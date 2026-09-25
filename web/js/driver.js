/* =========================================================
   driver.js — หน้าจอคนขับ (งานวันนี้ / ผู้โดยสาร / สแกน QR / ปิดงาน / ประวัติ)
   ========================================================= */
(function () {
  'use strict';
  var esc = UI.esc, icon = UI.icon, badge = UI.badge, S = Store;

  function tabbar(active) {
    var tabs = [['today', 'cal', 'งานวันนี้'], ['scan', 'scan', 'สแกน QR'], ['history', 'clock', 'ประวัติ'], ['me', 'user', 'บัญชี']];
    return '<nav class="tabbar" aria-label="เมนูคนขับ">' + tabs.map(function (t) {
      return '<a class="tab' + (active === t[0] ? ' on' : '') + '" href="#/d/' + t[0] + '"' + (active === t[0] ? ' aria-current="page"' : '') + '>' + icon(t[1], 24) + t[2] + '</a>';
    }).join('') + '</nav>';
  }
  var LABEL = { 'เปิด': 'เปิด (รอเริ่มงาน)', 'กำลังเดินทาง': 'กำลังเดินทาง', 'เสร็จสิ้น': 'เสร็จสิ้น', 'ยกเลิก': 'ยกเลิก' };
  function stBadge(s) { return badge(LABEL[s] || s, { 'เปิด': 'b-green', 'กำลังเดินทาง': 'b-amber', 'เสร็จสิ้น': 'b-gray', 'ยกเลิก': 'b-red' }[s]); }
  function myTrips(me) { return S.db.trips.filter(function (t) { return t.driverId === me.id; }); }
  function stats(t) {
    var items = S.tripItems(t.id).filter(function (i) { return i.status !== 'ยกเลิก'; });
    var sum = function (arr) { return arr.reduce(function (a, i) { return a + (+i.seats); }, 0); };
    var checked = items.filter(function (i) { return i.checkin; });
    var pending = items.filter(function (i) { return !i.checkin && i.status === 'ยืนยัน'; });
    return { items: items, booked: sum(items), real: sum(checked), waiting: sum(pending), pending: pending, noShow: items.filter(function (i) { return i.status === 'No Show'; }).length };
  }
  function userOf(item) { var b = S.booking(item.bookingId); var u = b && S.user(b.userId); return u ? u.name.split(' ')[0] : '-'; }
  function vehTxt(t) { var v = S.vehicle(t.vehicleId), vt = v && S.vtype(v.typeId); return (v ? v.plate : '-') + (vt ? ' (' + vt.name + ')' : ''); }
  function active(me) { return myTrips(me).filter(function (t) { return t.status === 'กำลังเดินทาง'; })[0]; }

  var V = {};
  V.today = function (me) {
    var today = U.nowDate(), d = new Date();
    var list = myTrips(me).filter(function (t) { return t.date === today; }).sort(function (a, b) { return a.dep < b.dep ? -1 : 1; });
    var h = '<header class="m-top big"><div style="flex:1"><div class="muted" style="font-size:13px">' + U.DAYS_TH[d.getDay()] + ' ' + d.getDate() + ' ' + U.MONTHS_SHORT[d.getMonth()] + ' ' + d.getFullYear() + '</div><h2 tabindex="-1" data-autofocus>งานวันนี้</h2></div>' +
      '<div style="text-align:right;font-size:13px;line-height:1.4"><b>' + esc(me.name) + '</b><div class="muted">คนขับ · ' + esc(me.id) + '</div></div></header><main class="m-body">';
    if (!list.length) h += UI.empty('วันนี้ไม่มีรอบที่ได้รับมอบหมาย', 'ดูรอบที่ผ่านมาได้ในแท็บประวัติ');
    list.forEach(function (t) {
      var s = stats(t);
      h += '<a class="card stack" style="gap:10px;text-decoration:none;color:inherit" href="#/d/trip/' + t.id + '">' +
        '<div class="row" style="justify-content:space-between"><div class="row" style="align-items:baseline;gap:10px"><span class="mono" style="font-size:30px;font-weight:600">' + t.dep + '</span><b>' + esc((S.route(t.routeId) || {}).name) + '</b></div>' + stBadge(t.status) + '</div>' +
        '<div style="font-size:14px;color:var(--ink-2)">รถ: ' + esc(vehTxt(t)) + ' · <span class="mono">' + t.id + '</span></div>' +
        '<div class="grid2"><div style="background:var(--bg);border-radius:12px;padding:8px 10px"><div class="muted" style="font-size:12px">จองแล้ว</div><b>' + s.booked + ' / ' + S.tripSeats(t) + ' ที่นั่ง</b></div>' +
        '<div style="background:var(--bg);border-radius:12px;padding:8px 10px"><div class="muted" style="font-size:12px">Check-in แล้ว</div><b>' + s.real + ' ที่นั่ง</b></div></div></a>';
    });
    return '<div class="m-shell">' + h + '<p class="hint" style="margin:0">แสดงเฉพาะรอบการเดินรถที่คุณเป็นคนขับในวันนี้ เรียงตามเวลาออก</p></main>' + tabbar('today') + '</div>';
  };

  V.trip = function (id, me) {
    var t = S.trip(id);
    if (!t || t.driverId !== me.id) return '<div class="m-shell">' + App.views.denied('รอบนี้ (ไม่ได้ถูกมอบหมายให้คุณ)') + '</div>';
    var s = stats(t), rs = S.routeStops(t.routeId), cum = S.cum(t.routeId), dep = U.toMin(t.dep);
    var rows = rs.map(function (r, i) {
      var ups = s.items.filter(function (it) { var p = S.seqPair(t.routeId, it.boardStopId, it.alightStopId); return p && p[0] === i; });
      var downs = s.items.filter(function (it) { var p = S.seqPair(t.routeId, it.boardStopId, it.alightStopId); return p && p[1] === i; });
      var sum = function (a) { return a.reduce(function (x, y) { return x + (+y.seats); }, 0); };
      return '<div class="stop' + (ups.length || downs.length ? '' : ' idle') + '"><div class="st-t">' + U.fmtMin(dep + cum[i]) + '</div><div><div class="st-n">' + esc(S.stopName(r.stopId)) + '</div>' +
        '<div class="pline"><span class="dir dir-up">ขึ้น ' + sum(ups) + '</span>' + ups.map(function (it) {
          var cls = it.checkin ? 'ok' : (it.status === 'No Show' ? 'ns' : '');
          return '<span class="pill ' + cls + '">' + esc(userOf(it)) + ' (' + it.seats + ')' + (it.checkin ? ' ✓ ' + it.checkin.slice(11) : (it.status === 'No Show' ? ' · No Show' : '')) + '</span>';
        }).join('') + '</div>' +
        '<div class="pline"><span class="dir dir-down">ลง ' + sum(downs) + '</span>' + downs.map(function (it) { return '<span class="pill">' + esc(userOf(it)) + ' (' + it.seats + ')</span>'; }).join('') + '</div></div></div>';
    }).join('');
    var foot;
    if (t.status === 'เปิด') foot = t.date === U.nowDate() ? '<button class="btn btn-a btn-lg btn-block" data-act="trip-start" data-id="' + t.id + '">เริ่มการเดินทาง</button>' : '<div class="muted" style="text-align:center;flex:1;padding:12px 0">เริ่มการเดินทางได้ในวันที่ ' + U.thDate(t.date) + '</div>';
    else if (t.status === 'กำลังเดินทาง') foot = '<a class="btn btn-p btn-lg" style="flex:1.3" href="#/d/scan">' + icon('scan', 20) + 'สแกน QR</a><button class="btn btn-s btn-lg" style="flex:1" data-act="trip-close" data-id="' + t.id + '">ปิดงาน</button>';
    else foot = '<div style="flex:1;text-align:center;font-size:14px;color:var(--ok);font-weight:600;padding:10px 0">ปิดงานแล้ว · ผู้ใช้บริการจริง ' + s.real + ' ที่นั่ง · No Show ' + s.noShow + ' รายการ</div>';
    return '<div class="m-shell has-foot"><header class="m-top"><a class="icb" href="#/d/today" aria-label="ย้อนกลับ">' + icon('back') + '</a><div style="flex:1"><h2 tabindex="-1" data-autofocus>รอบ ' + t.dep + ' · ' + esc((S.route(t.routeId) || {}).name) + '</h2>' +
      '<div class="muted" style="font-size:12px">' + U.thDate(t.date) + ' · ' + esc(vehTxt(t)) + ' · <span class="mono">' + t.id + '</span></div></div>' + stBadge(t.status) + '</header><main class="m-body">' +
      '<div class="stat3"><div class="card"><div class="muted" style="font-size:12px">จองแล้ว</div><div class="n">' + s.booked + '/' + S.tripSeats(t) + '</div></div>' +
      '<div class="card"><div class="muted" style="font-size:12px">Check-in</div><div class="n" style="color:var(--ok)">' + s.real + '</div></div>' +
      '<div class="card"><div class="muted" style="font-size:12px">ยังไม่ขึ้น</div><div class="n">' + s.waiting + '</div></div></div>' +
      '<div class="card" style="padding:6px 16px"><div style="font-weight:700;padding:10px 0 2px">ผู้โดยสารตามจุดจอด</div>' + rows + '</div></main><div class="m-foot">' + foot + '</div></div>';
  };

  V.scan = function (me) {
    var t = active(me);
    var h = '<header class="m-top big"><h2 tabindex="-1" data-autofocus style="flex:1">สแกน QR</h2>' + (t ? badge('รอบ ' + t.dep + ' · ' + stats(t).real + '/' + stats(t).booked, 'b-amber') : '') + '</header><main class="m-body">';
    if (!t) {
      h += '<div class="empty"><div class="empty-ic">' + icon('scan', 30) + '</div><div class="empty-t">ยังไม่มีรอบที่กำลังเดินทาง</div><div class="muted">กด “เริ่มการเดินทาง” ในรายละเอียดรอบก่อน จึงจะสแกน QR ได้</div><a class="btn btn-s" href="#/d/today">ไปที่งานวันนี้</a></div>';
    } else {
      var cam = 'BarcodeDetector' in window && navigator.mediaDevices;
      h += '<div class="vf" id="vf"><div class="frame"></div><div style="position:absolute;bottom:12px;font-size:12px">' + (cam ? 'กด “เปิดกล้อง” แล้วเล็งไปที่ QR Code' : 'เบราว์เซอร์นี้ไม่รองรับการสแกนด้วยกล้อง — พิมพ์รหัส QR ด้านล่าง') + '</div></div>' +
        (cam ? '<button class="btn btn-p btn-lg" data-act="cam-toggle" id="cam-btn">' + icon('scan', 20) + 'เปิดกล้อง</button>' : '') +
        '<form data-form="scan-code" class="row" style="gap:8px"><label for="qr-in" class="sr-only">รหัส QR</label><input id="qr-in" name="code" class="inp mono" placeholder="เช่น MUT-AB12CD" autocomplete="off" style="text-transform:uppercase"><button class="btn btn-p" type="submit">ตรวจ</button></form>' +
        '<div style="font-size:13px;font-weight:600;color:var(--ink-2);margin-top:4px">โหมดทดสอบ — แตะเพื่อจำลองการสแกน</div>';
      S.tripItems(t.id).forEach(function (it) {
        var hint = it.status === 'ยกเลิก' ? 'ถูกยกเลิก' : (it.checkin ? 'สแกนแล้ว' : 'ขึ้นที่ ' + S.stopName(it.boardStopId));
        h += '<button class="qbtn" data-act="scan-sample" data-code="' + esc(it.qr) + '"><span class="mono" style="font-size:12px;font-weight:600;background:#F1F0EC;border-radius:8px;padding:4px 8px">' + esc(it.qr) + '</span><span style="flex:1;font-size:14px">' + esc(userOf(it)) + ' · ' + it.seats + ' ที่นั่ง</span><span class="muted" style="font-size:12px">' + esc(hint) + '</span></button>';
      });
      var other = S.db.bookingItems.filter(function (i) { return i.tripId !== t.id && i.status === 'ยืนยัน'; })[0];
      if (other) h += '<button class="qbtn" data-act="scan-sample" data-code="' + esc(other.qr) + '"><span class="mono" style="font-size:12px;font-weight:600;background:#F1F0EC;border-radius:8px;padding:4px 8px">' + esc(other.qr) + '</span><span style="flex:1;font-size:14px">' + esc(userOf(other)) + ' · ' + other.seats + ' ที่นั่ง</span><span class="muted" style="font-size:12px">QR ของรอบอื่น</span></button>';
    }
    return '<div class="m-shell">' + h + '</main>' + tabbar('scan') + '</div>';
  };

  V.history = function (me) {
    var list = myTrips(me).filter(function (t) { return t.status === 'เสร็จสิ้น'; }).sort(function (a, b) { return (a.date + a.dep) < (b.date + b.dep) ? 1 : -1; }).slice(0, 30);
    var h = '<header class="m-top big"><h2 tabindex="-1" data-autofocus>ประวัติรอบที่ขับ</h2></header><main class="m-body" style="gap:10px">';
    if (!list.length) h += UI.empty('ยังไม่มีประวัติ');
    list.forEach(function (t) {
      var s = stats(t);
      h += '<div class="card stack" style="gap:8px;padding:14px 16px"><div class="row" style="justify-content:space-between"><b>' + U.thDate(t.date) + ' · <span class="mono">' + t.dep + '</span> · ' + esc((S.route(t.routeId) || {}).name) + '</b>' + stBadge(t.status) + '</div>' +
        '<div class="muted" style="font-size:13px">รถ ' + esc(vehTxt(t)) + '</div><div class="stat3" style="font-size:12px">' +
        '<div style="background:var(--bg);border-radius:10px;padding:6px 8px"><div class="muted">จอง</div><div class="n" style="font-size:16px">' + s.booked + '</div></div>' +
        '<div style="background:var(--bg);border-radius:10px;padding:6px 8px"><div class="muted">ผู้ใช้จริง</div><div class="n" style="font-size:16px">' + s.real + '</div></div>' +
        '<div style="background:var(--bg);border-radius:10px;padding:6px 8px"><div class="muted">No Show</div><div class="n" style="font-size:16px">' + s.noShow + '</div></div></div></div>';
    });
    return '<div class="m-shell">' + h + '</main>' + tabbar('history') + '</div>';
  };

  V.me = function (me) {
    return '<div class="m-shell"><header class="m-top big"><h2 tabindex="-1" data-autofocus>บัญชี</h2></header><main class="m-body">' +
      '<div class="card"><div style="font-size:18px;font-weight:700">' + esc(me.name) + '</div><div class="muted">' + esc(me.username) + ' · ' + esc(me.employee ? me.employee.phone : '') + '</div></div>' +
      '<a class="btn btn-s btn-lg" href="#/u/home">จองรถ (หน้าผู้ใช้บริการ)</a>' +
      (App.hasAdmin(me) ? '<a class="btn btn-s btn-lg" href="#/a/dashboard">ระบบหลังบ้าน</a>' : '') +
      '<button class="btn btn-r btn-lg" data-act="logout">' + icon('logout', 20) + 'ออกจากระบบ</button></main>' + tabbar('me') + '</div>';
  };

  App.views.driver = function (parts, me) {
    stopCam();
    var p = parts[0] || 'today';
    if (p === 'trip') return V.trip(parts[1], me);
    if (V[p]) return V[p](me);
    location.replace('#/d/today'); return '';
  };

  /* ---------- Scan logic (ข้อ 9.3) ---------- */
  function processScan(code) {
    var me = App.me(), t = active(me);
    code = String(code || '').trim().toUpperCase();
    if (!t) return;
    var it = S.db.bookingItems.filter(function (i) { return i.qr.toUpperCase() === code; })[0], r;
    if (!code) return;
    if (!it) r = { cls: 'res-bad', ic: 'x', title: 'ไม่พบรายการจอง', msg: 'ไม่พบรายการจองจาก QR Code นี้' };
    else if (it.tripId !== t.id) r = { cls: 'res-bad', ic: 'x', title: 'ปฏิเสธการขึ้นรถ', msg: 'QR Code นี้ไม่ตรงกับรอบการเดินทาง ไม่สามารถขึ้นรถได้' };
    else if (it.status === 'ยกเลิก') r = { cls: 'res-bad', ic: 'x', title: 'ปฏิเสธการขึ้นรถ', msg: 'รายการจองนี้ถูกยกเลิกแล้ว' };
    else if (it.checkin) r = { cls: 'res-warn', ic: 'alert', title: 'Check-in ซ้ำ', msg: 'รายการจองนี้ Check-in แล้วเมื่อ ' + it.checkin.slice(11) };
    else if (it.status !== 'ยืนยัน') r = { cls: 'res-bad', ic: 'x', title: 'ปฏิเสธการขึ้นรถ', msg: 'สถานะรายการจอง: ' + it.status };
    else {
      it.checkin = U.nowStamp(); it.status = 'Check-in แล้ว'; S.save();
      r = { cls: 'res-ok', ic: 'check', title: 'Check-in สำเร็จ', msg: userOf(it) + ' ' + it.seats + ' ที่นั่ง (ลงที่ ' + S.stopName(it.alightStopId) + ')' };
    }
    if (navigator.vibrate) navigator.vibrate(r.cls === 'res-ok' ? 60 : [60, 60, 60]);
    UI.modal('<div class="res-ic ' + r.cls + '">' + icon(r.ic, 36) + '</div><h3 style="text-align:center">' + esc(r.title) + '</h3>' +
      '<div class="modal-body" style="text-align:center">' + esc(r.msg) + '</div><div class="muted mono" style="text-align:center;font-size:12px">' + esc(code) + (it ? ' · ' + esc(it.id) : '') + '</div>' +
      '<button class="btn btn-p btn-lg" data-act="scan-next">สแกนต่อ</button>', { size: 'sm', sheet: true });
  }
  App.forms['scan-code'] = function (f, fd) { processScan(fd.get('code')); f.reset(); };
  App.actions['scan-sample'] = function (el) { processScan(el.dataset.code); };
  App.actions['scan-next'] = function () { UI.closeModal(); App.refresh(); };

  /* กล้อง: ใช้ BarcodeDetector (Chrome/Android) */
  var cam = { stream: null, timer: null };
  function stopCam() {
    if (cam.timer) clearInterval(cam.timer);
    if (cam.stream) cam.stream.getTracks().forEach(function (tr) { tr.stop(); });
    cam.stream = null; cam.timer = null;
  }
  App.actions['cam-toggle'] = function (el) {
    if (cam.stream) { stopCam(); App.refresh(); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (stream) {
      cam.stream = stream;
      var vf = document.getElementById('vf'), v = document.createElement('video');
      v.setAttribute('playsinline', ''); v.muted = true; v.srcObject = stream; vf.insertBefore(v, vf.firstChild); v.play();
      el.textContent = 'ปิดกล้อง';
      var det = new window.BarcodeDetector({ formats: ['qr_code'] }), busy = false;
      cam.timer = setInterval(function () {
        if (busy || document.getElementById('modal-root').innerHTML) return;
        busy = true;
        det.detect(v).then(function (codes) { busy = false; if (codes.length) processScan(codes[0].rawValue); }).catch(function () { busy = false; });
      }, 400);
    }).catch(function () { UI.toast('เปิดกล้องไม่ได้ — ตรวจสอบสิทธิ์การใช้กล้อง', 'bad'); });
  };

  /* ---------- เริ่มงาน / ปิดงาน ---------- */
  App.actions['trip-start'] = function (el) {
    var me = App.me(), t = S.trip(el.dataset.id), other = active(me);
    if (other && other.id !== t.id) { UI.toast('ปิดงานรอบ ' + other.dep + ' ก่อนเริ่มรอบใหม่', 'bad'); return; }
    t.status = 'กำลังเดินทาง'; S.save(); App.refresh(); UI.toast('เริ่มการเดินทางรอบ ' + t.dep + ' แล้ว', 'ok');
  };
  App.actions['trip-close'] = function (el) {
    var t = S.trip(el.dataset.id), s = stats(t);
    UI.confirmBox({ title: 'ปิดงานรอบ ' + t.dep + '?', okText: 'ยืนยันปิดงาน', cancelText: 'กลับ', sheet: true,
      body: '<div class="grid2"><div style="background:var(--ok-t);color:var(--ok);border-radius:14px;padding:12px"><div style="font-size:12px">ผู้ใช้บริการจริง</div><div class="mono" style="font-size:26px;font-weight:600">' + s.real + '</div><div style="font-size:12px">ที่นั่ง (Check-in แล้ว)</div></div>' +
        '<div style="background:var(--warn-t);color:var(--warn);border-radius:14px;padding:12px"><div style="font-size:12px">No Show</div><div class="mono" style="font-size:26px;font-weight:600">' + s.pending.length + '</div><div style="font-size:12px">รายการที่ยังไม่ Check-in</div></div></div>' +
        (s.pending.length ? '<div style="font-weight:600;font-size:13px;margin:12px 0 6px">รายชื่อ No Show</div>' + s.pending.map(function (i) { return '<div class="row" style="justify-content:space-between;background:var(--bg);border-radius:10px;padding:8px 12px;margin-bottom:6px;font-size:14px"><span>' + esc(userOf(i)) + ' · ' + i.seats + ' ที่นั่ง</span><span class="mono muted" style="font-size:12px">' + i.id + '</span></div>'; }).join('') : '') +
        '<p class="muted" style="font-size:13px;margin:10px 0 0">เมื่อยืนยัน สถานะรอบจะเป็น “เสร็จสิ้น” และรายการที่ไม่ Check-in จะเปลี่ยนเป็น No Show</p>',
      onOk: function () {
        t.status = 'เสร็จสิ้น';
        s.pending.forEach(function (i) { i.status = 'No Show'; });
        S.save(); App.refresh(); UI.toast('ปิดงานแล้ว — ผู้ใช้จริง ' + s.real + ' ที่นั่ง, No Show ' + s.pending.length + ' รายการ', 'ok');
      } });
  };
})();
