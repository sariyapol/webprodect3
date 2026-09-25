-- MUT Shuttle Bus System - Oracle Database 19c/21c/23ai compatible
-- Run in Oracle SQL Developer with F5 (Run Script) while connected to your own schema.
SET DEFINE OFF;
SET SERVEROUTPUT ON;

-- Clean old objects (safe to re-run)
BEGIN
  FOR x IN (SELECT object_name, object_type FROM user_objects WHERE object_name IN (
    'V_ROUTE_TOTALS','V_ROUTE_STOP_TIMES','V_TRIP_STOP_TIMES','V_TRIP_SEATS','V_BOOKING_ITEM_SEGMENTS','V_BOOKING_ITEM_TIMES',
    'TRG_TRIPS_BIU','TRG_ITEMS_BIU','SP_CREATE_BOOKING','SP_CANCEL_BOOKING_ITEM','SP_START_TRIP','SP_CHECKIN','SP_CLOSE_TRIP',
    'BOOKING_ITEMS','BOOKINGS','TRIPS','ROUTE_STOPS','PERMISSIONS','EMPLOYEES','USERS','VEHICLES','VEHICLE_TYPES','ROUTES','STOPS','SCREENS','POSITIONS','DEPARTMENTS')) LOOP
    BEGIN
      IF x.object_type='TABLE' THEN EXECUTE IMMEDIATE 'DROP TABLE '||x.object_name||' CASCADE CONSTRAINTS PURGE';
      ELSIF x.object_type='VIEW' THEN EXECUTE IMMEDIATE 'DROP VIEW '||x.object_name;
      ELSIF x.object_type='TRIGGER' THEN EXECUTE IMMEDIATE 'DROP TRIGGER '||x.object_name;
      ELSIF x.object_type='PROCEDURE' THEN EXECUTE IMMEDIATE 'DROP PROCEDURE '||x.object_name;
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END;
/

