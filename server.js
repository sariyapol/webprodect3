'use strict';

const express = require('express');
const oracledb = require('oracledb');
const path = require('path');

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.fetchAsString = [oracledb.CLOB];

const cfg = {
  user: process.env.ORACLE_USER || 'LAB04HW',
  password: process.env.ORACLE_PASSWORD || '',
  connectString:
    process.env.ORACLE_CONNECT_STRING || 'localhost:1521/XEPDB1'
};

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'web')));


// ======================================================
// HELPER
// ======================================================

async function q(c, sql, binds = {}) {
  const result = await c.execute(sql, binds);
  return result.rows;
}


// ======================================================
// MANY
// ใช้ execute ทีละ row แทน executeMany
// เพื่อเลี่ยงปัญหา NJS-012 / NJS-097 / NJS-098
// ======================================================

async function many(c, sql, rows) {

  if (!rows || !rows.length) {
    return;
  }

  for (const row of rows) {

    const cleaned = {};

    for (const [key, value] of Object.entries(row)) {

      if (value === undefined || value === '') {
        cleaned[key] = null;
      }
      else if (typeof value === 'boolean') {
        cleaned[key] = value ? 1 : 0;
      }
      else {
        cleaned[key] = value;
      }
    }

    await c.execute(
      sql,
      cleaned,
      {
        autoCommit: false
      }
    );
  }
}


// ======================================================
// HEALTH CHECK
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

  }
  catch (e) {

    console.error('HEALTH ERROR:', e);

    res.status(500).json({
      ok: false,
      error: e.message
    });

  }
  finally {

    if (c) {
      await c.close();
    }
  }
});


// ======================================================
// BOOTSTRAP - โหลดข้อมูลจาก ORACLE
// ======================================================

app.get('/api/bootstrap', async (req, res) => {

  let c;

  try {

    c = await oracledb.getConnection(cfg);

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

      q(
        c,
        `SELECT
          department_id ID,
          department_name NAME
         FROM departments
         ORDER BY department_id`
      ),

      q(
        c,
        `SELECT
          position_id ID,
          position_name NAME
         FROM positions
         ORDER BY position_id`
      ),

      q(
        c,
        `SELECT
          screen_id ID,
          screen_name NAME
         FROM screens
         ORDER BY screen_id`
      ),

      q(
        c,
        `SELECT
          user_id ID,
          name NAME,
          email EMAIL,
          username USERNAME,
          password_hash PASSWORD,
          department_id DEPTID
         FROM users
         ORDER BY user_id`
      ),

      q(
        c,
        `SELECT
          user_id ID,
          phone PHONE,
          position_id POSITIONID
         FROM employees`
      ),

      q(
        c,
        `SELECT
          permission_id ID,
          position_id POSITIONID,
          screen_id SCREENID,
          can_add ADDX,
          can_edit EDITX,
          can_delete DELX
         FROM permissions
         ORDER BY permission_id`
      ),

      q(
        c,
        `SELECT
          vehicle_type_id ID,
          type_name NAME,
          description DETAIL,
          seat_count SEATS
         FROM vehicle_types
         ORDER BY vehicle_type_id`
      ),

      q(
        c,
        `SELECT
          vehicle_id ID,
          plate_no PLATE,
          status STATUS,
          vehicle_type_id TYPEID
         FROM vehicles
         ORDER BY vehicle_id`
      ),

      q(
        c,
        `SELECT
          stop_id ID,
          stop_name NAME
         FROM stops
         ORDER BY stop_id`
      ),

      q(
        c,
        `SELECT
          route_id ID,
          route_name NAME
         FROM routes
         ORDER BY route_id`
      ),

      q(
        c,
        `SELECT
          route_id ROUTEID,
          stop_order SEQ,
          stop_id STOPID,
          travel_minutes MINUTES
         FROM route_stops
         ORDER BY route_id, stop_order`
      ),

      q(
        c,
        `SELECT
          trip_id ID,
          TO_CHAR(trip_date,'YYYY-MM-DD') "DATE",
          TO_CHAR(depart_time,'HH24:MI') DEP,
          status STATUS,
          vehicle_id VEHICLEID,
          route_id ROUTEID,
          driver_id DRIVERID
         FROM trips
         ORDER BY trip_date, depart_time`
      ),

      q(
        c,
        `SELECT
          booking_id ID,
          TO_CHAR(booked_at,'YYYY-MM-DD HH24:MI') CREATED,
          user_id USERID
         FROM bookings
         ORDER BY booked_at`
      ),

      q(
        c,
        `SELECT
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
         ORDER BY booking_item_id`
      )

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

      version: 2,

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
          vehicleId: x.VEHICLEID,
          routeId: x.ROUTEID,
          driverId: x.DRIVERID || ''
        })),

      bookings:
        bookings.map(x => ({
          id: x.ID,
          created: x.CREATED,
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
          board: x.BOARD,
          alight: x.ALIGHT
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

  }
  catch (e) {

    console.error('BOOTSTRAP ERROR:', e);

    res.status(500).json({
      ok: false,
      error: e.message
    });

  }
  finally {

    if (c) {
      await c.close();
    }
  }
});


