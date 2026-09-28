'use strict';

const express = require('express');
const oracledb = require('oracledb');
const path = require('path');

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.fetchAsString = [oracledb.CLOB];

const cfg = {
  user: process.env.ORACLE_USER || 'LAB04HW',
  password: process.env.ORACLE_PASSWORD || '',
  connectString: process.env.ORACLE_CONNECT_STRING || 'localhost:1521/XEPDB1'
};

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'web')));


// ======================================================
// HELPERS
// ======================================================

async function q(c, sql, binds = {}) {
  const result = await c.execute(sql, binds);
  return result.rows;
}

async function many(c, sql, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return;

  for (const row of rows) {
    const cleaned = {};

    for (const [key, value] of Object.entries(row)) {
      if (value === undefined || value === '') {
        cleaned[key] = null;
      } else if (typeof value === 'boolean') {
        cleaned[key] = value ? 1 : 0;
      } else {
        cleaned[key] = value;
      }
    }

    await c.execute(sql, cleaned, { autoCommit: false });
  }
}


// ======================================================
// AUTO FUTURE TRIPS
// สร้างรอบรถอัตโนมัติล่วงหน้า 30 วัน
// สลับ 2 รอบ / 3 รอบ
// ไม่ลบรอบเดิม
// ======================================================

async function ensureFutureTrips(c, daysAhead = 30) {

  const routes = await q(
    c,
    `
    SELECT route_id ID
    FROM routes
    ORDER BY route_id
    `
  );

  if (!routes.length) {
    console.log('AUTO TRIPS: NO ROUTES');
    return;
  }

  const routeId =
    routes.some(r => r.ID === 'R001')
      ? 'R001'
      : routes[0].ID;


  const vehicles = await q(
    c,
    `
    SELECT
      v.vehicle_id ID,
      vt.seat_count SEATS
    FROM vehicles v
    JOIN vehicle_types vt
      ON vt.vehicle_type_id = v.vehicle_type_id
    ORDER BY v.vehicle_id
    `
  );

  if (!vehicles.length) {
    console.log('AUTO TRIPS: NO VEHICLES');
    return;
  }


  const employees = await q(
    c,
    `
    SELECT user_id ID
    FROM employees
    ORDER BY user_id
    `
  );


  const preferredVehicles =
    ['V001', 'V002', 'V003']
      .map(id =>
        vehicles.find(v => v.ID === id)
      )
      .filter(Boolean);


  const usableVehicles =
    preferredVehicles.length
      ? preferredVehicles
      : vehicles;


  const preferredDrivers =
    ['U003', 'U004', 'U005']
      .filter(id =>
        employees.some(e => e.ID === id)
      );


  const usableDrivers =
    preferredDrivers.length
      ? preferredDrivers
      : employees.map(e => e.ID);


  const maxResult = await c.execute(`
    SELECT
      NVL(
        MAX(
          TO_NUMBER(
            REGEXP_SUBSTR(
              trip_id,
              '[0-9]+'
            )
          )
        ),
        0
      ) MAXNO
    FROM trips
    WHERE REGEXP_LIKE(
      trip_id,
      '^TR[0-9]+$'
    )
  `);


  let nextNo =
    Number(
      maxResult.rows[0].MAXNO || 0
    ) + 1;


  /*
   * วันที่ฐาน
   *
   * 2026-09-28 = 2 รอบ
   * 2026-09-29 = 3 รอบ
   * 2026-09-30 = 2 รอบ
   * 2026-10-01 = 3 รอบ
   *
   * แล้วสลับแบบนี้ต่อไป
   */

  const base =
    new Date(
      2026,
      8,
      28
    );

  base.setHours(
    0,
    0,
    0,
    0
  );


  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );


  for (
    let offset = 0;
    offset <= daysAhead;
    offset++
  ) {

    const d =
      new Date(today);

    d.setDate(
      today.getDate() + offset
    );


    const yyyy =
      d.getFullYear();

    const mm =
      String(
        d.getMonth() + 1
      ).padStart(2, '0');

    const dd =
      String(
        d.getDate()
      ).padStart(2, '0');


    const dateText =
      `${yyyy}-${mm}-${dd}`;


    const diffDays =
      Math.round(
        (
          d.getTime() -
          base.getTime()
        ) /
        86400000
      );


    const twoRounds =
      Math.abs(diffDays) % 2 === 0;


    /*
     * วัน 2 รอบ
     *
     * 09:30
     * 13:30
     *
     * วัน 3 รอบ
     *
     * 08:30
     * 12:00
     * 16:00
     */

    const slots =
      twoRounds
        ? [
            {
              time: '09:30',
              vehicle: 1,
              driver: 0
            },
            {
              time: '13:30',
              vehicle: 2,
              driver: 2
            }
          ]
        : [
            {
              time: '08:30',
              vehicle: 0,
              driver: 1
            },
            {
              time: '12:00',
              vehicle: 1,
              driver: 0
            },
            {
              time: '16:00',
              vehicle: 2,
              driver: 2
            }
          ];


    const existing =
      await q(
        c,
        `
        SELECT
          TO_CHAR(
            depart_time,
            'HH24:MI'
          ) DEP
        FROM trips
        WHERE TRUNC(trip_date) =
          TO_DATE(
            :datex,
            'YYYY-MM-DD'
          )
        ORDER BY depart_time
        `,
        {
          datex: dateText
        }
      );


    /*
     * ถ้ามีจำนวนรอบครบแล้ว
     * ไม่ต้องสร้างอะไรเพิ่ม
     */

    if (
      existing.length >=
      slots.length
    ) {
      continue;
    }


    const existingTimes =
      new Set(
        existing.map(
          x => x.DEP
        )
      );


    let currentCount =
      existing.length;


    for (
      let i = 0;
      i < slots.length &&
      currentCount < slots.length;
      i++
    ) {

      const slot =
        slots[i];


      /*
       * ถ้าเวลานี้มีอยู่แล้ว
       * ไม่สร้างซ้ำ
       */

      if (
        existingTimes.has(
          slot.time
        )
      ) {
        continue;
      }


      const vehicle =
        usableVehicles[
          slot.vehicle %
          usableVehicles.length
        ];


      const driverId =
        usableDrivers.length
          ? usableDrivers[
              slot.driver %
              usableDrivers.length
            ]
          : null;


      const tripId =
        'TR' +
        String(
          nextNo++
        ).padStart(
          4,
          '0'
        );


      /*
       * seatCount = ความจุรถทั้งหมด
       *
       * เช่น 12 หรือ 40
       *
       * จำนวนที่นั่งคงเหลือ
       * จะไปคำนวณจาก Booking
       */

      const seatCount =
        Number(
          vehicle.SEATS || 0
        );


      await c.execute(
        `
        INSERT INTO trips (
          trip_id,
          trip_date,
          depart_time,
          status,
          seat_count,
          vehicle_id,
          route_id,
          driver_id
        )
        VALUES (
          :tripId,

          TO_DATE(
            :datex,
            'YYYY-MM-DD'
          ),

          TO_TIMESTAMP(
            '2000-01-01 ' || :dep,
            'YYYY-MM-DD HH24:MI'
          ),

          'OPEN',
          :seatCount,
          :vehicleId,
          :routeId,
          :driverId
        )
        `,
        {
          tripId,
          datex: dateText,
          dep: slot.time,
          seatCount,
          vehicleId: vehicle.ID,
          routeId,
          driverId
        },
        {
          autoCommit: false
        }
      );


      existingTimes.add(
        slot.time
      );

      currentCount++;


      console.log(
        'AUTO TRIP CREATED:',
        tripId,
        dateText,
        slot.time
      );
    }
  }


  await c.commit();

  console.log(
    'AUTO FUTURE TRIPS READY'
  );
}


