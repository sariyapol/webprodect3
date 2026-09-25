/* =========================================================
   store.js — ฐานข้อมูลจำลอง (localStorage) ตาม ER / Mapping
   ========================================================= */
(function () {
  'use strict';
  var KEY = 'mutbus_db_v1';
  var SESSION_KEY = 'mutbus_session_v1';

  /* ---------- helpers: วันที่ / เวลา ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
  function toMin(t) { var p = String(t).split(':'); return (+p[0]) * 60 + (+p[1]); }
  function fmtMin(m) { m = ((m % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function thDate(s) { if (!s) return ''; var p = s.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function nowDate() { return ymd(new Date()); }
  function nowMin() { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  function nowStamp() { var d = new Date(); return ymd(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  var DAYS_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  var DAYS_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  var MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  function parseYmd(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }

  /* ---------- seeded random ---------- */
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ---------- seed data ---------- */
  function seed() {
    var db = {
      version: 1,
      departments: [
        { id: 'D001', name: 'ฝ่ายบุคคล' },
        { id: 'D002', name: 'ฝ่ายปฏิบัติการ' },
        { id: 'D003', name: 'ฝ่ายบัญชี' }
      ],
      positions: [
        { id: 'P01', name: 'Admin' },
        { id: 'P02', name: 'พนักงาน' },
        { id: 'P03', name: 'คนขับ' }
      ],
      // ผู้ใช้งาน (superclass) + employee = พนักงาน (subclass: เบอร์โทร)
      users: [
        { id: 'U001', name: 'สมชาย ใจดี', email: 'somchai@mail.com', username: 'somchai', password: '1234', deptId: 'D001', positionId: 'P02', employee: { phone: '0811111111' } },
        { id: 'U002', name: 'สมหญิง มีสุข', email: 'somying@mail.com', username: 'admin', password: '1234', deptId: 'D002', positionId: 'P01', employee: { phone: '0822222222' } },
        { id: 'U003', name: 'สมศักดิ์ รักงาน', email: 'somsak@mail.com', username: 'somsak', password: '1234', deptId: 'D002', positionId: 'P03', employee: { phone: '0833333333' } },
        { id: 'U004', name: 'วิชัย ขับดี', email: 'wichai@mail.com', username: 'wichai', password: '1234', deptId: 'D002', positionId: 'P03', employee: { phone: '0844444444' } },
        { id: 'U005', name: 'อำนาจ ตรงเวลา', email: 'amnat@mail.com', username: 'amnat', password: '1234', deptId: 'D002', positionId: 'P03', employee: { phone: '0855555555' } },
        { id: 'U006', name: 'มานี มีนา', email: 'mani@mail.com', username: 'mani', password: '1234', deptId: 'D003', positionId: '', employee: null },
        { id: 'U007', name: 'ปิติ ชูใจ', email: 'piti@mail.com', username: 'piti', password: '1234', deptId: 'D003', positionId: '', employee: null },
        { id: 'U008', name: 'วีระ กล้าหาญ', email: 'weera@mail.com', username: 'weera', password: '1234', deptId: 'D001', positionId: '', employee: null }
      ],
      screens: [
        { id: 'SC01', name: 'จัดการรถ' }, { id: 'SC02', name: 'จัดการการจอง' }, { id: 'SC03', name: 'จัดการประเภทรถ' },
        { id: 'SC04', name: 'จัดการจุดจอด' }, { id: 'SC05', name: 'จัดการเส้นทาง' }, { id: 'SC06', name: 'จัดการรอบการเดินรถ' },
        { id: 'SC07', name: 'จัดการผู้ใช้งาน/พนักงาน' }, { id: 'SC08', name: 'จัดการแผนก' }, { id: 'SC09', name: 'จัดการตำแหน่ง' },
        { id: 'SC10', name: 'จัดการหน้าจอและสิทธิ์' }, { id: 'SC11', name: 'รายงาน' }, { id: 'SC12', name: 'งานคนขับ' }
      ],
      permissions: [],
      vehicleTypes: [
        { id: 'T01', name: 'รถตู้', detail: 'รถโดยสารขนาดเล็ก', seats: 12 },
        { id: 'T02', name: 'รถบัส', detail: 'รถโดยสารขนาดใหญ่', seats: 40 }
      ],
      vehicles: [
        { id: 'V001', plate: 'กข 1234', status: 'พร้อมใช้งาน', typeId: 'T01' },
        { id: 'V002', plate: 'สย 2591', status: 'พร้อมใช้งาน', typeId: 'T01' },
        { id: 'V003', plate: 'ขค 5566', status: 'พร้อมใช้งาน', typeId: 'T02' },
        { id: 'V004', plate: 'ฮก 7788', status: 'ซ่อมบำรุง', typeId: 'T01' }
      ],
      stops: [
        { id: 'S001', name: 'มหาวิทยาลัยเทคโนโลยีมหานคร' },
        { id: 'S002', name: 'โลตัสหนองจอก' },
        { id: 'S003', name: 'โรงพยาบาลหนองจอก' },
        { id: 'S004', name: 'Big C หนองจอก' }
      ],
      routes: [{ id: 'R001', name: 'เส้นทาง 1' }],
      // เส้นทาง_จุดจอด (weak) — PK = (routeId, seq)
      routeStops: [
        { routeId: 'R001', seq: 1, stopId: 'S001', minutes: 0 },
        { routeId: 'R001', seq: 2, stopId: 'S002', minutes: 5 },
        { routeId: 'R001', seq: 3, stopId: 'S003', minutes: 3 },
        { routeId: 'R001', seq: 4, stopId: 'S004', minutes: 6 },
        { routeId: 'R001', seq: 5, stopId: 'S003', minutes: 3 },
        { routeId: 'R001', seq: 6, stopId: 'S002', minutes: 3 },
        { routeId: 'R001', seq: 7, stopId: 'S001', minutes: 10 }
      ],
      trips: [],        // รอบการเดินรถ
      bookings: [],     // การจอง (หัว)
      bookingItems: [], // รายการจอง (weak)
      counters: { trip: 0, booking: 0, item: 0 }
    };

    // สิทธิ์: Admin ได้ทุกหน้าจอ (ยกเว้นงานคนขับ), พนักงาน ดูได้บางหน้า, คนขับ ได้งานคนขับ
    var pr = 0;
    function perm(pos, sc, a, e, d) { pr++; db.permissions.push({ id: 'PR' + ('00' + pr).slice(-3), positionId: pos, screenId: sc, add: a, edit: e, del: d }); }
    db.screens.forEach(function (s) { if (s.id !== 'SC12') perm('P01', s.id, 1, 1, 1); });
    perm('P02', 'SC01', 0, 0, 0);
    perm('P02', 'SC02', 0, 1, 0);
    perm('P02', 'SC06', 0, 0, 0);
    perm('P02', 'SC11', 0, 0, 0);
    perm('P03', 'SC12', 0, 1, 0);

    // รอบการเดินรถ: ย้อนหลัง 30 วัน ถึงล่วงหน้า 3 วัน
    var R = rng(20260925);
    var today = new Date();
    var slots = [
      { t: '07:30', veh: 'V002', drv: 'U003' },
      { t: '09:30', veh: 'V002', drv: 'U003' },
      { t: '11:30', veh: 'V001', drv: 'U004' },
      { t: '13:30', veh: 'V003', drv: 'U005' },
      { t: '17:30', veh: 'V003', drv: 'U003' },
      { t: '18:30', veh: 'V001', drv: 'U004' }
    ];
    var riders = ['U001', 'U006', 'U007', 'U008', 'U002', 'U001', 'U006'];
    var pairs = [['S002', 'S004'], ['S001', 'S003'], ['S001', 'S004'], ['S002', 'S001'], ['S003', 'S001'], ['S004', 'S001'], ['S001', 'S002'], ['S004', 'S002']];
    var nowM = nowMin(), todayStr = ymd(today);
    var total = 30;
    for (var off = -30; off <= 3; off++) {
      var d = addDays(today, off), dow = d.getDay();
      if (dow === 0) continue; // อาทิตย์ไม่มีรอบ
      var daySlots = dow === 6 ? [slots[1], slots[3]] : slots;
      daySlots.forEach(function (sl) {
        var date = ymd(d);
        var past = off < 0 || (off === 0 && toMin(sl.t) + total <= nowM);
        db.counters.trip++;
        var trip = { id: 'TR' + ('000' + db.counters.trip).slice(-4), date: date, dep: sl.t, status: past ? 'เสร็จสิ้น' : 'เปิด', vehicleId: sl.veh, routeId: 'R001', driverId: sl.drv };
        db.trips.push(trip);
        var cap = sl.veh === 'V003' ? 40 : 12;
        var target = Math.floor(cap * (0.35 + R() * 0.55));
        if (off > 1) target = Math.floor(target * 0.3);
        var used = 0, guard = 0;
        while (used < target && guard++ < 40) {
          var seats = 1 + Math.floor(R() * 3);
          if (used + seats > cap) break;
          var pair = pairs[Math.floor(R() * pairs.length)];
          var uid = riders[Math.floor(R() * riders.length)];
          var status, checkin = '';
          var roll = R();
          if (past) {
            if (roll < 0.1) status = 'ยกเลิก';
            else if (roll < 0.18) status = 'No Show';
            else { status = 'Check-in แล้ว'; }
          } else status = roll < 0.08 ? 'ยกเลิก' : 'ยืนยัน';
          var created = ymd(addDays(d, -1 - Math.floor(R() * 3))) + ' ' + fmtMin(8 * 60 + Math.floor(R() * 12 * 60));
          var it = addBookingRaw(db, uid, trip, pair[0], pair[1], seats, status, created);
          if (status === 'Check-in แล้ว') it.checkin = date + ' ' + fmtMin(toMin(trip.dep) + arrOffset(db, 'R001', pair[0], pair[1])[0]);
          if (status !== 'ยกเลิก') used += seats;
        }
      });
    }
    // รอบสาธิตวันนี้ของคนขับ somsak (ให้ทดลองเริ่มงาน/สแกน QR ได้ทุกเวลา)
    var start = Math.ceil((nowM + 40) / 30) * 30;
    var mine = db.trips.filter(function (t) { return t.date === todayStr && t.driverId === 'U003'; });
    var clash = function (s) { return mine.some(function (t) { var a = toMin(t.dep); return s < a + total && a < s + total; }); };
    while (clash(start) && start < 23 * 60 + 30) start += 30;
    start = Math.min(start, 23 * 60 + 30);
    db.counters.trip++;
    var demo = { id: 'TR' + ('000' + db.counters.trip).slice(-4), date: todayStr, dep: fmtMin(start), status: 'เปิด', vehicleId: 'V002', routeId: 'R001', driverId: 'U003' };
    db.trips.push(demo);
    [['U006', 'S002', 'S004', 2], ['U007', 'S001', 'S003', 1], ['U008', 'S003', 'S001', 3], ['U002', 'S002', 'S001', 1]].forEach(function (x) { addBookingRaw(db, x[0], demo, x[1], x[2], x[3], 'ยืนยัน', nowStamp()); });
    addBookingRaw(db, 'U001', demo, 'S001', 'S004', 1, 'ยกเลิก', nowStamp());

    // การจองตัวอย่างของสมชาย: พรุ่งนี้ (หรือวันทำการถัดไป) 09:30 โลตัส → Big C 2 ที่นั่ง
    var nextTrip = db.trips.filter(function (t) { return t.date > todayStr && t.dep === '09:30'; })[0];
    if (nextTrip) addBookingRaw(db, 'U001', nextTrip, 'S002', 'S004', 2, 'ยืนยัน', nowStamp());
    return db;
  }

  function newQr(db) {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', code;
    do { code = 'MUT-'; for (var i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]; }
    while (db.bookingItems.some(function (b) { return b.qr === code; }));
    return code;
  }

  function addBookingRaw(db, userId, trip, board, alight, seats, status, createdAt) {
    db.counters.booking++; db.counters.item++;
    var b = { id: 'B' + ('000' + db.counters.booking).slice(-4), createdAt: createdAt, userId: userId };
    db.bookings.push(b);
    var it = { id: 'BD' + ('000' + db.counters.item).slice(-4), qr: newQr(db), status: status, seats: seats, checkin: '', bookingId: b.id, tripId: trip.id, boardStopId: board, alightStopId: alight };
    db.bookingItems.push(it);
    return it;
  }

  /* ลำดับจุดขึ้น–ลง: ลำดับแรกที่ตรงจุดขึ้น และลำดับถัดไปที่ตรงจุดลง */
  function seqPair(db, routeId, board, alight) {
    var rs = routeStopsOf(db, routeId);
    var bi = -1;
    for (var i = 0; i < rs.length; i++) if (rs[i].stopId === board) { bi = i; break; }
    if (bi < 0 || !alight || alight === board) return null;
    for (var j = bi + 1; j < rs.length; j++) if (rs[j].stopId === alight) return [bi, j];
    return null;
  }
  function routeStopsOf(db, routeId) { return db.routeStops.filter(function (r) { return r.routeId === routeId; }).sort(function (a, b) { return a.seq - b.seq; }); }
  function cumOf(db, routeId) { var s = 0; return routeStopsOf(db, routeId).map(function (r) { s += (+r.minutes || 0); return s; }); }
  function arrOffset(db, routeId, board, alight) { var p = seqPair(db, routeId, board, alight); if (!p) return [0, 0]; var c = cumOf(db, routeId); return [c[p[0]], c[p[1]]]; }

  /* ---------- Store API ---------- */
  var Store = {
    db: null,
    load: async function () {
      try {
        var r = await fetch('/api/bootstrap'); var j = await r.json();
        if (!r.ok || !j.ok) throw new Error(j.error || 'Database unavailable');
        this.db = j.db; return;
      } catch (e) {
        console.error('Oracle load failed:', e);
        this.db = seed();
        window.__DB_ERROR = e.message || String(e);
      }
    },
    save: function () {
      fetch('/api/sync', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({db:this.db})})
        .then(function(r){return r.json().then(function(j){if(!r.ok||!j.ok) throw new Error(j.error||'sync failed');});})
        .catch(function(e){ console.error('Oracle sync failed:',e); if(window.UI) UI.toast('บันทึก Oracle ไม่สำเร็จ: '+e.message,'bad'); });
    },
    reset: function () { this.db = seed(); this.save(); },

    session: function () { try { return localStorage.getItem(SESSION_KEY) || ''; } catch (e) { return ''; } },
    setSession: function (uid) { try { if (uid) localStorage.setItem(SESSION_KEY, uid); else localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ } },

    /* lookups */
    by: function (table, id) { var t = this.db[table]; for (var i = 0; i < t.length; i++) if (t[i].id === id) return t[i]; return null; },
    user: function (id) { return this.by('users', id); },
    stopName: function (id) { var s = this.by('stops', id); return s ? s.name : '-'; },
    vehicle: function (id) { return this.by('vehicles', id); },
    vtype: function (id) { return this.by('vehicleTypes', id); },
    route: function (id) { return this.by('routes', id); },
    trip: function (id) { return this.by('trips', id); },
    item: function (id) { return this.by('bookingItems', id); },
    booking: function (id) { return this.by('bookings', id); },

    routeStops: function (routeId) { return routeStopsOf(this.db, routeId); },
    routeTotal: function (routeId) { return this.routeStops(routeId).reduce(function (a, r) { return a + (+r.minutes || 0); }, 0); },
    cum: function (routeId) { return cumOf(this.db, routeId); },
    seqPair: function (routeId, b, a) { return seqPair(this.db, routeId, b, a); },

    tripSeats: function (trip) { var v = this.vehicle(trip.vehicleId); var t = v && this.vtype(v.typeId); return t ? +t.seats : 0; },
    tripItems: function (tripId) { return this.db.bookingItems.filter(function (i) { return i.tripId === tripId; }); },
    bookedSeats: function (tripId) { return this.tripItems(tripId).filter(function (i) { return i.status !== 'ยกเลิก'; }).reduce(function (a, i) { return a + (+i.seats); }, 0); },
    remaining: function (trip) { return this.tripSeats(trip) - this.bookedSeats(trip.id); },
    tripEnd: function (trip) { return fmtMin(toMin(trip.dep) + this.routeTotal(trip.routeId)); },
    arrivals: function (trip, board, alight) {
      var p = this.seqPair(trip.routeId, board, alight); if (!p) return null;
      var c = this.cum(trip.routeId), d = toMin(trip.dep);
      return { board: fmtMin(d + c[p[0]]), alight: fmtMin(d + c[p[1]]), boardMin: d + c[p[0]], alightMin: d + c[p[1]], seq: p };
    },

    /* สิทธิ์ */
    perm: function (positionId, screenId) {
      if (!positionId) return null;
      for (var i = 0; i < this.db.permissions.length; i++) { var p = this.db.permissions[i]; if (p.positionId === positionId && p.screenId === screenId) return p; }
      return null;
    },

    /* การจอง */
    createBooking: function (userId, tripId, board, alight, seats) {
      var trip = this.trip(tripId);
      if (!trip || trip.status !== 'เปิด') return { error: 'รอบนี้ไม่เปิดให้จองแล้ว' };
      if (!this.seqPair(trip.routeId, board, alight)) return { error: 'จุดลงต้องอยู่หลังจุดขึ้นในเส้นทาง' };
      if (seats < 1 || seats > 4) return { error: 'จองได้ 1–4 ที่นั่งต่อรายการจอง' };
      if (this.remaining(trip) < seats) return { error: 'ที่นั่งไม่พอ เหลือ ' + Math.max(0, this.remaining(trip)) + ' ที่นั่ง', seatError: true };
      var it = addBookingRaw(this.db, userId, trip, board, alight, seats, 'ยืนยัน', nowStamp());
      this.save();
      return { item: it };
    },

    nextId: function (table, prefix, width) {
      var max = 0; this.db[table].forEach(function (r) { var n = parseInt(String(r.id).replace(/\D/g, ''), 10); if (n > max) max = n; });
      return prefix + ('000000' + (max + 1)).slice(-width);
    }
  };

  window.Store = Store;
  window.U = { pad: pad, ymd: ymd, addDays: addDays, toMin: toMin, fmtMin: fmtMin, thDate: thDate, nowDate: nowDate, nowMin: nowMin, nowStamp: nowStamp,
    parseYmd: parseYmd, DAYS_TH: DAYS_TH, DAYS_SHORT: DAYS_SHORT, MONTHS_SHORT: MONTHS_SHORT };
})();
