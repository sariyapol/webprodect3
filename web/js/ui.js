/* =========================================================
   ui.js — ตัวช่วยสร้าง HTML, ไอคอน, badge, modal, toast, QR
   ========================================================= */
(function () {
  'use strict';

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  var P = 'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';
  var ICONS = {
    bus: '<rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M8 18v3M16 18v3"/><circle cx="8" cy="14.5" r="1"/><circle cx="16" cy="14.5" r="1"/>',
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
    ticket: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M9 6v12"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v7M14 20h3"/>',
    scan: '<path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M4 12h16"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    logout: '<path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 17l-5-5 5-5M5 12h11"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>',
    drag: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    refresh: '<path d="M20 11a8 8 0 10-2.3 5.7M20 5v6h-6"/>'
  };
  function icon(name, size) { size = size || 22; return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" ' + P + ' aria-hidden="true">' + (ICONS[name] || '') + '</svg>'; }

  var BADGE = {
    'ยืนยัน': 'b-green', 'Check-in แล้ว': 'b-blue', 'ยกเลิก': 'b-red', 'No Show': 'b-yellow',
    'เปิด': 'b-green', 'กำลังเดินทาง': 'b-amber', 'เสร็จสิ้น': 'b-gray',
    'พร้อมใช้งาน': 'b-green', 'ซ่อมบำรุง': 'b-yellow', 'ที่นั่งเต็ม': 'b-red', 'งดใช้งาน': 'b-gray'
  };
  function badge(text, cls) { return '<span class="badge ' + (cls || BADGE[text] || 'b-gray') + '">' + esc(text) + '</span>'; }

  /* ---------- toast ---------- */
  var toastTimer;
  function toast(msg, kind) {
    var el = document.getElementById('toast');
    el.className = 'toast show ' + (kind || '');
    el.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'toast'; }, 3000);
  }

  /* ---------- modal ---------- */
  var lastFocus = null;
  function modal(html, opts) {
    opts = opts || {};
    var root = document.getElementById('modal-root');
    lastFocus = document.activeElement;
    root.innerHTML = '<div class="modal-bg" data-act="modal-bg"><div class="modal ' + (opts.size || '') + (opts.sheet ? ' sheet' : '') + '" role="dialog" aria-modal="true" tabindex="-1">' + html + '</div></div>';
    var box = root.querySelector('.modal');
    var first = box.querySelector('input,button.btn-p,button.btn-d,button');
    (first || box).focus();
  }
  function closeModal() {
    document.getElementById('modal-root').innerHTML = '';
    if (lastFocus && lastFocus.focus && document.body.contains(lastFocus)) lastFocus.focus();
  }
  function confirmBox(o) {
    // o: title, body, okText, danger, onOk
    UI._confirmOk = o.onOk;
    modal('<h3>' + esc(o.title) + '</h3><div class="modal-body">' + o.body + '</div>' +
      '<div class="modal-actions"><button class="btn btn-s" data-act="modal-close">' + esc(o.cancelText || 'ยกเลิก') + '</button>' +
      '<button class="btn ' + (o.danger ? 'btn-d' : 'btn-p') + '" data-act="confirm-ok">' + esc(o.okText || 'ยืนยัน') + '</button></div>', { size: 'sm', sheet: o.sheet });
  }

  /* ---------- QR ----------
     ใช้ไลบรารี qrcodejs (ถ้าโหลดได้) เพื่อสร้าง QR ที่สแกนได้จริง
     ถ้าออฟไลน์จะแสดงลาย QR จำลอง + รหัสสำรองเป็นข้อความ */
  function qrPlaceholder(seed) {
    var h = 2166136261, i; for (i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    function finder(r, c) {
      var bx = [[0, 0], [0, 14], [14, 0]];
      for (var k = 0; k < 3; k++) {
        var rr = r - bx[k][0], cc = c - bx[k][1];
        if (rr >= -1 && rr <= 7 && cc >= -1 && cc <= 7) {
          if (rr < 0 || rr > 6 || cc < 0 || cc > 6) return false;
          if (rr === 0 || rr === 6 || cc === 0 || cc === 6) return true;
          return rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4;
        }
      }
      return null;
    }
    var rects = '';
    for (var r = 0; r < 21; r++) for (var c = 0; c < 21; c++) {
      var f = finder(r, c), on;
      if (f !== null) on = f; else if (r === 6 || c === 6) on = (r + c) % 2 === 0;
      else { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; on = (h & 7) < 4; }
      if (on) rects += '<rect x="' + c + '" y="' + r + '" width="1" height="1"/>';
    }
    return '<svg viewBox="0 0 21 21" width="100%" height="100%" shape-rendering="crispEdges" fill="#15181E">' + rects + '</svg>';
  }
  function qrBox(code, opts) {
    opts = opts || {};
    return '<div class="qr-wrap' + (opts.cancelled ? ' cancelled' : '') + '"><div class="qr" data-qr="' + esc(code) + '" role="img" aria-label="QR Code ' + esc(code) + '">' + qrPlaceholder(code) + '</div>' +
      (opts.cancelled ? '<div class="stamp"><span>ยกเลิก</span></div>' : '') + '</div>';
  }
  function hydrateQr(root) {
    if (!window.QRCode) return;
    (root || document).querySelectorAll('.qr[data-qr]').forEach(function (el) {
      if (el.dataset.done) return;
      var code = el.getAttribute('data-qr');
      el.innerHTML = '';
      try { new window.QRCode(el, { text: code, width: 180, height: 180, colorDark: '#15181E', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M }); el.dataset.done = '1'; el.removeAttribute('title'); }
      catch (e) { el.innerHTML = qrPlaceholder(code); }
    });
  }

  function empty(title, sub, action) {
    return '<div class="empty"><div class="empty-ic">' + icon('search', 30) + '</div><div class="empty-t">' + esc(title) + '</div>' +
      (sub ? '<div class="muted">' + esc(sub) + '</div>' : '') + (action || '') + '</div>';
  }

  window.UI = { esc: esc, icon: icon, badge: badge, toast: toast, modal: modal, closeModal: closeModal, confirmBox: confirmBox, qrBox: qrBox, hydrateQr: hydrateQr, empty: empty };
})();