CREATE TABLE departments (
  department_id VARCHAR2(10) PRIMARY KEY,
  department_name VARCHAR2(100) NOT NULL
);
CREATE TABLE positions (
  position_id VARCHAR2(10) PRIMARY KEY,
  position_name VARCHAR2(100) NOT NULL
);
CREATE TABLE screens (
  screen_id VARCHAR2(10) PRIMARY KEY,
  screen_name VARCHAR2(100) NOT NULL
);
CREATE TABLE users (
  user_id VARCHAR2(10) PRIMARY KEY,
  name VARCHAR2(100) NOT NULL,
  email VARCHAR2(150) NOT NULL UNIQUE,
  username VARCHAR2(50) NOT NULL UNIQUE,
  password_hash VARCHAR2(255) NOT NULL,
  department_id VARCHAR2(10) NOT NULL REFERENCES departments(department_id)
);
CREATE TABLE employees (
  user_id VARCHAR2(10) PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  phone VARCHAR2(20) NOT NULL,
  position_id VARCHAR2(10) NOT NULL REFERENCES positions(position_id)
);
CREATE TABLE permissions (
  permission_id VARCHAR2(10) PRIMARY KEY,
  can_add NUMBER(1) DEFAULT 0 NOT NULL CHECK(can_add IN(0,1)),
  can_edit NUMBER(1) DEFAULT 0 NOT NULL CHECK(can_edit IN(0,1)),
  can_delete NUMBER(1) DEFAULT 0 NOT NULL CHECK(can_delete IN(0,1)),
  position_id VARCHAR2(10) NOT NULL REFERENCES positions(position_id) ON DELETE CASCADE,
  screen_id VARCHAR2(10) NOT NULL REFERENCES screens(screen_id) ON DELETE CASCADE,
  CONSTRAINT uq_perm_position_screen UNIQUE(position_id,screen_id)
);
CREATE TABLE vehicle_types (
  vehicle_type_id VARCHAR2(10) PRIMARY KEY,
  type_name VARCHAR2(50) NOT NULL,
  description VARCHAR2(255),
  seat_count NUMBER(4) NOT NULL CHECK(seat_count>0)
);
CREATE TABLE vehicles (
  vehicle_id VARCHAR2(10) PRIMARY KEY,
  plate_no VARCHAR2(20) NOT NULL UNIQUE,
  status VARCHAR2(30) DEFAULT 'พร้อมใช้งาน' NOT NULL CHECK(status IN('พร้อมใช้งาน','ซ่อมบำรุง','ไม่พร้อมใช้งาน')),
  vehicle_type_id VARCHAR2(10) NOT NULL REFERENCES vehicle_types(vehicle_type_id)
);
CREATE TABLE routes (
  route_id VARCHAR2(10) PRIMARY KEY,
  route_name VARCHAR2(100) NOT NULL
);
CREATE TABLE stops (
  stop_id VARCHAR2(10) PRIMARY KEY,
  stop_name VARCHAR2(150) NOT NULL
);
CREATE TABLE route_stops (
  route_id VARCHAR2(10) NOT NULL REFERENCES routes(route_id) ON DELETE CASCADE,
  stop_order NUMBER(4) NOT NULL CHECK(stop_order>=1),
  stop_id VARCHAR2(10) NOT NULL REFERENCES stops(stop_id),
  travel_minutes NUMBER(5) DEFAULT 0 NOT NULL CHECK(travel_minutes>=0),
  CONSTRAINT pk_route_stops PRIMARY KEY(route_id,stop_order)
);
CREATE INDEX ix_route_stops_stop ON route_stops(stop_id);
CREATE TABLE trips (
  trip_id VARCHAR2(10) PRIMARY KEY,
  trip_date DATE NOT NULL,
  depart_time TIMESTAMP NOT NULL,
  status VARCHAR2(30) DEFAULT 'เปิด' NOT NULL CHECK(status IN('เปิด','กำลังเดินทาง','เสร็จสิ้น','ยกเลิก')),
  seat_count NUMBER(4) DEFAULT 0 NOT NULL,
  vehicle_id VARCHAR2(10) NOT NULL REFERENCES vehicles(vehicle_id),
  route_id VARCHAR2(10) NOT NULL REFERENCES routes(route_id),
  driver_id VARCHAR2(10) NOT NULL REFERENCES employees(user_id)
);
CREATE INDEX ix_trips_date ON trips(trip_date,depart_time);
CREATE TABLE bookings (
  booking_id VARCHAR2(10) PRIMARY KEY,
  booked_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  user_id VARCHAR2(10) NOT NULL REFERENCES users(user_id)
);
CREATE TABLE booking_items (
  booking_item_id VARCHAR2(10) PRIMARY KEY,
  qr_code VARCHAR2(64) NOT NULL UNIQUE,
  status VARCHAR2(30) DEFAULT 'ยืนยัน' NOT NULL CHECK(status IN('ยืนยัน','Check-in แล้ว','ยกเลิก','No Show')),
  seats NUMBER(2) NOT NULL CHECK(seats BETWEEN 1 AND 4),
  checkin_at TIMESTAMP,
  booking_id VARCHAR2(10) NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
  trip_id VARCHAR2(10) NOT NULL REFERENCES trips(trip_id),
  board_stop_id VARCHAR2(10) NOT NULL REFERENCES stops(stop_id),
  alight_stop_id VARCHAR2(10) NOT NULL REFERENCES stops(stop_id),
  CONSTRAINT ck_items_stops CHECK(board_stop_id<>alight_stop_id)
);
CREATE INDEX ix_items_trip ON booking_items(trip_id,status);

CREATE OR REPLACE VIEW v_route_totals AS
SELECT r.route_id,r.route_name,COUNT(rs.stop_order) stop_count,NVL(SUM(rs.travel_minutes),0) total_minutes
FROM routes r LEFT JOIN route_stops rs ON rs.route_id=r.route_id GROUP BY r.route_id,r.route_name;

CREATE OR REPLACE VIEW v_route_stop_times AS
SELECT rs.route_id,rs.stop_order,rs.stop_id,s.stop_name,rs.travel_minutes,
       SUM(rs.travel_minutes) OVER(PARTITION BY rs.route_id ORDER BY rs.stop_order ROWS UNBOUNDED PRECEDING) cum_minutes
FROM route_stops rs JOIN stops s ON s.stop_id=rs.stop_id;

CREATE OR REPLACE VIEW v_trip_stop_times AS
SELECT t.trip_id,t.trip_date,t.depart_time,t.route_id,st.stop_order,st.stop_id,st.stop_name,st.cum_minutes,
       t.depart_time + NUMTODSINTERVAL(st.cum_minutes,'MINUTE') arrive_at
FROM trips t JOIN v_route_stop_times st ON st.route_id=t.route_id;

