/* DEMO DATA ENGINE (part of the Data Layer)
   Makes SYNTHETIC complaints. Every record carries data_source = "DEMO".
   Nothing here is real CIL data. Each calendar day uses its own fixed seed, so the same day
   always produces the same complaints. */
(function () {
  'use strict';
  var CQ = (window.CQ = window.CQ || {});
  var M = CQ.Master, L = CQ.Logic;
  var G = (CQ.Demo = {});
  var START = '2025-04-01';

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function wpick(r, items, weights) {
    var tot = 0, i; for (i = 0; i < weights.length; i++) tot += weights[i];
    var x = r() * tot; for (i = 0; i < items.length; i++) { x -= weights[i]; if (x <= 0) return items[i]; }
    return items[items.length - 1];
  }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function between(r, a, b) { return a + r() * (b - a); }
  function rd(v, d) { var k = Math.pow(10, d); return Math.round(v * k) / k; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
  function poisson(r, lam) { var Lm = Math.exp(-lam), k = 0, p = 1; do { k++; p *= r(); } while (p > Lm); return k - 1; }

  /* fixed "hotness" of areas and mines, so some places have more complaints (clusters) */
  var hr = rng(20260);
  var areaHot = {}, mineHot = {};
  M.area_master.forEach(function (a) { areaHot[a.area_id] = 0.3 + hr() * 1.7; });
  M.mine_master.forEach(function (m) { var x = hr(); mineHot[m.mine_id] = 0.15 + x * x * 2.2; });

  var SUBS = ['ECL', 'BCCL', 'CCL', 'NCL', 'WCL', 'SECL', 'MCL'];
  var SUB_W = [0.11, 0.08, 0.17, 0.10, 0.13, 0.22, 0.19];
  var PROFILES = ['slip_ash', 'oversize_sand', 'moisture', 'shale', 'gcv', 'extraneous', 'other'];
  var PROF_W = [0.26, 0.15, 0.15, 0.12, 0.09, 0.08, 0.15];
  var BIAS = { MCL: { oversize_sand: 1.5 }, SECL: { slip_ash: 1.3 }, BCCL: { shale: 1.6 }, CCL: { shale: 1.3, slip_ash: 1.2 },
    WCL: { moisture: 1.4 }, NCL: { oversize_sand: 1.2, extraneous: 1.3 }, ECL: { gcv: 1.4 } };
  var CONSUMERS = [];
  for (var ci = 1; ci <= 12; ci++) CONSUMERS.push(['Demo Power Plant ' + ci, 'DEMO-C-' + pad(ci, 3)]);
  ['Demo Cement Works A', 'Demo Cement Works B', 'Demo Steel Unit 1', 'Demo Steel Unit 2', 'Demo Sponge Iron Unit', 'Demo Brick Kiln Cluster',
    'Demo Fertiliser Unit', 'Demo Paper Mill', 'Demo Textile Mill', 'Demo Aluminium Unit', 'Demo Captive Power Co', 'Demo Trading Agency'
  ].forEach(function (n, i) { CONSUMERS.push([n, 'DEMO-C-' + pad(13 + i, 3)]); });
  var LABS = ['Demo Central Lab', 'Demo Regional Lab 1', 'Demo Regional Lab 2', 'Demo Third-party Lab'];
  var ACTIONS = ['Joint sampling held with consumer', 'Loading-point supervision strengthened', 'Screening / picking arrangement improved',
    'Matter referred to commercial department', 'No deviation found in tested sample', 'Corrective instruction issued to loading point'];
  var REMARKS = ['Consumer asked for joint sampling', 'Photographs shared by consumer', 'Rake placement inspected', 'Samples drawn as per demo procedure',
    'Awaiting lab report', 'Loading point visited by quality team'];

  function pickLocation(r, mine) {
    var locs = M.locationsOf(mine.mine_id);
    var site = wpick(r, ['Siding', 'Road Sale', 'Other'], [0.55, 0.38, 0.07]);
    var m = locs.filter(function (l) { return l.loading_type === site; });
    return m.length ? pick(r, m) : pick(r, locs);
  }
  function pickPlace(r, sub) {
    var areas = M.areasOf(sub);
    var area = wpick(r, areas, areas.map(function (a) { return areaHot[a.area_id]; }));
    var mines = M.minesOf(area.area_id);
    var mine = wpick(r, mines, mines.map(function (m) { return mineHot[m.mine_id]; }));
    return { area: area, mine: mine, loc: pickLocation(r, mine) };
  }

  /* Build one complaint. ageDays = how old it is today (0 = today). */
  function build(r, dateISO, timeStr, ageDays, opts) {
    opts = opts || {};
    var sub = opts.sub || wpick(r, SUBS, SUB_W);
    var month = +dateISO.slice(5, 7);
    var pw = PROF_W.map(function (w, i) {
      var p = PROFILES[i], b = (BIAS[sub] && BIAS[sub][p]) || 1;
      if (p === 'moisture' && month >= 6 && month <= 9) b *= 2.6;
      return w * b;
    });
    var profile = opts.profile || wpick(r, PROFILES, pw);
    var place = pickPlace(r, sub), loc = place.loc;
    var site = loc.loading_type === 'Not Available' ? 'Other' : loc.loading_type;
    var mode = site === 'Siding' ? 'Rail' : 'Road';
    var gi = clamp(Math.round(8 + (r() + r() + r() - 1.5) * 6), 1, 17);
    var declared = 'G' + gi;
    var cons = pick(r, CONSUMERS);

    /* status and dates depend on how old the complaint is */
    var u = r(), pFinal = ageDays < 1 ? 0 : 1 - 0.95 * Math.exp(-ageDays / 80);
    var resDays = Math.round(clamp(Math.exp(Math.log(20) + 0.8 * (r() + r() + r() - 1.5)), 1, 120));
    var isFinal = u < pFinal && resDays <= ageDays;
    var status;
    if (isFinal) status = wpick(r, ['Resolved', 'Closed', 'Rejected/Not Admitted', 'Duplicate'], [0.55, 0.30, 0.09, 0.06]);
    else if (ageDays <= 2) status = wpick(r, ['New', 'Acknowledged'], [0.6, 0.4]);
    else if (ageDays <= 10) status = wpick(r, ['Acknowledged', 'Under Examination', 'Sample Collection Pending', 'Sample Collected'], [0.2, 0.4, 0.25, 0.15]);
    else status = wpick(r, ['Under Examination', 'Sample Collected', 'Under Testing', 'Investigation in Progress', 'Response Pending', 'Reopened'], [0.18, 0.12, 0.2, 0.25, 0.17, 0.08]);
    var statusDate = isFinal ? L.addDays(dateISO, resDays) : L.addDays(dateISO, Math.min(ageDays, Math.floor(r() * 4)));
    var hasTest = ['Sample Collected', 'Under Testing', 'Investigation in Progress', 'Response Pending', 'Resolved', 'Closed', 'Reopened'].indexOf(status) >= 0 && r() < 0.85;

    /* quality deviations by profile */
    var dev = { ash: 0, moist: 0, gcv: 0, shift: 0, shale: 0, sand: 0, over: 0, under: 0, ext: 0 }, cats = [];
    function addc(n, p) { if (p === undefined || r() < p) if (cats.indexOf(n) < 0) cats.push(n); }
    switch (profile) {
      case 'slip_ash':
        addc('Grade Slippage'); addc('Excess Ash'); addc('Excess Shale', 0.15); addc('Mixed Grade', 0.08);
        dev.ash = between(r, 2, 9); dev.gcv = -between(r, 150, 600); dev.shift = r() < 0.65 ? 1 : 2; break;
      case 'oversize_sand':
        addc('Oversize Coal'); addc('More than 100 mm Coal Size', 0.7); addc('Excess Sandstone', 0.65); addc('Size Variation', 0.1);
        dev.over = between(r, 3, 25); dev.sand = between(r, 2, 12); break;
      case 'moisture':
        addc('Excess Moisture'); addc('Moisture Variation', 0.25); addc('Low GCV', 0.3);
        dev.moist = between(r, 2, 9); dev.gcv = -between(r, 80, 350); break;
      case 'shale':
        addc('Excess Shale'); addc('Excess Ash', 0.5); addc('Stone/Foreign Material', 0.2);
        dev.shale = between(r, 2, 14); dev.ash = between(r, 1, 6); break;
      case 'gcv':
        addc('Low GCV'); addc('High GCV Variation', 0.25); addc('Grade Slippage', 0.3);
        dev.gcv = -between(r, 200, 800); dev.shift = r() < 0.3 ? 1 : 0; break;
      case 'extraneous':
        addc('Stone/Foreign Material'); addc('Excess Extraneous Matter', 0.6); addc('Excess Sandstone', 0.2);
        dev.ext = between(r, 1, 8); dev.sand = between(r, 1, 6); break;
      default:
        var pool = ['Poor Coal Quality', 'Undersize/Fines', 'Size Variation', 'Ash Variation', 'Wrong Grade Supplied', 'Mixed Grade', 'Other Quality Issue'];
        addc(pick(r, pool)); addc(pick(r, pool), 0.35); dev.under = between(r, 5, 25);
        if (cats.indexOf('Ash Variation') >= 0) dev.ash = between(r, 1, 4);
    }
    if (cats.indexOf('Wrong Grade Supplied') >= 0 || cats.indexOf('Mixed Grade') >= 0) dev.shift = dev.shift || 1;

    var ashD = rd(8 + gi * 2.1, 1), moD = rd(7 + (gi % 5) * 0.8, 1), gcvD = Math.round(7200 - gi * 330);
    var gShift = dev.shift ? Math.min(17, gi + dev.shift) : null;
    var claimed = gShift ? 'G' + gShift : (r() < 0.2 ? declared : null);
    var tested = hasTest && gShift && r() < 0.75 ? 'G' + gShift : null;
    function around(base, d, noise, haveReported) {
      var t = hasTest ? rd(base + d * between(r, 0.8, 1.2) + (r() - 0.5) * noise, 1) : null;
      var rep = haveReported ? rd(base + d * between(r, 1, 1.4) + (r() - 0.5) * noise, 1) : null;
      return [t, rep];
    }
    var ash = around(ashD, dev.ash, 1.2, dev.ash > 0 && r() < 0.7), mo = around(moD, dev.moist, 1, dev.moist > 0 && r() < 0.7);
    var gc = around(gcvD, dev.gcv, 80, dev.gcv < 0 && r() < 0.6);
    var qty = mode === 'Rail' ? Math.round(between(r, 1800, 4200)) : Math.round(between(r, 10, 40));
    var qtyC = Math.round(qty * between(r, 0.2, 1));
    var hasOver = dev.over > 0, hasShale = dev.shale > 0, hasSand = dev.sand > 0, hasExt = dev.ext > 0;
    var sampleDate = hasTest ? L.addDays(dateISO, Math.min(ageDays, 2 + Math.floor(r() * 5))) : '';
    var lab = pick(r, LABS);
    var priority = wpick(r, M.priorities, [0.70, 0.24, 0.06]);
    if (dev.over > 15 && dev.shift && r() < 0.5) priority = 'Critical';

    var recvD = L.addDays(dateISO, -Math.floor(r() * 3));
    var dispD = L.addDays(recvD, -(1 + Math.floor(r() * 5)));
    var loadD = L.addDays(dispD, -Math.floor(r() * 4));
    var c = {
      complaint_id: '', complaint_date: dateISO, complaint_time: timeStr,
      consumer_name: cons[0], consumer_id: cons[1], contact: 'demo.contact@example.com',
      source: wpick(r, M.sources, [0.3, 0.22, 0.08, 0.14, 0.06, 0.06, 0.06, 0.06, 0.02]),
      reference_no: 'REF-D-' + pad(Math.floor(r() * 999999), 6),
      subsidiary_id: sub, area_id: place.area.area_id, mine_id: place.mine.mine_id, location_id: loc.location_id,
      date_of_receipt: recvD, date_of_dispatch: dispD, date_of_loading: loadD,
      loading_site: site, dispatch_mode: mode,
      vehicle_no: (mode === 'Rail' ? 'RAKE-' : 'TRK-') + pad(Math.floor(r() * 9999), 4),
      rr_challan_no: 'RR-D-' + pad(Math.floor(r() * 999999), 6), invoice_no: 'INV-D-' + pad(Math.floor(r() * 999999), 6),
      declared_grade: declared, claimed_grade: claimed, tested_grade: tested, coal_size: '0-100 mm',
      quantity: qty, quantity_complained: qtyC, complaint_categories: cats,
      ash_declared: ashD, ash_tested: ash[0], ash_reported: ash[1],
      moisture_declared: moD, moisture_tested: mo[0], moisture_reported: mo[1],
      gcv_declared: gcvD, gcv_tested: gc[0] === null ? null : Math.round(gc[0]), gcv_reported: gc[1] === null ? null : Math.round(gc[1]),
      declared_size: '0-100 mm', observed_size: hasOver ? 'Up to ' + Math.round(between(r, 120, 350)) + ' mm' : '0-100 mm',
      undersize_pct: dev.under ? rd(dev.under, 1) : null,
      shale_complaint: hasShale ? 'Yes' : 'No', shale_observed: hasShale ? 'Yes' : 'No',
      shale_pct_est: hasShale ? rd(dev.shale * between(r, 0.9, 1.4), 1) : null, shale_pct_tested: hasShale && hasTest ? rd(dev.shale, 1) : null,
      shale_qty: hasShale ? rd(qtyC * dev.shale / 100, 1) : null, shale_remarks: hasShale ? 'Shale pieces seen on sorting (demo)' : '',
      sandstone_complaint: hasSand ? 'Yes' : 'No', sandstone_observed: hasSand ? 'Yes' : 'No',
      sandstone_pct_est: hasSand ? rd(dev.sand * between(r, 0.9, 1.4), 1) : null, sandstone_pct_tested: hasSand && hasTest ? rd(dev.sand, 1) : null,
      sandstone_qty: hasSand ? rd(qtyC * dev.sand / 100, 1) : null, sandstone_remarks: hasSand ? 'Sandstone bands noticed (demo)' : '',
      ext_stone: hasExt, ext_soil: hasExt && r() < 0.3, ext_metal: hasExt && r() < 0.1, ext_wood: hasExt && r() < 0.15, ext_other: false,
      ext_other_desc: '', ext_pct_est: hasExt ? rd(dev.ext, 1) : null, ext_remarks: hasExt ? 'Foreign matter noticed at unloading (demo)' : '',
      declared_max_size_mm: 100, observed_max_size_mm: hasOver ? Math.round(between(r, 120, 350)) : null,
      oversize_present: hasOver ? 'Yes' : 'No', oversize_pct_est: hasOver ? rd(dev.over * between(r, 0.9, 1.3), 1) : null,
      oversize_pct_tested: hasOver && hasTest ? rd(dev.over, 1) : null, oversize_pieces: hasOver ? Math.round(between(r, 5, 120)) : null,
      oversize_remarks: hasOver ? 'Oversize lumps seen at unloading (demo)' : '',
      status: status, status_date: statusDate, assigned_to: sub + ' Demo ' + pick(r, ['Quality Cell', 'Sales Department', 'Survey Department']),
      priority: priority, resolution_date: isFinal ? L.addDays(dateISO, resDays) : '',
      closure_remarks: isFinal ? (status === 'Duplicate' ? 'Same as an earlier complaint (demo)' : status === 'Rejected/Not Admitted' ? 'Not admitted: no supporting evidence (demo)' : 'Closed after action (demo)') : '',
      sample_collected: hasTest || status === 'Sample Collected' ? 'Yes' : 'No', sample_date: sampleDate, laboratory: hasTest ? lab : '',
      test_result: hasTest ? 'Tested ash ' + (ash[0] === null ? '—' : ash[0] + '%') + ', moisture ' + (mo[0] === null ? '—' : mo[0] + '%') + ' (demo result)' : 'Result awaited',
      investigation_remarks: pick(r, REMARKS), action_taken: isFinal && status === 'Resolved' ? pick(r, ACTIONS) : '',
      response: isFinal ? 'Reply sent to consumer (demo)' : '',
      attachments: r() < 0.4 ? [{ type: pick(r, M.attachmentTypes), file_name: 'demo-placeholder.pdf', demo_only: true }] : [],
      data_source: 'DEMO'
    };
    var created = new Date(dateISO + 'T' + timeStr + ':00');
    c.created_at = created.toISOString();
    c.updated_at = new Date(statusDate + 'T' + (statusDate === dateISO ? timeStr : '12:00') + ':00').toISOString();
    return c;
  }

  function dayRate(i, dow) {
    var base = dow === 0 ? 0.5 : dow === 6 ? 1.2 : 3.0;
    return base * (1 + 0.25 * Math.min(i / 500, 1.2));
  }
  function idFor(n) { return 'CQ-DEMO-' + pad(n, 6); }
  G.idFor = idFor;

  /* All base demo complaints from START up to today, oldest first. */
  G.generateBase = function () {
    var today = L.today(), nowT = L.nowTime(), out = [], seq = 0;
    var days = L.diffDays(START, today);
    for (var i = 0; i <= days; i++) {
      var d = L.addDays(START, i), dow = L.parse(d).getDay();
      var r = rng(1000 + i * 7919);
      var n = poisson(r, dayRate(i, dow));
      if (i === days) n = Math.max(n, 4);
      if (i === days - 1) n = Math.max(n, 3);
      var times = [];
      for (var k = 0; k < n; k++) {
        var mins = Math.floor(between(r, 9 * 60, 18 * 60));
        if (d === today) { var lim = (+nowT.slice(0, 2)) * 60 + (+nowT.slice(3)); mins = Math.min(mins, lim); if (lim > 60) mins = Math.min(mins, Math.floor(r() * lim)); }
        times.push(pad(Math.floor(mins / 60), 2) + ':' + pad(mins % 60, 2));
      }
      times.sort();
      for (k = 0; k < n; k++) {
        var rc = rng(5000 + i * 104729 + k * 31);
        var c = build(rc, d, times[k], days - i);
        c.complaint_id = idFor(++seq);
        out.push(c);
      }
    }
    return out;
  };

  /* One brand-new complaint for the "simulate live complaint" button. Uses names so it passes through the API check. */
  G.generateLivePayload = function () {
    var r = rng(Math.floor(Math.random() * 2147483647));
    var c = build(r, L.today(), L.nowTime(), 0, {});
    c.status = r() < 0.7 ? 'New' : 'Acknowledged';
    c.status_date = L.today(); c.resolution_date = ''; c.closure_remarks = ''; c.action_taken = ''; c.response = '';
    c.sample_collected = 'No'; c.sample_date = ''; c.laboratory = ''; c.test_result = 'Result awaited';
    ['ash_tested', 'moisture_tested', 'gcv_tested', 'oversize_pct_tested', 'shale_pct_tested', 'sandstone_pct_tested', 'tested_grade'].forEach(function (k) { c[k] = null; });
    c.complaint_id = ''; c.source = pick(r, ['Consumer Portal', 'Email', 'Mobile App', 'External API', 'Telephone']);
    c.date_of_loading = L.addDays(L.today(), -3); c.date_of_dispatch = L.addDays(L.today(), -2); c.date_of_receipt = L.addDays(L.today(), -1);
    return c;
  };
})();
