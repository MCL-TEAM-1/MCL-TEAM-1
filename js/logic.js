/* APPLICATION LAYER
   Dates, filtering, KPI maths, grouping and validation. No screen code and no data-loading code here. */
(function () {
  'use strict';
  var CQ = (window.CQ = window.CQ || {});
  var M = CQ.Master;
  var L = (CQ.Logic = {});

  /* ---------- dates (all dates are plain 'YYYY-MM-DD' text) ---------- */
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  L.iso = function (d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
  L.parse = function (s) { var a = s.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); };
  L.today = function () { return L.iso(new Date()); };
  L.addDays = function (s, n) { var d = L.parse(s); d.setDate(d.getDate() + n); return L.iso(d); };
  L.diffDays = function (a, b) { return Math.round((L.parse(b) - L.parse(a)) / 86400000); };
  L.isValidDate = function (s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var d = L.parse(s); return L.iso(d) === s && d.getFullYear() > 1990;
  };
  L.isValidTime = function (s) { return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s); };
  L.fmtDate = function (s) { return s ? s.slice(8, 10) + '-' + s.slice(5, 7) + '-' + s.slice(0, 4) : '—'; };
  L.fmtDateTime = function (d) {
    d = d || new Date();
    return p2(d.getDate()) + '-' + p2(d.getMonth() + 1) + '-' + d.getFullYear() + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
  };
  L.nowTime = function () { var d = new Date(); return p2(d.getHours()) + ':' + p2(d.getMinutes()); };
  /* Indian financial year: 1 April to 31 March */
  L.fyOf = function (s) { var y = +s.slice(0, 4), m = +s.slice(5, 7); var st = m >= 4 ? y : y - 1; return st + '-' + String((st + 1) % 100).replace(/^(\d)$/, '0$1'); };
  L.fyBounds = function (fy) { var st = +fy.slice(0, 4); return { from: st + '-04-01', to: (st + 1) + '-03-31' }; };
  L.weekStart = function (s) { var d = L.parse(s); var dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return L.iso(d); };
  L.bucketKey = function (s, gran) { return gran === 'day' ? s : gran === 'week' ? L.weekStart(s) : s.slice(0, 7); };
  L.bucketKeys = function (from, to, gran) {
    var keys = [], cur = L.bucketKey(from, gran), end = L.bucketKey(to, gran), guard = 0;
    while (cur <= end && guard++ < 3000) {
      keys.push(cur);
      if (gran === 'day') cur = L.addDays(cur, 1);
      else if (gran === 'week') cur = L.addDays(cur, 7);
      else { var y = +cur.slice(0, 4), m = +cur.slice(5, 7); m++; if (m > 12) { m = 1; y++; } cur = y + '-' + p2(m); }
    }
    return keys;
  };
  L.bucketLabel = function (k, gran) {
    if (gran === 'month') { var mn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; return mn[+k.slice(5, 7) - 1] + ' ' + k.slice(2, 4); }
    return k.slice(8, 10) + '-' + k.slice(5, 7);
  };
  L.bucketEnd = function (k, gran) {
    if (gran === 'day') return k; if (gran === 'week') return L.addDays(k, 6);
    var y = +k.slice(0, 4), m = +k.slice(5, 7); return L.iso(new Date(y, m, 0));
  };

  /* ---------- derived fields ---------- */
  function num(v) { return v === null || v === undefined || v === '' || isNaN(v) ? null : +v; }
  function first(a, b) { a = num(a); return a !== null ? a : num(b); }
  function avg(a) { var x = a.filter(function (v) { return v !== null; }); return x.length ? x.reduce(function (s, v) { return s + v; }, 0) / x.length : null; }
  L.avg = avg;

  L.enrich = function (c) {
    var st = M.statusByName[c.status] || { phase: 'other', is_final: false, display_group: 'Other' };
    var area = M.areaById[c.area_id], mine = M.mineById[c.mine_id], loc = M.locById[c.location_id];
    var sub = M.subById[c.subsidiary_id];
    c._ts = Date.parse(c.complaint_date + 'T' + (c.complaint_time || '00:00') + ':00');
    c._groups = [];
    (c.complaint_categories || []).forEach(function (n) { var g = M.categoryGroup[n] || 'other'; if (c._groups.indexOf(g) < 0) c._groups.push(g); });
    c._phase = st.phase; c._statusGroup = st.display_group;
    c._open = !st.is_final;
    c._resolved = c.status === 'Resolved' || c.status === 'Closed';
    c._exam = st.phase === 'exam' || st.phase === 'testing' || st.phase === 'investigation';
    c._sub = sub ? sub.subsidiary_code : c.subsidiary_id;
    c._area = area ? area.area_name : c.area_id; c._mine = mine ? mine.mine_name : c.mine_id;
    c._loc = loc ? loc.location_name : c.location_id; c._state = area ? area.state : 'Not available';
    c._ash = first(c.ash_tested, c.ash_reported); c._moist = first(c.moisture_tested, c.moisture_reported);
    c._gcv = first(c.gcv_tested, c.gcv_reported);
    c._over = first(c.oversize_pct_tested, c.oversize_pct_est);
    c._shale = first(c.shale_pct_tested, c.shale_pct_est); c._sand = first(c.sandstone_pct_tested, c.sandstone_pct_est);
    var base = num(c.ash_declared);
    var ashObs = first(c.ash_tested, c.ash_reported); c._ashDiff = base !== null && ashObs !== null ? +(ashObs - base).toFixed(1) : null;
    /* grade comparison: tested grade wins over consumer-claimed grade */
    var di = M.gradeIndex(c.declared_grade), oi = M.gradeIndex(c.tested_grade || c.claimed_grade);
    c._gradeDiff = di !== null && oi !== null ? oi - di : null;       /* + means lower quality grade than declared */
    c._potentialSlip = c._gradeDiff !== null && c._gradeDiff !== 0;
    c._slip = c._groups.indexOf('slippage') >= 0 || c._potentialSlip;
    c._resDays = c.resolution_date && L.isValidDate(c.resolution_date) ? L.diffDays(c.complaint_date, c.resolution_date) : null;
    c._age = L.diffDays(c.complaint_date, L.today());
    c._search = [c.complaint_id, c.consumer_name, c.invoice_no, c.rr_challan_no, c._mine, c._area, c._sub, c.subsidiary_id,
      (sub && sub.subsidiary_name), c.declared_grade, c.reference_no].join(' ').toLowerCase();
    return c;
  };

  /* ---------- filtering ---------- */
  L.emptyFilters = function () {
    return { fy: '', from: '', to: '', subsidiary: '', area: '', mine: '', location: '', site: '', grade: '',
      category: '', group: '', status: '', priority: '', consumer: '', mode: '', source: '', q: '' };
  };
  L.matches = function (c, f, range) {
    var from = range ? range.from : f.from, to = range ? range.to : f.to;
    if (from && c.complaint_date < from) return false;
    if (to && c.complaint_date > to) return false;
    if (f.subsidiary && c.subsidiary_id !== f.subsidiary) return false;
    if (f.area && c.area_id !== f.area) return false;
    if (f.mine && c.mine_id !== f.mine) return false;
    if (f.location && c.location_id !== f.location) return false;
    if (f.site && c.loading_site !== f.site) return false;
    if (f.grade && c.declared_grade !== f.grade) return false;
    if (f.category && (c.complaint_categories || []).indexOf(f.category) < 0) return false;
    if (f.group && c._groups.indexOf(f.group) < 0) return false;
    if (f.status && c.status !== f.status) return false;
    if (f.priority && c.priority !== f.priority) return false;
    if (f.consumer && c.consumer_name !== f.consumer) return false;
    if (f.mode && c.dispatch_mode !== f.mode) return false;
    if (f.source && c.source !== f.source) return false;
    if (f.q) { var q = f.q.toLowerCase().trim(); if (q && c._search.indexOf(q) < 0) return false; }
    return true;
  };
  L.filterRows = function (rows, f, range) { return rows.filter(function (c) { return L.matches(c, f, range); }); };
  /* "previous period" = same length straight before the chosen range (to-date capped at today) */
  L.prevRange = function (f) {
    if (!f.from || !f.to) return null;
    var to = f.to > L.today() ? L.today() : f.to;
    if (to < f.from) return null;
    var len = L.diffDays(f.from, to) + 1, pTo = L.addDays(f.from, -1);
    return { from: L.addDays(pTo, -(len - 1)), to: pTo };
  };

  /* ---------- KPI and grouping ---------- */
  L.KPIS = [
    { id: 'total', label: 'Total Complaints', test: function () { return true; }, goodUp: false },
    { id: 'open', label: 'Open Complaints', test: function (c) { return c._open; }, goodUp: false },
    { id: 'exam', label: 'Under Examination', test: function (c) { return c._exam; }, goodUp: false },
    { id: 'resolved', label: 'Resolved Complaints', test: function (c) { return c._resolved; }, goodUp: true },
    { id: 'slip', label: 'Grade Slippage Complaints', test: function (c) { return c._slip; }, goodUp: false, note: 'potential' },
    { id: 'ashmoist', label: 'Ash / Moisture Complaints', test: function (c) { return c._groups.indexOf('ash') >= 0 || c._groups.indexOf('moisture') >= 0; }, goodUp: false },
    { id: 'shsand', label: 'Shale / Sandstone Complaints', test: function (c) { return c._groups.indexOf('shale') >= 0 || c._groups.indexOf('sandstone') >= 0; }, goodUp: false },
    { id: 'oversize', label: 'Oversize >100 mm Complaints', test: function (c) { return c._groups.indexOf('oversize') >= 0; }, goodUp: false }
  ];
  L.count = function (rows, test) { var n = 0; rows.forEach(function (c) { if (test(c)) n++; }); return n; };
  L.pct = function (n, d) { return d ? Math.round(n * 1000 / d) / 10 : 0; };
  L.groupBy = function (rows, keyFn) {
    var o = {}; rows.forEach(function (c) { var k = keyFn(c); if (k === null || k === undefined) return; (o[k] = o[k] || []).push(c); }); return o;
  };
  L.tally = function (rows, keyFn) {
    var o = {}; rows.forEach(function (c) { var k = keyFn(c); if (k === null || k === undefined) return; o[k] = (o[k] || 0) + 1; }); return o;
  };
  /* count per time bucket for rows passing 'test', using date picked by dateFn */
  L.series = function (rows, test, gran, from, to, dateFn) {
    var keys = L.bucketKeys(from, to, gran), idx = {}; keys.forEach(function (k, i) { idx[k] = i; });
    var out = keys.map(function () { return 0; });
    rows.forEach(function (c) {
      if (!test(c)) return; var d = dateFn ? dateFn(c) : c.complaint_date; if (!d) return;
      var i = idx[L.bucketKey(d, gran)]; if (i !== undefined) out[i]++;
    });
    return { keys: keys, values: out };
  };
  L.dataRange = function (rows) {
    var mn = null, mx = null; rows.forEach(function (c) { if (!mn || c.complaint_date < mn) mn = c.complaint_date; if (!mx || c.complaint_date > mx) mx = c.complaint_date; });
    return { from: mn, to: mx };
  };
  L.AGE_BUCKETS = [['0–3 days', 0, 3], ['4–7 days', 4, 7], ['8–15 days', 8, 15], ['16–30 days', 16, 30], ['31–60 days', 31, 60], ['More than 60 days', 61, 1e9]];

  /* ---------- validation (the same rules are used by the form and the API layer) ---------- */
  var NUM_PCT = ['ash_declared', 'ash_tested', 'ash_reported', 'moisture_declared', 'moisture_tested', 'moisture_reported',
    'undersize_pct', 'shale_pct_est', 'shale_pct_tested', 'sandstone_pct_est', 'sandstone_pct_tested',
    'oversize_pct_est', 'oversize_pct_tested', 'ext_pct_est'];
  var NUM_GCV = ['gcv_declared', 'gcv_tested', 'gcv_reported'];
  var NUM_POS = ['quantity', 'quantity_complained', 'shale_qty', 'sandstone_qty', 'declared_max_size_mm', 'observed_max_size_mm', 'oversize_pieces'];
  L.NUM_FIELDS = NUM_PCT.concat(NUM_GCV, NUM_POS);
  L.validate = function (c, ctx) {
    ctx = ctx || {}; var errs = [];
    function bad(field, msg) { errs.push({ field: field, message: msg }); }
    function blank(v) { return v === null || v === undefined || String(v).trim() === ''; }
    [['complaint_date', 'Complaint date'], ['consumer_name', 'Consumer / customer name'], ['source', 'Source of complaint'],
      ['subsidiary_id', 'Subsidiary'], ['area_id', 'Area'], ['mine_id', 'Mine'], ['location_id', 'Location'],
      ['loading_site', 'Site of loading'], ['declared_grade', 'Declared grade'], ['status', 'Status'], ['priority', 'Priority']
    ].forEach(function (r) { if (blank(c[r[0]])) bad(r[0], r[1] + ' is required.'); });
    if (!c.complaint_categories || !c.complaint_categories.length) bad('complaint_categories', 'Choose at least one complaint category.');
    else c.complaint_categories.forEach(function (n) { if (M.categoryGroup[n] === undefined) bad('complaint_categories', 'Unknown complaint category: ' + n); });

    var today = L.today();
    ['complaint_date', 'date_of_loading', 'date_of_dispatch', 'date_of_receipt', 'status_date', 'resolution_date', 'sample_date'].forEach(function (f) {
      if (!blank(c[f]) && !L.isValidDate(c[f])) bad(f, 'Date is not valid (use YYYY-MM-DD): ' + f);
      else if (!blank(c[f]) && c[f] > today && f !== 'resolution_date') bad(f, 'Date cannot be in the future: ' + f);
    });
    if (!blank(c.complaint_time) && !L.isValidTime(c.complaint_time)) bad('complaint_time', 'Time must look like 14:30.');
    var chain = ['date_of_loading', 'date_of_dispatch', 'date_of_receipt', 'complaint_date'];
    for (var i = 0; i < chain.length - 1; i++) {
      var a = c[chain[i]], b = c[chain[i + 1]];
      if (L.isValidDate(a) && L.isValidDate(b) && a > b) bad(chain[i + 1], 'Dates look out of order: loading ≤ dispatch ≤ receipt ≤ complaint date.');
    }
    if (c.resolution_date && L.isValidDate(c.resolution_date) && L.isValidDate(c.complaint_date) && c.resolution_date < c.complaint_date) bad('resolution_date', 'Resolution date cannot be before the complaint date.');
    if ((c.status === 'Resolved' || c.status === 'Closed') && blank(c.resolution_date)) bad('resolution_date', 'Resolution date is required when status is ' + c.status + '.');
    if (c.status && !M.statusByName[c.status]) bad('status', 'Unknown status: ' + c.status);
    if (c.priority && M.priorities.indexOf(c.priority) < 0) bad('priority', 'Priority must be Normal, High or Critical.');
    if (c.source && M.sources.indexOf(c.source) < 0) bad('source', 'Unknown source: ' + c.source);
    if (c.loading_site && M.loadingSites.indexOf(c.loading_site) < 0) bad('loading_site', 'Site of loading must be Siding, Road Sale or Other.');
    if (c.dispatch_mode && M.dispatchModes.indexOf(c.dispatch_mode) < 0) bad('dispatch_mode', 'Dispatch mode must be Rail or Road.');

    /* master-data combinations */
    var sub = M.subById[c.subsidiary_id], area = M.areaById[c.area_id], mine = M.mineById[c.mine_id], loc = M.locById[c.location_id];
    if (c.subsidiary_id && (!sub || sub.level !== 'Subsidiary')) bad('subsidiary_id', 'Unknown subsidiary: ' + c.subsidiary_id);
    if (c.area_id && !area) bad('area_id', 'Unknown area: ' + c.area_id);
    else if (area && c.subsidiary_id && area.subsidiary_id !== c.subsidiary_id) bad('area_id', 'Area does not belong to the selected subsidiary.');
    if (c.mine_id && !mine) bad('mine_id', 'Unknown mine: ' + c.mine_id);
    else if (mine && c.area_id && mine.area_id !== c.area_id) bad('mine_id', 'Mine does not belong to the selected area.');
    if (c.location_id && !loc) bad('location_id', 'Unknown location: ' + c.location_id);
    else if (loc && c.mine_id && loc.mine_id !== c.mine_id) bad('location_id', 'Location does not belong to the selected mine.');
    if (c.declared_grade && !M.gradeByCode[c.declared_grade]) bad('declared_grade', 'Declared grade is not in the grade master: ' + c.declared_grade);
    ['claimed_grade', 'tested_grade'].forEach(function (f) { if (!blank(c[f]) && !M.gradeByCode[c[f]]) bad(f, 'Grade is not in the grade master: ' + c[f]); });

    /* numbers */
    NUM_PCT.forEach(function (f) {
      if (blank(c[f])) return; var v = Number(c[f]);
      if (isNaN(v)) bad(f, 'Must be a number: ' + f); else if (v < 0 || v > 100) bad(f, 'Percentage must be between 0 and 100: ' + f);
    });
    NUM_GCV.forEach(function (f) {
      if (blank(c[f])) return; var v = Number(c[f]);
      if (isNaN(v)) bad(f, 'Must be a number: ' + f); else if (v < 0 || v > 9000) bad(f, 'GCV must be between 0 and 9000 kcal/kg: ' + f);
    });
    NUM_POS.forEach(function (f) {
      if (blank(c[f])) return; var v = Number(c[f]);
      if (isNaN(v)) bad(f, 'Must be a number: ' + f); else if (v < 0) bad(f, 'Cannot be negative: ' + f);
    });
    if (!blank(c.quantity) && !blank(c.quantity_complained) && Number(c.quantity_complained) > Number(c.quantity)) bad('quantity_complained', 'Quantity complained against cannot be more than quantity supplied.');
    if (!blank(c.complaint_id) && ctx.existingIds && ctx.existingIds[c.complaint_id]) bad('complaint_id', 'Duplicate complaint ID: ' + c.complaint_id);
    return { ok: errs.length === 0, errors: errs };
  };

  /* ---------- export helpers (respect whatever rows are passed in) ---------- */
  L.EXPORT_COLS = ['complaint_id', 'complaint_date', 'complaint_time', 'consumer_name', 'consumer_id', 'source', 'reference_no',
    '_sub', '_area', '_mine', '_loc', 'loading_site', 'dispatch_mode', 'date_of_loading', 'date_of_dispatch', 'date_of_receipt',
    'vehicle_no', 'rr_challan_no', 'invoice_no', 'declared_grade', 'claimed_grade', 'tested_grade', 'quantity', 'quantity_complained',
    'complaint_categories', 'ash_declared', 'ash_tested', 'ash_reported', 'moisture_declared', 'moisture_tested', 'moisture_reported',
    'gcv_declared', 'gcv_tested', 'gcv_reported', 'oversize_pct_est', 'oversize_pct_tested', 'shale_pct_est', 'shale_pct_tested',
    'sandstone_pct_est', 'sandstone_pct_tested', 'status', 'status_date', 'priority', 'assigned_to', 'resolution_date', 'closure_remarks', 'data_source', 'created_at', 'updated_at'];
  L.EXPORT_HEAD = { _sub: 'subsidiary', _area: 'area', _mine: 'mine', _loc: 'location' };
  function cell(c, k) { var v = c[k]; if (Array.isArray(v)) v = v.join('; '); return v === null || v === undefined ? '' : v; }
  L.toCsv = function (rows) {
    function q(v) { v = String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    var head = L.EXPORT_COLS.map(function (k) { return L.EXPORT_HEAD[k] || k; }).join(',');
    return '﻿' + [head].concat(rows.map(function (c) { return L.EXPORT_COLS.map(function (k) { return q(cell(c, k)); }).join(','); })).join('\r\n');
  };
  L.esc = function (s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); };
  L.toXls = function (rows) {
    var h = '<tr>' + L.EXPORT_COLS.map(function (k) { return '<th>' + L.esc(L.EXPORT_HEAD[k] || k) + '</th>'; }).join('') + '</tr>';
    var b = rows.map(function (c) { return '<tr>' + L.EXPORT_COLS.map(function (k) { return '<td>' + L.esc(cell(c, k)) + '</td>'; }).join('') + '</tr>'; }).join('');
    return '<html><head><meta charset="utf-8"></head><body><table border="1">' + h + b + '</table></body></html>';
  };
})();