CREATE OR REPLACE VIEW v_trip_seats AS
SELECT t.trip_id,t.seat_count,
       NVL(SUM(CASE WHEN bi.status<>'ยกเลิก' THEN bi.seats ELSE 0 END),0) booked_seats,
       t.seat_count-NVL(SUM(CASE WHEN bi.status<>'ยกเลิก' THEN bi.seats ELSE 0 END),0) remaining_seats
FROM trips t LEFT JOIN booking_items bi ON bi.trip_id=t.trip_id GROUP BY t.trip_id,t.seat_count;

CREATE OR REPLACE VIEW v_booking_item_segments AS
SELECT bi.booking_item_id,bi.booking_id,bi.trip_id,bi.status,bi.seats,bi.checkin_at,bi.board_stop_id,bi.alight_stop_id,t.route_id,
 (SELECT MIN(a.stop_order) FROM route_stops a WHERE a.route_id=t.route_id AND a.stop_id=bi.board_stop_id) board_order,
 (SELECT MIN(b.stop_order) FROM route_stops b WHERE b.route_id=t.route_id AND b.stop_id=bi.alight_stop_id AND b.stop_order>
   (SELECT MIN(a2.stop_order) FROM route_stops a2 WHERE a2.route_id=t.route_id AND a2.stop_id=bi.board_stop_id)) alight_order
FROM booking_items bi JOIN trips t ON t.trip_id=bi.trip_id;

CREATE OR REPLACE VIEW v_booking_item_times AS
SELECT sg.*,u.user_id,u.name passenger_name,tb.arrive_at board_at,ta.arrive_at alight_at
FROM v_booking_item_segments sg JOIN bookings b ON b.booking_id=sg.booking_id JOIN users u ON u.user_id=b.user_id
JOIN v_trip_stop_times tb ON tb.trip_id=sg.trip_id AND tb.stop_order=sg.board_order
LEFT JOIN v_trip_stop_times ta ON ta.trip_id=sg.trip_id AND ta.stop_order=sg.alight_order;

-- Triggers kept row-safe for Oracle (no query against the table currently being mutated).
CREATE OR REPLACE TRIGGER trg_trips_biu
BEFORE INSERT OR UPDATE ON trips FOR EACH ROW
DECLARE v_seats NUMBER; v_status VARCHAR2(30);
BEGIN
  SELECT vt.seat_count,v.status INTO v_seats,v_status FROM vehicles v JOIN vehicle_types vt ON vt.vehicle_type_id=v.vehicle_type_id WHERE v.vehicle_id=:NEW.vehicle_id;
  :NEW.seat_count:=v_seats;
  IF :NEW.status<>'ยกเลิก' AND v_status<>'พร้อมใช้งาน' THEN RAISE_APPLICATION_ERROR(-20001,'รถคันนี้ไม่อยู่ในสถานะพร้อมใช้งาน'); END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_items_biu
BEFORE INSERT OR UPDATE ON booking_items FOR EACH ROW
DECLARE v_ok NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_ok FROM trips t JOIN route_stops a ON a.route_id=t.route_id AND a.stop_id=:NEW.board_stop_id
  JOIN route_stops b ON b.route_id=t.route_id AND b.stop_id=:NEW.alight_stop_id AND b.stop_order>a.stop_order WHERE t.trip_id=:NEW.trip_id;
  IF v_ok=0 THEN RAISE_APPLICATION_ERROR(-20010,'จุดขึ้น/จุดลงไม่อยู่ในเส้นทาง หรือจุดลงอยู่ก่อนจุดขึ้น'); END IF;
END;
/

CREATE OR REPLACE PROCEDURE sp_create_booking(p_user VARCHAR2,p_trip VARCHAR2,p_board VARCHAR2,p_alight VARCHAR2,p_seats NUMBER,p_booking_id OUT VARCHAR2,p_item_id OUT VARCHAR2,p_qr OUT VARCHAR2) AS
  v_status VARCHAR2(30); v_board_at TIMESTAMP; v_n NUMBER; v_remaining NUMBER;
