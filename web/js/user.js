/* =========================================================
   user.js — หน้าจอผู้ใช้บริการ (Mobile-first)
   ========================================================= */
(function () {
  'use strict';
  var esc = UI.esc, icon = UI.icon, badge = UI.badge, S = Store;

  function tabbar(active) {
    var tabs = [['home', 'home', 'หน้าหลัก'], ['search', 'bus', 'จองรถ'], ['bookings', 'ticket', 'การจองของฉัน'], ['profile', 'user', 'โปรไฟล์']];
    return '<nav class="tabbar" aria-label="เมนูหลัก">' + tabs.map(function (t) {
      return '<a class="tab' + (active === t[0] ? ' on' : '') + '" href="#/u/' + t[0] + '"' + (active === t[0] ? ' aria-current="page"' : '') + '>' + icon(t[1], 24) + t[2] + '</a>';
    }).join('') + '</nav>';
  }
  function top(title, back) {
    return '<header class="m-top">' + (back ? '<a class="icb" href="' + back + '" aria-label="ย้อนกลับ">' + icon('back') + '</a>' : '') + '<h2 tabindex="-1" data-autofocus>' + esc(title) + '</h2></header>';
  }
  function shell(inner, opts) { opts = opts || {}; return '<div class="m-shell' + (opts.foot ? ' has-foot' : '') + '">' + inner + '</div>'; }

  function dateLabel(ymd) {
    var d = U.parseYmd(ymd), t = U.nowDate(), tm = U.ymd(U.addDays(new Date(), 1));
    var pre = ymd === t ? 'วันนี้' : (ymd === tm ? 'พรุ่งนี้' : U.DAYS_TH[d.getDay()]);
    return { top: pre, sub: U.DAYS_SHORT[d.getDay()] + ' ' + d.getDate() + ' ' + U.MONTHS_SHORT[d.getMonth()] };
  }

  /* รายการจองของผู้ใช้ + ข้อมูลประกอบ */
  function myItems(me) {
    var mine = {}; S.db.bookings.forEach(function (b) { if (b.userId === me.id) mine[b.id] = b; });
    return S.db.bookingItems.filter(function (i) { return mine[i.bookingId]; }).map(decorate);
  }
  function decorate(i) {
    var t = S.trip(i.tripId), a = t ? S.arrivals(t, i.boardStopId, i.alightStopId) : null, v = t ? S.vehicle(t.vehicleId) : null;
    return { it: i, trip: t, arr: a || { board: '', alight: '' }, veh: v, sort: (t ? t.date : '') + ' ' + (a ? a.board : ''),
      route: t ? (S.route(t.routeId) || {}).name : '', booking: S.booking(i.bookingId) };
  }
  function tabOf(x) {
    var st = x.it.status;
    if (st === 'ยกเลิก') return 'cancel';
    if (st === 'ยืนยัน' && x.trip && x.trip.status !== 'เสร็จสิ้น') return 'up';
    return 'done';
  }
  function displayStatus(x) { return x.it.status === 'ยืนยัน' && x.trip && x.trip.status === 'เสร็จสิ้น' ? 'No Show' : x.it.status; }

  /* ค้นหารอบ ตามกฎข้อ 7.2 */
  function searchTrips(q) {
    var today = U.nowDate(), now = U.nowMin(), hidden = 0;
    var list = S.db.trips.filter(function (t) { return t.date === q.date && t.status === 'เปิด'; }).map(function (t) {
      var a = S.arrivals(t, q.board, q.alight); if (!a) return null;
      if (q.date < today || (q.date === today && a.boardMin - now < 20)) { hidden++; return null; }
      var cap = S.tripSeats(t), rem = Math.max(0, S.remaining(t)), v = S.vehicle(t.vehicleId), vt = v ? S.vtype(v.typeId) : null;
      return { t: t, a: a, cap: cap, rem: rem, veh: v, vt: vt };
    }).filter(Boolean).sort(function (x, y) { return x.a.boardMin - y.a.boardMin; });
    return { list: list, hidden: hidden };
  }
  function allowedAlight(board) {
    var out = {};
    S.db.routes.forEach(function (r) {
      var rs = S.routeStops(r.id), bi = -1;
      rs.forEach(function (x, i) { if (bi < 0 && x.stopId === board) bi = i; });
      if (bi < 0) return;
      rs.slice(bi + 1).forEach(function (x) { if (x.stopId !== board) out[x.stopId] = true; });
    });
    return out;
  }

  /* ---------- Views ---------- */
  var V = {};

  V.home = function (me) {
    var items = myItems(me), ups = items.filter(function (x) { return tabOf(x) === 'up'; }).sort(function (a, b) { return a.sort < b.sort ? -1 : 1; });
    var n = ups[0], d = new Date();
    var h = '<header class="m-top big"><div style="flex:1"><div class="muted" style="font-size:13px">' + U.DAYS_TH[d.getDay()] + ' ' + d.getDate() + ' ' + U.MONTHS_SHORT[d.getMonth()] + ' ' + d.getFullYear() + '</div>' +
      '<h2 tabindex="-1" data-autofocus>สวัสดี ' + esc(me.name.split(' ')[0]) + '</h2></div>' +
      '<a class="icb" href="#/u/profile" aria-label="โปรไฟล์" style="background:#E1E8F1;border-radius:50%;color:var(--primary);font-weight:700">' + esc(me.name.charAt(0)) + '</a></header><main class="m-body">';
    if (n) {
      h += '<section class="hero" aria-label="การเดินทางถัดไป"><div class="row" style="justify-content:space-between"><span class="sub" style="font-weight:600">การเดินทางถัดไป</span>' + badge('ยืนยัน', 'b-green') + '</div>' +
        '<div class="row" style="align-items:baseline"><span class="big-time">' + esc(n.arr.board) + '</span><span class="sub">' + U.thDate(n.trip.date) + ' · รถถึงจุดขึ้น</span></div>' +
        '<div><div><span class="sub">ขึ้น</span> ' + esc(S.stopName(n.it.boardStopId)) + '</div><div><span class="sub">ลง</span> ' + esc(S.stopName(n.it.alightStopId)) + ' (' + esc(n.arr.alight) + ')</div>' +
        '<div class="sub">' + esc(n.veh ? n.veh.plate : '') + ' · ' + n.it.seats + ' ที่นั่ง · ' + esc(n.it.id) + '</div></div>' +
        '<a class="btn btn-lg" style="background:#fff;color:var(--primary)" href="#/u/qr/' + esc(n.it.id) + '">' + icon('qr', 20) + 'ดู QR</a></section>';
    } else {
      h += '<div class="card"><div style="font-weight:600">ยังไม่มีการเดินทางที่กำลังจะถึง</div><div class="muted" style="font-size:14px">จองรอบรถเพื่อรับ QR Code สำหรับขึ้นรถ</div></div>';
    }
    h += '<div class="card row"><div class="mono" style="font-size:32px;font-weight:600;color:var(--primary);width:48px;text-align:center">' + ups.length + '</div><div style="font-size:14px"><b>รายการจองที่กำลังจะถึง</b><br><span class="muted">สถานะยืนยัน รอขึ้นรถ</span></div></div>' +
      '<div class="grid2"><a class="card tile" href="#/u/search"><span class="tile-ic" style="background:var(--accent-t);color:#7A3F00">' + icon('bus') + '</span><b style="font-size:16px">จองรถ</b><span class="muted" style="font-size:13px">ค้นหารอบและจองที่นั่ง</span></a>' +
      '<a class="card tile" href="#/u/bookings"><span class="tile-ic" style="background:#E1E8F1;color:var(--primary)">' + icon('ticket') + '</span><b style="font-size:16px">การจองของฉัน</b><span class="muted" style="font-size:13px">QR, ประวัติ, ยกเลิก</span></a></div>';
    if (App.hasAdmin(me) || App.isDriver(me)) {
      h += '<div class="card stack" style="gap:8px"><b style="font-size:14px">เมนูสำหรับพนักงาน</b><div class="pill-row">' +
        (App.hasAdmin(me) ? '<a class="btn btn-s btn-sm" href="#/a/dashboard">ระบบหลังบ้าน</a>' : '') +
        (App.isDriver(me) ? '<a class="btn btn-s btn-sm" href="#/d/today">งานคนขับ</a>' : '') + '</div></div>';
    }
    return shell(h + '</main>' + tabbar('home'));
  };

  V.search = function () {
    var q = App.state.search, allow = allowedAlight(q.board);
    if (q.alight && !allow[q.alight]) q.alight = '';
    var days = []; for (var i = 0; i < 4; i++) days.push(U.ymd(U.addDays(new Date(), i)));
    var h = '<header class="m-top big"><h2 tabindex="-1" data-autofocus>จองรถ</h2></header><main class="m-body" style="gap:20px">' +
      '<fieldset class="stack" style="border:0;padding:0;margin:0;gap:8px"><legend class="lbl" style="font-size:13px;font-weight:600;color:var(--ink-2);margin-bottom:8px">1 · จุดขึ้น</legend><div class="chips">' +
      S.db.stops.map(function (s) { return '<button class="chip' + (q.board === s.id ? ' on' : '') + '" aria-pressed="' + (q.board === s.id) + '" data-act="pick-board" data-id="' + s.id + '">' + esc(s.name) + '</button>'; }).join('') + '</div></fieldset>' +
      '<fieldset class="stack" style="border:0;padding:0;margin:0;gap:8px"><legend style="font-size:13px;font-weight:600;color:var(--ink-2);margin-bottom:8px">2 · จุดลง <span class="muted" style="font-weight:400">— เฉพาะจุดที่อยู่หลังจุดขึ้นในเส้นทาง</span></legend><div class="chips">' +
      S.db.stops.map(function (s) { var ok = allow[s.id]; return '<button class="chip' + (q.alight === s.id ? ' on' : '') + '" aria-pressed="' + (q.alight === s.id) + '"' + (ok ? '' : ' disabled') + ' data-act="pick-alight" data-id="' + s.id + '">' + esc(s.name) + '</button>'; }).join('') + '</div></fieldset>' +
      '<fieldset class="stack" style="border:0;padding:0;margin:0;gap:8px"><legend style="font-size:13px;font-weight:600;color:var(--ink-2);margin-bottom:8px">3 · วันที่เดินรถ</legend><div class="chips" style="grid-template-columns:repeat(4,minmax(0,1fr))">' +
      days.map(function (d) { var l = dateLabel(d); return '<button class="chip' + (q.date === d ? ' on' : '') + '" style="text-align:center;padding:6px" aria-pressed="' + (q.date === d) + '" data-act="pick-date" data-id="' + d + '"><div style="font-weight:700">' + l.top + '</div><div style="font-size:12px">' + l.sub + '</div></button>'; }).join('') + '</div>' +
      '<div class="field"><label for="s-date">หรือเลือกวันที่</label><input id="s-date" type="date" class="inp" min="' + U.nowDate() + '" value="' + esc(q.date) + '" data-change="search-date"></div></fieldset>' +
      '<a class="btn btn-p btn-lg" href="#/u/results"' + (q.alight ? '' : ' aria-disabled="true" data-act="noop"') + '>ค้นหารอบรถ</a>' +
      (q.alight ? '' : '<div class="hint" style="text-align:center">เลือกจุดลงก่อนค้นหา</div>') + '</main>';
    return shell(h + tabbar('search'));
  };

  V.results = function () {
    var q = App.state.search;
    if (!q.alight) { location.replace('#/u/search'); return ''; }
    var r = searchTrips(q);
    var h = '<header class="m-top"><a class="icb" href="#/u/search" aria-label="ย้อนกลับ">' + icon('back') + '</a><div style="flex:1;min-width:0"><h2 tabindex="-1" data-autofocus>เลือกรอบ</h2>' +
      '<div class="muted" style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(S.stopName(q.board)) + ' → ' + esc(S.stopName(q.alight)) + ' · ' + U.thDate(q.date) + '</div></div></header><main class="m-body" style="gap:12px">';
    if (!r.list.length) h += UI.empty('ไม่พบรอบรถที่ตรงกับเงื่อนไข', 'ลองเปลี่ยนวันที่หรือจุดขึ้น–ลงแล้วค้นหาอีกครั้ง', '<a class="btn btn-s" href="#/u/search" style="margin-top:6px">เปลี่ยนเงื่อนไข</a>');
    r.list.forEach(function (x) {
      var full = x.rem <= 0;
      h += '<article class="card trip-card"><div class="row" style="justify-content:space-between"><span style="font-size:13px;font-weight:600;color:var(--ink-2)">' + esc((S.route(x.t.routeId) || {}).name) + ' · <span class="mono">' + esc(x.t.id) + '</span></span>' + badge(full ? 'ที่นั่งเต็ม' : 'เปิด') + '</div>' +
        '<div class="times"><div><div class="t">' + x.a.board + '</div><div class="muted" style="font-size:12px">ถึงจุดขึ้น</div></div><div class="dash">' + (x.a.alightMin - x.a.boardMin) + ' นาที</div><div style="text-align:right"><div class="t">' + x.a.alight + '</div><div class="muted" style="font-size:12px">ถึงจุดลง</div></div></div>' +
        '<div class="split"><span>ออก ' + esc(x.t.dep) + ' · ' + esc(x.vt ? x.vt.name : '') + ' ' + esc(x.veh ? x.veh.plate : '') + '</span><b class="' + (full ? 'seat-full' : (x.rem <= 3 ? 'seat-low' : '')) + '">เหลือ ' + x.rem + '/' + x.cap + ' ที่นั่ง</b></div>' +
        '<div class="grid2"><a class="btn btn-s" href="#/u/trip/' + x.t.id + '">ดูรายละเอียด</a>' +
        (full ? '<button class="btn" disabled>ที่นั่งเต็ม</button>' : '<a class="btn btn-p" href="#/u/seats/' + x.t.id + '" data-act="start-book">จอง</a>') + '</div></article>';
    });
    h += '<p class="hint" style="margin:0">รอบที่เหลือเวลาก่อนรถถึงจุดขึ้นน้อยกว่า 20 นาทีจะไม่แสดง (เวลาปัจจุบัน ' + U.fmtMin(U.nowMin()) + ' น.)</p></main>';
    return shell(h);
  };

  function tripCtx(id) {
    var q = App.state.search, t = S.trip(id); if (!t) return null;
    var a = S.arrivals(t, q.board, q.alight); if (!a) return null;
    var v = S.vehicle(t.vehicleId), vt = v ? S.vtype(v.typeId) : null;
    return { t: t, a: a, v: v, vt: vt, cap: S.tripSeats(t), rem: Math.max(0, S.remaining(t)) };
  }

  V.trip = function (id) {
    var c = tripCtx(id), q = App.state.search;
    if (!c) return shell(top('รายละเอียดรอบ', '#/u/results') + '<main class="m-body">' + UI.empty('ไม่พบรอบนี้', 'รอบอาจถูกยกเลิกหรือไม่ผ่านจุดที่เลือก') + '</main>');
    var rs = S.routeStops(c.t.routeId), cum = S.cum(c.t.routeId), dep = U.toMin(c.t.dep), p = c.a.seq;
    var diagram = rs.map(function (r, i) {
      var key = i === p[0] || i === p[1], seg = i >= p[0] && i <= p[1];
      return '<div class="rt' + (seg ? '' : ' off') + '"><div class="rt-t">' + U.fmtMin(dep + cum[i]) + '</div><div class="rail"><div class="dot' + (key ? ' key' : (seg ? ' on' : '')) + '"></div>' + (i < rs.length - 1 ? '<div class="ln' + (i >= p[0] && i < p[1] ? ' on' : '') + '"></div>' : '') + '</div>' +
        '<div><div class="rt-n">' + esc(S.stopName(r.stopId)) + (key ? '<span class="tag">' + (i === p[0] ? 'จุดขึ้น' : 'จุดลง') + '</span>' : '') + '</div><div class="rt-l">' + (i === 0 ? 'ต้นทาง' : '+' + r.minutes + ' นาทีจากจุดก่อนหน้า') + '</div></div></div>';
    }).join('');
    var full = c.rem <= 0;
    return shell(top('รายละเอียดรอบ', '#/u/results') + '<main class="m-body">' +
      '<div class="card" style="padding:4px 16px">' +
      kv('เส้นทาง', esc((S.route(c.t.routeId) || {}).name) + ' · <span class="mono">' + c.t.id + '</span>') + kv('วันที่ / เวลาออก', U.thDate(c.t.date) + ' · ' + c.t.dep) +
      kv('รถ', esc(c.v ? c.v.plate : '') + ' (' + esc(c.vt ? c.vt.name : '') + ')') + kv('ที่นั่งคงเหลือ', c.rem + ' / ' + c.cap) + kv('สถานะรอบ', badge(c.t.status)) + '</div>' +
      '<div class="card"><div class="row" style="justify-content:space-between;margin-bottom:14px"><b>จุดจอดและเวลาถึง</b><span class="muted" style="font-size:13px">เวลารวม ' + S.routeTotal(c.t.routeId) + ' นาที</span></div>' + diagram + '</div>' +
      '</main><div class="m-foot">' + (full ? '<button class="btn btn-lg btn-block" disabled>ที่นั่งเต็ม</button>' : '<a class="btn btn-p btn-lg btn-block" href="#/u/seats/' + c.t.id + '" data-act="start-book">จองรอบนี้</a>') + '</div>', { foot: true });
    function kv(k, v) { return '<div class="kv"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }
  };

  V.seats = function (id) {
    var c = tripCtx(id), q = App.state.search;
    if (!c) { location.replace('#/u/results'); return ''; }
    var max = Math.max(0, Math.min(4, c.rem));
    if (App.state.seats > max) App.state.seats = Math.max(1, max);
    var n = App.state.seats;
    return shell(top('เลือกจำนวนที่นั่ง', '#/u/results') + '<main class="m-body" style="gap:20px">' +
      '<div class="card" style="font-size:14px"><b>' + c.a.board + ' ' + esc(S.stopName(q.board)) + '</b><div class="muted">→ ' + c.a.alight + ' ' + esc(S.stopName(q.alight)) + '</div><div class="muted">' + U.thDate(c.t.date) + ' · ' + esc(c.vt ? c.vt.name : '') + ' ' + esc(c.v ? c.v.plate : '') + '</div></div>' +
      '<div class="card stack center" style="padding:28px 16px;gap:18px"><div id="seat-lbl" style="font-size:13px;font-weight:600;color:var(--ink-2)">จำนวนที่นั่งจอง</div>' +
      '<div class="stepper" role="group" aria-labelledby="seat-lbl"><button class="stp" data-act="seat-dec" aria-label="ลดที่นั่ง"' + (n <= 1 ? ' disabled' : '') + '>' + icon('minus', 26) + '</button>' +
      '<div class="stp-n" aria-live="polite">' + n + '</div><button class="stp" data-act="seat-inc" aria-label="เพิ่มที่นั่ง"' + (n >= max ? ' disabled' : '') + '>' + icon('plus', 26) + '</button></div>' +
      '<div class="muted" style="font-size:13px">เลือกได้ 1 – ' + max + ' ที่นั่ง<br>' + (c.rem < 4 ? 'รอบนี้เหลือเพียง ' + c.rem + ' ที่นั่ง' : 'จองได้สูงสุด 4 ที่นั่งต่อรายการจอง') + '</div></div>' +
      '<p class="hint" style="margin:0">ระบบบันทึกเฉพาะจำนวนที่นั่ง ไม่ต้องกรอกชื่อผู้โดยสาร</p></main>' +
      '<div class="m-foot">' + (max < 1 ? '<button class="btn btn-lg btn-block" disabled>ที่นั่งไม่พอ</button>' : '<a class="btn btn-p btn-lg btn-block" href="#/u/confirm/' + c.t.id + '">ถัดไป</a>') + '</div>', { foot: true });
  };

  V.confirm = function (id) {
    var c = tripCtx(id), q = App.state.search;
    if (!c) { location.replace('#/u/results'); return ''; }
    function kv(k, v) { return '<div class="kv"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }
    return shell(top('ยืนยันการจอง', '#/u/seats/' + id) + '<main class="m-body"><div class="card" style="padding:4px 16px">' +
      kv('เส้นทาง', esc((S.route(c.t.routeId) || {}).name)) + kv('วันที่เดินรถ', U.thDate(c.t.date)) + kv('เวลาออก', c.t.dep) +
      kv('จุดขึ้น', esc(S.stopName(q.board)) + ' (ถึง ' + c.a.board + ')') + kv('จุดลง', esc(S.stopName(q.alight)) + ' (ถึง ' + c.a.alight + ')') +
      kv('รถ', esc(c.v ? c.v.plate : '') + ' (' + esc(c.vt ? c.vt.name : '') + ')') + kv('จำนวนที่นั่ง', App.state.seats) + '</div>' +
      '<p class="hint" style="margin:0">ระบบจะตรวจสอบที่นั่งว่างอีกครั้งก่อนบันทึก และสร้าง QR Code สำหรับขึ้นรถ</p></main>' +
      '<div class="m-foot"><a class="btn btn-s btn-lg" style="flex:1" href="#/u/seats/' + id + '">ย้อนกลับ</a><button class="btn btn-p btn-lg" style="flex:1.6" data-act="do-book" data-id="' + id + '">ยืนยันการจอง</button></div>', { foot: true });
  };

  function kvs(x) {
    function kv(k, v) { return '<div class="kv"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }
    return '<div class="card" style="padding:4px 16px;width:100%;text-align:left">' +
      kv('รหัสการจอง', '<span class="mono">' + esc(x.it.bookingId) + ' / ' + esc(x.it.id) + '</span>') +
      kv('เส้นทาง / วันที่', esc(x.route) + ' · ' + U.thDate(x.trip.date)) + kv('เวลาออก', x.trip.dep) +
      kv('ขึ้น', esc(S.stopName(x.it.boardStopId)) + ' (' + x.arr.board + ')') + kv('ลง', esc(S.stopName(x.it.alightStopId)) + ' (' + x.arr.alight + ')') +
      kv('รถ', esc(x.veh ? x.veh.plate : '')) + kv('จำนวนที่นั่ง', x.it.seats) +
      (x.it.checkin ? kv('Check-in', esc(U.thDate(x.it.checkin.slice(0, 10)) + ' ' + x.it.checkin.slice(11))) : '') +
      kv('สถานะการจอง', badge(displayStatus(x))) + '</div>';
  }

  V.success = function (bd, me) {
    var it = S.item(bd); if (!it) { location.replace('#/u/bookings'); return ''; }
    var x = decorate(it);
    return shell('<main class="m-body center" style="padding-top:28px;gap:14px">' +
      '<div class="res-ic res-ok" style="width:60px;height:60px">' + icon('check', 32) + '</div><h2 tabindex="-1" data-autofocus style="margin:0;font-size:24px">จองสำเร็จ</h2>' +
      '<div class="muted mono" style="font-size:13px">การจอง ' + esc(it.bookingId) + ' · รายการ ' + esc(it.id) + '</div>' +
      UI.qrBox(it.qr) + '<div class="qr-code">' + esc(it.qr) + '</div>' + kvs(x) +
      '<button class="btn btn-s btn-lg btn-block" data-act="print-qr">' + icon('download', 20) + 'บันทึก / พิมพ์ QR</button>' +
      '<div class="grid2" style="width:100%"><a class="btn btn-s btn-lg" href="#/u/bookings">การจองของฉัน</a><a class="btn btn-p btn-lg" href="#/u/home">กลับหน้าหลัก</a></div></main>');
  };

  V.qr = function (bd, me) {
    var it = S.item(bd), b = it && S.booking(it.bookingId);
    if (!it || b.userId !== me.id) return shell(top('QR Code', '#/u/bookings') + App.views.denied('รายการจองนี้'));
    var x = decorate(it), st = displayStatus(x);
    return shell(top('QR Code สำหรับขึ้นรถ', '#/u/bookings') + '<main class="m-body center" style="gap:14px">' + badge(st) +
      UI.qrBox(it.qr, { cancelled: st === 'ยกเลิก' }) + '<div class="qr-code">' + esc(it.qr) + '</div>' +
      '<div class="muted" style="font-size:13px">' + (st === 'ยกเลิก' ? 'รายการนี้ถูกยกเลิกแล้ว ใช้ขึ้นรถไม่ได้' : 'แสดง QR นี้ให้คนขับสแกนเมื่อขึ้นรถ') + '</div>' + kvs(x) +
      (st === 'ยืนยัน' ? '<button class="btn btn-s btn-lg btn-block" data-act="print-qr">' + icon('download', 20) + 'บันทึก / พิมพ์ QR</button>' : '') + '</main>');
  };

  V.bookings = function (me) {
    var tab = App.state.bkTab, all = myItems(me);
    var list = all.filter(function (x) { return tabOf(x) === tab; }).sort(function (a, b) { return tab === 'up' ? (a.sort < b.sort ? -1 : 1) : (a.sort < b.sort ? 1 : -1); });
    var h = '<header class="m-top big"><h2 tabindex="-1" data-autofocus>การจองของฉัน</h2></header><div style="padding:0 20px 12px"><div class="seg" role="tablist">' +
      [['up', 'กำลังจะถึง'], ['done', 'เสร็จแล้ว'], ['cancel', 'ยกเลิก']].map(function (t) {
        var n = all.filter(function (x) { return tabOf(x) === t[0]; }).length;
        return '<button role="tab" aria-selected="' + (tab === t[0]) + '" class="' + (tab === t[0] ? 'on' : '') + '" data-act="bk-tab" data-id="' + t[0] + '">' + t[1] + ' (' + n + ')</button>';
      }).join('') + '</div></div><main class="m-body" style="gap:12px;padding-top:0">';
    if (!list.length) h += '<div class="empty"><div class="muted">ไม่มีรายการในแท็บนี้</div>' + (tab === 'up' ? '<a class="btn btn-p" href="#/u/search">จองรถ</a>' : '') + '</div>';
    list.slice(0, 40).forEach(function (x) {
      var st = displayStatus(x), canCancel = x.it.status === 'ยืนยัน' && x.trip && x.trip.status === 'เปิด';
      var d = U.parseYmd(x.trip.date);
      h += '<article class="card stack" style="gap:10px"><div class="row" style="justify-content:space-between"><span class="mono" style="font-size:12px;color:var(--ink-2)">' + esc(x.it.bookingId) + ' · ' + esc(x.it.id) + '</span>' + badge(st) + '</div>' +
        '<div class="row" style="align-items:flex-start"><div style="text-align:center;width:64px;flex:none"><div class="mono" style="font-size:22px;font-weight:600">' + x.arr.board + '</div><div class="muted" style="font-size:12px">' + d.getDate() + ' ' + U.MONTHS_SHORT[d.getMonth()] + '</div></div>' +
        '<div style="flex:1;font-size:14px"><div style="font-weight:600">' + esc(S.stopName(x.it.boardStopId)) + '</div><div class="muted">→ ' + esc(S.stopName(x.it.alightStopId)) + '</div><div class="muted" style="font-size:12px">' + esc(x.route) + ' · ' + x.it.seats + ' ที่นั่ง</div></div></div>' +
        (x.it.checkin ? '<div style="font-size:13px;color:#12467A;background:#EEF3FA;border-radius:10px;padding:8px 10px">Check-in เมื่อ ' + esc(U.thDate(x.it.checkin.slice(0, 10)) + ' ' + x.it.checkin.slice(11)) + '</div>' : '') +
        '<div class="row" style="gap:8px"><a class="btn btn-s" style="flex:1" href="#/u/qr/' + x.it.id + '">ดู QR</a>' +
        (canCancel ? '<button class="btn btn-r" style="flex:1" data-act="ask-cancel" data-id="' + x.it.id + '">ยกเลิก</button>' : '') + '</div></article>';
    });
    return shell(h + '</main>' + tabbar('bookings'));
  };

  V.profile = function (me) {
    var dept = S.by('departments', me.deptId), pos = S.by('positions', me.positionId);
    function kv(k, v) { return '<div class="kv"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }
    return shell('<header class="m-top big"><h2 tabindex="-1" data-autofocus>โปรไฟล์</h2></header><main class="m-body">' +
      '<div class="card row"><div style="width:56px;height:56px;border-radius:50%;background:#E1E8F1;color:var(--primary);display:grid;place-items:center;font-size:22px;font-weight:700">' + esc(me.name.charAt(0)) + '</div>' +
      '<div><div style="font-size:18px;font-weight:700">' + esc(me.name) + '</div><div class="muted mono" style="font-size:13px">' + esc(me.id) + '</div></div></div>' +
      '<div class="card" style="padding:4px 16px">' + kv('username', '<span class="mono">' + esc(me.username) + '</span>') + kv('email', esc(me.email)) +
      kv('แผนก', esc(dept ? dept.name + ' (' + dept.id + ')' : '-')) + (pos ? kv('ตำแหน่ง', esc(pos.name)) : '') + (me.employee ? kv('เบอร์โทร', '<span class="mono">' + esc(me.employee.phone) + '</span>') : '') + '</div>' +
      (App.hasAdmin(me) ? '<a class="btn btn-s btn-lg" href="#/a/dashboard">ไปที่ระบบหลังบ้าน</a>' : '') +
      (App.isDriver(me) ? '<a class="btn btn-s btn-lg" href="#/d/today">ไปที่งานคนขับ</a>' : '') +
      '<button class="btn btn-r btn-lg" data-act="logout">' + icon('logout', 20) + 'ออกจากระบบ</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="reset-data">รีเซ็ตข้อมูลตัวอย่าง</button></main>' + tabbar('profile'));
  };

  App.views.user = function (parts, me) {
    var p = parts[0] || 'home';
    switch (p) {
      case 'home': return V.home(me);
      case 'search': return V.search(me);
      case 'results': return V.results(me);
      case 'trip': return V.trip(parts[1]);
      case 'seats': return V.seats(parts[1]);
      case 'confirm': return V.confirm(parts[1]);
      case 'success': return V.success(parts[1], me);
      case 'qr': return V.qr(parts[1], me);
      case 'bookings': return V.bookings(me);
      case 'profile': return V.profile(me);
      default: location.replace('#/u/home'); return '';
    }
  };

  /* ---------- Actions ---------- */
  var A = App.actions;
  A.noop = function () {};
  A['pick-board'] = function (el) { var q = App.state.search; q.board = el.dataset.id; if (!allowedAlight(q.board)[q.alight]) q.alight = ''; App.refresh(); };
  A['pick-alight'] = function (el) { App.state.search.alight = el.dataset.id; App.refresh(); };
  A['pick-date'] = function (el) { App.state.search.date = el.dataset.id; App.refresh(); };
  App.changes['search-date'] = function (el) { if (el.value) { App.state.search.date = el.value; App.refresh(); } };
  A['start-book'] = function (el) { App.state.seats = 1; location.hash = el.getAttribute('href'); };
  A['seat-dec'] = function () { App.state.seats = Math.max(1, App.state.seats - 1); App.refresh(); };
  A['seat-inc'] = function () { App.state.seats = Math.min(4, App.state.seats + 1); App.refresh(); };
  A['do-book'] = function (el) {
    var q = App.state.search, me = App.me();
    el.disabled = true; el.textContent = 'กำลังบันทึก…';
    setTimeout(function () {
      Store.load(); // ตรวจที่นั่งซ้ำจากข้อมูลล่าสุด
      var r = Store.createBooking(me.id, el.dataset.id, q.board, q.alight, App.state.seats);
      if (r.error) {
        UI.toast(r.error, 'bad');
        if (r.seatError) App.go('#/u/seats/' + el.dataset.id); else App.go('#/u/results');
        return;
      }
      App.go('#/u/success/' + r.item.id);
    }, 350);
  };
  A['bk-tab'] = function (el) { App.state.bkTab = el.dataset.id; App.refresh(); };
  A['ask-cancel'] = function (el) {
    var it = Store.item(el.dataset.id), t = Store.trip(it.tripId);
    UI.confirmBox({ title: 'ยืนยันการยกเลิกรายการจอง ' + it.id + '?', danger: true, okText: 'ยืนยันการยกเลิก', cancelText: 'กลับ', sheet: true,
      body: '<span class="muted">ที่นั่ง ' + it.seats + ' ที่จะถูกคืนให้รอบ ' + esc(t.dep) + ' ' + esc((Store.route(t.routeId) || {}).name) + ' (' + U.thDate(t.date) + ') และ QR Code นี้จะใช้ขึ้นรถไม่ได้</span>',
      onOk: function () { it.status = 'ยกเลิก'; Store.save(); App.refresh(); UI.toast('ยกเลิก ' + it.id + ' แล้ว — คืน ' + it.seats + ' ที่นั่งให้รอบ ' + t.dep); } });
  };
  A['print-qr'] = function () { window.print(); };
})();