// ======================================================
// HEALTH
// ======================================================

app.get('/api/health', async (req, res) => {
  let c;

  try {
    c = await oracledb.getConnection(cfg);

    const r = await c.execute(`
      SELECT
        user AS USERNAME,
        sys_context('USERENV','SERVICE_NAME') AS SERVICE_NAME
      FROM dual
    `);

    res.json({
      ok: true,
      db: r.rows[0]
    });

  } catch (e) {

    console.error('HEALTH ERROR:', e);

    res.status(500).json({
      ok: false,
      error: e.message
    });

  } finally {
    if (c) await c.close();
  }
});


// ======================================================
// BOOTSTRAP
// ======================================================

app.get('/api/bootstrap', async (req, res) => {
  let c;

  try {

    c = await oracledb.getConnection(cfg);

    /*
     * ทุกครั้งที่เว็บโหลดข้อมูล
     * ตรวจสอบรอบรถวันนี้ถึง 30 วันข้างหน้า
     */
    await ensureFutureTrips(c, 30);


    const [
      departments,
      positions,
      screens,
      users,
      employees,
      permissions,
      vehicleTypes,
      vehicles,
      stops,
      routes,
      routeStops,
      trips,
      bookings,
      bookingItems
    ] = await Promise.all([

      q(c, `
        SELECT
          department_id ID,
          department_name NAME
        FROM departments
        ORDER BY department_id
      `),

      q(c, `
        SELECT
          position_id ID,
          position_name NAME
        FROM positions
        ORDER BY position_id
      `),

      q(c, `
        SELECT
          screen_id ID,
          screen_name NAME
        FROM screens
        ORDER BY screen_id
      `),

      q(c, `
        SELECT
          user_id ID,
          name NAME,
          email EMAIL,
          username USERNAME,
          password_hash PASSWORD,
          department_id DEPTID
        FROM users
        ORDER BY user_id
      `),

      q(c, `
        SELECT
          user_id ID,
          phone PHONE,
          position_id POSITIONID
        FROM employees
      `),

      q(c, `
        SELECT
          permission_id ID,
          position_id POSITIONID,
          screen_id SCREENID,
          can_add ADDX,
          can_edit EDITX,
          can_delete DELX
        FROM permissions
        ORDER BY permission_id
      `),

      q(c, `
        SELECT
          vehicle_type_id ID,
          type_name NAME,
          description DETAIL,
          seat_count SEATS
        FROM vehicle_types
        ORDER BY vehicle_type_id
      `),

      q(c, `
        SELECT
          vehicle_id ID,
          plate_no PLATE,
          status STATUS,
          vehicle_type_id TYPEID
        FROM vehicles
        ORDER BY vehicle_id
      `),

      q(c, `
        SELECT
          stop_id ID,
          stop_name NAME
        FROM stops
        ORDER BY stop_id
      `),

      q(c, `
        SELECT
          route_id ID,
          route_name NAME
        FROM routes
        ORDER BY route_id
      `),

      q(c, `
        SELECT
          route_id ROUTEID,
          stop_order SEQ,
          stop_id STOPID,
          travel_minutes MINUTES
        FROM route_stops
        ORDER BY route_id, stop_order
      `),

      q(c, `
        SELECT
          trip_id ID,
          TO_CHAR(trip_date,'YYYY-MM-DD') "DATE",
          TO_CHAR(depart_time,'HH24:MI') DEP,
          status STATUS,
          seat_count SEATCOUNT,
          vehicle_id VEHICLEID,
          route_id ROUTEID,
          driver_id DRIVERID
        FROM trips
        ORDER BY trip_date, depart_time
      `),

      q(c, `
        SELECT
          booking_id ID,
          TO_CHAR(booked_at,'YYYY-MM-DD HH24:MI') CREATED,
          user_id USERID
        FROM bookings
        ORDER BY booked_at
      `),

      q(c, `
        SELECT
          booking_item_id ID,
          qr_code QR,
          status STATUS,
          seats SEATS,
          TO_CHAR(checkin_at,'YYYY-MM-DD HH24:MI') CHECKIN,
          booking_id BOOKINGID,
          trip_id TRIPID,
          board_stop_id BOARD,
          alight_stop_id ALIGHT
        FROM booking_items
        ORDER BY booking_item_id
      `)
    ]);


    const emp = Object.fromEntries(
      employees.map(x => [x.ID, x])
    );


    const jsUsers = users.map(x => ({
      id: x.ID,
      name: x.NAME,
      email: x.EMAIL,
      username: x.USERNAME,
      password: x.PASSWORD,
      deptId: x.DEPTID,

      positionId:
        emp[x.ID]?.POSITIONID || '',

      employee:
        emp[x.ID]
          ? {
              phone: emp[x.ID].PHONE
            }
          : null
    }));


    const db = {

      version: 5,

      departments:
        departments.map(x => ({
          id: x.ID,
          name: x.NAME
        })),

      positions:
        positions.map(x => ({
          id: x.ID,
          name: x.NAME
        })),

      screens:
        screens.map(x => ({
          id: x.ID,
          name: x.NAME
        })),

      users: jsUsers,

      permissions:
        permissions.map(x => ({
          id: x.ID,
          positionId: x.POSITIONID,
          screenId: x.SCREENID,
          add: Number(x.ADDX || 0),
          edit: Number(x.EDITX || 0),
          del: Number(x.DELX || 0)
        })),

      vehicleTypes:
        vehicleTypes.map(x => ({
          id: x.ID,
          name: x.NAME,
          detail: x.DETAIL || '',
          seats: Number(x.SEATS || 0)
        })),

      vehicles:
        vehicles.map(x => ({
          id: x.ID,
          plate: x.PLATE,
          status: x.STATUS,
          typeId: x.TYPEID
        })),

      stops:
        stops.map(x => ({
          id: x.ID,
          name: x.NAME
        })),

      routes:
        routes.map(x => ({
          id: x.ID,
          name: x.NAME
        })),

      routeStops:
        routeStops.map(x => ({
          routeId: x.ROUTEID,
          seq: Number(x.SEQ || 0),
          stopId: x.STOPID,
          minutes: Number(x.MINUTES || 0)
        })),

      trips:
        trips.map(x => ({
          id: x.ID,
          date: x.DATE,
          dep: x.DEP,
          status: x.STATUS,
          seatCount: Number(x.SEATCOUNT || 0),
          vehicleId: x.VEHICLEID,
          routeId: x.ROUTEID,
          driverId: x.DRIVERID || ''
        })),

      bookings:
        bookings.map(x => ({
          id: x.ID,
          createdAt: x.CREATED || '',
          userId: x.USERID
        })),

      bookingItems:
        bookingItems.map(x => ({
          id: x.ID,
          qr: x.QR,
          status: x.STATUS,
          seats: Number(x.SEATS || 0),
          checkin: x.CHECKIN || '',
          bookingId: x.BOOKINGID,
          tripId: x.TRIPID,
          boardStopId: x.BOARD,
          alightStopId: x.ALIGHT
        })),

      counters: {
        trip: trips.length,
        booking: bookings.length,
        item: bookingItems.length
      }
    };


    res.json({
      ok: true,
      db
    });

  } catch (e) {

    console.error('BOOTSTRAP ERROR:', e);

    res.status(500).json({
      ok: false,
      error: e.message
    });

  } finally {

    if (c) await c.close();
  }
});


