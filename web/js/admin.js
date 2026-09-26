/* =========================================================
   admin.js — ระบบหลังบ้าน (เมนูและปุ่มตามสิทธิ์ของตำแหน่ง)
   SAFE DELETE VERSION
   ========================================================= */
(function () {
  'use strict';

  var esc = UI.esc, icon = UI.icon, badge = UI.badge, S = Store;

  var st = App.state.admin = {
    trips: {
      date: U.nowDate(),
      route: '',
      driver: '',
      vehicle: '',
      status: ''
    },
    bk: {
      from: U.ymd(U.addDays(new Date(), -7)),
      to: U.ymd(U.addDays(new Date(), 3)),
      status: '',
      route: '',
      q: ''
    },
    rep: {
      n: 1,
      year: String(new Date().getFullYear()),
      from: U.ymd(U.addDays(new Date(), -30)),
      to: U.nowDate()
    },
    permPos: 'P02',
    routeDraft: null
  };


  /* =========================================================
     SAFE DELETE — ลบ Oracle จริง
     ========================================================= */

  async function oracleDelete(entity, id) {
    try {
      var response = await fetch(
        '/api/delete/' +
        encodeURIComponent(entity) +
        '/' +
        encodeURIComponent(id),
        {
          method: 'DELETE',
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      var data = {};

      try {
        data = await response.json();
      } catch (_) {}

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error ||
          'ไม่สามารถลบข้อมูลจาก Oracle ได้'
        );
      }

      return true;

    } catch (err) {
      console.error(
        'ORACLE DELETE ERROR:',
        entity,
        id,
        err
      );

      UI.toast(
        'ลบไม่สำเร็จ: ' + err.message,
        'bad'
      );

      return false;
    }
  }


  /* ---------- สิทธิ์ ---------- */

  function me() {
    return App.me();
  }

  function P(sc) {
    var u = me();

    return sc
      ? S.perm(u.positionId, sc)
      : {
          add: 1,
          edit: 1,
          del: 1
        };
  }


  var PAGES = {
    dashboard: ['Dashboard', null],

    users: [
      'ผู้ใช้งาน / พนักงาน',
      'SC07'
    ],

    depts: [
      'แผนก',
      'SC08'
    ],

    positions: [
      'ตำแหน่ง',
      'SC09'
    ],

    screens: [
      'หน้าจอ',
      'SC10'
    ],

    perms: [
      'สิทธิ์ตามตำแหน่ง',
      'SC10'
    ],

    vtypes: [
      'ประเภทรถ',
      'SC03'
    ],

    vehicles: [
      'รถ',
      'SC01'
    ],

    stops: [
      'จุดจอด',
      'SC04'
    ],

    routes: [
      'เส้นทาง',
      'SC05'
    ],

    trips: [
      'รอบการเดินรถ',
      'SC06'
    ],

    bookings: [
      'การจอง',
      'SC02'
    ],

    reports: [
      'รายงาน',
      'SC11'
    ]
  };


  var MENU = [
    ['', ['dashboard']],

    [
      'ข้อมูลหลัก',
      [
        'users',
        'depts',
        'positions'
      ]
    ],

    [
      'สิทธิ์',
      [
        'screens',
        'perms'
      ]
    ],

    [
      'การเดินรถ',
      [
        'vtypes',
        'vehicles',
        'stops',
        'routes',
        'trips'
      ]
    ],

    [
      'การจอง',
      ['bookings']
    ],

    [
      'รายงาน',
      ['reports']
    ]
  ];


  function shell(page, inner) {
    var u = me();
    var pos = S.by(
      'positions',
      u.positionId
    );

    var menu = MENU.map(function (g) {
      var items = g[1].filter(function (p) {
        return !PAGES[p][1] ||
          P(PAGES[p][1]);
      });

      if (!items.length) {
        return '';
      }

      return (
        g[0]
          ? '<div class="grp">' +
            g[0] +
            '</div>'
          : ''
      ) +

      items.map(function (p) {
        return (
          '<a class="mi' +
          (page === p ? ' on' : '') +
          '" href="#/a/' +
          p +
          '"' +
          (
            page === p
              ? ' aria-current="page"'
              : ''
          ) +
          '>' +
          PAGES[p][0] +
          '</a>'
        );
      }).join('');
    }).join('');


    return (
      '<div class="a-shell" id="a-shell">' +

      '<aside class="side" aria-label="เมนูหลังบ้าน">' +

      '<a class="brand" href="#/a/dashboard">' +
      '<span class="lg">' +
      icon('bus', 20) +
      '</span>' +

      '<span>' +
      '<b>MUT Shuttle</b>' +
      '<div style="font-size:12px;color:#8FA6C2">' +
      'ระบบหลังบ้าน' +
      '</div>' +
      '</span>' +
      '</a>' +

      '<nav>' +
      menu +
      '</nav>' +

      '<div style="flex:1"></div>' +

      '<div style="font-size:12px;color:#8FA6C2;padding:12px;line-height:1.5">' +
      'เมนูแสดงตามสิทธิ์ของตำแหน่ง<br>' +

      '<b style="color:#fff">' +
      esc(
        pos
          ? pos.name + ' (' + pos.id + ')'
          : '-'
      ) +
      '</b>' +
      '</div>' +

      '</aside>' +

      '<div class="a-main">' +

      '<header class="a-top">' +

      '<button class="icb menu-btn" data-act="a-menu" aria-label="เปิดเมนู">' +
      icon('menu') +
      '</button>' +

      '<div style="flex:1;font-weight:600" class="muted">' +
      esc(
        PAGES[page]
          ? PAGES[page][0]
          : ''
      ) +
      '</div>' +

      '<a class="btn btn-s btn-sm hide-md" href="#/u/home">' +
      'หน้าผู้ใช้บริการ' +
      '</a>' +

      (
        App.isDriver(u)
          ? '<a class="btn btn-s btn-sm hide-md" href="#/d/today">งานคนขับ</a>'
          : ''
      ) +

      '<div class="row" style="gap:10px;padding-left:10px;border-left:1px solid var(--line)">' +

      '<div style="width:36px;height:36px;border-radius:50%;background:#E1E8F1;color:var(--primary);display:grid;place-items:center;font-weight:700">' +
      esc(u.name.charAt(0)) +
      '</div>' +

      '<div class="hide-md" style="font-size:13px;line-height:1.3">' +
      '<b>' +
      esc(u.name) +
      '</b>' +

      '<div class="muted">' +
      esc(
        pos
          ? pos.name
          : ''
      ) +
      '</div>' +
      '</div>' +

      '<button class="icb" data-act="logout" aria-label="ออกจากระบบ" title="ออกจากระบบ">' +
      icon('logout') +
      '</button>' +

      '</div>' +
      '</header>' +

      '<main class="a-content" id="main">' +
      inner +
      '</main>' +

      '</div>' +
      '</div>'
    );
  }


  function ph(title, desc, actions) {
    return (
      '<div class="ph">' +

      '<div>' +
      '<h1 tabindex="-1" data-autofocus>' +
      esc(title) +
      '</h1>' +

      (
        desc
          ? '<p>' + desc + '</p>'
          : ''
      ) +

      '</div>' +

      '<div class="row">' +
      (actions || '') +
      '</div>' +

      '</div>'
    );
  }


  function permSummary(p) {
    return ['ดู']
      .concat(
        p.add ? ['เพิ่ม'] : [],
        p.edit ? ['แก้ไข'] : [],
        p.del ? ['ลบ'] : []
      )
      .join(' / ');
  }


  function opt(v, label, sel) {
    return (
      '<option value="' +
      esc(v) +
      '"' +
      (
        String(v) === String(sel)
          ? ' selected'
          : ''
      ) +
      '>' +
      esc(label) +
      '</option>'
    );
  }


  function driverUsers() {
    return S.db.users.filter(function (u) {
      return u.employee &&
        S.perm(
          u.positionId,
          'SC12'
        );
    });
  }


  function vehLabel(v) {
    var t =
      v &&
      S.vtype(v.typeId);

    return v
      ? v.plate +
        (
          t
            ? ' · ' + t.name
            : ''
        )
      : '-';
  }


  /* ======================= Dashboard ======================= */

  function dashboard() {
    var today = U.nowDate();

    var trips =
      S.db.trips
        .filter(function (t) {
          return t.date === today;
        })
        .sort(function (a, b) {
          return a.dep < b.dep
            ? -1
            : 1;
        });

    var ids = {};

    trips.forEach(function (t) {
      ids[t.id] = 1;
    });

    var items =
      S.db.bookingItems.filter(function (i) {
        return ids[i.tripId];
      });

    var live =
      items.filter(function (i) {
        return (
          i.status !== 'ยกเลิก' &&
          i.status !== 'CANCELLED' &&
          i.status !== 'CANCELED'
        );
      });

    var sum = function (a) {
      return a.reduce(function (x, i) {
        return x + (+i.seats);
      }, 0);
    };

    var ready =
      S.db.vehicles.filter(function (v) {
        return (
          v.status === 'พร้อมใช้งาน' ||
          v.status === 'READY'
        );
      }).length;

    var k = [
      [
        'รายการจองวันนี้',
        live.length,
        'รายการ (ไม่รวมยกเลิก)'
      ],

      [
        'รอบรถวันนี้',
        trips.length,
        'รอบ'
      ],

      [
        'ที่นั่งที่ถูกจองวันนี้',
        sum(live),
        'ที่นั่ง'
      ],

      [
        'ผู้ใช้บริการจริง',
        sum(
          items.filter(function (i) {
            return i.checkin;
          })
        ),
        'ที่นั่ง Check-in'
      ],

      [
        'No Show',
        items.filter(function (i) {
          return i.status === 'No Show';
        }).length,
        'รายการ'
      ],

      [
        'รถพร้อมใช้งาน',
        ready +
        ' / ' +
        S.db.vehicles.length,
        'คัน'
      ]
    ];


    var recent =
      S.db.bookings
        .slice()
        .sort(function (a, b) {
          return a.createdAt < b.createdAt
            ? 1
            : -1;
        })
        .slice(0, 6);


    var h =
      ph(
        'Dashboard',
        'ภาพรวมวันที่ ' +
        U.thDate(today)
      ) +

      '<div class="kpis">' +

      k.map(function (x) {
        return (
          '<div class="kpi">' +
          '<div class="k">' +
          x[0] +
          '</div>' +

          '<div class="v">' +
          x[1] +
          '</div>' +

          '<div class="muted" style="font-size:12px">' +
          x[2] +
          '</div>' +

          '</div>'
        );
      }).join('') +

      '</div>' +

      '<div class="two">' +

      '<section class="panel">' +

      '<div class="panel-h">' +
      'รอบรถวันนี้' +

      (
        P('SC06')
          ? '<a class="btn btn-s btn-sm" href="#/a/trips">ดูทั้งหมด</a>'
          : ''
      ) +

      '</div>' +

      '<div class="tbl-wrap">' +

      '<table class="tbl">' +

      '<thead>' +
      '<tr>' +
      '<th>เวลา</th>' +
      '<th>เส้นทาง</th>' +
      '<th>คนขับ</th>' +
      '<th>รถ</th>' +
      '<th>จองแล้ว</th>' +
      '<th>สถานะ</th>' +
      '</tr>' +
      '</thead>' +

      '<tbody>' +

      (
        trips.length
          ? trips.map(function (t) {
              var d =
                S.user(t.driverId);

              return (
                '<tr>' +

                '<td class="mono">' +
                t.dep +
                '</td>' +

                '<td>' +
                esc(
                  (
                    S.route(t.routeId) ||
                    {}
                  ).name
                ) +
                '</td>' +

                '<td>' +
                esc(
                  d
                    ? d.name
                    : '-'
                ) +
                '</td>' +

                '<td>' +
                esc(
                  (
                    S.vehicle(t.vehicleId) ||
                    {}
                  ).plate
                ) +
                '</td>' +

                '<td class="mono">' +
                S.bookedSeats(t.id) +
                ' / ' +
                S.tripSeats(t) +
                '</td>' +

                '<td>' +
                badge(t.status) +
                '</td>' +

                '</tr>'
              );
            }).join('')

          : '<tr><td colspan="6" class="muted" style="text-align:center;padding:24px">วันนี้ไม่มีรอบรถ</td></tr>'
      ) +

      '</tbody>' +
      '</table>' +
      '</div>' +
      '</section>' +


      '<section class="panel">' +
      '<div class="panel-h">รายการจองล่าสุด</div>' +

      '<div style="padding:0 18px 12px">' +

      recent.map(function (b) {
        var its =
          S.db.bookingItems.filter(function (i) {
            return i.bookingId === b.id;
          });

        var it = its[0];

        var u =
          S.user(b.userId);

        var t =
          it &&
          S.trip(it.tripId);

        return (
          '<div class="row" style="padding:9px 0;border-bottom:1px solid var(--line-2);font-size:14px">' +

          '<span class="mono muted" style="font-size:12px;width:52px">' +
          esc(b.id) +
          '</span>' +

          '<div style="flex:1;min-width:0">' +

          '<b>' +
          esc(
            u
              ? u.name
              : '-'
          ) +
          '</b>' +

          ' · ' +
          (
            it
              ? it.seats
              : 0
          ) +
          ' ที่นั่ง' +

          '<div class="muted" style="font-size:12px">' +

          (
            t
              ? U.thDate(t.date) +
                ' ' +
                t.dep +
                ' · '
              : ''
          ) +

          (
            it
              ? esc(
                  S.stopName(
                    it.boardStopId
                  )
                ) +
                ' → ' +
                esc(
                  S.stopName(
                    it.alightStopId
                  )
                )
              : ''
          ) +

          '</div>' +
          '</div>' +

          (
            it
              ? badge(it.status)
              : ''
          ) +

          '</div>'
        );
      }).join('') +

      '</div>' +
      '</section>' +

      '</div>';

    return h;
  }


  /* ======================= Generic CRUD ======================= */

  var ENT = {

    depts: {
      table: 'departments',
      prefix: 'D',
      width: 3,
      noun: 'แผนก',
      desc: 'รหัสแผนกและชื่อแผนก',

      cols: [
        ['id', 'รหัสแผนก', 'mono'],
        ['name', 'ชื่อแผนก']
      ],

      fields: [
        {
          k: 'name',
          l: 'ชื่อแผนก',
          req: 1
        }
      ],

      used: function (r) {
        return S.db.users.some(function (u) {
          return u.deptId === r.id;
        })
          ? 'มีผู้ใช้งานอยู่ในแผนกนี้'
          : '';
      }
    },


    positions: {
      table: 'positions',
      prefix: 'P',
      width: 2,
      noun: 'ตำแหน่ง',

      desc:
        'ตำแหน่งใช้เป็น “บทบาท” สำหรับกำหนดสิทธิ์ — เพิ่ม/แก้ไขได้ตลอด',

      cols: [
        [
          'id',
          'รหัสตำแหน่ง',
          'mono'
        ],

        [
          'name',
          'ชื่อตำแหน่ง'
        ],

        [
          function (r) {
            return (
              S.db.users.filter(function (u) {
                return u.positionId === r.id;
              }).length +
              ' คน'
            );
          },
          'ผู้ใช้งาน'
        ]
      ],

      fields: [
        {
          k: 'name',
          l: 'ชื่อตำแหน่ง',
          req: 1
        }
      ],

      extra: function (r) {
        return P('SC10')
          ? (
              '<a class="btn btn-s btn-sm" ' +
              'href="#/a/perms" ' +
              'data-act="a-perm-of" ' +
              'data-id="' +
              r.id +
              '">' +
              'กำหนดสิทธิ์' +
              '</a>'
            )
          : '';
      },

      used: function (r) {
        return S.db.users.some(function (u) {
          return u.positionId === r.id;
        })
          ? 'มีผู้ใช้งานในตำแหน่งนี้'
          : '';
      },

      onDelete: function (r) {
        S.db.permissions =
          S.db.permissions.filter(function (p) {
            return p.positionId !== r.id;
          });
      }
    },


    screens: {
      table: 'screens',
      prefix: 'SC',
      width: 2,
      noun: 'หน้าจอ',

      desc:
        'รายการหน้าจอ/โมดูลในระบบ — ใช้เป็นแถวของ Permission Matrix',

      cols: [
        [
          'id',
          'รหัสหน้าจอ',
          'mono'
        ],

        [
          'name',
          'ชื่อหน้าจอ'
        ]
      ],

      fields: [
        {
          k: 'name',
          l: 'ชื่อหน้าจอ',
          req: 1
        }
      ],

      used: function (r) {
        return [
          'SC01',
          'SC02',
          'SC03',
          'SC04',
          'SC05',
          'SC06',
          'SC07',
          'SC08',
          'SC09',
          'SC10',
          'SC11',
          'SC12'
        ].indexOf(r.id) >= 0
          ? 'เป็นหน้าจอหลักที่ระบบใช้ตรวจสิทธิ์'
          : '';
      },

      onDelete: function (r) {
        S.db.permissions =
          S.db.permissions.filter(function (p) {
            return p.screenId !== r.id;
          });
      }
    },


    vtypes: {
      table: 'vehicleTypes',
      prefix: 'T',
      width: 2,
      noun: 'ประเภทรถ',

      desc:
        'จำนวนที่นั่งของรอบการเดินรถคำนวณจากประเภทรถ',

      cols: [
        ['id', 'รหัส', 'mono'],
        ['name', 'ชื่อประเภทรถ'],
        ['detail', 'รายละเอียด'],
        ['seats', 'จำนวนที่นั่ง', 'num']
      ],

      fields: [
        {
          k: 'name',
          l: 'ชื่อประเภทรถ',
          req: 1
        },

        {
          k: 'detail',
          l: 'รายละเอียด'
        },

        {
          k: 'seats',
          l: 'จำนวนที่นั่ง',
          type: 'number',
          req: 1,
          min: 1
        }
      ],

      used: function (r) {
        return S.db.vehicles.some(function (v) {
          return v.typeId === r.id;
        })
          ? 'มีรถที่ใช้ประเภทนี้อยู่'
          : '';
      }
    },


    vehicles: {
      table: 'vehicles',
      prefix: 'V',
      width: 3,
      noun: 'รถ',

      desc:
        'ทะเบียนรถต้องไม่ซ้ำ',

      cols: [
        [
          'id',
          'รหัสรถ',
          'mono'
        ],

        [
          'plate',
          'ทะเบียนรถ'
        ],

        [
          function (r) {
            var t =
              S.vtype(r.typeId);

            return t
              ? t.name
              : '-';
          },
          'ประเภทรถ'
        ],

        [
          function (r) {
            var t =
              S.vtype(r.typeId);

            return t
              ? t.seats
              : '-';
          },
          'จำนวนที่นั่ง',
          'num'
        ],

        [
          function (r) {
            return badge(r.status);
          },
          'สถานะ',
          'html'
        ]
      ],

      fields: [
        {
          k: 'plate',
          l: 'ทะเบียนรถ',
          req: 1,
          unique:
            'ทะเบียนรถนี้มีอยู่ในระบบแล้ว',
          ph:
            'เช่น กข 1234'
        },

        {
          k: 'typeId',
          l: 'ประเภทรถ',
          type: 'select',

          opts: function () {
            return S.db.vehicleTypes.map(
              function (t) {
                return [
                  t.id,
                  t.name +
                  ' (' +
                  t.seats +
                  ' ที่นั่ง)'
                ];
              }
            );
          },

          req: 1
        },

        {
          k: 'status',
          l: 'สถานะ',
          type: 'select',

          opts: function () {
            return [
              [
                'พร้อมใช้งาน',
                'พร้อมใช้งาน'
              ],
              [
                'ซ่อมบำรุง',
                'ซ่อมบำรุง'
              ],
              [
                'งดใช้งาน',
                'งดใช้งาน'
              ]
            ];
          },

          req: 1
        }
      ],

      used: function (r) {
        return S.db.trips.some(function (t) {
          return t.vehicleId === r.id;
        })
          ? 'รถคันนี้ถูกใช้ในรอบการเดินรถแล้ว'
          : '';
      }
    },


    stops: {
      table: 'stops',
      prefix: 'S',
      width: 3,
      noun: 'จุดจอด',

      desc:
        'จุดจอดที่ถูกใช้ในเส้นทางหรือรายการจองจะลบไม่ได้',

      cols: [
        [
          'id',
          'รหัสจุดจอด',
          'mono'
        ],

        [
          'name',
          'ชื่อจุดจอด'
        ]
      ],

      fields: [
        {
          k: 'name',
          l: 'ชื่อจุดจอด',
          req: 1
        }
      ],

      used: function (r) {
        var inRoute =
          S.db.routeStops
            .filter(function (x) {
              return x.stopId === r.id;
            })
            .map(function (x) {
              return x.routeId;
            });

        if (inRoute.length) {
          return (
            'ถูกใช้ในเส้นทาง_จุดจอด (' +
            inRoute
              .filter(function (v, i, a) {
                return a.indexOf(v) === i;
              })
              .join(', ') +
            ')'
          );
        }

        return S.db.bookingItems.some(
          function (i) {
            return (
              i.boardStopId === r.id ||
              i.alightStopId === r.id
            );
          }
        )
          ? 'ถูกใช้ในรายการจอง'
          : '';
      }
    },


    users: {
      table: 'users',
      prefix: 'U',
      width: 3,
      noun: 'ผู้ใช้งาน',

      desc:
        'ผู้ใช้งานทุกคน — ถ้าเป็น “พนักงาน” จะมีเบอร์โทร',

      cols: [
        ['id', 'รหัส', 'mono'],
        ['name', 'ชื่อ'],
        ['email', 'email'],
        ['username', 'username', 'mono'],

        [
          function (r) {
            var d =
              S.by(
                'departments',
                r.deptId
              );

            return d
              ? d.name
              : '-';
          },
          'แผนก'
        ],

        [
          function (r) {
            var p =
              S.by(
                'positions',
                r.positionId
              );

            return p
              ? badge(
                  p.name,
                  'b-blue'
                )
              : '<span class="muted">—</span>';
          },
          'ตำแหน่ง',
          'html'
        ],

        [
          function (r) {
            return r.employee
              ? r.employee.phone
              : '—';
          },
          'เบอร์โทร',
          'mono'
        ]
      ],

      fields: [
        {
          k: 'name',
          l: 'ชื่อ',
          req: 1
        },

        {
          k: 'email',
          l: 'email',
          type: 'email',
          req: 1
        },

        {
          k: 'username',
          l: 'username',
          req: 1,
          unique:
            'username นี้ถูกใช้แล้ว'
        },

        {
          k: 'password',
          l: 'password',
          type: 'password',
          reqNew: 1,
          hint:
            'แก้ไข: เว้นว่างไว้หากไม่ต้องการเปลี่ยน'
        },

        {
          k: 'deptId',
          l: 'แผนก',
          type: 'select',
          req: 1,

          opts: function () {
            return S.db.departments.map(
              function (d) {
                return [
                  d.id,
                  d.name
                ];
              }
            );
          }
        },

        {
          k: 'positionId',
          l: 'ตำแหน่ง',
          type: 'select',

          opts: function () {
            return [
              [
                '',
                '— ไม่มี (ผู้ใช้บริการ)'
              ]
            ].concat(
              S.db.positions.map(
                function (p) {
                  return [
                    p.id,
                    p.name
                  ];
                }
              )
            );
          }
        },

        {
          k: 'isEmp',
          l: 'เป็นพนักงาน',
          type: 'check'
        },

        {
          k: 'phone',
          l: 'เบอร์โทร',
          type: 'tel',
          showIf: 'isEmp',
          ph: '0811111111'
        }
      ],

      toForm: function (r) {
        var o =
          Object.assign(
            {},
            r,
            {
              password: ''
            }
          );

        o.isEmp =
          !!r.employee;

        o.phone =
          r.employee
            ? r.employee.phone
            : '';

        return o;
      },

      fromForm: function (o, old) {
        var r = {
          name: o.name,
          email: o.email,
          username: o.username,
          deptId: o.deptId,
          positionId: o.positionId,

          employee:
            o.isEmp
              ? {
                  phone: o.phone
                }
              : null
        };

        r.password =
          o.password ||
          (
            old
              ? old.password
              : ''
          );

        return r;
      },

      validate: function (o) {
        if (
          o.isEmp &&
          !/^0\d{8,9}$/.test(
            o.phone || ''
          )
        ) {
          return {
            phone:
              'กรอกเบอร์โทร 9–10 หลัก ขึ้นต้นด้วย 0'
          };
        }
      },

      used: function (r) {
        if (r.id === me().id) {
          return (
            'ไม่สามารถลบบัญชีที่กำลังใช้งานอยู่'
          );
        }

        if (
          S.db.bookings.some(function (b) {
            return b.userId === r.id;
          })
        ) {
          return (
            'ผู้ใช้งานนี้มีประวัติการจอง'
          );
        }

        return S.db.trips.some(
          function (t) {
            return t.driverId === r.id;
          }
        )
          ? 'ผู้ใช้งานนี้ถูกมอบหมายเป็นคนขับในรอบการเดินรถ'
          : '';
      }
    }
  };


  function cell(r, c) {
    var v =
      typeof c[0] === 'function'
        ? c[0](r)
        : r[c[0]];

    if (c[2] === 'html') {
      return (
        '<td>' +
        v +
        '</td>'
      );
    }

    return (
      '<td class="' +
      (c[2] || '') +
      '">' +
      esc(v) +
      '</td>'
    );
  }


  function crud(page) {
    var E = ENT[page];
    var p = P(PAGES[page][1]);
    var rows = S.db[E.table];

    var h =
      ph(
        PAGES[page][0],
        E.desc,

        p.add
          ? (
              '<button class="btn btn-p" data-act="a-new" data-ent="' +
              page +
              '">' +
              icon('plus', 18) +
              'เพิ่ม' +
              E.noun +
              '</button>'
            )
          : ''
      ) +

      '<div class="toolbar">' +

      '<label class="sr-only" for="tbl-q">ค้นหา</label>' +

      '<input id="tbl-q" class="inp" style="width:300px" placeholder="ค้นหา' +
      E.noun +
      '…" data-input="tbl-filter">' +

      '<span class="muted" style="font-size:13px">' +
      '<span id="tbl-count">' +
      rows.length +
      '</span> รายการ' +
      '</span>' +

      '<div style="flex:1"></div>' +

      '<span class="muted" style="font-size:12px">' +
      'สิทธิ์ของคุณ: ' +
      permSummary(p) +
      '</span>' +

      '</div>' +

      '<section class="panel">' +
      '<div class="tbl-wrap">' +

      '<table class="tbl" id="crud-tbl">' +

      '<thead><tr>' +

      E.cols.map(function (c) {
        return (
          '<th' +
          (
            c[2] === 'num'
              ? ' class="num"'
              : ''
          ) +
          '>' +
          c[1] +
          '</th>'
        );
      }).join('') +

      '<th>Actions</th>' +
      '</tr></thead>' +

      '<tbody>' +

      rows.map(function (r) {
        var text =
          E.cols.map(function (c) {
            return typeof c[0] === 'function'
              ? String(c[0](r))
                  .replace(/<[^>]+>/g, '')
              : r[c[0]];
          })
          .join(' ')
          .toLowerCase();

        return (
          '<tr data-text="' +
          esc(text) +
          '">' +

          E.cols.map(function (c) {
            return cell(r, c);
          }).join('') +

          '<td><div class="act">' +

          (
            E.extra
              ? E.extra(r)
              : ''
          ) +

          (
            p.edit
              ? (
                  '<button class="btn btn-e btn-sm" data-act="a-edit" data-ent="' +
                  page +
                  '" data-id="' +
                  esc(r.id) +
                  '">' +
                  'แก้ไข' +
                  '</button>'
                )
              : ''
          ) +

          (
            p.del
              ? (
                  '<button class="btn btn-r btn-sm" data-act="a-del" data-ent="' +
                  page +
                  '" data-id="' +
                  esc(r.id) +
                  '">' +
                  'ลบ' +
                  '</button>'
                )
              : ''
          ) +

          (
            !p.edit &&
            !p.del &&
            !E.extra
              ? '<span class="muted" style="font-size:12px">ดูอย่างเดียว</span>'
              : ''
          ) +

          '</div></td>' +
          '</tr>'
        );
      }).join('') +

      '</tbody>' +
      '</table>' +

      (
        rows.length
          ? ''
          : UI.empty(
              'ยังไม่มีข้อมูล'
            )
      ) +

      '</div>' +
      '</section>';

    return h;
  }


  App.inputs['tbl-filter'] = function (el) {
    var q =
      el.value
        .trim()
        .toLowerCase();

    var n = 0;

    document
      .querySelectorAll(
        '#crud-tbl tbody tr'
      )
      .forEach(function (tr) {
        var ok =
          !q ||
          tr.dataset.text.indexOf(q) >= 0;

        tr.style.display =
          ok
            ? ''
            : 'none';

        if (ok) {
          n++;
        }
      });

    document.getElementById(
      'tbl-count'
    ).textContent = n;
  };


  function entForm(
    page,
    id,
    errors,
    values
  ) {
    var E = ENT[page];

    var old =
      id
        ? S.by(E.table, id)
        : null;

    var v =
      values ||
      (
        old
          ? (
              E.toForm
                ? E.toForm(old)
                : Object.assign(
                    {},
                    old
                  )
            )
          : {
              isEmp: false
            }
      );

    errors =
      errors ||
      {};

    var body =
      E.fields.map(function (f) {
        var val =
          v[f.k] == null
            ? ''
            : v[f.k];

        var err =
          errors[f.k];

        var fid =
          'f-' + f.k;

        var hidden =
          f.showIf &&
          !v[f.showIf];

        var input;


        if (f.type === 'select') {
          input =
            '<select id="' +
            fid +
            '" name="' +
            f.k +
            '" class="inp' +
            (
              err
                ? ' bad'
                : ''
            ) +
            '">' +

            (
              f.req &&
              !old &&
              !val
                ? '<option value="">— เลือก —</option>'
                : ''
            ) +

            f.opts()
              .map(function (o) {
                return opt(
                  o[0],
                  o[1],
                  val
                );
              })
              .join('') +

            '</select>';

        } else if (
          f.type === 'check'
        ) {
          return (
            '<label class="switch">' +

            '<input type="checkbox" name="' +
            f.k +
            '"' +
            (
              val
                ? ' checked'
                : ''
            ) +
            ' data-change="toggle-show" data-target="' +
            f.k +
            '">' +

            ' ' +
            esc(f.l) +

            '</label>'
          );

        } else {
          input =
            '<input id="' +
            fid +
            '" name="' +
            f.k +
            '" class="inp' +
            (
              err
                ? ' bad'
                : ''
            ) +
            '" type="' +
            (f.type || 'text') +
            '"' +

            (
              f.min != null
                ? ' min="' +
                  f.min +
                  '"'
                : ''
            ) +

            ' value="' +
            esc(val) +
            '"' +

            (
              f.ph
                ? ' placeholder="' +
                  esc(f.ph) +
                  '"'
                : ''
            ) +

            (
              f.type === 'password'
                ? ' autocomplete="new-password"'
                : ''
            ) +

            '>';
        }


        return (
          '<div class="field" data-show-if="' +
          (f.showIf || '') +
          '"' +
          (
            hidden
              ? ' hidden'
              : ''
          ) +
          '>' +

          '<label for="' +
          fid +
          '">' +

          esc(f.l) +

          (
            f.req ||
            (
              f.reqNew &&
              !old
            )
              ? ' <span style="color:var(--danger)">*</span>'
              : ''
          ) +

          '</label>' +

          input +

          (
            err
              ? (
                  '<div class="err" role="alert">' +
                  esc(err) +
                  '</div>'
                )
              : (
                  f.hint &&
                  old
                    ? (
                        '<div class="hint">' +
                        esc(f.hint) +
                        '</div>'
                      )
                    : ''
                )
          ) +

          '</div>'
        );
      }).join('');


    UI.modal(
      '<h3>' +
      (
        old
          ? 'แก้ไข' +
            E.noun +
            ' ' +
            esc(old.id)
          : 'เพิ่ม' +
            E.noun
      ) +
      '</h3>' +

      '<form class="stack" data-form="a-ent" data-ent="' +
      page +
      '" data-id="' +
      esc(id || '') +
      '" novalidate>' +

      body +

      '<div class="modal-actions">' +

      '<button type="button" class="btn btn-s" data-act="modal-close">' +
      'ยกเลิก' +
      '</button>' +

      '<button class="btn btn-p" type="submit">' +
      'บันทึก' +
      '</button>' +

      '</div>' +
      '</form>'
    );
  }


  App.changes['toggle-show'] =
    function (el) {
      var form =
        el.closest('form');

      form
        .querySelectorAll(
          '[data-show-if="' +
          el.dataset.target +
          '"]'
        )
        .forEach(function (d) {
          d.hidden =
            !el.checked;
        });
    };


  App.actions['a-new'] =
    function (el) {
      entForm(
        el.dataset.ent,
        null
      );
    };


  App.actions['a-edit'] =
    function (el) {
      entForm(
        el.dataset.ent,
        el.dataset.id
      );
    };


  App.forms['a-ent'] =
    function (f, fd) {
      var page =
        f.dataset.ent;

      var id =
        f.dataset.id;

      var E =
        ENT[page];

      var old =
        id
          ? S.by(E.table, id)
          : null;

      var v = {};
      var err = {};


      E.fields.forEach(function (x) {
        v[x.k] =
          x.type === 'check'
            ? fd.get(x.k) === 'on'
            : String(
                fd.get(x.k) == null
                  ? ''
                  : fd.get(x.k)
              ).trim();
      });


      E.fields.forEach(function (x) {
        if (
          x.showIf &&
          !v[x.showIf]
        ) {
          return;
        }

        if (
          (
            x.req ||
            (
              x.reqNew &&
              !old
            )
          ) &&
          v[x.k] === ''
        ) {
          err[x.k] =
            'กรุณากรอก' +
            x.l;

        } else if (
          x.type === 'number' &&
          v[x.k] !== '' &&
          (
            isNaN(+v[x.k]) ||
            +v[x.k] <
            (x.min || 0)
          )
        ) {
          err[x.k] =
            x.l +
            ' ต้องเป็นตัวเลขตั้งแต่ ' +
            (x.min || 0);

        } else if (
          x.unique
        ) {
          var norm =
            function (s) {
              return String(s)
                .replace(/\s+/g, '')
                .toLowerCase();
            };

          if (
            S.db[E.table].some(
              function (r) {
                return (
                  r.id !== id &&
                  norm(r[x.k]) ===
                  norm(v[x.k])
                );
              }
            )
          ) {
            err[x.k] =
              x.unique;
          }
        }
      });


      if (E.validate) {
        Object.assign(
          err,
          E.validate(v) || {}
        );
      }


      if (
        Object.keys(err).length
      ) {
        entForm(
          page,
          id,
          err,
          v
        );

        return;
      }


      var rec =
        E.fromForm
          ? E.fromForm(
              v,
              old
            )
          : (
              function () {
                var r = {};

                E.fields.forEach(
                  function (x) {
                    r[x.k] =
                      x.type === 'number'
                        ? +v[x.k]
                        : v[x.k];
                  }
                );

                return r;
              }
            )();


      if (old) {
        Object.assign(
          old,
          rec
        );

      } else {
        rec.id =
          S.nextId(
            E.table,
            E.prefix,
            E.width
          );

        S.db[E.table].push(rec);
      }


      S.save();

      UI.closeModal();

      App.refresh();

      UI.toast(
        (
          old
            ? 'บันทึกการแก้ไข '
            : 'เพิ่ม '
        ) +
        (
          old
            ? old.id
            : rec.id
        ) +
        ' แล้ว',
        'ok'
      );
    };


  /* =========================================================
     GENERIC SAFE DELETE
     ========================================================= */

  App.actions['a-del'] =
    function (el) {
      var E =
        ENT[el.dataset.ent];

      var r =
        S.by(
          E.table,
          el.dataset.id
        );

      if (!r) {
        UI.toast(
          'ไม่พบข้อมูลที่ต้องการลบ',
          'bad'
        );
        return;
      }


      var why =
        E.used
          ? E.used(r)
          : '';

      var label =
        r.name ||
        r.plate ||
        r.id;


      if (why) {
        UI.modal(
          '<h3>ไม่สามารถลบได้</h3>' +

          '<div class="alert alert-bad">' +
          icon('alert', 20) +

          '<div>“' +
          esc(label) +
          '” (' +
          esc(r.id) +
          ') ' +
          esc(why) +
          '</div>' +

          '</div>' +

          '<div class="modal-actions">' +
          '<button class="btn btn-p" data-act="modal-close">' +
          'เข้าใจแล้ว' +
          '</button>' +
          '</div>',

          {
            size: 'sm'
          }
        );

        return;
      }


      UI.confirmBox({
        title:
          'ยืนยันการลบ',

        danger: true,

        okText:
          'ลบ',

        body:
          'ต้องการลบ <b>' +
          esc(label) +
          '</b> (' +
          '<span class="mono">' +
          esc(r.id) +
          '</span>) ใช่หรือไม่?' +

          '<br><br>' +

          '<span class="muted">' +
          'ข้อมูลจะถูกลบจาก Oracle Database จริง' +
          '</span>',

        onOk:
          async function () {

            var ok =
              await oracleDelete(
                E.table,
                r.id
              );

            if (!ok) {
              return;
            }


            if (E.onDelete) {
              E.onDelete(r);
            }


            S.db[E.table] =
              S.db[E.table]
                .filter(function (x) {
                  return x !== r;
                });


            UI.closeModal();

            App.refresh();

            UI.toast(
              'ลบ ' +
              r.id +
              ' จาก Oracle แล้ว',
              'ok'
            );
          }
      });
    };


  App.actions['a-perm-of'] =
    function (el) {
      st.permPos =
        el.dataset.id;

      App.go(
        '#/a/perms'
      );
    };


  /* ======================= Permission Matrix ======================= */

  function perms() {
    var p = P('SC10');
    var pos = st.permPos;

    if (
      !S.by(
        'positions',
        pos
      )
    ) {
      pos =
        st.permPos =
        S.db.positions[0].id;
    }


    var h =
      ph(
        'สิทธิ์ตามตำแหน่ง',
        'เลือกตำแหน่ง แล้วกำหนดสิทธิ์ เข้าถึง / เพิ่ม / แก้ไข / ลบ ต่อหน้าจอ'
      ) +

      '<div class="pill-row" role="tablist">' +

      S.db.positions.map(
        function (x) {
          return (
            '<button class="pchip' +
            (
              x.id === pos
                ? ' on'
                : ''
            ) +
            '" role="tab" aria-selected="' +
            (x.id === pos) +
            '" data-act="a-perm-pos" data-id="' +
            x.id +
            '">' +
            esc(x.name) +
            ' (' +
            x.id +
            ')' +
            '</button>'
          );
        }
      ).join('') +

      '</div>' +

      (
        p.edit
          ? ''
          : (
              '<div class="alert alert-info">' +
              icon('lock', 20) +
              '<div>คุณดูได้อย่างเดียว — ไม่มีสิทธิ์แก้ไขหน้าจอนี้</div>' +
              '</div>'
            )
      ) +

      '<section class="panel" style="max-width:900px">' +
      '<div class="tbl-wrap">' +

      '<table class="tbl">' +

      '<thead>' +
      '<tr>' +
      '<th>รหัส</th>' +
      '<th>หน้าจอ</th>' +
      '<th>เข้าถึง</th>' +
      '<th>เพิ่ม</th>' +
      '<th>แก้ไข</th>' +
      '<th>ลบ</th>' +
      '<th>รหัสสิทธิ์</th>' +
      '</tr>' +
      '</thead>' +

      '<tbody>' +

      S.db.screens.map(
        function (sc) {
          var r =
            S.perm(
              pos,
              sc.id
            );

          var dis =
            !p.edit;

          function box(
            k,
            on,
            disabled
          ) {
            return (
              '<td>' +

              '<input type="checkbox" class="ck" aria-label="' +
              esc(sc.name) +
              ' — ' +
              {
                acc: 'เข้าถึง',
                add: 'เพิ่ม',
                edit: 'แก้ไข',
                del: 'ลบ'
              }[k] +
              '"' +

              (
                on
                  ? ' checked'
                  : ''
              ) +

              (
                disabled
                  ? ' disabled'
                  : ''
              ) +

              ' data-change="a-perm" data-sc="' +
              sc.id +
              '" data-k="' +
              k +
              '">' +

              '</td>'
            );
          }


          return (
            '<tr>' +

            '<td class="mono">' +
            sc.id +
            '</td>' +

            '<td>' +
            esc(sc.name) +
            '</td>' +

            box(
              'acc',
              !!r,
              dis
            ) +

            box(
              'add',
              r && r.add,
              dis || !r
            ) +

            box(
              'edit',
              r && r.edit,
              dis || !r
            ) +

            box(
              'del',
              r && r.del,
              dis || !r
            ) +

            '<td class="mono muted">' +
            (
              r
                ? r.id
                : '—'
            ) +
            '</td>' +

            '</tr>'
          );
        }
      ).join('') +

      '</tbody>' +
      '</table>' +
      '</div>' +
      '</section>';

    return h;
  }


  App.actions['a-perm-pos'] =
    function (el) {
      st.permPos =
        el.dataset.id;

      App.refresh();
    };


  App.changes['a-perm'] =
    function (el) {
      if (
        !P('SC10') ||
        !P('SC10').edit
      ) {
        return;
      }

      var pos =
        st.permPos;

      var sc =
        el.dataset.sc;

      var k =
        el.dataset.k;

      var r =
        S.perm(
          pos,
          sc
        );


      if (k === 'acc') {
        if (
          el.checked &&
          !r
        ) {
          S.db.permissions.push({
            id:
              S.nextId(
                'permissions',
                'PR',
                3
              ),

            positionId: pos,
            screenId: sc,
            add: 0,
            edit: 0,
            del: 0
          });

        } else if (
          !el.checked &&
          r
        ) {
          S.db.permissions =
            S.db.permissions.filter(
              function (x) {
                return x !== r;
              }
            );
        }

      } else if (r) {
        r[k] =
          el.checked
            ? 1
            : 0;
      }


      S.save();

      App.refresh();

      UI.toast(
        'บันทึกสิทธิ์แล้ว',
        'ok'
      );
    };


  /* ======================= Routes ======================= */

  function diagram(
    routeId,
    stopsArr
  ) {
    var rs =
      stopsArr ||
      S.routeStops(routeId);

    return (
      '<div class="rdiag">' +

      rs.map(
        function (r, i) {
          return (
            (
              i
                ? (
                    '<div class="rleg">' +
                    '<span>+' +
                    (+r.minutes || 0) +
                    ' นาที</span>' +
                    '</div>'
                  )
                : ''
            ) +

            '<div class="rstop">' +

            '<div class="rdot"></div>' +

            '<div class="mono" style="font-size:12px;font-weight:700">' +
            (i + 1) +
            ' · ' +
            esc(r.stopId) +
            '</div>' +

            '<div style="font-size:13px;line-height:1.35">' +
            esc(
              S.stopName(
                r.stopId
              )
            ) +
            '</div>' +

            '</div>'
          );
        }
      ).join('') +

      '</div>'
    );
  }


  function routes() {
    var p =
      P('SC05');

    var h =
      ph(
        'เส้นทาง',

        'เส้นทางและลำดับจุดจอด (เส้นทาง_จุดจอด) — เวลารวมเป็นค่า Derived จากผลรวมเวลาเดินทางจากจุดก่อนหน้า',

        p.add
          ? (
              '<a class="btn btn-p" href="#/a/routes/new">' +
              icon('plus', 18) +
              'เพิ่มเส้นทาง' +
              '</a>'
            )
          : ''
      ) +

      '<section class="panel">' +
      '<div class="tbl-wrap">' +

      '<table class="tbl">' +

      '<thead>' +
      '<tr>' +
      '<th>รหัสเส้นทาง</th>' +
      '<th>ชื่อเส้นทาง</th>' +
      '<th>จำนวนจุดจอด</th>' +
      '<th class="num">เวลารวม</th>' +
      '<th>Actions</th>' +
      '</tr>' +
      '</thead>' +

      '<tbody>' +

      S.db.routes.map(
        function (r) {
          return (
            '<tr>' +

            '<td class="mono">' +
            r.id +
            '</td>' +

            '<td><b>' +
            esc(r.name) +
            '</b></td>' +

            '<td>' +
            S.routeStops(r.id).length +
            ' ลำดับ</td>' +

            '<td class="num">' +
            S.routeTotal(r.id) +
            ' นาที</td>' +

            '<td><div class="act">' +

            (
              p.edit
                ? (
                    '<a class="btn btn-e btn-sm" href="#/a/routes/' +
                    r.id +
                    '">' +
                    'แก้ไข' +
                    '</a>'
                  )
                : ''
            ) +

            (
              p.del
                ? (
                    '<button class="btn btn-r btn-sm" data-act="a-route-del" data-id="' +
                    r.id +
                    '">' +
                    'ลบ' +
                    '</button>'
                  )
                : ''
            ) +

            '</div></td>' +
            '</tr>'
          );
        }
      ).join('') +

      '</tbody>' +
      '</table>' +
      '</div>' +
      '</section>' +

      S.db.routes.map(
        function (r) {
          return (
            '<section class="panel">' +

            '<div class="panel-h">' +
            esc(r.name) +
            ' — Route diagram' +

            '<span class="muted" style="font-weight:400;font-size:13px">' +
            'เวลารวม ' +

            '<b class="mono" style="color:var(--ink)">' +
            S.routeTotal(r.id) +
            ' นาที' +
            '</b>' +

            '</span>' +
            '</div>' +

            '<div style="padding:0 18px 18px">' +
            diagram(r.id) +
            '</div>' +

            '</section>'
          );
        }
      ).join('');

    return h;
  }


  function routeForm(id) {
    var p =
      P('SC05');

    if (
      !(
        id === 'new'
          ? p.add
          : p.edit
      )
    ) {
      return App.views.denied(
        'การ' +
        (
          id === 'new'
            ? 'เพิ่ม'
            : 'แก้ไข'
        ) +
        'เส้นทาง'
      );
    }


    var d =
      st.routeDraft;


    if (
      !d ||
      d.id !== id
    ) {
      var r =
        id === 'new'
          ? {
              name: ''
            }
          : S.route(id);


      if (!r) {
        return UI.empty(
          'ไม่พบเส้นทาง'
        );
      }


      d =
        st.routeDraft = {
          id: id,

          name:
            r.name,

          rows:
            id === 'new'
              ? [
                  {
                    stopId:
                      S.db.stops[0].id,
                    minutes: 0
                  },

                  {
                    stopId:
                      (
                        S.db.stops[1] ||
                        S.db.stops[0]
                      ).id,

                    minutes: 5
                  }
                ]

              : S.routeStops(id)
                  .map(function (x) {
                    return {
                      stopId:
                        x.stopId,

                      minutes:
                        +x.minutes
                    };
                  }),

          err: ''
        };
    }


    var total =
      d.rows.reduce(
        function (a, r, i) {
          return (
            a +
            (
              i
                ? (+r.minutes || 0)
                : 0
            )
          );
        },
        0
      );


    return (
      ph(
        id === 'new'
          ? 'เพิ่มเส้นทาง'
          : 'แก้ไขเส้นทาง ' + id,

        'ลากเพื่อเรียงลำดับจุดจอด · จุดจอดเดียวกันเลือกซ้ำได้ · ลำดับ 1 ล็อกเวลาเป็น 0',

        '<a class="btn btn-s" href="#/a/routes" data-act="a-route-cancel">ยกเลิก</a>'
      ) +

      '<form class="panel stack" style="padding:20px 22px;max-width:900px" data-form="a-route" novalidate>' +

      (
        d.err
          ? (
              '<div class="alert alert-bad">' +
              icon('alert', 20) +
              '<div>' +
              esc(d.err) +
              '</div>' +
              '</div>'
            )
          : ''
      ) +

      '<div class="field" style="max-width:360px">' +
      '<label for="r-name">' +
      'ชื่อเส้นทาง ' +
      '<span style="color:var(--danger)">*</span>' +
      '</label>' +

      '<input id="r-name" class="inp" name="name" value="' +
      esc(d.name) +
      '" data-input="a-route-name">' +

      '</div>' +

      '<div>' +

      '<div class="rs-row" style="font-size:12px;font-weight:700;color:var(--ink-2)">' +
      '<span></span>' +
      '<span>ลำดับ</span>' +
      '<span>จุดจอด</span>' +
      '<span>เวลาจากจุดก่อนหน้า (นาที)</span>' +
      '<span></span>' +
      '</div>' +

      '<div id="rs-list">' +

      d.rows.map(
        function (r, i) {
          return (
            '<div class="rs-row" draggable="true" data-idx="' +
            i +
            '">' +

            '<span class="handle" title="ลากเพื่อย้าย" aria-hidden="true">' +
            icon('drag', 18) +
            '</span>' +

            '<span class="mono">' +
            (i + 1) +
            '</span>' +

            '<select class="inp" aria-label="จุดจอดลำดับ ' +
            (i + 1) +
            '" data-change="a-rs-stop" data-idx="' +
            i +
            '">' +

            S.db.stops.map(
              function (s) {
                return opt(
                  s.id,
                  s.id +
                  ' · ' +
                  s.name,
                  r.stopId
                );
              }
            ).join('') +

            '</select>' +

            '<input class="inp mono" type="number" min="0" aria-label="เวลาเดินทางลำดับ ' +
            (i + 1) +
            '" value="' +
            (
              i
                ? r.minutes
                : 0
            ) +
            '"' +
            (
              i
                ? ''
                : ' disabled'
            ) +
            ' data-input="a-rs-min" data-idx="' +
            i +
            '">' +

            '<span class="row" style="gap:2px">' +

            '<button type="button" class="icb" style="width:32px;height:32px" data-act="a-rs-move" data-idx="' +
            i +
            '" data-dir="-1" aria-label="เลื่อนขึ้น"' +
            (
              i
                ? ''
                : ' disabled'
            ) +
            '>' +
            icon('up', 16) +
            '</button>' +

            '<button type="button" class="icb" style="width:32px;height:32px" data-act="a-rs-move" data-idx="' +
            i +
            '" data-dir="1" aria-label="เลื่อนลง"' +
            (
              i < d.rows.length - 1
                ? ''
                : ' disabled'
            ) +
            '>' +
            icon('down', 16) +
            '</button>' +

            '<button type="button" class="icb" style="width:32px;height:32px;color:var(--danger)" data-act="a-rs-del" data-idx="' +
            i +
            '" aria-label="ลบลำดับ ' +
            (i + 1) +
            '">' +
            icon('trash', 16) +
            '</button>' +

            '</span>' +
            '</div>'
          );
        }
      ).join('') +

      '</div>' +
      '</div>' +

      '<div class="row" style="justify-content:space-between;flex-wrap:wrap">' +

      '<button type="button" class="btn btn-s" data-act="a-rs-add">' +
      icon('plus', 18) +
      'เพิ่มจุดจอด' +
      '</button>' +

      '<span class="muted">' +
      'เวลารวม (คำนวณอัตโนมัติ): ' +

      '<b class="mono" style="color:var(--ink)" id="rs-total">' +
      total +
      '</b> นาที' +

      '</span>' +
      '</div>' +

      '<div class="panel" style="box-shadow:none;background:var(--bg)">' +

      '<div style="padding:10px 14px 0;font-size:13px;font-weight:600">' +
      'ตัวอย่าง Route diagram' +
      '</div>' +

      '<div style="padding:0 14px 10px" id="rs-diag">' +
      diagram(
        null,
        d.rows
      ) +
      '</div>' +

      '</div>' +

      '<div class="modal-actions">' +

      '<a class="btn btn-s" href="#/a/routes" data-act="a-route-cancel">' +
      'ยกเลิก' +
      '</a>' +

      '<button class="btn btn-p" type="submit">' +
      'บันทึกเส้นทาง' +
      '</button>' +

      '</div>' +
      '</form>'
    );
  }


  function draftTotal() {
    var d =
      st.routeDraft;

    var t =
      d.rows.reduce(
        function (a, r, i) {
          return (
            a +
            (
              i
                ? (+r.minutes || 0)
                : 0
            )
          );
        },
        0
      );

    var el =
      document.getElementById(
        'rs-total'
      );

    if (el) {
      el.textContent = t;
    }

    var dg =
      document.getElementById(
        'rs-diag'
      );

    if (dg) {
      dg.innerHTML =
        diagram(
          null,
          d.rows
        );
    }
  }


  App.inputs['a-route-name'] =
    function (el) {
      st.routeDraft.name =
        el.value;
    };


  App.inputs['a-rs-min'] =
    function (el) {
      st.routeDraft.rows[
        +el.dataset.idx
      ].minutes =
        Math.max(
          0,
          parseInt(
            el.value,
            10
          ) || 0
        );

      draftTotal();
    };


  App.changes['a-rs-stop'] =
    function (el) {
      st.routeDraft.rows[
        +el.dataset.idx
      ].stopId =
        el.value;

      draftTotal();
    };


  App.actions['a-rs-add'] =
    function () {
      st.routeDraft.rows.push({
        stopId:
          S.db.stops[0].id,

        minutes: 5
      });

      App.refresh();
    };


  App.actions['a-rs-del'] =
    function (el) {
      var d =
        st.routeDraft;

      if (
        d.rows.length <= 2
      ) {
        UI.toast(
          'เส้นทางต้องมีอย่างน้อย 2 จุดจอด',
          'bad'
        );

        return;
      }

      d.rows.splice(
        +el.dataset.idx,
        1
      );

      App.refresh();
    };


  App.actions['a-rs-move'] =
    function (el) {
      var d =
        st.routeDraft;

      var i =
        +el.dataset.idx;

      var j =
        i +
        (+el.dataset.dir);

      var t =
        d.rows[i];

      d.rows[i] =
        d.rows[j];

      d.rows[j] =
        t;

      App.refresh();
    };


  App.actions['a-route-cancel'] =
    function () {
      st.routeDraft = null;

      App.go(
        '#/a/routes'
      );
    };


  App.forms['a-route'] =
    function () {
      var d =
        st.routeDraft;

      d.name =
        d.name.trim();


      if (!d.name) {
        d.err =
          'กรุณากรอกชื่อเส้นทาง';

      } else if (
        d.rows.length < 2
      ) {
        d.err =
          'เส้นทางต้องมีอย่างน้อย 2 จุดจอด';

      } else if (
        d.rows.some(
          function (r, i) {
            return (
              i &&
              r.stopId ===
              d.rows[i - 1].stopId
            );
          }
        )
      ) {
        d.err =
          'จุดจอดที่อยู่ติดกันต้องไม่ซ้ำกัน';

      } else {
        d.err = '';
      }


      if (d.err) {
        App.refresh();
        return;
      }


      var id =
        d.id === 'new'
          ? S.nextId(
              'routes',
              'R',
              3
            )
          : d.id;


      if (
        d.id === 'new'
      ) {
        S.db.routes.push({
          id: id,
          name: d.name
        });

      } else {
        S.route(id).name =
          d.name;
      }


      S.db.routeStops =
        S.db.routeStops
          .filter(function (r) {
            return r.routeId !== id;
          })
          .concat(
            d.rows.map(
              function (r, i) {
                return {
                  routeId: id,
                  seq: i + 1,
                  stopId: r.stopId,
                  minutes:
                    i
                      ? +r.minutes
                      : 0
                };
              }
            )
          );


      S.save();

      st.routeDraft = null;

      App.go(
        '#/a/routes'
      );

      UI.toast(
        'บันทึกเส้นทาง ' +
        id +
        ' แล้ว — เวลารวม ' +
        S.routeTotal(id) +
        ' นาที',
        'ok'
      );
    };


  /* =========================================================
     SAFE DELETE ROUTE
     ========================================================= */

  App.actions['a-route-del'] =
    function (el) {
      var r =
        S.route(
          el.dataset.id
        );


      if (
        S.db.trips.some(
          function (t) {
            return t.routeId === r.id;
          }
        )
      ) {
        UI.modal(
          '<h3>ไม่สามารถลบได้</h3>' +

          '<div class="alert alert-bad">' +
          icon('alert', 20) +

          '<div>“' +
          esc(r.name) +
          '” ถูกใช้ในรอบการเดินรถแล้ว</div>' +

          '</div>' +

          '<div class="modal-actions">' +

          '<button class="btn btn-p" data-act="modal-close">' +
          'เข้าใจแล้ว' +
          '</button>' +

          '</div>',

          {
            size: 'sm'
          }
        );

        return;
      }


      UI.confirmBox({
        title:
          'ยืนยันการลบ',

        danger: true,

        okText:
          'ลบ',

        body:
          'ลบ <b>' +
          esc(r.name) +
          '</b> และลำดับจุดจอดทั้งหมด?' +

          '<br><br>' +

          '<span class="muted">' +
          'ข้อมูลจะถูกลบจาก Oracle Database จริง' +
          '</span>',

        onOk:
          async function () {

            var ok =
              await oracleDelete(
                'routes',
                r.id
              );

            if (!ok) {
              return;
            }


            S.db.routes =
              S.db.routes.filter(
                function (x) {
                  return x !== r;
                }
              );


            S.db.routeStops =
              S.db.routeStops.filter(
                function (x) {
                  return x.routeId !== r.id;
                }
              );


            UI.closeModal();

            App.refresh();

            UI.toast(
              'ลบ ' +
              r.id +
              ' จาก Oracle แล้ว',
              'ok'
            );
          }
      });
    };


  /* drag & drop เรียงลำดับจุดจอด */

  var dragIdx = null;


  document.addEventListener(
    'dragstart',
    function (e) {
      var row =
        e.target.closest &&
        e.target.closest(
          '.rs-row[draggable]'
        );

      if (!row) {
        return;
      }

      dragIdx =
        +row.dataset.idx;

      row.classList.add(
        'dragging'
      );

      e.dataTransfer.effectAllowed =
        'move';
    }
  );


  document.addEventListener(
    'dragover',
    function (e) {
      var row =
        e.target.closest &&
        e.target.closest(
          '.rs-row[draggable]'
        );

      if (
        !row ||
        dragIdx === null
      ) {
        return;
      }

      e.preventDefault();

      document
        .querySelectorAll(
          '.rs-row.over'
        )
        .forEach(function (r) {
          r.classList.remove(
            'over'
          );
        });

      row.classList.add(
        'over'
      );
    }
  );


  document.addEventListener(
    'drop',
    function (e) {
      var row =
        e.target.closest &&
        e.target.closest(
          '.rs-row[draggable]'
        );

      if (
        !row ||
        dragIdx === null
      ) {
        return;
      }

      e.preventDefault();

      var to =
        +row.dataset.idx;

      var rows =
        st.routeDraft.rows;

      var it =
        rows.splice(
          dragIdx,
          1
        )[0];

      rows.splice(
        to,
        0,
        it
      );

      dragIdx = null;

      App.refresh();
    }
  );


  document.addEventListener(
    'dragend',
    function () {
      dragIdx = null;

      document
        .querySelectorAll(
          '.rs-row'
        )
        .forEach(function (r) {
          r.classList.remove(
            'dragging',
            'over'
          );
        });
    }
  );


  /* ======================= Trips ======================= */

  function trips() {
    var p =
      P('SC06');

    var f =
      st.trips;


    var list =
      S.db.trips
        .filter(function (t) {
          return (
            (
              !f.date ||
              t.date === f.date
            ) &&
            (
              !f.route ||
              t.routeId === f.route
            ) &&
            (
              !f.driver ||
              t.driverId === f.driver
            ) &&
            (
              !f.vehicle ||
              t.vehicleId === f.vehicle
            ) &&
            (
              !f.status ||
              t.status === f.status
            )
          );
        })
        .sort(function (a, b) {
          return (
            a.date + a.dep
          ) < (
            b.date + b.dep
          )
            ? -1
            : 1;
        });


    function sel(
      k,
      label,
      opts
    ) {
      return (
        '<label class="sr-only" for="tf-' +
        k +
        '">' +
        label +
        '</label>' +

        '<select id="tf-' +
        k +
        '" class="inp" data-change="a-tf" data-k="' +
        k +
        '">' +

        opt(
          '',
          label + ': ทั้งหมด',
          f[k]
        ) +

        opts.map(
          function (o) {
            return opt(
              o[0],
              o[1],
              f[k]
            );
          }
        ).join('') +

        '</select>'
      );
    }


    return (
      ph(
        'รอบการเดินรถ',

        'ช่วงเวลาของรอบ = เวลาออก → เวลาออก + เวลารวมของเส้นทาง · ระบบตรวจรถ/คนขับชนเวลาก่อนบันทึก',

        p.add
          ? (
              '<button class="btn btn-p" data-act="a-trip-new">' +
              icon('plus', 18) +
              'เพิ่มรอบการเดินรถ' +
              '</button>'
            )
          : ''
      ) +

      '<div class="toolbar">' +

      '<label class="sr-only" for="tf-date">วันที่</label>' +

      '<input id="tf-date" type="date" class="inp" value="' +
      esc(f.date) +
      '" data-change="a-tf" data-k="date">' +

      sel(
        'route',
        'เส้นทาง',
        S.db.routes.map(function (r) {
          return [
            r.id,
            r.name
          ];
        })
      ) +

      sel(
        'driver',
        'คนขับ',
        driverUsers().map(function (u) {
          return [
            u.id,
            u.name
          ];
        })
      ) +

      sel(
        'vehicle',
        'รถ',
        S.db.vehicles.map(function (v) {
          return [
            v.id,
            v.plate
          ];
        })
      ) +

      sel(
        'status',
        'สถานะรอบ',
        [
          'เปิด',
          'OPEN',
          'กำลังเดินทาง',
          'เสร็จสิ้น',
          'ยกเลิก'
        ].map(function (x) {
          return [
            x,
            x
          ];
        })
      ) +

      '<button class="btn btn-ghost btn-sm" data-act="a-tf-clear">' +
      'ล้างตัวกรอง' +
      '</button>' +

      '<span class="muted" style="font-size:13px">' +
      list.length +
      ' รอบ' +
      '</span>' +

      '</div>' +

      '<section class="panel">' +
      '<div class="tbl-wrap">' +

      '<table class="tbl">' +

      '<thead>' +
      '<tr>' +
      '<th>รหัสรอบ</th>' +
      '<th>วันที่เดินรถ</th>' +
      '<th>เวลาออก</th>' +
      '<th>ถึงปลายทาง</th>' +
      '<th>เส้นทาง</th>' +
      '<th>คนขับ</th>' +
      '<th>รถ</th>' +
      '<th class="num">จองแล้ว</th>' +
      '<th>สถานะรอบ</th>' +
      '<th>Actions</th>' +
      '</tr>' +
      '</thead>' +

      '<tbody>' +

      list.map(function (t) {
        var d =
          S.user(t.driverId);

        var v =
          S.vehicle(t.vehicleId);

        return (
          '<tr>' +

          '<td class="mono">' +
          t.id +
          '</td>' +

          '<td>' +
          U.thDate(t.date) +
          '</td>' +

          '<td class="mono">' +
          t.dep +
          '</td>' +

          '<td class="mono">' +
          S.tripEnd(t) +
          '</td>' +

          '<td>' +
          esc(
            (
              S.route(t.routeId) ||
              {}
            ).name
          ) +
          '</td>' +

          '<td>' +
          esc(
            d
              ? d.name
              : '-'
          ) +
          '</td>' +

          '<td>' +
          esc(
            v
              ? v.plate
              : '-'
          ) +
          '</td>' +

          '<td class="num">' +
          S.bookedSeats(t.id) +
          ' / ' +
          S.tripSeats(t) +
          '</td>' +

          '<td>' +
          badge(t.status) +
          '</td>' +

          '<td><div class="act">' +

          (
            p.edit
              ? (
                  '<button class="btn btn-e btn-sm" data-act="a-trip-edit" data-id="' +
                  t.id +
                  '">' +
                  'แก้ไข' +
                  '</button>'
                )
              : ''
          ) +

          (
            p.del
              ? (
                  '<button class="btn btn-r btn-sm" data-act="a-trip-del" data-id="' +
                  t.id +
                  '">' +
                  'ลบ' +
                  '</button>'
                )
              : ''
          ) +

          '</div></td>' +

          '</tr>'
        );
      }).join('') +

      '</tbody>' +
      '</table>' +

      (
        list.length
          ? ''
          : UI.empty(
              'ไม่พบรอบการเดินรถ',
              'ลองเปลี่ยนวันที่หรือล้างตัวกรอง'
            )
      ) +

      '</div>' +
      '</section>'
    );
  }


  App.changes['a-tf'] =
    function (el) {
      st.trips[
        el.dataset.k
      ] = el.value;

      App.refresh();
    };


  App.actions['a-tf-clear'] =
    function () {
      st.trips = {
        date: '',
        route: '',
        driver: '',
        vehicle: '',
        status: ''
      };

      App.refresh();
    };


  function tripForm(t, v, err) {
    v =
      v ||
      (
        t
          ? Object.assign(
              {},
              t
            )
          : {
              routeId:
                (
                  S.db.routes[0] ||
                  {}
                ).id,

              date:
                st.trips.date ||
                U.nowDate(),

              dep: '',
              vehicleId: '',
              driverId: '',
              status: 'เปิด'
            }
      );


    var vehs =
      S.db.vehicles.filter(
        function (x) {
          return (
            x.status === 'พร้อมใช้งาน' ||
            x.status === 'READY' ||
            (
              t &&
              x.id === t.vehicleId
            )
          );
        }
      );


    var vv =
      S.vehicle(
        v.vehicleId
      );

    var vt =
      vv &&
      S.vtype(
        vv.typeId
      );

    var total =
      v.routeId
        ? S.routeTotal(
            v.routeId
          )
        : 0;


    UI.modal(
      '<h3>' +
      (
        t
          ? 'แก้ไขรอบ ' + t.id
          : 'เพิ่มรอบการเดินรถ'
      ) +
      '</h3>' +

      (
        err
          ? (
              '<div class="alert alert-bad" role="alert">' +
              icon('alert', 20) +
              '<div>' +
              esc(err) +
              '</div>' +
              '</div>'
            )
          : ''
      ) +

      '<form class="stack" data-form="a-trip" data-id="' +
      (
        t
          ? t.id
          : ''
      ) +
      '" novalidate>' +

      '<div class="field">' +
      '<label for="t-route">เส้นทาง</label>' +

      '<select id="t-route" name="routeId" class="inp" data-change="a-trip-range">' +

      S.db.routes.map(
        function (r) {
          return opt(
            r.id,
            r.name +
            ' (' +
            S.routeTotal(r.id) +
            ' นาที)',
            v.routeId
          );
        }
      ).join('') +

      '</select>' +
      '</div>' +

      '<div class="grid2">' +

      '<div class="field">' +
      '<label for="t-date">วันที่เดินรถ</label>' +
      '<input id="t-date" name="date" type="date" class="inp" value="' +
      esc(v.date) +
      '" required>' +
      '</div>' +

      '<div class="field">' +
      '<label for="t-dep">เวลาออก</label>' +
      '<input id="t-dep" name="dep" type="time" class="inp mono" value="' +
      esc(v.dep) +
      '" required data-input="a-trip-range">' +
      '</div>' +

      '</div>' +

      '<div class="alert alert-info" id="t-range">' +
      'ช่วงเวลาของรอบ: ' +

      '<b class="mono">' +
      (
        v.dep
          ? (
              v.dep +
              ' – ' +
              U.fmtMin(
                U.toMin(v.dep) +
                total
              )
            )
          : '—'
      ) +
      '</b>' +

      '</div>' +

      '<div class="grid2">' +

      '<div class="field">' +
      '<label for="t-veh">รถ (เฉพาะพร้อมใช้งาน)</label>' +

      '<select id="t-veh" name="vehicleId" class="inp" data-change="a-trip-seats">' +

      opt(
        '',
        '— เลือกรถ —',
        v.vehicleId
      ) +

      vehs.map(
        function (x) {
          return opt(
            x.id,
            vehLabel(x),
            v.vehicleId
          );
        }
      ).join('') +

      '</select>' +
      '</div>' +

      '<div class="field">' +
      '<label for="t-drv">คนขับ (จากพนักงาน)</label>' +

      '<select id="t-drv" name="driverId" class="inp">' +

      opt(
        '',
        '— เลือกคนขับ —',
        v.driverId
      ) +

      driverUsers().map(
        function (u) {
          return opt(
            u.id,
            u.name,
            v.driverId
          );
        }
      ).join('') +

      '</select>' +
      '</div>' +

      '</div>' +

      '<div class="grid2">' +

      '<div class="field">' +
      '<label for="t-seats">จำนวนที่นั่ง (จากประเภทรถ)</label>' +

      '<input id="t-seats" class="inp" readonly value="' +
      (
        vt
          ? vt.seats + ' ที่นั่ง'
          : '—'
      ) +
      '">' +

      '</div>' +

      '<div class="field">' +
      '<label for="t-st">สถานะรอบ</label>' +

      '<select id="t-st" name="status" class="inp">' +

      [
        'เปิด',
        'OPEN',
        'กำลังเดินทาง',
        'เสร็จสิ้น',
        'ยกเลิก'
      ].map(
        function (x) {
          return opt(
            x,
            x,
            v.status
          );
        }
      ).join('') +

      '</select>' +
      '</div>' +

      '</div>' +

      '<div class="modal-actions">' +

      '<button type="button" class="btn btn-s" data-act="modal-close">' +
      'ยกเลิก' +
      '</button>' +

      '<button class="btn btn-p" type="submit">' +
      'บันทึกรอบ' +
      '</button>' +

      '</div>' +
      '</form>',

      {
        size: 'lg'
      }
    );
  }


  App.inputs['a-trip-range'] =
  App.changes['a-trip-range'] =
    function () {
      var dep =
        document.getElementById(
          't-dep'
        ).value;

      var r =
        document.getElementById(
          't-route'
        ).value;

      var box =
        document.getElementById(
          't-range'
        );

      if (box) {
        box.innerHTML =
          'ช่วงเวลาของรอบ: <b class="mono">' +
          (
            dep
              ? (
                  dep +
                  ' – ' +
                  U.fmtMin(
                    U.toMin(dep) +
                    S.routeTotal(r)
                  )
                )
              : '—'
          ) +
          '</b>';
      }
    };


  App.changes['a-trip-seats'] =
    function (el) {
      var v =
        S.vehicle(el.value);

      var t =
        v &&
        S.vtype(v.typeId);

      document.getElementById(
        't-seats'
      ).value =
        t
          ? t.seats + ' ที่นั่ง'
          : '—';
    };


  App.actions['a-trip-new'] =
    function () {
      tripForm(null);
    };


  App.actions['a-trip-edit'] =
    function (el) {
      tripForm(
        S.trip(
          el.dataset.id
        )
      );
    };


  App.forms['a-trip'] =
    function (f, fd) {
      var id =
        f.dataset.id;

      var t =
        id
          ? S.trip(id)
          : null;

      var v = {};

      [
        'routeId',
        'date',
        'dep',
        'vehicleId',
        'driverId',
        'status'
      ].forEach(
        function (k) {
          v[k] =
            String(
              fd.get(k) ||
              ''
            );
        }
      );


      var err = '';


      if (
        !v.date ||
        !v.dep
      ) {
        err =
          'กรุณาระบุวันที่และเวลาออก';

      } else if (
        !v.vehicleId
      ) {
        err =
          'กรุณาเลือกรถ';

      } else if (
        !v.driverId
      ) {
        err =
          'กรุณาเลือกคนขับ';

      } else if (
        t &&
        S.bookedSeats(t.id) >
        (
          S.vtype(
            S.vehicle(
              v.vehicleId
            ).typeId
          ) ||
          {}
        ).seats
      ) {
        err =
          'รถที่เลือกมีที่นั่งน้อยกว่าจำนวนที่จองแล้ว (' +
          S.bookedSeats(t.id) +
          ' ที่นั่ง)';

      } else if (
        v.status !== 'ยกเลิก'
      ) {
        var a =
          U.toMin(v.dep);

        var b =
          a +
          S.routeTotal(
            v.routeId
          );


        S.db.trips.some(
          function (o) {
            if (
              o.id === id ||
              o.date !== v.date ||
              o.status === 'ยกเลิก'
            ) {
              return false;
            }


            var oa =
              U.toMin(o.dep);

            var ob =
              oa +
              S.routeTotal(
                o.routeId
              );

            var rng =
              o.dep +
              '–' +
              U.fmtMin(ob);


            if (
              a < ob &&
              oa < b
            ) {
              if (
                o.vehicleId ===
                v.vehicleId
              ) {
                err =
                  'ไม่สามารถจัดรอบนี้ได้ เนื่องจากรถ ' +
                  S.vehicle(
                    v.vehicleId
                  ).plate +
                  ' ถูกมอบหมายในรอบ ' +
                  o.id +
                  ' (' +
                  rng +
                  ')';

              } else if (
                o.driverId ===
                v.driverId
              ) {
                err =
                  'ไม่สามารถจัดรอบนี้ได้ เนื่องจากคนขับ ' +
                  S.user(
                    v.driverId
                  ).name +
                  ' มีงานรอบ ' +
                  o.id +
                  ' (' +
                  rng +
                  ')';
              }
            }

            return !!err;
          }
        );
      }


      if (err) {
        tripForm(
          t,
          v,
          err
        );

        return;
      }


      if (t) {
        Object.assign(
          t,
          v
        );

      } else {
        v.id =
          S.nextId(
            'trips',
            'TR',
            4
          );

        S.db.trips.push(v);
      }


      S.save();

      UI.closeModal();

      st.trips.date =
        v.date;

      App.refresh();

      UI.toast(
        'บันทึกรอบ ' +
        (
          t
            ? t.id
            : v.id
        ) +
        ' (' +
        v.dep +
        ') แล้ว',
        'ok'
      );
    };


  /* =========================================================
     SAFE DELETE TRIP
     ========================================================= */

  App.actions['a-trip-del'] =
    function (el) {
      var t =
        S.trip(
          el.dataset.id
        );

      var n =
        S.tripItems(t.id)
          .filter(function (i) {
            return (
              i.status !== 'ยกเลิก' &&
              i.status !== 'CANCELLED' &&
              i.status !== 'CANCELED'
            );
          }).length;


      if (n) {
        UI.modal(
          '<h3>ไม่สามารถลบได้</h3>' +

          '<div class="alert alert-bad">' +
          icon('alert', 20) +

          '<div>รอบ ' +
          t.id +
          ' มีรายการจอง ' +
          n +
          ' รายการ — ให้เปลี่ยนสถานะรอบเป็น “ยกเลิก” แทน</div>' +

          '</div>' +

          '<div class="modal-actions">' +

          '<button class="btn btn-p" data-act="modal-close">' +
          'เข้าใจแล้ว' +
          '</button>' +

          '</div>',

          {
            size: 'sm'
          }
        );

        return;
      }


      UI.confirmBox({
        title:
          'ยืนยันการลบ',

        danger: true,

        okText:
          'ลบ',

        body:
          'ลบรอบ <b>' +
          t.id +
          '</b> (' +
          U.thDate(t.date) +
          ' ' +
          t.dep +
          ')?' +

          '<br><br>' +

          '<span class="muted">' +
          'ข้อมูลจะถูกลบจาก Oracle Database จริง' +
          '</span>',

        onOk:
          async function () {

            var ok =
              await oracleDelete(
                'trips',
                t.id
              );

            if (!ok) {
              return;
            }


            S.db.trips =
              S.db.trips.filter(
                function (x) {
                  return x !== t;
                }
              );


            UI.closeModal();

            App.refresh();

            UI.toast(
              'ลบ ' +
              t.id +
              ' จาก Oracle แล้ว',
              'ok'
            );
          }
      });
    };


  /* ======================= Bookings ======================= */

  function bookingRows() {
    var f =
      st.bk;

    var q =
      f.q
        .trim()
        .toLowerCase();


    return S.db.bookingItems
      .map(function (i) {
        var b =
          S.booking(
            i.bookingId
          );

        var u =
          b &&
          S.user(
            b.userId
          );

        var t =
          S.trip(
            i.tripId
          );

        return {
          i: i,
          b: b,
          u: u,
          t: t
        };
      })

      .filter(function (x) {
        if (!x.t) {
          return false;
        }

        if (
          f.from &&
          x.t.date < f.from
        ) {
          return false;
        }

        if (
          f.to &&
          x.t.date > f.to
        ) {
          return false;
        }

        if (
          f.status &&
          x.i.status !== f.status
        ) {
          return false;
        }

        if (
          f.route &&
          x.t.routeId !== f.route
        ) {
          return false;
        }

        if (
          q &&
          (
            x.i.id +
            ' ' +
            x.b.id +
            ' ' +
            (
              x.u
                ? x.u.name
                : ''
            ) +
            ' ' +
            x.i.qr
          )
            .toLowerCase()
            .indexOf(q) < 0
        ) {
          return false;
        }

        return true;
      })

      .sort(function (a, b) {
        return (
          a.t.date +
          a.t.dep +
          a.i.id
        ) < (
          b.t.date +
          b.t.dep +
          b.i.id
        )
          ? 1
          : -1;
      });
  }


  function bookings() {
    var p =
      P('SC02');

    var f =
      st.bk;

    var rows =
      bookingRows();

    var shown =
      rows.slice(0, 200);


    return (
      ph(
        'การจอง',
        'แสดงระดับ “รายการจอง” — 1 การจองมีได้หลายรายการ'
      ) +

      '<form class="toolbar" data-form="a-bk-filter">' +

      '<label class="sr-only" for="bk-q">ค้นหา</label>' +

      '<input id="bk-q" name="q" class="inp" style="width:240px" placeholder="รหัสการจอง / ชื่อ / QR" value="' +
      esc(f.q) +
      '">' +

      '<label class="muted" style="font-size:13px" for="bk-from">วันที่เดินรถ</label>' +

      '<input id="bk-from" name="from" type="date" class="inp" value="' +
      esc(f.from) +
      '">' +

      '<span class="muted">–</span>' +

      '<label class="sr-only" for="bk-to">ถึง</label>' +

      '<input id="bk-to" name="to" type="date" class="inp" value="' +
      esc(f.to) +
      '">' +

      '<label class="sr-only" for="bk-st">สถานะ</label>' +

      '<select id="bk-st" name="status" class="inp">' +

      opt(
        '',
        'สถานะ: ทั้งหมด',
        f.status
      ) +

      [
        'ยืนยัน',
        'Check-in แล้ว',
        'ยกเลิก',
        'No Show'
      ].map(function (x) {
        return opt(
          x,
          x,
          f.status
        );
      }).join('') +

      '</select>' +

      '<label class="sr-only" for="bk-rt">เส้นทาง</label>' +

      '<select id="bk-rt" name="route" class="inp">' +

      opt(
        '',
        'เส้นทาง: ทั้งหมด',
        f.route
      ) +

      S.db.routes.map(
        function (r) {
          return opt(
            r.id,
            r.name,
            f.route
          );
        }
      ).join('') +

      '</select>' +

      '<button class="btn btn-p btn-sm" type="submit">' +
      'กรอง' +
      '</button>' +

      '<span class="muted" style="font-size:13px">' +
      rows.length +
      ' รายการ' +

      (
        rows.length > 200
          ? ' (แสดง 200 รายการล่าสุด)'
          : ''
      ) +

      '</span>' +

      '</form>' +

      '<section class="panel">' +
      '<div class="tbl-wrap">' +

      '<table class="tbl">' +

      '<thead>' +
      '<tr>' +
      '<th>การจอง</th>' +
      '<th>รายการ</th>' +
      '<th>ผู้จอง</th>' +
      '<th>วันเวลาจอง</th>' +
      '<th>รอบ</th>' +
      '<th>จุดขึ้น → จุดลง</th>' +
      '<th class="num">ที่นั่ง</th>' +
      '<th>สถานะ</th>' +
      '<th>Check-in</th>' +
      '<th>Actions</th>' +
      '</tr>' +
      '</thead>' +

      '<tbody>' +

      shown.map(function (x) {
        return (
          '<tr>' +

          '<td class="mono">' +
          x.b.id +
          '</td>' +

          '<td class="mono">' +
          x.i.id +
          '</td>' +

          '<td>' +
          esc(
            x.u
              ? x.u.name
              : '-'
          ) +
          '</td>' +

          '<td style="font-size:13px">' +
          esc(
            U.thDate(
              x.b.createdAt.slice(
                0,
                10
              )
            ) +
            ' ' +
            x.b.createdAt.slice(11)
          ) +
          '</td>' +

          '<td style="font-size:13px">' +
          U.thDate(x.t.date) +
          ' ' +
          x.t.dep +

          '<div class="muted">' +
          esc(
            (
              S.route(
                x.t.routeId
              ) ||
              {}
            ).name
          ) +
          '</div>' +

          '</td>' +

          '<td style="font-size:13px">' +
          esc(
            S.stopName(
              x.i.boardStopId
            )
          ) +
          ' → ' +
          esc(
            S.stopName(
              x.i.alightStopId
            )
          ) +
          '</td>' +

          '<td class="num">' +
          x.i.seats +
          '</td>' +

          '<td>' +
          badge(
            x.i.status
          ) +
          '</td>' +

          '<td class="mono" style="font-size:13px">' +
          (
            x.i.checkin
              ? x.i.checkin.slice(11)
              : '—'
          ) +
          '</td>' +

          '<td><div class="act">' +

          '<button class="btn btn-s btn-sm" data-act="a-bk-view" data-id="' +
          x.b.id +
          '">' +
          'ดู' +
          '</button>' +

          (
            p.edit &&
            x.i.status === 'ยืนยัน'
              ? (
                  '<button class="btn btn-r btn-sm" data-act="a-bk-cancel" data-id="' +
                  x.i.id +
                  '">' +
                  'ยกเลิก' +
                  '</button>'
                )
              : ''
          ) +

          '</div></td>' +

          '</tr>'
        );
      }).join('') +

      '</tbody>' +
      '</table>' +

      (
        rows.length
          ? ''
          : UI.empty(
              'ไม่พบรายการจอง',
              'ลองเปลี่ยนตัวกรอง'
            )
      ) +

      '</div>' +
      '</section>'
    );
  }


  App.forms['a-bk-filter'] =
    function (f, fd) {
      [
        'q',
        'from',
        'to',
        'status',
        'route'
      ].forEach(
        function (k) {
          st.bk[k] =
            String(
              fd.get(k) ||
              ''
            );
        }
      );

      App.refresh();
    };


  App.actions['a-bk-view'] =
    function (el) {
      var b =
        S.booking(
          el.dataset.id
        );

      var u =
        S.user(
          b.userId
        );

      var p =
        P('SC02');

      var items =
        S.db.bookingItems.filter(
          function (i) {
            return i.bookingId === b.id;
          }
        );


      UI.modal(
        '<h3>การจอง <span class="mono">' +
        b.id +
        '</span></h3>' +

        '<div class="card" style="box-shadow:none;background:var(--bg);padding:4px 16px">' +

        '<div class="kv">' +
        '<span class="k">ผู้จอง</span>' +

        '<span class="v">' +
        esc(
          u
            ? u.name +
              ' (' +
              u.id +
              ')'
            : '-'
        ) +
        '</span>' +
        '</div>' +

        '<div class="kv">' +
        '<span class="k">วันและเวลาจอง</span>' +

        '<span class="v">' +
        esc(
          U.thDate(
            b.createdAt.slice(
              0,
              10
            )
          ) +
          ' ' +
          b.createdAt.slice(11)
        ) +
        '</span>' +
        '</div>' +

        '</div>' +

        items.map(function (i) {
          var t =
            S.trip(i.tripId);

          var a =
            t &&
            S.arrivals(
              t,
              i.boardStopId,
              i.alightStopId
            );

          return (
            '<div class="card row" style="align-items:flex-start;gap:16px;flex-wrap:wrap">' +

            UI.qrBox(
              i.qr,
              {
                cancelled:
                  i.status === 'ยกเลิก'
              }
            ) +

            '<div class="stack" style="gap:6px;flex:1;min-width:220px;font-size:14px">' +

            '<div class="row" style="justify-content:space-between">' +

            '<b class="mono">' +
            i.id +
            '</b>' +

            badge(i.status) +

            '</div>' +

            '<div class="mono muted">' +
            esc(i.qr) +
            '</div>' +

            '<div>' +

            (
              t
                ? (
                    U.thDate(t.date) +
                    ' · ออก ' +
                    t.dep +
                    ' · ' +
                    esc(
                      (
                        S.route(
                          t.routeId
                        ) ||
                        {}
                      ).name
                    )
                  )
                : '-'
            ) +

            '</div>' +

            '<div>' +

            esc(
              S.stopName(
                i.boardStopId
              )
            ) +

            (
              a
                ? ' (' +
                  a.board +
                  ')'
                : ''
            ) +

            ' → ' +

            esc(
              S.stopName(
                i.alightStopId
              )
            ) +

            (
              a
                ? ' (' +
                  a.alight +
                  ')'
                : ''
            ) +

            '</div>' +

            '<div>' +
            i.seats +
            ' ที่นั่ง · Check-in: ' +

            (
              i.checkin
                ? esc(
                    i.checkin.slice(11)
                  )
                : '—'
            ) +

            '</div>' +

            (
              p.edit
                ? (
                    '<div class="row" style="gap:8px">' +

                    '<label class="sr-only" for="st-' +
                    i.id +
                    '">' +
                    'เปลี่ยนสถานะ' +
                    '</label>' +

                    '<select id="st-' +
                    i.id +
                    '" class="inp" style="min-height:36px;width:auto">' +

                    [
                      'ยืนยัน',
                      'Check-in แล้ว',
                      'ยกเลิก',
                      'No Show'
                    ].map(
                      function (x) {
                        return opt(
                          x,
                          x,
                          i.status
                        );
                      }
                    ).join('') +

                    '</select>' +

                    '<button class="btn btn-e btn-sm" data-act="a-bk-status" data-id="' +
                    i.id +
                    '">' +
                    'เปลี่ยนสถานะ' +
                    '</button>' +

                    '</div>'
                  )
                : ''
            ) +

            '</div>' +
            '</div>'
          );
        }).join('') +

        '<div class="modal-actions">' +
        '<button class="btn btn-p" data-act="modal-close">' +
        'ปิด' +
        '</button>' +
        '</div>',

        {
          size: 'lg'
        }
      );


      UI.hydrateQr(
        document.getElementById(
          'modal-root'
        )
      );
    };


  App.actions['a-bk-status'] =
    function (el) {
      var i =
        S.item(
          el.dataset.id
        );

      var v =
        document.getElementById(
          'st-' + i.id
        ).value;


      i.status = v;


      if (
        v === 'Check-in แล้ว' &&
        !i.checkin
      ) {
        i.checkin =
          U.nowStamp();
      }


      if (
        v !== 'Check-in แล้ว'
      ) {
        i.checkin = '';
      }


      S.save();

      UI.closeModal();

      App.refresh();

      UI.toast(
        'เปลี่ยนสถานะ ' +
        i.id +
        ' เป็น “' +
        v +
        '” แล้ว',
        'ok'
      );
    };


  App.actions['a-bk-cancel'] =
    function (el) {
      var i =
        S.item(
          el.dataset.id
        );

      var t =
        S.trip(
          i.tripId
        );

      var b =
        S.booking(
          i.bookingId
        );

      var u =
        S.user(
          b.userId
        );


      UI.confirmBox({
        title:
          'ยกเลิกรายการจอง ' +
          i.id +
          '?',

        danger: true,

        okText:
          'ยืนยันการยกเลิก',

        cancelText:
          'กลับ',

        body:
          esc(
            u
              ? u.name
              : ''
          ) +
          ' · ' +
          i.seats +
          ' ที่นั่ง · รอบ ' +
          U.thDate(t.date) +
          ' ' +
          t.dep +

          '<br><span class="muted">' +
          'ที่นั่งจะถูกคืนให้รอบทันที' +
          '</span>',

        onOk:
          function () {
            i.status =
              'ยกเลิก';

            S.save();

            App.refresh();

            UI.toast(
              'ยกเลิก ' +
              i.id +
              ' แล้ว — คืน ' +
              i.seats +
              ' ที่นั่ง'
            );
          }
      });
    };


  /* ======================= Reports ======================= */

  var REPORTS = [
    'เปรียบเทียบจำนวนคนขึ้น–ลงรถรายปี',
    'สถิติการจองรายปี',
    'พฤติกรรมผู้ใช้ตามช่วงวันที่',
    'สรุปยอดผู้ใช้แต่ละเส้นทางรายวัน',
    'การใช้บริการแต่ละจุดจอดตามรอบเวลา',
    'สรุปการมอบหมายงานคนขับ',
    'จำนวนการมอบหมายงานให้รถแต่ละประเภท'
  ];


  function joined() {
    return S.db.bookingItems
      .map(function (i) {
        return {
          i: i,
          t: S.trip(i.tripId),
          b: S.booking(i.bookingId)
        };
      })
      .filter(function (x) {
        return x.t && x.b;
      });
  }


  function inRange(date) {
    return (
      date >= st.rep.from &&
      date <= st.rep.to
    );
  }


  function nf(n) {
    return Number(n)
      .toLocaleString('en-US');
  }


  function pct(a, b) {
    return b
      ? (
          a /
          b *
          100
        ).toFixed(1) + '%'
      : '—';
  }


  function buildReport(n) {
    var R = {
      cards: [],
      bars: [],
      cols: [],
      rows: [],
      filter: 'range'
    };

    var J =
      joined();

    var y =
      st.rep.year;

    var sumSeats =
      function (arr) {
        return arr.reduce(
          function (a, x) {
            return (
              a +
              (+x.i.seats)
            );
          },
          0
        );
      };


    if (n === 1) {
      R.filter =
        'year';

      var py =
        String(+y - 1);

      var chk =
        J.filter(function (x) {
          return (
            x.i.status ===
            'Check-in แล้ว'
          );
        });

      var by =
        function (yr, key) {
          var m = {};

          chk
            .filter(function (x) {
              return (
                x.t.date.slice(
                  0,
                  4
                ) === yr
              );
            })
            .forEach(function (x) {
              var k =
                x.i[key];

              m[k] =
                (m[k] || 0) +
                (+x.i.seats);
            });

          return m;
        };


      var up0 =
        by(py, 'boardStopId');

      var up1 =
        by(y, 'boardStopId');

      var dn0 =
        by(py, 'alightStopId');

      var dn1 =
        by(y, 'alightStopId');

      var tot =
        [0, 0, 0, 0];


      R.cols = [
        'จุดจอด',
        'ขึ้น ' + py,
        'ขึ้น ' + y,
        'ลง ' + py,
        'ลง ' + y,
        'เปลี่ยนแปลง (ขึ้น)'
      ];


      S.db.stops.forEach(
        function (s) {
          var a =
            up0[s.id] || 0;

          var b =
            up1[s.id] || 0;

          var c =
            dn0[s.id] || 0;

          var d =
            dn1[s.id] || 0;


          tot[0] += a;
          tot[1] += b;
          tot[2] += c;
          tot[3] += d;


          R.rows.push([
            s.name,
            nf(a),
            nf(b),
            nf(c),
            nf(d),

            a
              ? (
                  (
                    b - a
                  ) /
                  a *
                  100
                ).toFixed(1) + '%'
              : '—'
          ]);


          R.bars.push([
            s.name,
            b,
            d
          ]);
        }
      );


      R.rows.push({
        strong: 1,

        cells: [
          'รวม',
          nf(tot[0]),
          nf(tot[1]),
          nf(tot[2]),
          nf(tot[3]),

          tot[0]
            ? (
                (
                  tot[1] -
                  tot[0]
                ) /
                tot[0] *
                100
              ).toFixed(1) + '%'
            : '—'
        ]
      });


      R.cards = [
        [
          'ขึ้นรถ ' + y,
          nf(tot[1])
        ],

        [
          'ลงรถ ' + y,
          nf(tot[3])
        ],

        [
          'ขึ้นรถ ' + py,
          nf(tot[0])
        ]
      ];


      R.barTitle =
        'จำนวนคนขึ้น–ลงรถ ปี ' +
        y +
        ' ต่อจุดจอด';

      R.legend =
        [
          'ขึ้น',
          'ลง'
        ];


    } else if (n === 2) {
      R.filter =
        'none';

      var years = {};

      J.forEach(function (x) {
        years[
          x.t.date.slice(
            0,
            4
          )
        ] = 1;
      });


      R.cols = [
        'ปี',
        'การจอง',
        'รายการจอง',
        'ที่นั่ง',
        'ยกเลิก',
        'Check-in',
        'No Show',
        'อัตรา Check-in'
      ];


      Object.keys(years)
        .sort()
        .forEach(function (yr) {
          var a =
            J.filter(function (x) {
              return (
                x.t.date.slice(
                  0,
                  4
                ) === yr
              );
            });

          var bk = {};

          a.forEach(function (x) {
            bk[x.b.id] = 1;
          });

          var c =
            function (s) {
              return a.filter(
                function (x) {
                  return (
                    x.i.status === s
                  );
                }
              ).length;
            };


          R.rows.push([
            yr,

            nf(
              Object.keys(bk).length
            ),

            nf(a.length),

            nf(
              sumSeats(
                a.filter(
                  function (x) {
                    return (
                      x.i.status !==
                      'ยกเลิก'
                    );
                  }
                )
              )
            ),

            nf(c('ยกเลิก')),
            nf(c('Check-in แล้ว')),
            nf(c('No Show')),

            pct(
              c('Check-in แล้ว'),
              a.length
            )
          ]);


          R.bars.push([
            yr,
            a.length
          ]);


          if (
            yr === y ||
            !R.cards.length
          ) {
            R.cards = [
              [
                'รายการจอง ' + yr,
                nf(a.length)
              ],

              [
                'อัตรา Check-in',
                pct(
                  c('Check-in แล้ว'),
                  a.length
                )
              ],

              [
                'อัตรา No Show',
                pct(
                  c('No Show'),
                  a.length
                )
              ]
            ];
          }
        });


      R.barTitle =
        'จำนวนรายการจองต่อปี';


    } else if (n === 3) {
      var A =
        J.filter(function (x) {
          return inRange(
            x.t.date
          );
        });

      var m = {};


      A.forEach(function (x) {
        var k =
          x.b.userId;

        m[k] =
          m[k] ||
          [0, 0, 0, 0];

        m[k][0]++;

        if (
          x.i.status ===
          'Check-in แล้ว'
        ) {
          m[k][1]++;
        }

        if (
          x.i.status ===
          'ยกเลิก'
        ) {
          m[k][2]++;
        }

        if (
          x.i.status ===
          'No Show'
        ) {
          m[k][3]++;
        }
      });


      R.cols = [
        'ผู้ใช้งาน',
        'จองทั้งหมด',
        'ขึ้นจริง',
        'ยกเลิก',
        'No Show'
      ];


      Object.keys(m)
        .sort(function (a, b) {
          return (
            m[b][0] -
            m[a][0]
          );
        })
        .forEach(function (k) {
          var u =
            S.user(k);

          R.rows.push(
            [
              u
                ? u.name
                : k
            ].concat(
              m[k].map(nf)
            )
          );

          R.bars.push([
            u
              ? u.name.split(' ')[0]
              : k,

            m[k][0],
            m[k][1]
          ]);
        });


      R.cards = [
        [
          'ผู้ใช้ที่จอง',
          Object.keys(m).length +
          ' คน'
        ],

        [
          'จองทั้งหมด',
          nf(A.length)
        ],

        [
          'ขึ้นจริง',
          nf(
            A.filter(function (x) {
              return (
                x.i.status ===
                'Check-in แล้ว'
              );
            }).length
          )
        ]
      ];


      R.barTitle =
        'การจองต่อผู้ใช้';

      R.legend =
        [
          'จองทั้งหมด',
          'ขึ้นจริง'
        ];


    } else if (n === 4) {
      var A4 =
        J.filter(function (x) {
          return (
            inRange(x.t.date) &&
            x.i.status ===
            'Check-in แล้ว'
          );
        });


      R.cols =
        ['วัน']
          .concat(
            S.db.routes.map(
              function (r) {
                return r.name;
              }
            ),
            ['รวมทั้งวัน']
          );


      var grand = 0;

      var order =
        [1, 2, 3, 4, 5, 6, 0];


      order.forEach(
        function (dw) {
          var row =
            [U.DAYS_TH[dw]];

          var t = 0;


          S.db.routes.forEach(
            function (r) {
              var v =
                sumSeats(
                  A4.filter(
                    function (x) {
                      return (
                        x.t.routeId ===
                        r.id &&
                        U.parseYmd(
                          x.t.date
                        ).getDay() === dw
                      );
                    }
                  )
                );

              row.push(
                nf(v)
              );

              t += v;
            }
          );


          row.push(
            nf(t)
          );

          grand += t;

          R.rows.push(row);

          R.bars.push([
            U.DAYS_TH[dw],
            t
          ]);
        }
      );


      R.cards = [
        [
          'ผู้ใช้รวม (ที่นั่ง Check-in)',
          nf(grand)
        ],

        [
          'เส้นทาง',
          S.db.routes.length
        ],

        [
          'ช่วงข้อมูล',
          st.rep.from +
          ' ถึง ' +
          st.rep.to
        ]
      ];


      R.barTitle =
        'ผู้ใช้ตามวันในสัปดาห์';


    } else if (n === 5) {
      var A5 =
        J.filter(function (x) {
          return (
            inRange(x.t.date) &&
            x.i.status ===
            'Check-in แล้ว'
          );
        });

      var g = {};


      A5.forEach(function (x) {
        var a =
          S.arrivals(
            x.t,
            x.i.boardStopId,
            x.i.alightStopId
          );

        if (!a) {
          return;
        }

        var k1 =
          x.i.boardStopId +
          '|' +
          a.board;

        var k2 =
          x.i.alightStopId +
          '|' +
          a.alight;


        g[k1] =
          g[k1] ||
          [0, 0];

        g[k1][0] +=
          +x.i.seats;


        g[k2] =
          g[k2] ||
          [0, 0];

        g[k2][1] +=
          +x.i.seats;
      });


      R.cols = [
        'จุดจอด',
        'เวลาถึง',
        'ขึ้น',
        'ลง'
      ];


      Object.keys(g)
        .sort()
        .forEach(function (k) {
          var p =
            k.split('|');

          R.rows.push([
            S.stopName(p[0]),
            p[1],
            nf(g[k][0]),
            nf(g[k][1])
          ]);
        });


      S.db.stops.forEach(
        function (s) {
          var up = 0;
          var dn = 0;

          Object.keys(g)
            .forEach(function (k) {
              if (
                k.split('|')[0] ===
                s.id
              ) {
                up +=
                  g[k][0];

                dn +=
                  g[k][1];
              }
            });

          R.bars.push([
            s.name,
            up,
            dn
          ]);
        }
      );


      R.cards = [
        [
          'จุดจอด',
          S.db.stops.length +
          ' จุด'
        ],

        [
          'ช่วงเวลาที่มีผู้ใช้',
          Object.keys(g).length
        ],

        [
          'ขึ้นรถรวม',
          nf(
            sumSeats(A5)
          )
        ]
      ];


      R.barTitle =
        'ขึ้น–ลงรวมต่อจุดจอด';

      R.legend =
        [
          'ขึ้น',
          'ลง'
        ];


    } else if (n === 6) {
      var T6 =
        S.db.trips.filter(
          function (t) {
            return (
              inRange(t.date) &&
              t.status !== 'ยกเลิก'
            );
          }
        );

      var md = {};


      T6.forEach(function (t) {
        md[t.driverId] =
          md[t.driverId] ||
          [0, 0];

        md[t.driverId][
          U.toMin(t.dep) <
          17 * 60
            ? 0
            : 1
        ]++;
      });


      R.cols = [
        'คนขับ',
        'ก่อน 17:00',
        'หลัง 17:00',
        'รวม'
      ];


      var s0 = 0;
      var s1 = 0;


      Object.keys(md)
        .forEach(function (k) {
          var u =
            S.user(k);

          var v =
            md[k];

          s0 += v[0];
          s1 += v[1];


          R.rows.push([
            u
              ? u.name
              : k,

            nf(v[0]),
            nf(v[1]),
            nf(v[0] + v[1])
          ]);


          R.bars.push([
            u
              ? u.name.split(' ')[0]
              : k,

            v[0],
            v[1]
          ]);
        });


      R.cards = [
        [
          'รอบทั้งหมด',
          nf(s0 + s1)
        ],

        [
          'ก่อน 17:00',
          nf(s0)
        ],

        [
          'หลัง 17:00',
          nf(s1)
        ]
      ];


      R.barTitle =
        'จำนวนรอบต่อคนขับ';

      R.legend =
        [
          'ก่อน 17:00',
          'หลัง 17:00'
        ];


    } else if (n === 7) {
      var T7 =
        S.db.trips.filter(
          function (t) {
            return (
              inRange(t.date) &&
              t.status !== 'ยกเลิก'
            );
          }
        );

      var all = 0;


      R.cols = [
        'ประเภทรถ',
        'ทะเบียน',
        'จำนวนรอบ'
      ];


      S.db.vehicleTypes.forEach(
        function (vt) {
          var sub = 0;


          S.db.vehicles
            .filter(function (v) {
              return (
                v.typeId ===
                vt.id
              );
            })
            .forEach(function (v) {
              var c =
                T7.filter(
                  function (t) {
                    return (
                      t.vehicleId ===
                      v.id
                    );
                  }
                ).length;

              sub += c;


              R.rows.push([
                vt.name,
                v.plate,
                nf(c)
              ]);


              R.bars.push([
                v.plate,
                c
              ]);
            });


          R.rows.push({
            strong: 1,

            cells: [
              'รวม' + vt.name,
              '',
              nf(sub)
            ]
          });


          all += sub;


          R.cards.push([
            vt.name,
            nf(sub) +
            ' รอบ'
          ]);
        }
      );


      R.rows.push({
        strong: 1,

        cells: [
          'รวมทั้งหมด',
          '',
          nf(all)
        ]
      });


      R.cards =
        R.cards
          .slice(0, 2)
          .concat([
            [
              'รวมทั้งหมด',
              nf(all) +
              ' รอบ'
            ]
          ]);


      R.barTitle =
        'จำนวนรอบต่อทะเบียนรถ';
    }


    return R;
  }


  function reports() {
    var n =
      st.rep.n;

    var R =
      buildReport(n);

    var years = {};

    S.db.trips.forEach(
      function (t) {
        years[
          t.date.slice(
            0,
            4
          )
        ] = 1;
      }
    );

    years[
      st.rep.year
    ] = 1;


    var max = 1;

    R.bars.forEach(
      function (b) {
        max =
          Math.max(
            max,
            b[1],
            b[2] || 0
          );
      }
    );


    var filt =
      R.filter === 'year'
        ? (
            '<label for="rp-y" class="muted" style="font-size:13px">ปี</label>' +

            '<select id="rp-y" class="inp" data-change="a-rep" data-k="year">' +

            Object.keys(years)
              .sort()
              .map(function (y) {
                return opt(
                  y,
                  y,
                  st.rep.year
                );
              })
              .join('') +

            '</select>'
          )

        : (
            R.filter === 'range'
              ? (
                  '<label for="rp-f" class="muted" style="font-size:13px">ช่วงวันที่</label>' +

                  '<input id="rp-f" type="date" class="inp" value="' +
                  st.rep.from +
                  '" data-change="a-rep" data-k="from">' +

                  '<span class="muted">–</span>' +

                  '<label for="rp-t" class="sr-only">ถึง</label>' +

                  '<input id="rp-t" type="date" class="inp" value="' +
                  st.rep.to +
                  '" data-change="a-rep" data-k="to">'
                )

              : '<span class="muted" style="font-size:13px">ทุกปีที่มีข้อมูล</span>'
          );


    return (
      ph(
        'รายงาน',

        'คำนวณจากข้อมูลการจองและรอบการเดินรถในระบบ',

        '<button class="btn btn-s" data-act="a-rep-csv">' +
        icon('download', 18) +
        'Export CSV' +
        '</button>' +

        '<button class="btn btn-s" data-act="a-rep-print">' +
        'พิมพ์' +
        '</button>'
      ) +

      '<div class="pill-row" role="tablist">' +

      REPORTS.map(
        function (t, i) {
          return (
            '<button class="pchip' +
            (
              n === i + 1
                ? ' on'
                : ''
            ) +
            '" role="tab" aria-selected="' +
            (n === i + 1) +
            '" data-act="a-rep-n" data-n="' +
            (i + 1) +
            '">' +
            (i + 1) +
            ' · ' +
            t +
            '</button>'
          );
        }
      ).join('') +

      '</div>' +

      '<section class="panel toolbar" style="padding:14px 18px">' +

      '<b style="flex:1;font-size:17px">' +
      'รายงาน' +
      REPORTS[n - 1] +
      '</b>' +

      filt +

      '</section>' +

      '<div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr))">' +

      R.cards.map(
        function (c) {
          return (
            '<div class="kpi">' +
            '<div class="k">' +
            esc(c[0]) +
            '</div>' +

            '<div class="v">' +
            esc(c[1]) +
            '</div>' +
            '</div>'
          );
        }
      ).join('') +

      '</div>' +

      '<div class="two" style="grid-template-columns:1fr 1.4fr">' +

      '<section class="panel">' +

      '<div class="panel-h">' +
      esc(R.barTitle) +
      '</div>' +

      '<div class="bars" style="padding-top:0">' +

      (
        R.bars.length
          ? R.bars.map(
              function (b) {
                return (
                  '<div class="bar-row">' +

                  '<span>' +
                  esc(b[0]) +
                  '</span>' +

                  '<div class="stack" style="gap:3px">' +

                  '<div class="bar-track">' +
                  '<div class="bar" style="width:' +
                  (
                    b[1] /
                    max *
                    100
                  ) +
                  '%"></div>' +
                  '</div>' +

                  (
                    b.length > 2
                      ? (
                          '<div class="bar-track" style="height:12px">' +
                          '<div class="bar alt" style="height:12px;width:' +
                          (
                            b[2] /
                            max *
                            100
                          ) +
                          '%"></div>' +
                          '</div>'
                        )
                      : ''
                  ) +

                  '</div>' +

                  '<span class="mono" style="text-align:right;font-weight:600">' +
                  nf(b[1]) +
                  '</span>' +

                  '</div>'
                );
              }
            ).join('')

          : '<div class="muted">ไม่มีข้อมูลในช่วงที่เลือก</div>'
      ) +

      '</div>' +
      '</section>' +

      '<section class="panel">' +
      '<div class="tbl-wrap">' +

      '<table class="tbl" id="rep-tbl">' +

      '<thead><tr>' +

      R.cols.map(
        function (c, i) {
          return (
            '<th' +
            (
              i
                ? ' class="num"'
                : ''
            ) +
            '>' +
            esc(c) +
            '</th>'
          );
        }
      ).join('') +

      '</tr></thead>' +

      '<tbody>' +

      (
        R.rows.length
          ? R.rows.map(
              function (r) {
                var cells =
                  r.cells ||
                  r;

                return (
                  '<tr' +
                  (
                    r.strong
                      ? ' class="strong"'
                      : ''
                  ) +
                  '>' +

                  cells.map(
                    function (c, i) {
                      return (
                        '<td' +
                        (
                          i
                            ? ' class="num"'
                            : ''
                        ) +
                        '>' +
                        esc(c) +
                        '</td>'
                      );
                    }
                  ).join('') +

                  '</tr>'
                );
              }
            ).join('')

          : (
              '<tr>' +
              '<td colspan="' +
              R.cols.length +
              '" class="muted" style="text-align:center;padding:24px">' +
              'ไม่มีข้อมูล' +
              '</td>' +
              '</tr>'
            )
      ) +

      '</tbody>' +
      '</table>' +
      '</div>' +
      '</section>' +

      '</div>'
    );
  }


  App.actions['a-rep-n'] =
    function (el) {
      st.rep.n =
        +el.dataset.n;

      App.refresh();
    };


  App.changes['a-rep'] =
    function (el) {
      st.rep[
        el.dataset.k
      ] = el.value;

      App.refresh();
    };


  App.actions['a-rep-print'] =
    function () {
      window.print();
    };


  App.actions['a-rep-csv'] =
    function () {
      var R =
        buildReport(
          st.rep.n
        );

      var lines =
        [R.cols]
          .concat(
            R.rows.map(
              function (r) {
                return (
                  r.cells ||
                  r
                );
              }
            )
          )
          .map(
            function (r) {
              return r.map(
                function (c) {
                  return (
                    '"' +
                    String(c)
                      .replace(
                        /"/g,
                        '""'
                      ) +
                    '"'
                  );
                }
              ).join(',');
            }
          );


      var blob =
        new Blob(
          [
            '﻿' +
            lines.join('\r\n')
          ],
          {
            type:
              'text/csv;charset=utf-8'
          }
        );


      var a =
        document.createElement(
          'a'
        );

      a.href =
        URL.createObjectURL(
          blob
        );

      a.download =
        'report-' +
        st.rep.n +
        '.csv';

      document.body.appendChild(a);

      a.click();

      a.remove();


      UI.toast(
        'ดาวน์โหลด report-' +
        st.rep.n +
        '.csv แล้ว',
        'ok'
      );
    };


  App.actions['a-menu'] =
    function () {
      document
        .getElementById(
          'a-shell'
        )
        .classList
        .toggle(
          'menu-open'
        );
    };


  /* ======================= Router ======================= */

  App.views.admin =
    function (parts) {
      var page =
        parts[0] ||
        'dashboard';


      if (!PAGES[page]) {
        location.replace(
          '#/a/dashboard'
        );

        return '';
      }


      var sc =
        PAGES[page][1];

      var inner;


      if (
        !App.hasAdmin(me())
      ) {
        return shell(
          page,
          App.views.denied(
            'ระบบหลังบ้าน'
          )
        );
      }


      if (
        sc &&
        !P(sc)
      ) {
        inner =
          App.views.denied(
            'หน้า “' +
            PAGES[page][0] +
            '” (' +
            sc +
            ')'
          );

      } else if (
        page === 'dashboard'
      ) {
        inner =
          dashboard();

      } else if (
        ENT[page]
      ) {
        inner =
          crud(page);

      } else if (
        page === 'perms'
      ) {
        inner =
          perms();

      } else if (
        page === 'routes'
      ) {
        inner =
          parts[1]
            ? routeForm(parts[1])
            : routes();

      } else if (
        page === 'trips'
      ) {
        inner =
          trips();

      } else if (
        page === 'bookings'
      ) {
        inner =
          bookings();

      } else if (
        page === 'reports'
      ) {
        inner =
          reports();
      }


      return shell(
        page,
        inner
      );
    };

})();