BEGIN
  IF p_seats<1 OR p_seats>4 THEN RAISE_APPLICATION_ERROR(-20020,'จองได้ 1-4 ที่นั่งต่อรายการ'); END IF;
  SELECT status INTO v_status FROM trips WHERE trip_id=p_trip FOR UPDATE;
  IF v_status<>'เปิด' THEN RAISE_APPLICATION_ERROR(-20021,'รอบนี้ไม่เปิดให้จอง'); END IF;
  SELECT remaining_seats INTO v_remaining FROM v_trip_seats WHERE trip_id=p_trip; IF p_seats>v_remaining THEN RAISE_APPLICATION_ERROR(-20023,'ที่นั่งว่างไม่พอสำหรับรอบนี้'); END IF;
  SELECT MIN(arrive_at) INTO v_board_at FROM v_trip_stop_times WHERE trip_id=p_trip AND stop_id=p_board;
  IF v_board_at IS NULL OR v_board_at<SYSTIMESTAMP+NUMTODSINTERVAL(20,'MINUTE') THEN RAISE_APPLICATION_ERROR(-20022,'ต้องจองก่อนรถถึงจุดขึ้นอย่างน้อย 20 นาที'); END IF;
  SELECT NVL(MAX(TO_NUMBER(SUBSTR(booking_id,2))),0)+1 INTO v_n FROM bookings; p_booking_id:='B'||LPAD(v_n,3,'0');
  INSERT INTO bookings VALUES(p_booking_id,SYSTIMESTAMP,p_user);
  SELECT NVL(MAX(TO_NUMBER(SUBSTR(booking_item_id,3))),0)+1 INTO v_n FROM booking_items; p_item_id:='BD'||LPAD(v_n,3,'0');
  p_qr:='QR-'||p_item_id||'-'||SUBSTR(RAWTOHEX(SYS_GUID()),1,8);
  INSERT INTO booking_items(booking_item_id,qr_code,status,seats,booking_id,trip_id,board_stop_id,alight_stop_id) VALUES(p_item_id,p_qr,'ยืนยัน',p_seats,p_booking_id,p_trip,p_board,p_alight);
  COMMIT;
END;
/
CREATE OR REPLACE PROCEDURE sp_cancel_booking_item(p_item VARCHAR2,p_user VARCHAR2) AS v_owner VARCHAR2(10); v_status VARCHAR2(30); v_checkin TIMESTAMP;
BEGIN
 SELECT b.user_id,bi.status,bi.checkin_at INTO v_owner,v_status,v_checkin FROM booking_items bi JOIN bookings b ON b.booking_id=bi.booking_id WHERE bi.booking_item_id=p_item;
 IF p_user IS NOT NULL AND v_owner<>p_user THEN RAISE_APPLICATION_ERROR(-20030,'ไม่สามารถยกเลิกรายการจองของผู้อื่นได้'); END IF;
 IF v_status<>'ยืนยัน' OR v_checkin IS NOT NULL THEN RAISE_APPLICATION_ERROR(-20031,'รายการนี้ยกเลิกไม่ได้'); END IF;
 UPDATE booking_items SET status='ยกเลิก' WHERE booking_item_id=p_item; COMMIT;
END;
/
CREATE OR REPLACE PROCEDURE sp_start_trip(p_trip VARCHAR2,p_driver VARCHAR2) AS v_count NUMBER;
BEGIN SELECT COUNT(*) INTO v_count FROM trips WHERE trip_id=p_trip AND driver_id=p_driver AND status='เปิด'; IF v_count=0 THEN RAISE_APPLICATION_ERROR(-20040,'เริ่มรอบนี้ไม่ได้'); END IF; UPDATE trips SET status='กำลังเดินทาง' WHERE trip_id=p_trip; COMMIT; END;
/
CREATE OR REPLACE PROCEDURE sp_checkin(p_qr VARCHAR2,p_trip VARCHAR2) AS v_item VARCHAR2(10); v_trip VARCHAR2(10); v_status VARCHAR2(30); v_checkin TIMESTAMP; v_ts VARCHAR2(30);
BEGIN
 SELECT status INTO v_status FROM trips WHERE trip_id=p_trip; IF v_status<>'กำลังเดินทาง' THEN RAISE_APPLICATION_ERROR(-20050,'กรุณาเริ่มการเดินทางก่อนสแกน QR'); END IF;
 SELECT booking_item_id,trip_id,status,checkin_at INTO v_item,v_trip,v_status,v_checkin FROM booking_items WHERE qr_code=p_qr;
 IF v_trip<>p_trip THEN RAISE_APPLICATION_ERROR(-20051,'QR Code นี้ไม่ตรงกับรอบการเดินทาง'); ELSIF v_status='ยกเลิก' THEN RAISE_APPLICATION_ERROR(-20052,'รายการจองนี้ถูกยกเลิกแล้ว'); ELSIF v_checkin IS NOT NULL THEN RAISE_APPLICATION_ERROR(-20053,'รายการจองนี้ Check-in แล้ว'); END IF;
 UPDATE booking_items SET checkin_at=SYSTIMESTAMP,status='Check-in แล้ว' WHERE booking_item_id=v_item; COMMIT;