// ======================================================
// SAFE SYNC
// ======================================================

app.post('/api/sync', async (req, res) => {

  const d = req.body && req.body.db;

  if (!d) {
    return res.status(400).json({
      ok: false,
      error: 'missing db'
    });
  }

  let c;

  try {

    c = await oracledb.getConnection(cfg);


    // ==================================================
    // DEPARTMENTS
    // ==================================================

    await many(
      c,
      `
      MERGE INTO departments t
      USING (
        SELECT
          :id AS department_id,
          :name AS department_name
        FROM dual
      ) s

      ON (
        t.department_id = s.department_id
      )

      WHEN MATCHED THEN
        UPDATE SET
          t.department_name = s.department_name

      WHEN NOT MATCHED THEN
        INSERT (
          department_id,
          department_name
        )
        VALUES (
          s.department_id,
          s.department_name
        )
      `,
      (d.departments || []).map(x => ({
        id: x.id,
        name: x.name
      }))
    );


    // ==================================================
    // POSITIONS
    // ==================================================

    await many(
      c,
      `
      MERGE INTO positions t
      USING (
        SELECT
          :id AS position_id,
          :name AS position_name
        FROM dual
      ) s

      ON (
        t.position_id = s.position_id
      )

      WHEN MATCHED THEN
        UPDATE SET
          t.position_name = s.position_name

      WHEN NOT MATCHED THEN
        INSERT (
          position_id,
          position_name
        )
        VALUES (
          s.position_id,
          s.position_name
        )
      `,
      (d.positions || []).map(x => ({
        id: x.id,
        name: x.name
      }))
    );


    // ==================================================
    // SCREENS
    // ==================================================

    await many(
      c,
      `
      MERGE INTO screens t
      USING (
        SELECT
          :id AS screen_id,
          :name AS screen_name
        FROM dual
      ) s

      ON (
        t.screen_id = s.screen_id
      )

      WHEN MATCHED THEN
        UPDATE SET
          t.screen_name = s.screen_name

      WHEN NOT MATCHED THEN
        INSERT (
          screen_id,
          screen_name
        )
        VALUES (
          s.screen_id,
          s.screen_name
        )
      `,
      (d.screens || []).map(x => ({
        id: x.id,
        name: x.name
      }))
    );


    // ==================================================
    // USERS
    // ==================================================

    await many(
      c,
      `
      MERGE INTO users t
      USING (
        SELECT
          :id AS user_id,
          :name AS name,
          :email AS email,
          :username AS username,
          :password AS password_hash,
          :deptId AS department_id
        FROM dual
      ) s

      ON (
        t.user_id = s.user_id
      )

      WHEN MATCHED THEN
        UPDATE SET
          t.name = s.name,
          t.email = s.email,
          t.username = s.username,
          t.password_hash = s.password_hash,
          t.department_id = s.department_id

      WHEN NOT MATCHED THEN
        INSERT (
          user_id,
          name,
          email,
          username,
          password_hash,
          department_id
        )
        VALUES (
          s.user_id,
          s.name,
          s.email,
          s.username,
          s.password_hash,
          s.department_id
        )
      `,
      (d.users || []).map(x => ({
        id: x.id,
        name: x.name,
        email: x.email,
        username: x.username,
        password: x.password,
        deptId: x.deptId
      }))
    );


    // ==================================================
    // EMPLOYEES
    // ==================================================

    await many(
      c,
      `
      MERGE INTO employees t
      USING (
        SELECT
          :id AS user_id,
          :phone AS phone,
          :positionId AS position_id
        FROM dual
      ) s

      ON (
        t.user_id = s.user_id
      )

      WHEN MATCHED THEN
        UPDATE SET
          t.phone = s.phone,
          t.position_id = s.position_id

      WHEN NOT MATCHED THEN
        INSERT (
          user_id,
          phone,
          position_id
        )
        VALUES (
          s.user_id,
          s.phone,
          s.position_id
        )
      `,
      (d.users || [])
        .filter(x => x.employee)
        .map(x => ({
          id: x.id,
          phone: x.employee?.phone || null,
          positionId: x.positionId || null
        }))
    );


    // ==================================================
    // PERMISSIONS
    // ==================================================

    await many(
      c,
      `
      MERGE INTO permissions t
      USING (
        SELECT
          :id AS permission_id,
          :canAdd AS can_add,
          :canEdit AS can_edit,
          :canDelete AS can_delete,
          :positionId AS position_id,
          :screenId AS screen_id
        FROM dual
      ) s

      ON (
        t.permission_id = s.permission_id
      )

      WHEN MATCHED THEN
        UPDATE SET
          t.can_add = s.can_add,
          t.can_edit = s.can_edit,
          t.can_delete = s.can_delete,
          t.position_id = s.position_id,
          t.screen_id = s.screen_id

      WHEN NOT MATCHED THEN
        INSERT (
          permission_id,
          can_add,
          can_edit,
          can_delete,
          position_id,
          screen_id
        )
        VALUES (
          s.permission_id,
          s.can_add,
          s.can_edit,
          s.can_delete,
          s.position_id,
          s.screen_id
        )
      `,
      (d.permissions || []).map(x => ({
        id: x.id,
        canAdd: Number(x.add || 0),
        canEdit: Number(x.edit || 0),
        canDelete: Number(x.del || 0),
        positionId: x.positionId,
        screenId: x.screenId
      }))
    );


    // ==================================================
    // VEHICLE TYPES
    // ==================================================

    await many(
      c,
      `
      MERGE INTO vehicle_types t
      USING (
        SELECT
          :id AS vehicle_type_id,
          :name AS type_name,
          :detail AS description,
          :seats AS seat_count
        FROM dual
      ) s

      ON (
        t.vehicle_type_id = s.vehicle_type_id
      )

      WHEN MATCHED THEN
        UPDATE SET
          t.type_name = s.type_name,
          t.description = s.description,
          t.seat_count = s.seat_count

      WHEN NOT MATCHED THEN
        INSERT (
          vehicle_type_id,
          type_name,
          description,
          seat_count
        )
        VALUES (
          s.vehicle_type_id,
          s.type_name,
          s.description,
          s.seat_count
        )
      `,
      (d.vehicleTypes || []).map(x => ({
        id: x.id,
        name: x.name,
        detail: x.detail || null,
        seats: Number(x.seats || 0)
      }))
    );


    // ==================================================
    // VEHICLES
    // ==================================================

    await many(
      c,
      `
      MERGE INTO vehicles t
      USING (
        SELECT
          :id AS vehicle_id,
          :plate AS plate_no,
          :status AS status,
          :typeId AS vehicle_type_id
        FROM dual
      ) s

      ON (
        t.vehicle_id = s.vehicle_id
      )

      WHEN MATCHED THEN
        UPDATE SET
          t.plate_no = s.plate_no,
          t.status = s.status,
          t.vehicle_type_id = s.vehicle_type_id

      WHEN NOT MATCHED THEN
        INSERT (
          vehicle_id,
          plate_no,
          status,
          vehicle_type_id
        )
        VALUES (
          s.vehicle_id,
          s.plate_no,
          s.status,
          s.vehicle_type_id
        )
      `,
      (d.vehicles || []).map(x => ({
        id: x.id,
        plate: x.plate,
        status: x.status,
        typeId: x.typeId
      }))
    );


    // ==================================================
    // STOPS
    // ==================================================

    await many(
      c,
      `
      MERGE INTO stops t
      USING (
        SELECT
          :id AS stop_id,
          :name AS stop_name
        FROM dual
      ) s

      ON (
        t.stop_id = s.stop_id
      )

      WHEN MATCHED THEN
        UPDATE SET
          t.stop_name = s.stop_name

      WHEN NOT MATCHED THEN
        INSERT (
          stop_id,
          stop_name
        )
        VALUES (
          s.stop_id,
          s.stop_name
        )
      `,
      (d.stops || []).map(x => ({
        id: x.id,
        name: x.name
      }))
    );


    // ==================================================
    // ROUTES
    // ==================================================

    await many(
      c,
      `
      MERGE INTO routes t
      USING (
        SELECT
          :id AS route_id,
          :name AS route_name
        FROM dual
      ) s

      ON (
        t.route_id = s.route_id
      )

      WHEN MATCHED THEN
        UPDATE SET
          t.route_name = s.route_name

      WHEN NOT MATCHED THEN
        INSERT (
          route_id,
          route_name
        )
        VALUES (
          s.route_id,
          s.route_name
        )
      `,
      (d.routes || []).map(x => ({
        id: x.id,
        name: x.name
      }))
    );


    // ==================================================
    // ROUTE STOPS
    // ==================================================

    await many(
      c,
      `
      MERGE INTO route_stops t
      USING (
        SELECT
          :routeId AS route_id,
          :seq AS stop_order,
          :stopId AS stop_id,
          :minutes AS travel_minutes
        FROM dual
      ) s

      ON (
        t.route_id = s.route_id
        AND t.stop_order = s.stop_order
      )

      WHEN MATCHED THEN
        UPDATE SET
          t.stop_id = s.stop_id,
          t.travel_minutes = s.travel_minutes

      WHEN NOT MATCHED THEN
        INSERT (
          route_id,
          stop_order,
          stop_id,
          travel_minutes
        )
        VALUES (
          s.route_id,
          s.stop_order,
          s.stop_id,
          s.travel_minutes
        )
      `,
      (d.routeStops || []).map(x => ({
        routeId: x.routeId,
        seq: Number(x.seq || 0),
        stopId: x.stopId,
        minutes: Number(x.minutes || 0)
      }))
    );


    // ==================================================
    // TRIPS
    // ==================================================

    const tripRows = (d.trips || []).map(x => {

      let seatCount =
        Number(
          x.seatCount || 0
        );


      if (seatCount <= 0) {

        const vehicle =
          (d.vehicles || []).find(
            v =>
              v.id === x.vehicleId
          );


        const vehicleType =
          vehicle
            ? (d.vehicleTypes || []).find(
                vt =>
                  vt.id === vehicle.typeId
              )
            : null;


        seatCount =
          vehicleType
            ? Number(
                vehicleType.seats || 0
              )
            : 0;
      }


      return {
        id: x.id,
        datex: x.date,
        dep: x.dep,
        status: x.status,
        seatCount,
        vehicleId: x.vehicleId,
        routeId: x.routeId,
        driverId:
          x.driverId || null
      };
    });


    await many(
      c,
      `
      MERGE INTO trips t

      USING (
        SELECT
          :id AS trip_id,

          TO_DATE(
            :datex,
            'YYYY-MM-DD'
          ) AS trip_date,

          TO_TIMESTAMP(
            '2000-01-01 ' || :dep,
            'YYYY-MM-DD HH24:MI'
          ) AS depart_time,

          :status AS status,
          :seatCount AS seat_count,
          :vehicleId AS vehicle_id,
          :routeId AS route_id,
          :driverId AS driver_id

        FROM dual
      ) s

      ON (
        t.trip_id =
        s.trip_id
      )

      WHEN MATCHED THEN
        UPDATE SET
          t.trip_date =
            s.trip_date,
          t.depart_time =
            s.depart_time,
          t.status =
            s.status,
          t.seat_count =
            s.seat_count,
          t.vehicle_id =
            s.vehicle_id,
          t.route_id =
            s.route_id,
          t.driver_id =
            s.driver_id

      WHEN NOT MATCHED THEN
        INSERT (
          trip_id,
          trip_date,
          depart_time,
          status,
          seat_count,
          vehicle_id,
          route_id,
          driver_id
        )
        VALUES (
          s.trip_id,
          s.trip_date,
          s.depart_time,
          s.status,
          s.seat_count,
          s.vehicle_id,
          s.route_id,
          s.driver_id
        )
      `,
      tripRows
    );


    // ==================================================
    // BOOKINGS
    // ==================================================

    const bookingRows =
      (d.bookings || []).map(
        x => ({
          id: x.id,

          createdAt:
            x.createdAt ||
            x.created ||
            null,

          userId:
            x.userId
        })
      );


    await many(
      c,
      `
      MERGE INTO bookings t

      USING (
        SELECT
          :id AS booking_id,

          TO_TIMESTAMP(
            :createdAt,
            'YYYY-MM-DD HH24:MI'
          ) AS booked_at,

          :userId AS user_id

        FROM dual
      ) s

      ON (
        t.booking_id =
        s.booking_id
      )

      WHEN MATCHED THEN
        UPDATE SET
          t.booked_at =
            s.booked_at,
          t.user_id =
            s.user_id

      WHEN NOT MATCHED THEN
        INSERT (
          booking_id,
          booked_at,
          user_id
        )
        VALUES (
          s.booking_id,
          s.booked_at,
          s.user_id
        )
      `,
      bookingRows
    );


    // ==================================================
    // BOOKING ITEMS
    // ==================================================

    const bookingItemRows =
      (d.bookingItems || []).map(
        x => ({
          id: x.id,
          qr: x.qr,
          status: x.status,

          seats:
            Number(
              x.seats || 1
            ),

          checkin:
            x.checkin || null,

          bookingId:
            x.bookingId,

          tripId:
            x.tripId,

          boardStopId:
            x.boardStopId ||
            x.board ||
            null,

          alightStopId:
            x.alightStopId ||
            x.alight ||
            null
        })
      );


    await many(
      c,
      `
      MERGE INTO booking_items t

      USING (
        SELECT
          :id AS booking_item_id,
          :qr AS qr_code,
          :status AS status,
          :seats AS seats,

          TO_TIMESTAMP(
            :checkin,
            'YYYY-MM-DD HH24:MI'
          ) AS checkin_at,

          :bookingId AS booking_id,
          :tripId AS trip_id,
          :boardStopId AS board_stop_id,
          :alightStopId AS alight_stop_id

        FROM dual
      ) s

      ON (
        t.booking_item_id =
        s.booking_item_id
      )

      WHEN MATCHED THEN
        UPDATE SET
          t.qr_code =
            s.qr_code,
          t.status =
            s.status,
          t.seats =
            s.seats,
          t.checkin_at =
            s.checkin_at,
          t.booking_id =
            s.booking_id,
          t.trip_id =
            s.trip_id,
          t.board_stop_id =
            s.board_stop_id,
          t.alight_stop_id =
            s.alight_stop_id

      WHEN NOT MATCHED THEN
        INSERT (
          booking_item_id,
          qr_code,
          status,
          seats,
          checkin_at,
          booking_id,
          trip_id,
          board_stop_id,
          alight_stop_id
        )
        VALUES (
          s.booking_item_id,
          s.qr_code,
          s.status,
          s.seats,
          s.checkin_at,
          s.booking_id,
          s.trip_id,
          s.board_stop_id,
          s.alight_stop_id
        )
      `,
      bookingItemRows
    );


    await c.commit();


    console.log('');
    console.log('====================================');
    console.log(' SAFE SYNC SUCCESS');
    console.log(' No tables were deleted');
    console.log('====================================');
    console.log('');


    res.json({
      ok: true,
      mode: 'safe-upsert'
    });


  } catch (e) {

    console.error('');
    console.error('====================================');
    console.error('SYNC ERROR');
    console.error('====================================');
    console.error(e);
    console.error('');


    if (c) {
      try {
        await c.rollback();
        console.log(
          'ROLLBACK SUCCESS'
        );
      } catch (rollbackError) {

        console.error(
          'ROLLBACK ERROR:',
          rollbackError
        );
      }
    }


    res.status(500).json({
      ok: false,
      error: e.message,
      code: e.code || null
    });


  } finally {

    if (c) {
      await c.close();
    }
  }
});


