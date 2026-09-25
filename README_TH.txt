MUT SHUTTLE BUS SYSTEM - ORACLE EDITION
=======================================

ไฟล์สำคัญ
1) 01_mut_shuttle_oracle.sql  = ฐานข้อมูล Oracle ทั้งระบบ
2) server.js                  = Backend Node.js เชื่อม Oracle
3) web/                       = หน้าเว็บ User / Driver / Admin
4) START_SERVER.bat           = ตัวเปิดเว็บเซิร์ฟเวอร์

A. ติดตั้งฐานข้อมูลใน Oracle SQL Developer
-------------------------------------------
1. เปิด Oracle SQL Developer
2. ดับเบิลคลิก Connection ของคุณ เช่น LAB04hw
3. File > Open > เลือก 01_mut_shuttle_oracle.sql
4. ตรวจช่อง Connection ด้านบนให้เป็น LAB04hw
5. กด F5 (Run Script) ไม่ใช่ Ctrl+Enter
6. ด้านล่าง Script Output ต้องลงท้ายด้วย
   DONE: MUT Shuttle Oracle installed
7. Refresh Tables / Views ทางซ้าย จะเห็นตารางของระบบ

หมายเหตุ: Oracle ไม่มีคำสั่ง CREATE DATABASE แบบ MySQL ใน schema งานนักศึกษา
ดังนั้นไฟล์นี้สร้าง Tables/Views/Triggers/Procedures ภายใน Connection ที่คุณล็อกอินอยู่

B. เปิดเว็บไซต์
---------------
ต้องมี Node.js ก่อน (เช็กใน Command Prompt: node -v)

1. ดับเบิลคลิก START_SERVER.bat
2. กรอก Oracle Username เดียวกับ SQL Developer เช่น LAB04HW
3. กรอก Password เดียวกับ Connection
4. Connect String ให้ใช้ค่าของ Connection ใน SQL Developer
   ตัวอย่าง: localhost:1521/XEPDB1
5. ครั้งแรกระบบจะ npm install ให้อัตโนมัติ
6. เมื่อขึ้น MUT Shuttle: http://localhost:3000
   เปิด Chrome แล้วเข้า http://localhost:3000

ทดสอบฐานข้อมูลก่อน:
http://localhost:3000/api/health
ถ้าขึ้น {"ok":true,...} = เว็บเชื่อม Oracle สำเร็จ

บัญชีทดลอง (password 1234)
--------------------------
User:     mani / 1234
Staff:    somchai / 1234
Driver:   somsak / 1234
Admin:    admin / 1234

โครงสร้างระบบ
-------------
User: ค้นหารอบ, เลือกจุดขึ้น/ลง, จอง 1-4 ที่นั่ง, QR, ประวัติ, ยกเลิก
Driver: งานวันนี้, เริ่มเดินทาง, QR Check-in, ปิดงาน, No Show, ประวัติ
Admin: Dashboard, Users/Employees, Departments, Positions, Permissions,
       Vehicle Types, Vehicles, Stops, Routes, Trips, Bookings, Reports

การทำงานกับฐานข้อมูล
---------------------
- ตอนเปิดเว็บ server จะโหลดข้อมูลจาก Oracle ผ่าน /api/bootstrap
- เมื่อหน้าเว็บเพิ่ม/แก้ไข/ลบ ระบบ sync กลับ Oracle ผ่าน /api/sync
- Session login เก็บเฉพาะ user id ใน browser; ข้อมูลระบบหลักมาจาก Oracle

ถ้าเปิดเว็บไม่ได้
----------------
1. เช็ก Oracle Database service ว่าทำงาน
2. ใน SQL Developer ต้อง Connect ได้ก่อน
3. เปิด http://localhost:3000/api/health
4. ถ้า ORA-01017 = username/password ผิด
5. ถ้า ORA-12514/12541 = service name/port ไม่ตรง
6. ดู Host / Port / Service name จาก Properties ของ Connection ใน SQL Developer

คำเตือนสำหรับงานสาธิต
---------------------
password_hash ในข้อมูลตัวอย่างเก็บ 1234 เพื่อให้ตรวจงานง่ายเท่านั้น
ระบบจริงควร hash password ด้วย bcrypt/Argon2 และใช้ API login/session ฝั่ง server