EXCEPTION WHEN NO_DATA_FOUND THEN RAISE_APPLICATION_ERROR(-20054,'ไม่พบ QR Code นี้ในระบบ');
END;
/
CREATE OR REPLACE PROCEDURE sp_close_trip(p_trip VARCHAR2) AS v_status VARCHAR2(30);
BEGIN SELECT status INTO v_status FROM trips WHERE trip_id=p_trip FOR UPDATE; IF v_status<>'กำลังเดินทาง' THEN RAISE_APPLICATION_ERROR(-20060,'ปิดงานได้เฉพาะรอบที่กำลังเดินทาง'); END IF; UPDATE booking_items SET status='No Show' WHERE trip_id=p_trip AND status='ยืนยัน' AND checkin_at IS NULL; UPDATE trips SET status='เสร็จสิ้น' WHERE trip_id=p_trip; COMMIT; END;
/

PROMPT === Seed data ===
INSERT INTO departments VALUES('D001','ฝ่ายบุคคล');
INSERT INTO departments VALUES('D002','ฝ่ายปฏิบัติการ');
INSERT INTO departments VALUES('D003','ฝ่ายบัญชี');
INSERT INTO positions VALUES('P01','Admin'); INSERT INTO positions VALUES('P02','พนักงาน'); INSERT INTO positions VALUES('P03','คนขับ');
BEGIN FOR i IN 1..12 LOOP INSERT INTO screens VALUES('SC'||LPAD(i,2,'0'),CASE i WHEN 1 THEN 'จัดการรถ' WHEN 2 THEN 'จัดการการจอง' WHEN 3 THEN 'จัดการประเภทรถ' WHEN 4 THEN 'จัดการจุดจอด' WHEN 5 THEN 'จัดการเส้นทาง' WHEN 6 THEN 'จัดการรอบการเดินรถ' WHEN 7 THEN 'จัดการผู้ใช้งาน/พนักงาน' WHEN 8 THEN 'จัดการแผนก' WHEN 9 THEN 'จัดการตำแหน่ง' WHEN 10 THEN 'จัดการหน้าจอและสิทธิ์' WHEN 11 THEN 'รายงาน' ELSE 'งานคนขับ' END); END LOOP; END;
/
INSERT INTO users VALUES('U001','สมชาย ใจดี','somchai@mail.com','somchai','1234','D001');
INSERT INTO users VALUES('U002','สมหญิง มีสุข','somying@mail.com','admin','1234','D002');
INSERT INTO users VALUES('U003','สมศักดิ์ รักงาน','somsak@mail.com','somsak','1234','D002');
INSERT INTO users VALUES('U004','วิชัย ขับดี','wichai@mail.com','wichai','1234','D002');
INSERT INTO users VALUES('U005','อำนาจ ตรงเวลา','amnat@mail.com','amnat','1234','D002');
INSERT INTO users VALUES('U006','มานี มีนา','mani@mail.com','mani','1234','D003');
INSERT INTO users VALUES('U007','ปิติ ชูใจ','piti@mail.com','piti','1234','D003');
INSERT INTO users VALUES('U008','วีระ กล้าหาญ','weera@mail.com','weera','1234','D001');
INSERT INTO employees VALUES('U001','0811111111','P02'); INSERT INTO employees VALUES('U002','0822222222','P01'); INSERT INTO employees VALUES('U003','0833333333','P03'); INSERT INTO employees VALUES('U004','0844444444','P03'); INSERT INTO employees VALUES('U005','0855555555','P03');
DECLARE n NUMBER:=0; BEGIN FOR i IN 1..11 LOOP n:=n+1; INSERT INTO permissions VALUES('PR'||LPAD(n,3,'0'),1,1,1,'P01','SC'||LPAD(i,2,'0')); END LOOP; n:=n+1; INSERT INTO permissions VALUES('PR'||LPAD(n,3,'0'),0,0,0,'P02','SC01'); n:=n+1; INSERT INTO permissions VALUES('PR'||LPAD(n,3,'0'),0,1,0,'P02','SC02'); n:=n+1; INSERT INTO permissions VALUES('PR'||LPAD(n,3,'0'),0,0,0,'P02','SC06'); n:=n+1; INSERT INTO permissions VALUES('PR'||LPAD(n,3,'0'),0,0,0,'P02','SC11'); n:=n+1; INSERT INTO permissions VALUES('PR'||LPAD(n,3,'0'),0,1,0,'P03','SC12'); END;
/
INSERT INTO vehicle_types VALUES('T01','รถตู้','รถโดยสารขนาดเล็ก',12); INSERT INTO vehicle_types VALUES('T02','รถบัส','รถโดยสารขนาดใหญ่',40);
INSERT INTO vehicles VALUES('V001','กข 1234','พร้อมใช้งาน','T01'); INSERT INTO vehicles VALUES('V002','สย 2591','พร้อมใช้งาน','T01'); INSERT INTO vehicles VALUES('V003','ขค 5566','พร้อมใช้งาน','T02'); INSERT INTO vehicles VALUES('V004','ฮก 7788','ซ่อมบำรุง','T01');
INSERT INTO stops VALUES('S001','มหาวิทยาลัยเทคโนโลยีมหานคร'); INSERT INTO stops VALUES('S002','โลตัสหนองจอก'); INSERT INTO stops VALUES('S003','โรงพยาบาลหนองจอก'); INSERT INTO stops VALUES('S004','Big C หนองจอก');
INSERT INTO routes VALUES('R001','เส้นทาง 1');
INSERT INTO route_stops VALUES('R001',1,'S001',0); INSERT INTO route_stops VALUES('R001',2,'S002',5); INSERT INTO route_stops VALUES('R001',3,'S003',3); INSERT INTO route_stops VALUES('R001',4,'S004',6); INSERT INTO route_stops VALUES('R001',5,'S003',3); INSERT INTO route_stops VALUES('R001',6,'S002',3); INSERT INTO route_stops VALUES('R001',7,'S001',10);
-- Demo trips are relative to SYSDATE so the website remains usable later.
INSERT INTO trips(trip_id,trip_date,depart_time,status,seat_count,vehicle_id,route_id,driver_id) VALUES('TR0001',TRUNC(SYSDATE)+1,TO_TIMESTAMP(TO_CHAR(TRUNC(SYSDATE)+1,'YYYY-MM-DD')||' 09:30','YYYY-MM-DD HH24:MI'),'เปิด',12,'V002','R001','U003');
INSERT INTO trips(trip_id,trip_date,depart_time,status,seat_count,vehicle_id,route_id,driver_id) VALUES('TR0002',TRUNC(SYSDATE)+1,TO_TIMESTAMP(TO_CHAR(TRUNC(SYSDATE)+1,'YYYY-MM-DD')||' 13:30','YYYY-MM-DD HH24:MI'),'เปิด',40,'V003','R001','U005');
INSERT INTO trips(trip_id,trip_date,depart_time,status,seat_count,vehicle_id,route_id,driver_id) VALUES('TR0003',TRUNC(SYSDATE)+2,TO_TIMESTAMP(TO_CHAR(TRUNC(SYSDATE)+2,'YYYY-MM-DD')||' 09:30','YYYY-MM-DD HH24:MI'),'เปิด',12,'V001','R001','U004');
INSERT INTO bookings VALUES('B001',SYSTIMESTAMP,'U006');
INSERT INTO booking_items VALUES('BD001','QR-BD001-DEMO0001','ยืนยัน',2,NULL,'B001','TR0001','S002','S004');
COMMIT;

PROMPT === Installation check ===
SELECT 'TABLES' kind, COUNT(*) qty FROM user_tables WHERE table_name IN ('USERS','EMPLOYEES','TRIPS','BOOKINGS','BOOKING_ITEMS')
UNION ALL SELECT 'VIEWS',COUNT(*) FROM user_views WHERE view_name LIKE 'V_%'
UNION ALL SELECT 'TRIGGERS',COUNT(*) FROM user_triggers WHERE trigger_name LIKE 'TRG_%'
UNION ALL SELECT 'PROCEDURES',COUNT(*) FROM user_procedures WHERE object_name LIKE 'SP_%';
SELECT username,name FROM users ORDER BY user_id;
PROMPT === DONE: MUT Shuttle Oracle installed ===