// ======================================================
// SAFE DELETE BY ID
//
// ลบเฉพาะ record ที่ผู้ใช้กดลบ
// ไม่มี DELETE FROM table ทั้งตาราง
// ======================================================

app.delete(
  '/api/delete/:entity/:id',
  async (req, res) => {

    const entity =
      String(
        req.params.entity || ''
      );


    const id =
      String(
        req.params.id || ''
      ).trim();


    if (!id) {

      return res.status(400).json({
        ok: false,
        error: 'missing id'
      });
    }


    const allowed = {

      departments: {

        sql:
          `
          DELETE FROM departments
          WHERE department_id = :id
          `
      },


      positions: {

        before: [
          `
          DELETE FROM permissions
          WHERE position_id = :id
          `
        ],

        sql:
          `
          DELETE FROM positions
          WHERE position_id = :id
          `
      },


      screens: {

        before: [
          `
          DELETE FROM permissions
          WHERE screen_id = :id
          `
        ],

        sql:
          `
          DELETE FROM screens
          WHERE screen_id = :id
          `
      },


      vehicleTypes: {

        sql:
          `
          DELETE FROM vehicle_types
          WHERE vehicle_type_id = :id
          `
      },


      vehicles: {

        sql:
          `
          DELETE FROM vehicles
          WHERE vehicle_id = :id
          `
      },


      stops: {

        sql:
          `
          DELETE FROM stops
          WHERE stop_id = :id
          `
      },


      routes: {

        before: [
          `
          DELETE FROM route_stops
          WHERE route_id = :id
          `
        ],

        sql:
          `
          DELETE FROM routes
          WHERE route_id = :id
          `
      },


      trips: {

        sql:
          `
          DELETE FROM trips
          WHERE trip_id = :id
          `
      },


      users: {

        before: [
          `
          DELETE FROM employees
          WHERE user_id = :id
          `
        ],

        sql:
          `
          DELETE FROM users
          WHERE user_id = :id
          `
      }
    };


    const deleteConfig =
      allowed[entity];


    if (!deleteConfig) {

      return res
        .status(400)
        .json({
          ok: false,
          error:
            'ไม่อนุญาตให้ลบ entity นี้: ' +
            entity
        });
    }


    let c;


    try {

      c =
        await oracledb
          .getConnection(cfg);


      for (
        const sql
        of (
          deleteConfig.before ||
          []
        )
      ) {

        await c.execute(
          sql,
          { id },
          {
            autoCommit: false
          }
        );
      }


      const result =
        await c.execute(
          deleteConfig.sql,
          { id },
          {
            autoCommit: false
          }
        );


      if (!result.rowsAffected) {

        await c.rollback();

        return res
          .status(404)
          .json({
            ok: false,
            error:
              'ไม่พบข้อมูล ' +
              id
          });
      }


      await c.commit();


      console.log('');
      console.log(
        'SAFE DELETE SUCCESS:',
        entity,
        id
      );
      console.log('');


      res.json({
        ok: true,
        entity,
        id
      });


    } catch (e) {

      if (c) {

        try {
          await c.rollback();
        } catch (_) {}
      }


      console.error('');
      console.error(
        'SAFE DELETE ERROR:',
        entity,
        id
      );
      console.error(e);
      console.error('');


      let message =
        e.message ||
        'ไม่สามารถลบข้อมูลได้';


      if (
        e.errorNum === 2292 ||
        String(
          e.message || ''
        ).includes(
          'ORA-02292'
        )
      ) {

        message =
          'ไม่สามารถลบได้ เพราะข้อมูลนี้ถูกใช้งานโดยข้อมูลอื่นอยู่';
      }


      res.status(409).json({
        ok: false,
        error: message,
        code: e.code || null
      });


    } finally {

      if (c) {

        try {
          await c.close();
        } catch (_) {}
      }
    }
  }
);


// ======================================================
// FALLBACK
// ======================================================

app.use((req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      'web',
      'index.html'
    )
  );
});


// ======================================================
// START SERVER
// ======================================================

const port =
  Number(
    process.env.PORT
  ) || 3000;


app.listen(
  port,
  () => {

    console.log('');
    console.log('====================================');
    console.log(' MUT Shuttle Server');
    console.log(' SAFE SYNC + SAFE DELETE');
    console.log(' AUTO TRIPS 2/3 ROUNDS');
    console.log('====================================');

    console.log(
      ` Open    : http://localhost:${port}`
    );

    console.log(
      ` Test DB : http://localhost:${port}/api/health`
    );

    console.log('====================================');
    console.log('');
  }
);