/* =========================================================
   app.js — Router, Login / Access Control, event delegation
   ========================================================= */
(function () {
  'use strict';
  var esc = UI.esc, icon = UI.icon;

  var App = {
    views: {}, actions: {}, forms: {}, inputs: {}, changes: {},
    state: {
      search: { board: 'S002', alight: 'S004', date: U.nowDate() },
      seats: 1,
      bkTab: 'up',
      login: { username: '', error: {} }
    },
    me: function () { var id = Store.session(); return id ? Store.user(id) : null; },
    go: function (hash) { if (location.hash === hash) App.render(); else location.hash = hash; },
    /* หน้าแรกตามสิทธิ์ของตำแหน่ง */
    homeFor: function (u) {
      if (!u) return '#/login';
      if (Store.perm(u.positionId, 'SC12')) return '#/d/today';
      if (u.positionId === 'P01') return '#/a/dashboard';
      return '#/u/home';
    },
    hasAdmin: function (u) { return !!(u && u.positionId && Store.db.permissions.some(function (p) { return p.positionId === u.positionId && p.screenId !== 'SC12'; })); },
    isDriver: function (u) { return !!(u && Store.perm(u.positionId, 'SC12')); }
  };
  window.App = App;

  /* ---------- Login ---------- */
  App.views.login = function () {
    var L = App.state.login, e = L.error || {};
    return '<main class="login"><div class="login-box">' +
      '<div class="stack"><div class="logo">' + icon('bus', 30) + '</div><h1>MUT Shuttle</h1>' +
      '<p class="muted" style="margin:0">ระบบจองรถรับส่ง มหาวิทยาลัยเทคโนโลยีมหานคร<br>เข้าสู่ระบบก่อนจองรถทุกครั้ง</p></div>' +
      '<form class="stack" data-form="login" novalidate>' +
      '<div class="field"><label for="lg-u">username</label><input id="lg-u" name="username" class="inp' + (e.username ? ' bad' : '') + '" value="' + esc(L.username) + '" autocomplete="username" required>' + (e.username ? '<div class="err" role="alert">' + esc(e.username) + '</div>' : '') + '</div>' +
      '<div class="field"><label for="lg-p">password</label><div style="position:relative"><input id="lg-p" name="password" type="password" class="inp' + (e.password ? ' bad' : '') + '" style="padding-right:84px" autocomplete="current-password" required>' +
      '<button type="button" class="btn btn-sm btn-e" style="position:absolute;right:6px;top:6px" data-act="toggle-pw" aria-controls="lg-p">แสดง</button></div>' + (e.password ? '<div class="err" role="alert">' + esc(e.password) + '</div>' : '') + '</div>' +
      '<button class="btn btn-p btn-lg" type="submit" id="lg-btn">เข้าสู่ระบบ</button>' +
      '</form>' +
      '<div class="demo"><b>บัญชีทดลอง</b> (password <span class="mono">1234</span>) — แตะเพื่อกรอก<br>' +
      'ผู้ใช้บริการ <button type="button" data-act="demo" data-u="mani">mani</button> ' +
      'พนักงาน <button type="button" data-act="demo" data-u="somchai">somchai</button><br>' +
      'คนขับ <button type="button" data-act="demo" data-u="somsak">somsak</button> ' +
      'Admin <button type="button" data-act="demo" data-u="admin">admin</button></div>' +
      '</div></main>';
  };
  App.actions['toggle-pw'] = function (el) {
    var p = document.getElementById('lg-p'); var show = p.type === 'password';
    p.type = show ? 'text' : 'password'; el.textContent = show ? 'ซ่อน' : 'แสดง';
  };
  App.actions.demo = function (el) {
    document.getElementById('lg-u').value = el.dataset.u;
    document.getElementById('lg-p').value = '1234';
    document.getElementById('lg-btn').focus();
  };
  App.forms.login = function (f, fd) {
    var u = String(fd.get('username') || '').trim(), p = String(fd.get('password') || ''), err = {};
    App.state.login.username = u;
    var user = Store.db.users.filter(function (x) { return x.username === u; })[0];
    if (!u) err.username = 'กรุณากรอก username';
    else if (!user) err.username = 'ไม่พบ username นี้ในระบบ';
    else if (!p) err.password = 'กรุณากรอก password';
    else if (user.password !== p) err.password = 'password ไม่ถูกต้อง';
    App.state.login.error = err;
    if (err.username || err.password) { App.render(); return; }
    var btn = document.getElementById('lg-btn'); btn.disabled = true; btn.textContent = 'กำลังเข้าสู่ระบบ…';
    setTimeout(function () {
      Store.setSession(user.id);
      App.state.login = { username: '', error: {} };
      var back = App.state.afterLogin; App.state.afterLogin = null;
      App.go(back || App.homeFor(user));
    }, 400);
  };
  App.actions.logout = function () {
    Store.setSession('');
    UI.closeModal();
    App.go('#/login');
    UI.toast('ออกจากระบบแล้ว');
  };
  App.actions['reset-data'] = function () {
    UI.confirmBox({ title: 'รีเซ็ตข้อมูลตัวอย่าง?', body: 'ข้อมูลทั้งหมดที่เพิ่ม/แก้ไขในเบราว์เซอร์นี้จะถูกล้าง และสร้างข้อมูลตัวอย่างใหม่', okText: 'รีเซ็ต', danger: true,
      onOk: function () { Store.reset(); Store.setSession(''); App.go('#/login'); UI.toast('รีเซ็ตข้อมูลแล้ว'); } });
  };

  /* ---------- Access Denied ---------- */
  App.views.denied = function (what) {
    return '<div class="denied"><div class="ic">' + icon('lock', 38) + '</div><div style="font-size:26px;font-weight:700">Access Denied</div>' +
      '<div class="muted" style="max-width:460px">คุณไม่มีสิทธิ์เข้าถึง ' + esc(what || 'หน้านี้') + '<br>ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์</div>' +
      '<a class="btn btn-p" href="' + App.homeFor(App.me()) + '">กลับหน้าแรก</a></div>';
  };

  /* ---------- Router ---------- */
  App.render = function () {
    var hash = location.hash.replace(/^#\/?/, '') || 'login';
    var parts = hash.split('/').map(decodeURIComponent);
    var area = parts[0], me = App.me(), html;
    var root = document.getElementById('app');
    document.body.className = '';

    if (area === 'login') {
      if (me) { location.replace(App.homeFor(me)); return; }
      html = App.views.login();
    } else if (!me) {
      // ต้อง Login ก่อนเสมอ
      App.state.afterLogin = '#/' + hash;
      location.replace('#/login');
      return;
    } else if (area === 'u') {
      document.body.className = 'mobile-bg';
      html = App.views.user(parts.slice(1), me);
    } else if (area === 'd') {
      document.body.className = 'mobile-bg';
      html = App.isDriver(me) ? App.views.driver(parts.slice(1), me) : '<div class="m-shell">' + App.views.denied('งานคนขับ (SC12)') + '</div>';
    } else if (area === 'a') {
      html = App.views.admin(parts.slice(1), me);
    } else {
      location.replace(App.homeFor(me)); return;
    }
    root.innerHTML = html;
    UI.hydrateQr(root);
    var h = root.querySelector('[data-autofocus]'); if (h) h.focus();
    if (App.afterRender) { var fn = App.afterRender; App.afterRender = null; fn(); }
    if (!App._keepScroll) window.scrollTo(0, 0);
    App._keepScroll = false;
  };
  /* re-render โดยไม่เลื่อนหน้า */
  App.refresh = function () { App._keepScroll = true; App.render(); };

  /* ---------- Event delegation ---------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act');
    if (act === 'modal-bg') { if (e.target === el) UI.closeModal(); return; }
    if (act === 'modal-close') { UI.closeModal(); return; }
    if (act === 'confirm-ok') { var fn = UI._confirmOk; UI.closeModal(); if (fn) fn(); return; }
    if (App.actions[act]) { e.preventDefault(); App.actions[act](el, e); }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    var name = f.getAttribute('data-form');
    if (App.forms[name]) App.forms[name](f, new FormData(f));
  });
  document.addEventListener('input', function (e) {
    var el = e.target.closest('[data-input]');
    if (el && App.inputs[el.getAttribute('data-input')]) App.inputs[el.getAttribute('data-input')](el, e);
  });
  document.addEventListener('change', function (e) {
    var el = e.target.closest('[data-change]');
    if (el && App.changes[el.getAttribute('data-change')]) App.changes[el.getAttribute('data-change')](el, e);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.getElementById('modal-root').innerHTML) UI.closeModal();
  });

  window.addEventListener('hashchange', function () { UI.closeModal(); App.render(); });
  window.addEventListener('storage', function (e) { if (e.key === 'mutbus_db_v1') { Store.load(); App.refresh(); } });
  document.addEventListener('DOMContentLoaded', async function () { await Store.load(); App.render(); if(window.__DB_ERROR) UI.toast('เชื่อม Oracle ไม่ได้ — กำลังแสดงข้อมูลสำรอง: '+window.__DB_ERROR,'bad'); });
})();
