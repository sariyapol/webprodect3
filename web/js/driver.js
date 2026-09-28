/* =========================================================
   driver.js — หน้าจอคนขับ
   งานวันนี้ / ผู้โดยสาร / สแกน QR / ปิดงาน / ประวัติ
   รองรับสถานะทั้งภาษาไทยและ Oracle/English
   ========================================================= */
(function () {
  'use strict';

  var esc = UI.esc,
      icon = UI.icon,
      badge = UI.badge,
      S = Store;


  /* =========================================================
     Helpers: STATUS
     รองรับทั้งสถานะเดิมภาษาไทย และสถานะจาก Oracle
     ========================================================= */

  function tripStatus(s) {
    s = String(s || '').trim().toUpperCase();

    if (s === 'OPEN' || s === 'เปิด') {
      return 'OPEN';
    }

    if (
      s === 'IN_PROGRESS' ||
      s === 'IN PROGRESS' ||
      s === 'RUNNING' ||
      s === 'กำลังเดินทาง'
    ) {
      return 'IN_PROGRESS';
    }

    if (
      s === 'FINISHED' ||
      s === 'CLOSED' ||
      s === 'COMPLETED' ||
      s === 'DONE' ||
      s === 'เสร็จสิ้น'
    ) {
      return 'FINISHED';
    }

    if (
      s === 'CANCELLED' ||
      s === 'CANCELED' ||
      s === 'ยกเลิก'
    ) {
      return 'CANCELLED';
    }

    return s;
  }


  function bookingStatus(s) {
    s = String(s || '').trim().toUpperCase();

    if (
      s === 'CONFIRMED' ||
      s === 'ยืนยัน'
    ) {
      return 'CONFIRMED';
    }

    if (
      s === 'CHECKED_IN' ||
      s === 'CHECK-IN' ||
      s === 'CHECK-IN แล้ว' ||
      s === 'CHECKIN' ||
      s === 'CHECKED IN'
    ) {
      return 'CHECKED_IN';
    }

    if (
      s === 'CANCELLED' ||
      s === 'CANCELED' ||
      s === 'ยกเลิก'
    ) {
      return 'CANCELLED';
    }

    if (
      s === 'NO SHOW' ||
      s === 'NO_SHOW'
    ) {
      return 'NO_SHOW';
    }

    return s;
  }


  function isTripOpen(t) {
    return t && tripStatus(t.status) === 'OPEN';
  }

  function isTripRunning(t) {
    return t && tripStatus(t.status) === 'IN_PROGRESS';
  }

  function isTripFinished(t) {
    return t && tripStatus(t.status) === 'FINISHED';
  }

  function isTripCancelled(t) {
    return t && tripStatus(t.status) === 'CANCELLED';
  }

  function isBookingConfirmed(i) {
    return i && bookingStatus(i.status) === 'CONFIRMED';
  }

  function isBookingCancelled(i) {
    return i && bookingStatus(i.status) === 'CANCELLED';
  }

  function isNoShow(i) {
    return i && bookingStatus(i.status) === 'NO_SHOW';
  }


  /* =========================================================
     Tabbar
     ========================================================= */

  function tabbar(active) {

    var tabs = [
      ['today', 'cal', 'งานวันนี้'],
      ['scan', 'scan', 'สแกน QR'],
      ['history', 'clock', 'ประวัติ'],
      ['me', 'user', 'บัญชี']
    ];

    return (
      '<nav class="tabbar" aria-label="เมนูคนขับ">' +

      tabs.map(function (t) {

        return (
          '<a class="tab' +
          (active === t[0] ? ' on' : '') +
          '" href="#/d/' +
          t[0] +
          '"' +
          (active === t[0]
            ? ' aria-current="page"'
            : '') +
          '>' +

          icon(t[1], 24) +
          t[2] +

          '</a>'
        );

      }).join('') +

      '</nav>'
    );
  }


  /* =========================================================
     Trip Badge
     ========================================================= */

  function stBadge(s) {

    var st = tripStatus(s);

    var label = {
      OPEN: 'เปิด (รอเริ่มงาน)',
      IN_PROGRESS: 'กำลังเดินทาง',
      FINISHED: 'เสร็จสิ้น',
      CANCELLED: 'ยกเลิก'
    };

    var cls = {
      OPEN: 'b-green',
      IN_PROGRESS: 'b-amber',
      FINISHED: 'b-gray',
      CANCELLED: 'b-red'
    };

    return badge(
      label[st] || s,
      cls[st]
    );
  }


  /* =========================================================
     งานของคนขับ
     ========================================================= */

  function myTrips(me) {

    if (!me) {
      return [];
    }

    var myId = String(me.id || '')
      .trim()
      .toUpperCase();

    return S.db.trips.filter(function (t) {

      /*
       * กรณี 1:
       * รอบนี้ถูกมอบหมายให้เราเป็นคนขับ
       */
      var isMyDriverTrip =
        String(t.driverId || '')
          .trim()
          .toUpperCase() === myId;

      if (isMyDriverTrip) {
        return true;
      }


      /*
       * กรณี 2:
       * บัญชีนี้เป็นคนจองรอบนี้
       * ใช้สำหรับ Demo ตอนสลับ Role
       */
      var myBookingIds = (S.db.bookings || [])
        .filter(function (b) {

          return String(b.userId || '')
            .trim()
            .toUpperCase() === myId;

        })
        .map(function (b) {

          return String(b.id || '');

        });


      var hasMyBooking = (S.db.bookingItems || [])
        .some(function (item) {

          return (
            String(item.tripId || '') === String(t.id || '') &&
            myBookingIds.indexOf(
              String(item.bookingId || '')
            ) !== -1 &&
            !isBookingCancelled(item)
          );

        });


      return hasMyBooking;
    });
  }


  /* =========================================================
     สถิติผู้โดยสารของรอบ
     ========================================================= */

  function stats(t) {

    var items =
      S.tripItems(t.id)
        .filter(function (i) {
          return !isBookingCancelled(i);
        });

    var sum = function (arr) {

      return arr.reduce(
        function (a, i) {

          return (
            a +
            Number(i.seats || 0)
          );

        },
        0
      );
    };


    var checked =
      items.filter(function (i) {

        return (
          !!i.checkin ||
          bookingStatus(i.status) === 'CHECKED_IN'
        );
      });


    var pending =
      items.filter(function (i) {

        return (
          !i.checkin &&
          isBookingConfirmed(i)
        );
      });


    return {

      items: items,

      booked:
        sum(items),

      real:
        sum(checked),

      waiting:
        sum(pending),

      pending:
        pending,

      noShow:
        items.filter(function (i) {
          return isNoShow(i);
        }).length
    };
  }


  /* =========================================================
     ชื่อผู้โดยสาร
     ========================================================= */

  function userOf(item) {

    var b =
      S.booking(
        item.bookingId
      );

    var u =
      b &&
      S.user(
        b.userId
      );

    if (!u) {
      return '-';
    }

    return String(u.name || '-')
      .split(' ')[0];
  }


  /* =========================================================
     ข้อมูลรถ
     ========================================================= */

  function vehTxt(t) {

    var v =
      S.vehicle(
        t.vehicleId
      );

    var vt =
      v &&
      S.vtype(
        v.typeId
      );

    return (
      (v
        ? v.plate
        : '-') +

      (vt
        ? ' (' + vt.name + ')'
        : '')
    );
  }


  /* =========================================================
     รอบที่กำลังเดินทางอยู่
     ========================================================= */

  function active(me) {

    return myTrips(me)
      .filter(function (t) {

        return isTripRunning(t);

      })[0];
  }


  /* =========================================================
     Views
     ========================================================= */

  var V = {};


  /* =========================================================
     งานวันนี้
     ========================================================= */

  V.today = function (me) {

    var today =
      U.nowDate();

    var d =
      new Date();


    var list =
      myTrips(me)
        .filter(function (t) {

          return (
            String(t.date || '') ===
            String(today)
          );

        })
        .sort(function (a, b) {

          return (
            String(a.dep || '') <
            String(b.dep || '')
              ? -1
              : 1
          );
        });


    var h =

      '<header class="m-top big">' +

      '<div style="flex:1">' +

      '<div class="muted" style="font-size:13px">' +

      U.DAYS_TH[d.getDay()] +
      ' ' +
      d.getDate() +
      ' ' +
      U.MONTHS_SHORT[d.getMonth()] +
      ' ' +
      d.getFullYear() +

      '</div>' +

      '<h2 tabindex="-1" data-autofocus>' +
      'งานวันนี้' +
      '</h2>' +

      '</div>' +

      '<div style="text-align:right;font-size:13px;line-height:1.4">' +

      '<b>' +
      esc(me.name) +
      '</b>' +

      '<div class="muted">' +
      'คนขับ · ' +
      esc(me.id) +
      '</div>' +

      '</div>' +

      '</header>' +

      '<main class="m-body">';


    if (!list.length) {

      h += UI.empty(
        'วันนี้ไม่มีรอบที่ได้รับมอบหมาย',
        'ระบบจะแสดงรอบการเดินรถของวันนี้'
      );
    }


    list.forEach(function (t) {

      var s =
        stats(t);

      h +=

        '<a class="card stack" ' +
        'style="gap:10px;text-decoration:none;color:inherit" ' +
        'href="#/d/trip/' +
        t.id +
        '">' +


        '<div class="row" ' +
        'style="justify-content:space-between">' +

        '<div class="row" ' +
        'style="align-items:baseline;gap:10px">' +

        '<span class="mono" ' +
        'style="font-size:30px;font-weight:600">' +

        esc(t.dep || '') +

        '</span>' +

        '<b>' +

        esc(
          (S.route(t.routeId) || {}).name ||
          t.routeId ||
          '-'
        ) +

        '</b>' +

        '</div>' +

        stBadge(t.status) +

        '</div>' +


        '<div style="font-size:14px;color:var(--ink-2)">' +

        'รถ: ' +
        esc(vehTxt(t)) +

        ' · ' +

        '<span class="mono">' +
        esc(t.id) +
        '</span>' +

        '</div>' +


        '<div class="grid2">' +

        '<div style="background:var(--bg);border-radius:12px;padding:8px 10px">' +

        '<div class="muted" style="font-size:12px">' +
        'จองแล้ว' +
        '</div>' +

        '<b>' +
        s.booked +
        ' / ' +
        S.tripSeats(t) +
        ' ที่นั่ง' +
        '</b>' +

        '</div>' +


        '<div style="background:var(--bg);border-radius:12px;padding:8px 10px">' +

        '<div class="muted" style="font-size:12px">' +
        'Check-in แล้ว' +
        '</div>' +

        '<b>' +
        s.real +
        ' ที่นั่ง' +
        '</b>' +

        '</div>' +

        '</div>' +

        '</a>';
    });


    return (

      '<div class="m-shell">' +

      h +

      '<p class="hint" style="margin:0">' +
      'แสดงรอบการเดินรถของวันนี้ เรียงตามเวลาออก' +
      '</p>' +

      '</main>' +

      tabbar('today') +

      '</div>'
    );
  };


  /* =========================================================
     รายละเอียดรอบ
     ========================================================= */

  V.trip = function (id, me) {

    var t =
      S.trip(id);


    if (!t) {

      return (
        '<div class="m-shell">' +
        App.views.denied(
          'ไม่พบรอบการเดินทาง'
        ) +
        '</div>'
      );
    }


    /*
     * อนุญาตถ้าเป็นคนขับของรอบ
     * หรือเป็นรอบที่ myTrips() มองเห็นสำหรับ Demo
     */
    var allowed =
      myTrips(me).some(function (x) {
        return String(x.id) === String(t.id);
      });


    if (!allowed) {

      return (
        '<div class="m-shell">' +
        App.views.denied(
          'รอบนี้ (ไม่ได้ถูกมอบหมายให้คุณ)'
        ) +
        '</div>'
      );
    }


    var s =
      stats(t);

    var rs =
      S.routeStops(
        t.routeId
      );

    var cum =
      S.cum(
        t.routeId
      );

    var dep =
      U.toMin(
        t.dep
      );


    var rows =
      rs.map(function (r, i) {

        var ups =
          s.items.filter(function (it) {

            var p =
              S.seqPair(
                t.routeId,
                it.boardStopId,
                it.alightStopId
              );

            return (
              p &&
              p[0] === i
            );
          });


        var downs =
          s.items.filter(function (it) {

            var p =
              S.seqPair(
                t.routeId,
                it.boardStopId,
                it.alightStopId
              );

            return (
              p &&
              p[1] === i
            );
          });


        var sum =
          function (a) {

            return a.reduce(
              function (x, y) {

                return (
                  x +
                  Number(y.seats || 0)
                );

              },
              0
            );
          };


        return (

          '<div class="stop' +
          (
            ups.length ||
            downs.length
              ? ''
              : ' idle'
          ) +
          '">' +


          '<div class="st-t">' +

          U.fmtMin(
            dep +
            cum[i]
          ) +

          '</div>' +


          '<div>' +

          '<div class="st-n">' +

          esc(
            S.stopName(
              r.stopId
            )
          ) +

          '</div>' +


          '<div class="pline">' +

          '<span class="dir dir-up">' +

          'ขึ้น ' +
          sum(ups) +

          '</span>' +


          ups.map(function (it) {

            var checked =
              !!it.checkin ||
              bookingStatus(it.status) ===
              'CHECKED_IN';

            var noShow =
              isNoShow(it);

            var cls =
              checked
                ? 'ok'
                : (
                    noShow
                      ? 'ns'
                      : ''
                  );


            return (

              '<span class="pill ' +
              cls +
              '">' +

              esc(
                userOf(it)
              ) +

              ' (' +
              it.seats +
              ')' +

              (
                checked
                  ? (
                      ' ✓ ' +
                      (
                        it.checkin
                          ? String(it.checkin).slice(11)
                          : ''
                      )
                    )
                  : (
                      noShow
                        ? ' · No Show'
                        : ''
                    )
              ) +

              '</span>'
            );
          }).join('') +

          '</div>' +


          '<div class="pline">' +

          '<span class="dir dir-down">' +

          'ลง ' +
          sum(downs) +

          '</span>' +


          downs.map(function (it) {

            return (

              '<span class="pill">' +

              esc(
                userOf(it)
              ) +

              ' (' +
              it.seats +
              ')' +

              '</span>'
            );

          }).join('') +

          '</div>' +

          '</div>' +

          '</div>'
        );

      }).join('');


    var foot;


    if (isTripOpen(t)) {

      foot =

        t.date === U.nowDate()

          ? (
              '<button class="btn btn-a btn-lg btn-block" ' +
              'data-act="trip-start" ' +
              'data-id="' +
              t.id +
              '">' +

              'เริ่มการเดินทาง' +

              '</button>'
            )

          : (
              '<div class="muted" ' +
              'style="text-align:center;flex:1;padding:12px 0">' +

              'เริ่มการเดินทางได้ในวันที่ ' +
              U.thDate(t.date) +

              '</div>'
            );

    } else if (isTripRunning(t)) {

      foot =

        '<a class="btn btn-p btn-lg" ' +
        'style="flex:1.3" ' +
        'href="#/d/scan">' +

        icon('scan', 20) +

        'สแกน QR' +

        '</a>' +

        '<button class="btn btn-s btn-lg" ' +
        'style="flex:1" ' +
        'data-act="trip-close" ' +
        'data-id="' +
        t.id +
        '">' +

        'ปิดงาน' +

        '</button>';

    } else if (isTripCancelled(t)) {

      foot =

        '<div style="flex:1;text-align:center;flex:1;padding:12px 0;color:var(--bad)">' +

        'รอบนี้ถูกยกเลิกแล้ว' +

        '</div>';

    } else {

      foot =

        '<div style="flex:1;text-align:center;font-size:14px;color:var(--ok);font-weight:600;padding:10px 0">' +

        'ปิดงานแล้ว · ผู้ใช้บริการจริง ' +
        s.real +
        ' ที่นั่ง · No Show ' +
        s.noShow +
        ' รายการ' +

        '</div>';
    }


    return (

      '<div class="m-shell has-foot">' +


      '<header class="m-top">' +

      '<a class="icb" ' +
      'href="#/d/today" ' +
      'aria-label="ย้อนกลับ">' +

      icon('back') +

      '</a>' +


      '<div style="flex:1">' +

      '<h2 tabindex="-1" data-autofocus>' +

      'รอบ ' +
      esc(t.dep) +
      ' · ' +
      esc(
        (S.route(t.routeId) || {}).name ||
        t.routeId ||
        '-'
      ) +

      '</h2>' +


      '<div class="muted" style="font-size:12px">' +

      U.thDate(t.date) +

      ' · ' +

      esc(
        vehTxt(t)
      ) +

      ' · ' +

      '<span class="mono">' +
      esc(t.id) +
      '</span>' +

      '</div>' +

      '</div>' +

      stBadge(t.status) +

      '</header>' +


      '<main class="m-body">' +


      '<div class="stat3">' +

      '<div class="card">' +

      '<div class="muted" style="font-size:12px">' +
      'จองแล้ว' +
      '</div>' +

      '<div class="n">' +
      s.booked +
      '/' +
      S.tripSeats(t) +
      '</div>' +

      '</div>' +


      '<div class="card">' +

      '<div class="muted" style="font-size:12px">' +
      'Check-in' +
      '</div>' +

      '<div class="n" style="color:var(--ok)">' +
      s.real +
      '</div>' +

      '</div>' +


      '<div class="card">' +

      '<div class="muted" style="font-size:12px">' +
      'ยังไม่ขึ้น' +
      '</div>' +

      '<div class="n">' +
      s.waiting +
      '</div>' +

      '</div>' +

      '</div>' +


      '<div class="card" style="padding:6px 16px">' +

      '<div style="font-weight:700;padding:10px 0 2px">' +
      'ผู้โดยสารตามจุดจอด' +
      '</div>' +

      rows +

      '</div>' +

      '</main>' +


      '<div class="m-foot">' +
      foot +
      '</div>' +

      '</div>'
    );
  };


  /* =========================================================
     SCAN QR
     ========================================================= */

  V.scan = function (me) {

    var t =
      active(me);


    var h =

      '<header class="m-top big">' +

      '<h2 tabindex="-1" data-autofocus style="flex:1">' +
      'สแกน QR' +
      '</h2>' +

      (
        t
          ? badge(
              'รอบ ' +
              t.dep +
              ' · ' +
              stats(t).real +
              '/' +
              stats(t).booked,
              'b-amber'
            )
          : ''
      ) +

      '</header>' +

      '<main class="m-body">';


    if (!t) {

      h +=

        '<div class="empty">' +

        '<div class="empty-ic">' +
        icon('scan', 30) +
        '</div>' +

        '<div class="empty-t">' +
        'ยังไม่มีรอบที่กำลังเดินทาง' +
        '</div>' +

        '<div class="muted">' +
        'กด “เริ่มการเดินทาง” ในรายละเอียดรอบก่อน จึงจะสแกน QR ได้' +
        '</div>' +

        '<a class="btn btn-s" href="#/d/today">' +
        'ไปที่งานวันนี้' +
        '</a>' +

        '</div>';

    } else {

      var camOk =
        'BarcodeDetector' in window &&
        navigator.mediaDevices;


      h +=

        '<div class="vf" id="vf">' +

        '<div class="frame"></div>' +

        '<div style="position:absolute;bottom:12px;font-size:12px">' +

        (
          camOk
            ? 'กด “เปิดกล้อง” แล้วเล็งไปที่ QR Code'
            : 'เบราว์เซอร์นี้ไม่รองรับการสแกนด้วยกล้อง — พิมพ์รหัส QR ด้านล่าง'
        ) +

        '</div>' +

        '</div>' +


        (
          camOk
            ? (
                '<button class="btn btn-p btn-lg" ' +
                'data-act="cam-toggle" ' +
                'id="cam-btn">' +

                icon('scan', 20) +

                'เปิดกล้อง' +

                '</button>'
              )
            : ''
        ) +


        '<form data-form="scan-code" ' +
        'class="row" ' +
        'style="gap:8px">' +

        '<label for="qr-in" class="sr-only">' +
        'รหัส QR' +
        '</label>' +

        '<input id="qr-in" ' +
        'name="code" ' +
        'class="inp mono" ' +
        'placeholder="เช่น MUT-AB12CD" ' +
        'autocomplete="off" ' +
        'style="text-transform:uppercase">' +

        '<button class="btn btn-p" type="submit">' +
        'ตรวจ' +
        '</button>' +

        '</form>' +


        '<div style="font-size:13px;font-weight:600;color:var(--ink-2);margin-top:4px">' +
        'โหมดทดสอบ — แตะเพื่อจำลองการสแกน' +
        '</div>';


      S.tripItems(t.id)
        .forEach(function (it) {

          var hint;

          if (isBookingCancelled(it)) {

            hint =
              'ถูกยกเลิก';

          } else if (
            it.checkin ||
            bookingStatus(it.status) === 'CHECKED_IN'
          ) {

            hint =
              'สแกนแล้ว';

          } else {

            hint =
              'ขึ้นที่ ' +
              S.stopName(
                it.boardStopId
              );
          }


          h +=

            '<button class="qbtn" ' +
            'data-act="scan-sample" ' +
            'data-code="' +
            esc(it.qr) +
            '">' +

            '<span class="mono" ' +
            'style="font-size:12px;font-weight:600;background:#F1F0EC;border-radius:8px;padding:4px 8px">' +

            esc(it.qr) +

            '</span>' +

            '<span style="flex:1;font-size:14px">' +

            esc(
              userOf(it)
            ) +

            ' · ' +
            it.seats +
            ' ที่นั่ง' +

            '</span>' +

            '<span class="muted" style="font-size:12px">' +

            esc(hint) +

            '</span>' +

            '</button>';
        });


      var other =
        S.db.bookingItems.filter(function (i) {

          return (
            i.tripId !== t.id &&
            isBookingConfirmed(i)
          );

        })[0];


      if (other) {

        h +=

          '<button class="qbtn" ' +
          'data-act="scan-sample" ' +
          'data-code="' +
          esc(other.qr) +
          '">' +

          '<span class="mono" ' +
          'style="font-size:12px;font-weight:600;background:#F1F0EC;border-radius:8px;padding:4px 8px">' +

          esc(other.qr) +

          '</span>' +

          '<span style="flex:1;font-size:14px">' +

          esc(
            userOf(other)
          ) +

          ' · ' +
          other.seats +
          ' ที่นั่ง' +

          '</span>' +

          '<span class="muted" style="font-size:12px">' +
          'QR ของรอบอื่น' +
          '</span>' +

          '</button>';
      }
    }


    return (

      '<div class="m-shell">' +

      h +

      '</main>' +

      tabbar('scan') +

      '</div>'
    );
  };


  /* =========================================================
     HISTORY
     ========================================================= */

  V.history = function (me) {

    var list =
      myTrips(me)
        .filter(function (t) {

          return isTripFinished(t);

        })
        .sort(function (a, b) {

          return (
            (
              String(a.date || '') +
              String(a.dep || '')
            ) <
            (
              String(b.date || '') +
              String(b.dep || '')
            )
              ? 1
              : -1
          );

        })
        .slice(
          0,
          30
        );


    var h =

      '<header class="m-top big">' +

      '<h2 tabindex="-1" data-autofocus>' +
      'ประวัติรอบที่ขับ' +
      '</h2>' +

      '</header>' +

      '<main class="m-body" style="gap:10px">';


    if (!list.length) {

      h +=
        UI.empty(
          'ยังไม่มีประวัติ'
        );
    }


    list.forEach(function (t) {

      var s =
        stats(t);


      h +=

        '<div class="card stack" ' +
        'style="gap:8px;padding:14px 16px">' +

        '<div class="row" ' +
        'style="justify-content:space-between">' +

        '<b>' +

        U.thDate(t.date) +

        ' · ' +

        '<span class="mono">' +
        esc(t.dep) +
        '</span>' +

        ' · ' +

        esc(
          (S.route(t.routeId) || {}).name ||
          t.routeId ||
          '-'
        ) +

        '</b>' +

        stBadge(t.status) +

        '</div>' +


        '<div class="muted" style="font-size:13px">' +

        'รถ ' +
        esc(
          vehTxt(t)
        ) +

        '</div>' +


        '<div class="stat3" style="font-size:12px">' +


        '<div style="background:var(--bg);border-radius:10px;padding:6px 8px">' +

        '<div class="muted">' +
        'จอง' +
        '</div>' +

        '<div class="n" style="font-size:16px">' +
        s.booked +
        '</div>' +

        '</div>' +


        '<div style="background:var(--bg);border-radius:10px;padding:6px 8px">' +

        '<div class="muted">' +
        'ผู้ใช้จริง' +
        '</div>' +

        '<div class="n" style="font-size:16px">' +
        s.real +
        '</div>' +

        '</div>' +


        '<div style="background:var(--bg);border-radius:10px;padding:6px 8px">' +

        '<div class="muted">' +
        'No Show' +
        '</div>' +

        '<div class="n" style="font-size:16px">' +
        s.noShow +
        '</div>' +

        '</div>' +

        '</div>' +

        '</div>';
    });


    return (

      '<div class="m-shell">' +

      h +

      '</main>' +

      tabbar('history') +

      '</div>'
    );
  };


  /* =========================================================
     ACCOUNT
     ========================================================= */

  V.me = function (me) {

    return (

      '<div class="m-shell">' +

      '<header class="m-top big">' +

      '<h2 tabindex="-1" data-autofocus>' +
      'บัญชี' +
      '</h2>' +

      '</header>' +

      '<main class="m-body">' +


      '<div class="card">' +

      '<div style="font-size:18px;font-weight:700">' +
      esc(me.name) +
      '</div>' +

      '<div class="muted">' +

      esc(me.username) +

      ' · ' +

      esc(
        me.employee
          ? me.employee.phone
          : ''
      ) +

      '</div>' +

      '</div>' +


      '<a class="btn btn-s btn-lg" href="#/u/home">' +
      'จองรถ (หน้าผู้ใช้บริการ)' +
      '</a>' +


      (
        App.hasAdmin(me)

          ? (
              '<a class="btn btn-s btn-lg" ' +
              'href="#/a/dashboard">' +
              'ระบบหลังบ้าน' +
              '</a>'
            )

          : ''
      ) +


      '<button class="btn btn-r btn-lg" ' +
      'data-act="logout">' +

      icon('logout', 20) +

      'ออกจากระบบ' +

      '</button>' +

      '</main>' +

      tabbar('me') +

      '</div>'
    );
  };


  /* =========================================================
     DRIVER ROUTER
     ========================================================= */

  App.views.driver = function (parts, me) {

    stopCam();

    var p =
      parts[0] ||
      'today';


    if (p === 'trip') {

      return V.trip(
        parts[1],
        me
      );
    }


    if (V[p]) {

      return V[p](
        me
      );
    }


    location.replace(
      '#/d/today'
    );

    return '';
  };


  /* =========================================================
     SCAN LOGIC
     ========================================================= */

  function processScan(code) {

    var me =
      App.me();

    var t =
      active(me);


    code =
      String(code || '')
        .trim()
        .toUpperCase();


    if (!t) {

      UI.toast(
        'ยังไม่มีรอบที่กำลังเดินทาง',
        'bad'
      );

      return;
    }


    if (!code) {
      return;
    }


    var it =
      S.db.bookingItems.filter(function (i) {

        return (
          String(i.qr || '')
            .trim()
            .toUpperCase() ===
          code
        );

      })[0];


    var r;


    if (!it) {

      r = {

        cls:
          'res-bad',

        ic:
          'x',

        title:
          'ไม่พบรายการจอง',

        msg:
          'ไม่พบรายการจองจาก QR Code นี้'
      };

    } else if (
      it.tripId !== t.id
    ) {

      r = {

        cls:
          'res-bad',

        ic:
          'x',

        title:
          'ปฏิเสธการขึ้นรถ',

        msg:
          'QR Code นี้ไม่ตรงกับรอบการเดินทาง ไม่สามารถขึ้นรถได้'
      };

    } else if (
      isBookingCancelled(it)
    ) {

      r = {

        cls:
          'res-bad',

        ic:
          'x',

        title:
          'ปฏิเสธการขึ้นรถ',

        msg:
          'รายการจองนี้ถูกยกเลิกแล้ว'
      };

    } else if (
      it.checkin ||
      bookingStatus(it.status) === 'CHECKED_IN'
    ) {

      r = {

        cls:
          'res-warn',

        ic:
          'alert',

        title:
          'Check-in ซ้ำ',

        msg:
          'รายการจองนี้ Check-in แล้ว' +
          (
            it.checkin
              ? (
                  ' เมื่อ ' +
                  String(it.checkin).slice(11)
                )
              : ''
          )
      };

    } else if (
      !isBookingConfirmed(it)
    ) {

      r = {

        cls:
          'res-bad',

        ic:
          'x',

        title:
          'ปฏิเสธการขึ้นรถ',

        msg:
          'สถานะรายการจอง: ' +
          it.status
      };

    } else {

      it.checkin =
        U.nowStamp();

      /*
       * FIX:
       * ใช้ status code ภาษาอังกฤษ
       * เพื่อไม่ให้เกิน VARCHAR2(30 BYTE)
       */
      it.status =
        'CHECKED_IN';


      S.save();


      r = {

        cls:
          'res-ok',

        ic:
          'check',

        title:
          'Check-in สำเร็จ',

        msg:
          userOf(it) +
          ' ' +
          it.seats +
          ' ที่นั่ง (ลงที่ ' +
          S.stopName(
            it.alightStopId
          ) +
          ')'
      };
    }


    if (
      navigator.vibrate
    ) {

      navigator.vibrate(

        r.cls === 'res-ok'

          ? 60

          : [
              60,
              60,
              60
            ]
      );
    }


    UI.modal(

      '<div class="res-ic ' +
      r.cls +
      '">' +

      icon(
        r.ic,
        36
      ) +

      '</div>' +

      '<h3 style="text-align:center">' +
      esc(r.title) +
      '</h3>' +

      '<div class="modal-body" style="text-align:center">' +
      esc(r.msg) +
      '</div>' +

      '<div class="muted mono" ' +
      'style="text-align:center;font-size:12px">' +

      esc(code) +

      (
        it
          ? (
              ' · ' +
              esc(it.id)
            )
          : ''
      ) +

      '</div>' +

      '<button class="btn btn-p btn-lg" ' +
      'data-act="scan-next">' +

      'สแกนต่อ' +

      '</button>',

      {
        size:
          'sm',

        sheet:
          true
      }
    );
  }


  App.forms['scan-code'] =
    function (f, fd) {

      processScan(
        fd.get('code')
      );

      f.reset();
    };


  App.actions['scan-sample'] =
    function (el) {

      processScan(
        el.dataset.code
      );
    };


  App.actions['scan-next'] =
    function () {

      UI.closeModal();

      App.refresh();
    };


  /* =========================================================
     CAMERA
     ========================================================= */

  var cam = {

    stream:
      null,

    timer:
      null
  };


  function stopCam() {

    if (cam.timer) {

      clearInterval(
        cam.timer
      );
    }


    if (cam.stream) {

      cam.stream
        .getTracks()
        .forEach(
          function (tr) {

            tr.stop();

          }
        );
    }


    cam.stream =
      null;

    cam.timer =
      null;
  }


  App.actions['cam-toggle'] =
    function (el) {

      if (cam.stream) {

        stopCam();

        App.refresh();

        return;
      }


      navigator.mediaDevices
        .getUserMedia({

          video: {
            facingMode:
              'environment'
          }

        })
        .then(function (stream) {

          cam.stream =
            stream;


          var vf =
            document.getElementById(
              'vf'
            );


          var v =
            document.createElement(
              'video'
            );


          v.setAttribute(
            'playsinline',
            ''
          );


          v.muted =
            true;

          v.srcObject =
            stream;


          vf.insertBefore(
            v,
            vf.firstChild
          );


          v.play();


          el.textContent =
            'ปิดกล้อง';


          var det =
            new window.BarcodeDetector({

              formats: [
                'qr_code'
              ]

            });


          var busy =
            false;


          cam.timer =
            setInterval(
              function () {

                if (
                  busy ||
                  document.getElementById(
                    'modal-root'
                  ).innerHTML
                ) {

                  return;
                }


                busy =
                  true;


                det.detect(v)

                  .then(function (codes) {

                    busy =
                      false;


                    if (
                      codes.length
                    ) {

                      processScan(
                        codes[0].rawValue
                      );
                    }

                  })

                  .catch(function () {

                    busy =
                      false;

                  });

              },
              400
            );

        })
        .catch(function () {

          UI.toast(
            'เปิดกล้องไม่ได้ — ตรวจสอบสิทธิ์การใช้กล้อง',
            'bad'
          );

        });
    };


  /* =========================================================
     START TRIP
     ========================================================= */

  App.actions['trip-start'] =
    function (el) {

      var me =
        App.me();

      var t =
        S.trip(
          el.dataset.id
        );

      if (!t) {

        UI.toast(
          'ไม่พบรอบการเดินทาง',
          'bad'
        );

        return;
      }


      /*
       * อนุญาตรอบที่อยู่ใน myTrips()
       * รองรับ Demo สลับ Role
       */
      var allowed =
        myTrips(me).some(function (x) {

          return String(x.id) === String(t.id);

        });


      if (!allowed) {

        UI.toast(
          'รอบนี้ไม่ได้ถูกมอบหมายให้คุณ',
          'bad'
        );

        return;
      }


      var other =
        active(me);


      if (
        other &&
        other.id !== t.id
      ) {

        UI.toast(
          'ปิดงานรอบ ' +
          other.dep +
          ' ก่อนเริ่มรอบใหม่',
          'bad'
        );

        return;
      }


      /*
       * FIX ORA-12899
       * ห้ามใช้ "กำลังเดินทาง"
       * เพราะ TRIPS.STATUS = VARCHAR2(30 BYTE)
       */
      t.status =
        'IN_PROGRESS';


      S.save();

      App.refresh();


      UI.toast(
        'เริ่มการเดินทางรอบ ' +
        t.dep +
        ' แล้ว',
        'ok'
      );
    };


  /* =========================================================
     CLOSE TRIP
     ========================================================= */

  App.actions['trip-close'] =
    function (el) {

      var t =
        S.trip(
          el.dataset.id
        );


      if (!t) {

        UI.toast(
          'ไม่พบรอบการเดินทาง',
          'bad'
        );

        return;
      }


      var s =
        stats(t);


      UI.confirmBox({

        title:
          'ปิดงานรอบ ' +
          t.dep +
          '?',

        okText:
          'ยืนยันปิดงาน',

        cancelText:
          'กลับ',

        sheet:
          true,


        body:

          '<div class="grid2">' +


          '<div style="background:var(--ok-t);color:var(--ok);border-radius:14px;padding:12px">' +

          '<div style="font-size:12px">' +
          'ผู้ใช้บริการจริง' +
          '</div>' +

          '<div class="mono" ' +
          'style="font-size:26px;font-weight:600">' +

          s.real +

          '</div>' +

          '<div style="font-size:12px">' +
          'ที่นั่ง (Check-in แล้ว)' +
          '</div>' +

          '</div>' +


          '<div style="background:var(--warn-t);color:var(--warn);border-radius:14px;padding:12px">' +

          '<div style="font-size:12px">' +
          'No Show' +
          '</div>' +

          '<div class="mono" ' +
          'style="font-size:26px;font-weight:600">' +

          s.pending.length +

          '</div>' +

          '<div style="font-size:12px">' +
          'รายการที่ยังไม่ Check-in' +
          '</div>' +

          '</div>' +

          '</div>' +


          (
            s.pending.length

              ? (
                  '<div style="font-weight:600;font-size:13px;margin:12px 0 6px">' +
                  'รายชื่อ No Show' +
                  '</div>' +

                  s.pending.map(
                    function (i) {

                      return (

                        '<div class="row" ' +
                        'style="justify-content:space-between;background:var(--bg);border-radius:10px;padding:8px 12px;margin-bottom:6px;font-size:14px">' +

                        '<span>' +

                        esc(
                          userOf(i)
                        ) +

                        ' · ' +
                        i.seats +
                        ' ที่นั่ง' +

                        '</span>' +

                        '<span class="mono muted" style="font-size:12px">' +

                        esc(i.id) +

                        '</span>' +

                        '</div>'
                      );

                    }
                  ).join('')
                )

              : ''
          ) +


          '<p class="muted" style="font-size:13px;margin:10px 0 0">' +

          'เมื่อยืนยัน สถานะรอบจะเป็น “เสร็จสิ้น” และรายการที่ไม่ Check-in จะเปลี่ยนเป็น No Show' +

          '</p>',


        onOk:
          function () {

            /*
             * FIX:
             * เก็บสถานะภาษาอังกฤษใน Oracle
             */
            t.status =
              'FINISHED';


            s.pending.forEach(
              function (i) {

                i.status =
                  'NO_SHOW';

              }
            );


            S.save();

            App.refresh();


            UI.toast(

              'ปิดงานแล้ว — ผู้ใช้จริง ' +
              s.real +
              ' ที่นั่ง, No Show ' +
              s.pending.length +
              ' รายการ',

              'ok'
            );
          }
      });
    };

})();