// ======================================================
// DELETE OLD DATA
// ======================================================

async function delAll(c) {

  const tables = [
    'booking_items',
    'bookings',
    'trips',
    'route_stops',
    'permissions',
    'employees',
    'users',
    'vehicles',
    'vehicle_types',
    'routes',
    'stops',
    'screens',
    'positions',
    'departments'
  ];

  for (const table of tables) {
    await c.execute(`DELETE FROM ${table}`);
  }
}


// ======================================================
// SYNC DATABASE
// ======================================================

app.post('/api/sync', async (req, res) => {

  const d =
    req.body &&
    req.body.db;

  if (!d) {

    return res.status(400).json({
      ok: false,
      error: 'missing db'
    });
  }


  let c;

  try {

    c = await oracledb.getConnection(cfg);

    await delAll(c);


    // ==================================================
    // DEPARTMENTS
    // ==================================================

    await many(
      c,
      `INSERT INTO departments(
        department_id,
        department_name
      )
      VALUES(
        :id,
        :name
      )`,
      d.departments
    );


    // ==================================================
    // POSITIONS
    // ==================================================

    await many(
      c,
      `INSERT INTO positions(
        position_id,
        position_name
      )
      VALUES(
        :id,
        :name
      )`,
      d.positions
    );


    // ==================================================
    // SCREENS
    // ==================================================

    await many(
      c,
      `INSERT INTO screens(
        screen_id,
        screen_name
      )
      VALUES(
        :id,
        :name
      )`,
      d.screens
    );


    // ==================================================
    // USERS
    // ==================================================

    await many(
      c,
      `INSERT INTO users(
        user_id,
        name,
        email,
        username,
        password_hash,
        department_id
      )
      VALUES(
        :id,
        :name,
        :email,
        :username,
        :password,
        :deptId
      )`,

      d.users.map(x => ({
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
      `INSERT INTO employees(
        user_id,
        phone,
        position_id
      )
      VALUES(
        :id,
        :phone,
        :positionId
      )`,

      d.users
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
      `INSERT INTO permissions(
        permission_id,
        can_add,
        can_edit,
        can_delete,
        position_id,
        screen_id
      )
      VALUES(
        :id,
        :canAdd,
        :canEdit,
        :canDelete,
        :positionId,
        :screenId
      )`,

      d.permissions.map(x => ({
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
      `INSERT INTO vehicle_types(
        vehicle_type_id,
        type_name,
        description,
        seat_count
      )
      VALUES(
        :id,
        :name,
        :detail,
        :seats
      )`,

      d.vehicleTypes.map(x => ({
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
      `INSERT INTO vehicles(
        vehicle_id,
        plate_no,
        status,
        vehicle_type_id
      )
      VALUES(
        :id,
        :plate,
        :status,
        :typeId
      )`,

      d.vehicles.map(x => ({
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
      `INSERT INTO stops(
        stop_id,
        stop_name
      )
      VALUES(
        :id,
        :name
      )`,

      d.stops.map(x => ({
        id: x.id,
        name: x.name
      }))
    );


    // ==================================================
    // ROUTES
    // ==================================================

    await many(
      c,
      `INSERT INTO routes(
        route_id,
        route_name
      )
      VALUES(
        :id,
        :name
      )`,

      d.routes.map(x => ({
        id: x.id,
        name: x.name
      }))
    );


    // ==================================================
    // ROUTE STOPS
    // ==================================================

    await many(
      c,
      `INSERT INTO route_stops(
        route_id,
        stop_order,
        stop_id,
        travel_minutes
      )
      VALUES(
        :routeId,
        :seq,
        :stopId,
        :minutes
      )`,

      d.routeStops.map(x => ({
        routeId: x.routeId,
        seq: Number(x.seq || 0),
        stopId: x.stopId,
        minutes: Number(x.minutes || 0)
      }))
    );


    // ==================================================
    // TRIPS
    // ==================================================

    const tripRows =
      d.trips.map(x => ({
        id: x.id,
        datex: x.date,
        dep: x.dep,
        status: x.status,
        vehicleId: x.vehicleId,
        routeId: x.routeId,
        driverId: x.driverId || null
      }));


    await many(
      c,

      `INSERT INTO trips(
        trip_id,
        trip_date,
        depart_time,
        status,
        seat_count,
        vehicle_id,
        route_id,
        driver_id
      )

      SELECT
        :id,

        TO_DATE(
          :datex,
          'YYYY-MM-DD'
        ),

        TO_TIMESTAMP(
          '2000-01-01 ' || :dep,
          'YYYY-MM-DD HH24:MI'
        ),

        :status,

        vt.seat_count,

        :vehicleId,
        :routeId,
        :driverId

      FROM vehicles v

      JOIN vehicle_types vt
        ON vt.vehicle_type_id =
           v.vehicle_type_id

      WHERE
        v.vehicle_id = :vehicleId`,

      tripRows
    );


    // ==================================================
    // BOOKINGS
    // ==================================================

    await many(
      c,

      `INSERT INTO bookings(
        booking_id,
        booked_at,
        user_id
      )

      VALUES(
        :id,

        TO_TIMESTAMP(
          :created,
          'YYYY-MM-DD HH24:MI'
        ),

        :userId
      )`,

      d.bookings.map(x => ({
        id: x.id,
        created: x.created,
        userId: x.userId
      }))
    );


    // ==================================================
    // BOOKING ITEMS
    // ==================================================

    const bookingItemRows =
      d.bookingItems.map(x => ({
        id: x.id,
        qr: x.qr,
        status: x.status,
        seats: Number(x.seats || 1),

        checkin:
          x.checkin
            ? x.checkin
            : null,

        bookingId: x.bookingId,
        tripId: x.tripId,
        board: x.board,
        alight: x.alight
      }));


    await many(
      c,

      `INSERT INTO booking_items(
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

      VALUES(
        :id,
        :qr,
        :status,
        :seats,

        CASE
          WHEN :checkin IS NULL
          THEN NULL
          ELSE TO_TIMESTAMP(
            :checkin,
            'YYYY-MM-DD HH24:MI'
          )
        END,

        :bookingId,
        :tripId,
        :board,
        :alight
      )`,

      bookingItemRows
    );


    // ==================================================
    // COMMIT
    // ==================================================

    await c.commit();

    console.log('SYNC SUCCESS');

    res.json({
      ok: true
    });

  }
  catch (e) {

    console.error('SYNC ERROR:', e);

    if (c) {

      try {
        await c.rollback();
      }
      catch (rollbackError) {
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

  }
  finally {

    if (c) {
      await c.close();
    }
  }
});


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
  Number(process.env.PORT) || 3000;


app.listen(
  port,
  () => {

    console.log('');
    console.log('====================================');
    console.log(' MUT Shuttle Server');
    console.log('====================================');
    console.log(` http://localhost:${port}`);
    console.log('====================================');
    console.log('');
  }
);