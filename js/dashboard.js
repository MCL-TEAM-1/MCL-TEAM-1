/* PRESENTATION LAYER - dashboard page: filters, KPI cards, charts, tables, detail view, export, simulation.
   It reads data only through CQ.Data.current and does its maths with CQ.Logic. */
(function () {
  'use strict';
  var CQ = window.CQ, M = CQ.Master, L = CQ.Logic, U = CQ.UI, D = CQ.Data, I = CQ.Integration;
  function $(id) { return document.getElementById(id); }
  var esc = U.esc;

  var VIEWS = { dashboard: 'Dashboard', live: 'Live Complaints', search: 'Complaint Search', management: 'Management Summary',
    analytics: 'Detailed Analytics', subsidiary: 'Subsidiary Analysis', area: 'Area Analysis', mine: 'Mine Analysis',
    quality: 'Quality Analysis', grade: 'Grade Analysis', loading: 'Loading Site Analysis', trend: 'Trend Analysis', reports: 'Reports' };
  var SUBS = M.complaintSubsidiaries().map(function (s) { return s.subsidiary_code; });
  var SUB_COL = ['#2f6db5', '#e0672a', '#4aa56b', '#8e6bbf', '#d9a21b', '#1fa5c4', '#c0392b'];
  var GROUP = {}; M.groups.forEach(function (g) { GROUP[g.id] = g; });
  var THR = CQ.Settings.get('oversize_threshold_mm') || 100;
  GROUP.oversize.label = 'Oversize >' + THR + ' mm';
  L.KPIS.forEach(function (k) { if (k.id === 'oversize') k.label = 'Oversize >' + THR + ' mm Complaints'; });
  var STATUS_COL = { 'New': '#2f6db5', 'Acknowledged': '#5b8fd6', 'Under Examination': '#d9a21b', 'Testing': '#e0872a', 'Investigation': '#8e6bbf', 'Resolved': '#2e8b57', 'Closed': '#1b5e3c', 'Other': '#8a939e' };

  var S = { all: [], rows: [], prev: [], f: L.emptyFilters(), view: 'dashboard', known: null, fresh: {}, charts: {}, page: 1,
    auto: true, autoTimer: null, simTimer: null, lastToday: null,
    trendOn: { total: true, slip: true, ash: false, moisture: false, shsa: false, oversize: false } };

  function cv(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function num1(v) { return v === null || v === undefined ? '—' : (Math.round(v * 10) / 10).toString(); }
  function dash(v, unit) { return v === null || v === undefined || v === '' ? '—' : esc(v) + (unit ? ' ' + unit : ''); }

  /* ================= filters ================= */
  function fillSel(el, first, items, keep) {
    var cur = keep === undefined ? el.value : keep;
    el.innerHTML = '<option value="">' + esc(first) + '</option>' + items.map(function (i) { return '<option value="' + esc(i.v) + '">' + esc(i.t) + '</option>'; }).join('');
    if (cur && items.some(function (i) { return i.v === cur; })) el.value = cur; else el.value = '';
  }
  function plain(a) { return a.map(function (x) { return { v: x, t: x }; }); }

  function fillHierarchy() {
    var sub = $('f_sub').value, area = $('f_area').value, mine = $('f_mine').value;
    fillSel($('f_area'), 'All areas', M.areasOf(sub).map(function (a) { return { v: a.area_id, t: a.area_name }; }), area);
    area = $('f_area').value;
    fillSel($('f_mine'), 'All mines', M.minesOf(area, sub).map(function (m) { return { v: m.mine_id, t: m.mine_name }; }), mine);
    mine = $('f_mine').value;
    fillSel($('f_loc'), 'All locations', M.locationsOf(mine, area, sub).map(function (l) { return { v: l.location_id, t: l.location_name }; }), $('f_loc').value);
  }
  function buildFilterOptions() {
    fillSel($('f_sub'), 'All subsidiaries (Coal India Limited)', M.complaintSubsidiaries().map(function (s) { return { v: s.subsidiary_id, t: s.subsidiary_code + ' - ' + s.subsidiary_name }; }), '');
    fillHierarchy();
    fillSel($('f_site'), 'All', plain(M.loadingSites), '');
    fillSel($('f_grade'), 'All grades', M.coal_grade_master.map(function (g) { return { v: g.grade_code, t: g.grade_code }; }), '');
    fillSel($('f_cat'), 'All categories', M.complaint_category_master.map(function (c) { return { v: c.category_name, t: c.category_name }; }), '');
    fillSel($('f_status'), 'All statuses', M.complaint_status_master.map(function (s) { return { v: s.status_name, t: s.status_name }; }), '');
    fillSel($('f_prio'), 'All priorities', plain(M.priorities), '');
    fillSel($('f_mode'), 'All', plain(M.dispatchModes), '');
    fillSel($('f_source'), 'All sources', plain(M.sources), '');
    fillSel($('f_consumer'), 'All consumers', [], '');
  }
  function buildFyOptions() {
    var set = {}, cur = $('f_fy').value; set[L.fyOf(L.today())] = 1;
    S.all.forEach(function (c) { set[L.fyOf(c.complaint_date)] = 1; });
    fillSel($('f_fy'), 'All / custom', Object.keys(set).sort().reverse().map(function (x) { return { v: x, t: 'FY ' + x }; }), cur || S.f.fy);
  }
  function buildConsumers() {
    var set = {}; S.all.forEach(function (c) { set[c.consumer_name] = 1; });
    fillSel($('f_consumer'), 'All consumers', plain(Object.keys(set).sort()), S.f.consumer);
  }
  function readFilters() {
    var f = S.f;
    f.fy = $('f_fy').value; f.from = $('f_from').value; f.to = $('f_to').value; f.subsidiary = $('f_sub').value; f.area = $('f_area').value;
    f.mine = $('f_mine').value; f.location = $('f_loc').value; f.site = $('f_site').value; f.grade = $('f_grade').value; f.category = $('f_cat').value;
    f.status = $('f_status').value; f.priority = $('f_prio').value; f.consumer = $('f_consumer').value; f.mode = $('f_mode').value; f.source = $('f_source').value;
  }
  function writeFilters() {
    var f = S.f;
    $('f_fy').value = f.fy; $('f_from').value = f.from; $('f_to').value = f.to; $('f_sub').value = f.subsidiary;
    fillHierarchy();
    $('f_area').value = f.area; fillHierarchy(); $('f_mine').value = f.mine; fillHierarchy(); $('f_loc').value = f.location;
    $('f_site').value = f.site; $('f_grade').value = f.grade; $('f_cat').value = f.category; $('f_status').value = f.status;
    $('f_prio').value = f.priority; $('f_consumer').value = f.consumer; $('f_mode').value = f.mode; $('f_source').value = f.source;
    $('bigSearch').value = f.q; $('globalSearch').value = f.q;
  }
  /* change filters from code (chart clicks etc.), keeping parent/child links valid */
  function setFilters(patch) {
    var f = S.f, k; for (k in patch) f[k] = patch[k];
    if (patch.mine) { var m = M.mineById[patch.mine]; if (m) { f.area = m.area_id; f.subsidiary = m.subsidiary_id; f.location = ''; } }
    else if (patch.area) { var a = M.areaById[patch.area]; if (a) { f.subsidiary = a.subsidiary_id; f.mine = ''; f.location = ''; } }
    else if (patch.subsidiary !== undefined) { f.area = ''; f.mine = ''; f.location = ''; }
    writeFilters(); refresh();
  }
  function defaultFilters() {
    var f = L.emptyFilters(), fy = L.fyOf(L.today()), b = L.fyBounds(fy);
    f.fy = fy; f.from = b.from; f.to = b.to; return f;
  }
  function onFyChange() {
    var fy = $('f_fy').value;
    if (fy) { var b = L.fyBounds(fy); $('f_from').value = b.from; $('f_to').value = b.to; }
  }
  function onRange() {
    var v = $('f_range').value, t = L.today(), fy = L.fyOf(t), out = null;
    if (v === 'today') out = [t, t, ''];
    else if (v === '7') out = [L.addDays(t, -6), t, ''];
    else if (v === '30') out = [L.addDays(t, -29), t, ''];
    else if (v === 'month') out = [t.slice(0, 7) + '-01', t, ''];
    else if (v === 'fy') { var b = L.fyBounds(fy); out = [b.from, b.to, fy]; }
    else if (v === 'lastfy') { var lf = (+fy.slice(0, 4) - 1) + '-' + String(+fy.slice(0, 4) % 100).replace(/^(\d)$/, '0$1'); var bb = L.fyBounds(lf); out = [bb.from, bb.to, lf]; }
    else if (v === 'all') out = ['', '', ''];
    if (out) { $('f_from').value = out[0]; $('f_to').value = out[1]; $('f_fy').value = out[2]; if (out[2] && $('f_fy').value !== out[2]) $('f_fy').value = ''; applyFromUi(); }
  }
  function applyFromUi() { readFilters(); refresh(); }
  function describeFilters() {
    var f = S.f, p = [];
    if (f.from || f.to) p.push('Dates ' + (f.from ? L.fmtDate(f.from) : 'start') + ' to ' + (f.to ? L.fmtDate(f.to) : 'today'));
    if (f.subsidiary) p.push(f.subsidiary); if (f.area) p.push((M.areaById[f.area] || {}).area_name); if (f.mine) p.push((M.mineById[f.mine] || {}).mine_name);
    if (f.location) p.push((M.locById[f.location] || {}).location_name); if (f.site) p.push(f.site); if (f.grade) p.push('Grade ' + f.grade);
    if (f.category) p.push(f.category); if (f.group) p.push('Issue: ' + GROUP[f.group].label); if (f.status) p.push(f.status); if (f.priority) p.push(f.priority + ' priority');
    if (f.consumer) p.push(f.consumer); if (f.mode) p.push(f.mode); if (f.source) p.push('Source: ' + f.source); if (f.q) p.push('Search: "' + f.q + '"');
    return p.filter(Boolean);
  }

  /* ================= data loading ================= */
  function load() {
    return D.current.load().then(function (rows) {
      S.all = rows;
      if (S.known === null) { S.known = {}; rows.forEach(function (c) { S.known[c.complaint_id] = 1; }); }
      else rows.forEach(function (c) { if (!S.known[c.complaint_id]) { S.known[c.complaint_id] = 1; S.fresh[c.complaint_id] = Date.now(); } });
      buildFyOptions(); buildConsumers();
      $('lastUpdated').textContent = L.fmtDateTime(D.current.lastSync || new Date());
      refresh();
    }).catch(function (e) {
      $('chartsError').innerHTML = U.errorHtml('Could not load the complaints.', e);
    });
  }
  function refresh() {
    var f = S.f;
    S.rows = L.filterRows(S.all, f);
    var pr = L.prevRange(f); S.prev = pr ? L.filterRows(S.all, f, pr) : null;
    renderHeader(); renderKpis(); renderCharts(); renderTables();
    var d = describeFilters(); $('filterSummary').textContent = S.rows.length + ' complaints match' + (d.length ? ' · ' + d.join(' · ') : '');
  }

  /* ================= header / counters ================= */
  function renderHeader() {
    var a = D.current, t = L.today(), now = Date.now(), n24 = 0, n7 = 0, nm = 0, nf = 0, nt = 0, fy = L.fyOf(t), d7 = L.addDays(t, -6);
    S.all.forEach(function (c) {
      if (c.complaint_date === t) nt++;
      if (c._ts >= now - 864e5 && c._ts <= now) n24++;
      if (c.complaint_date >= d7 && c.complaint_date <= t) n7++;
      if (c.complaint_date.slice(0, 7) === t.slice(0, 7)) nm++;
      if (L.fyOf(c.complaint_date) === fy) nf++;
    });
    $('lcToday').textContent = nt; $('lc24').textContent = n24; $('lc7').textContent = n7; $('lcMonth').textContent = nm; $('lcFy').textContent = nf;
    if (S.lastToday !== null && nt > S.lastToday) { var el = $('lcToday'); el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }
    S.lastToday = nt;
    $('srcText').textContent = a.info.live ? 'Connected Data Source' : 'Demo (synthetic)';
    $('srcBadge').innerHTML = a.info.live ? '<span class="badge-live">● LIVE DATA</span>' : '<span class="badge-demo">● DEMO DATA</span>';
    var f = S.f; $('rangeText').textContent = 'Date range: ' + (f.from ? L.fmtDate(f.from) : 'all dates') + ' to ' + (f.to ? L.fmtDate(f.to) : 'today') +
      ' · Last synchronized: ' + L.fmtDateTime(a.lastSync || new Date());
    U.refreshBanner();
  }

  /* ================= KPI cards ================= */
  function effRange() {
    var f = S.f, dr = L.dataRange(S.all), t = L.today();
    var from = f.from || dr.from || t, to = f.to && f.to < t ? f.to : t; if (to < from) to = from; return { from: from, to: to };
  }
  function spark(test) {
    var r = effRange(), s = L.series(S.rows, test, 'week', r.from, r.to), v = s.values.slice(-12);
    if (v.length < 2) return '';
    var mx = Math.max.apply(null, v) || 1, w = 100, h = 30, pts = v.map(function (y, i) { return (i * w / (v.length - 1)).toFixed(1) + ',' + (h - 3 - y * (h - 6) / mx).toFixed(1); }).join(' ');
    return '<svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="' + cv('--blue') + '" stroke-width="2" points="' + pts + '"/></svg>';
  }
  function changeHtml(cur, prev, goodUp) {
    if (prev === null) return '<div class="chg flat">■ No previous period (choose date range)</div>';
    if (prev === 0 && cur === 0) return '<div class="chg flat">■ No change (0 before)</div>';
    if (prev === 0) return '<div class="chg flat">▲ New (0 before)</div>';
    var p = Math.round((cur - prev) * 100 / prev);
    if (p === 0) return '<div class="chg flat">■ 0% vs previous period (' + prev + ')</div>';
    var up = p > 0, good = up === goodUp;
    return '<div class="chg ' + (good ? 'good' : 'bad') + '">' + (up ? '▲ +' : '▼ ') + p + '% vs previous period (' + prev + ')</div>';
  }
  function renderKpis() {
    var tot = S.rows.length, ptot = S.prev ? S.prev.length : null;
    var colors = { total: 'blue', open: 'amber', exam: 'orange', resolved: 'green', slip: 'blue', ashmoist: 'amber', shsand: 'grey', oversize: 'red' };
    $('kpis').innerHTML = L.KPIS.map(function (k) {
      var n = L.count(S.rows, k.test), pv = S.prev ? L.count(S.prev, k.test) : null;
      return '<div class="kpi" style="border-top-color:var(--' + colors[k.id] + ')"><div class="l">' + esc(k.label) + (k.note ? ' <span class="note">(potential)</span>' : '') + '</div><div class="n">' + n.toLocaleString('en-IN') + '</div>' +
        '<div class="p">' + L.pct(n, tot) + '% of total</div>' + changeHtml(n, pv, k.goodUp) + spark(k.test) + '</div>';
    }).join('');
    var by = function (g) { return L.count(S.rows, function (c) { return c._groups.indexOf(g) >= 0; }); };
    var res = L.count(S.rows, function (c) { return c._resolved; });
    var items = [['Total complaints', tot, '', 'blue'], ['Open complaints', L.count(S.rows, function (c) { return c._open; }), L.pct(L.count(S.rows, function (c) { return c._open; }), tot) + '% of total', 'amber'],
      ['Resolved complaints', res, '', 'green'], ['Resolution %', L.pct(res, tot) + '%', 'resolved or closed', 'green'],
      ['Grade slippage (potential)', L.count(S.rows, function (c) { return c._slip; }), '', 'blue'], ['Ash', by('ash'), '', 'amber'], ['Moisture', by('moisture'), '', 'blue'],
      ['Shale', by('shale'), '', 'grey'], ['Sandstone', by('sandstone'), '', 'orange'], [GROUP.oversize.label, by('oversize'), '', 'red']];
    $('mgmtKpis').innerHTML = items.map(function (i) {
      var sub = i[2] || (typeof i[1] === 'number' ? L.pct(i[1], tot) + '% of total' : '');
      return '<div class="kpi" style="border-top-color:var(--' + i[3] + ')"><div class="l">' + esc(i[0]) + '</div><div class="n">' + i[1] + '</div><div class="p">' + esc(sub) + '</div></div>';
    }).join('');
  }

  /* ================= charts ================= */
  var hasChart = function () { return typeof window.Chart !== 'undefined'; };
  function defaults() { if (!hasChart()) return; Chart.defaults.color = cv('--text'); Chart.defaults.borderColor = cv('--grid'); Chart.defaults.font.family = 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'; }
  function mk(id, cfg, hasData) {
    var card = $(id), box = card.querySelector('.chart-box'), canvas = box.querySelector('canvas');
    if (S.charts[id]) { S.charts[id].destroy(); delete S.charts[id]; }
    box.classList.toggle('empty', !hasData);
    if (!hasData || !hasChart()) return;
    cfg.options = cfg.options || {}; cfg.options.responsive = true; cfg.options.maintainAspectRatio = false; cfg.options.animation = false;
    S.charts[id] = new Chart(canvas, cfg);
  }
  function clickable(fn) {
    return {
      onClick: function (e, els, chart) { if (els.length) fn(els[0].index, els[0].datasetIndex); },
      onHover: function (e, els) { if (e.native && e.native.target) e.native.target.style.cursor = els.length ? 'pointer' : 'default'; }
    };
  }
  function pct(n, d) { return L.pct(n, d) + '%'; }
  function hboxHeight(id, n) { $(id).style.height = Math.max(220, n * 26 + 70) + 'px'; }
  function barOpts(horizontal, extra) {
    var o = { indexAxis: horizontal ? 'y' : 'x', plugins: { legend: { display: false } }, scales: { x: { ticks: { maxRotation: 60 }, grid: { display: !horizontal } }, y: { beginAtZero: true, grid: { display: horizontal ? false : true } } } };
    if (horizontal) { o.scales.x.beginAtZero = true; o.scales.x.grid = { display: true }; }
    for (var k in extra) o[k] = extra[k];
    return o;
  }
  function visible(id) { var el = $(id); return el && !el.hidden; }

  function renderCharts() {
    if (!hasChart()) {
      $('chartsError').innerHTML = U.errorHtml('Charts could not be loaded, but the numbers and tables still work.', window.CHART_LOAD_FAILED ? 'The Chart.js file from cdn.jsdelivr.net did not load (check internet access).' : 'Chart.js is not available.');
      return;
    }
    if ($('chartsError').textContent.indexOf('Charts could not') >= 0) $('chartsError').innerHTML = '';
    defaults();
    var R = S.rows, tot = R.length, f = S.f;
    document.querySelectorAll('.thr').forEach(function (e) { e.textContent = '>' + THR; });

    if (visible('c_subs')) {
      var cnt = L.tally(R, function (c) { return c.subsidiary_id; }), openBy = L.tally(R.filter(function (c) { return c._open; }), function (c) { return c.subsidiary_id; });
      var data = SUBS.map(function (s) { return cnt[s] || 0; });
      mk('c_subs', { type: 'bar', data: { labels: SUBS, datasets: [{ label: 'Complaints', data: data, backgroundColor: cv('--blue') }] },
        options: barOpts(false, Object.assign(clickable(function (i) { setFilters({ subsidiary: SUBS[i] }); }), {
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (x) { return x.parsed.y + ' complaints (' + pct(x.parsed.y, tot) + ')'; }, afterLabel: function (x) { return 'Open: ' + (openBy[SUBS[x.dataIndex]] || 0); } } } } })) }, tot > 0);
    }
    if (visible('c_subsGroups')) {
      var byS = L.groupBy(R, function (c) { return c.subsidiary_id; });
      mk('c_subsGroups', { type: 'bar', data: { labels: SUBS, datasets: M.groups.map(function (g) {
        return { label: g.label, backgroundColor: g.color, data: SUBS.map(function (s) { return (byS[s] || []).filter(function (c) { return c._groups.indexOf(g.id) >= 0; }).length; }) }; }) },
        options: { plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } } }, tot > 0);
    }
    if (visible('c_cat')) {
      var gc = M.groups.map(function (g) { return L.count(R, function (c) { return c._groups.indexOf(g.id) >= 0; }); }), gt = gc.reduce(function (a, b) { return a + b; }, 0);
      mk('c_cat', { type: 'doughnut', data: { labels: M.groups.map(function (g) { return g.label; }), datasets: [{ data: gc, backgroundColor: M.groups.map(function (g) { return g.color; }), borderColor: cv('--panel'), borderWidth: 2 }] },
        options: Object.assign(clickable(function (i) { setFilters({ group: f.group === M.groups[i].id ? '' : M.groups[i].id }); }), { plugins: { legend: { position: 'right', labels: { generateLabels: function (ch) {
          return ch.data.labels.map(function (l, i) { return { text: l + ' — ' + gc[i] + ' (' + pct(gc[i], gt) + ')', fillStyle: M.groups[i].color, strokeStyle: M.groups[i].color, index: i, hidden: false }; }); } } },
          tooltip: { callbacks: { label: function (x) { return x.label + ': ' + x.parsed + ' (' + pct(x.parsed, gt) + ' of issue mentions)'; }, afterLabel: function (x) { return pct(x.parsed, tot) + ' of complaints'; } } } } }) }, gt > 0);
    }
    if (visible('c_area')) {
      var ac = L.tally(R, function (c) { return c.area_id; }), ids = Object.keys(ac);
      if (f.subsidiary) M.areasOf(f.subsidiary).forEach(function (a) { if (ids.indexOf(a.area_id) < 0) ids.push(a.area_id); });
      ids.sort(function (a, b) { return (ac[b] || 0) - (ac[a] || 0); });
      var top = +$('areaTop').value; if (top) ids = ids.slice(0, top);
      hboxHeight('areaBox', ids.length);
      mk('c_area', { type: 'bar', data: { labels: ids.map(function (i) { return M.areaById[i].area_name; }), datasets: [{ label: 'Complaints', data: ids.map(function (i) { return ac[i] || 0; }), backgroundColor: cv('--blue') }] },
        options: barOpts(true, Object.assign(clickable(function (i) { setFilters({ area: ids[i] }); }), { plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (x) { return x.parsed.x + ' complaints (' + pct(x.parsed.x, tot) + ')'; } } } } })) }, ids.length > 0 && tot > 0);
    }
    if (visible('c_mine')) {
      var mc = L.tally(R, function (c) { return c.mine_id; }), mids = Object.keys(mc).sort(function (a, b) { return mc[b] - mc[a]; }), mt = +$('mineTop').value; if (mt) mids = mids.slice(0, mt);
      hboxHeight('mineBox', mids.length);
      mk('c_mine', { type: 'bar', data: { labels: mids.map(function (i) { return M.mineById[i].mine_name; }), datasets: [{ label: 'Complaints', data: mids.map(function (i) { return mc[i]; }), backgroundColor: cv('--orange') }] },
        options: barOpts(true, Object.assign(clickable(function (i) { setFilters({ mine: mids[i] }); }), { plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (x) { return x.parsed.x + ' complaints (' + pct(x.parsed.x, tot) + ')'; } } } } })) }, mids.length > 0);
    }
    if (visible('c_loc')) {
      var lc = L.tally(R, function (c) { return c.location_id; }), lids = Object.keys(lc).sort(function (a, b) { return lc[b] - lc[a]; }).slice(0, 10);
      hboxHeight('locBox', lids.length);
      mk('c_loc', { type: 'bar', data: { labels: lids.map(function (i) { return M.locById[i].location_name; }), datasets: [{ label: 'Complaints', data: lids.map(function (i) { return lc[i]; }), backgroundColor: cv('--amber') }] },
        options: barOpts(true, { plugins: { legend: { display: false } } }) }, lids.length > 0);
    }
    if (visible('c_trend')) renderTrend();
    if (visible('c_grade')) renderGrade();
    if (visible('c_loading')) renderLoading();
    if (visible('c_status')) {
      var sc = M.statusGroups.map(function (g) { return L.count(R, function (c) { return c._statusGroup === g; }); }), st = sc.reduce(function (a, b) { return a + b; }, 0);
      mk('c_status', { type: 'doughnut', data: { labels: M.statusGroups, datasets: [{ data: sc, backgroundColor: M.statusGroups.map(function (g) { return STATUS_COL[g]; }), borderColor: cv('--panel'), borderWidth: 2 }] },
        options: { plugins: { legend: { position: 'right', labels: { generateLabels: function (ch) {
          return ch.data.labels.map(function (l, i) { return { text: l + ' — ' + sc[i] + ' (' + pct(sc[i], st) + ')', fillStyle: STATUS_COL[l], strokeStyle: STATUS_COL[l], index: i, hidden: false }; }); } } },
          tooltip: { callbacks: { label: function (x) { return x.label + ': ' + x.parsed + ' (' + pct(x.parsed, st) + ')'; } } } } } }, st > 0);
    }
    if (visible('c_aging')) {
      var open = R.filter(function (c) { return c._open; }), ag = L.AGE_BUCKETS.map(function (b) { return L.count(open, function (c) { return c._age >= b[1] && c._age <= b[2]; }); });
      var agc = ['#2e8b57', '#7ab648', '#d9a21b', '#e0872a', '#d9534f', '#a31f1a'];
      mk('c_aging', { type: 'bar', data: { labels: L.AGE_BUCKETS.map(function (b) { return b[0]; }), datasets: [{ label: 'Open complaints', data: ag, backgroundColor: agc }] },
        options: barOpts(false, { plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (x) { return x.parsed.y + ' open (' + pct(x.parsed.y, open.length) + ')'; } } } } }) }, open.length > 0);
    }
    if (visible('c_res')) renderRes();
    if (visible('c_scatter')) renderScatter();
    if (visible('c_qtrend')) renderQTrend();
    if (visible('c_ash')) hist('c_ash', R, function (c) { return c.ash_declared; }, function (c) { return c._ash; }, [0, 10, 15, 20, 25, 30, 35, 40, 45, 101], 'Ash %');
    if (visible('c_moist')) hist('c_moist', R, function (c) { return c.moisture_declared; }, function (c) { return c._moist; }, [0, 4, 6, 8, 10, 12, 14, 16, 101], 'Moisture %');
    if (visible('c_gcv')) hist('c_gcv', R, function (c) { return c.gcv_declared; }, function (c) { return c._gcv; }, [0, 2000, 3000, 4000, 5000, 6000, 7000, 9001], 'GCV (kcal/kg)');
    if (visible('c_size')) hist('c_size', R, null, function (c) { return c._over; }, [0, 2, 5, 10, 15, 20, 101], 'Oversize %');
    if (visible('c_shsa')) {
      var bs = L.groupBy(R, function (c) { return c.subsidiary_id; });
      var av = function (s, k) { return L.avg((bs[s] || []).map(function (c) { return c[k]; })); };
      var d1 = SUBS.map(function (s) { return av(s, '_shale'); }), d2 = SUBS.map(function (s) { return av(s, '_sand'); });
      mk('c_shsa', { type: 'bar', data: { labels: SUBS, datasets: [{ label: 'Average shale %', data: d1.map(function (v) { return v === null ? null : +v.toFixed(1); }), backgroundColor: '#8e6bbf' }, { label: 'Average sandstone %', data: d2.map(function (v) { return v === null ? null : +v.toFixed(1); }), backgroundColor: '#d9a21b' }] },
        options: { plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, title: { display: true, text: '%' } } } } }, d1.concat(d2).some(function (v) { return v !== null; }));
    }
    if (visible('c_restime')) {
      var done = R.filter(function (c) { return c._resolved && c._resDays !== null; }), bd = L.groupBy(done, function (c) { return c.subsidiary_id; });
      var med = function (a) { if (!a.length) return null; a = a.slice().sort(function (x, y) { return x - y; }); var m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
      mk('c_restime', { type: 'bar', data: { labels: SUBS, datasets: [
        { label: 'Average days', data: SUBS.map(function (s) { var v = L.avg((bd[s] || []).map(function (c) { return c._resDays; })); return v === null ? null : +v.toFixed(1); }), backgroundColor: cv('--blue') },
        { label: 'Median days', data: SUBS.map(function (s) { return med((bd[s] || []).map(function (c) { return c._resDays; })); }), backgroundColor: cv('--green') }] },
        options: { plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'days' } } } } }, done.length > 0);
    }
    if (visible('c_geo')) {
      var sc2 = L.tally(R, function (c) { return c._state; }), sk = Object.keys(sc2).sort(function (a, b) { return sc2[b] - sc2[a]; });
      mk('c_geo', { type: 'bar', data: { labels: sk, datasets: [{ label: 'Complaints', data: sk.map(function (k) { return sc2[k]; }), backgroundColor: cv('--blue') }] },
        options: barOpts(true, { plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (x) { return x.parsed.x + ' complaints (' + pct(x.parsed.x, tot) + ')'; } } } } }) }, sk.length > 0);
    }
  }

  var TREND_DEFS = [['total', 'Total complaints', function () { return true; }, '#1d4f91'], ['slip', 'Grade slippage (potential)', function (c) { return c._slip; }, GROUP_C('slippage')],
    ['ash', 'Ash', function (c) { return c._groups.indexOf('ash') >= 0; }, GROUP_C('ash')], ['moisture', 'Moisture', function (c) { return c._groups.indexOf('moisture') >= 0; }, GROUP_C('moisture')],
    ['shsa', 'Shale / Sandstone', function (c) { return c._groups.indexOf('shale') >= 0 || c._groups.indexOf('sandstone') >= 0; }, GROUP_C('shale')],
    ['oversize', 'Oversize', function (c) { return c._groups.indexOf('oversize') >= 0; }, GROUP_C('oversize')]];
  function GROUP_C(id) { return GROUP[id].color; }
  var DASH = { total: [], slip: [6, 3], ash: [2, 3], moisture: [8, 3, 2, 3], shsa: [4, 2], oversize: [1, 3] };
  function rangeFor(gran) {
    var r = effRange(), from = r.from;
    if (gran === 'day' && L.diffDays(from, r.to) > 365) from = L.addDays(r.to, -365);
    return { from: from, to: r.to };
  }
  function renderTrend() {
    var gran = $('trendGran').value, r = rangeFor(gran), box = $('trendSeries');
    if (!box.firstChild) {
      box.innerHTML = TREND_DEFS.map(function (d) { return '<label><input type="checkbox" data-s="' + d[0] + '"' + (S.trendOn[d[0]] ? ' checked' : '') + '> ' + d[1] + '</label>'; }).join('');
      box.addEventListener('change', function (e) { S.trendOn[e.target.getAttribute('data-s')] = e.target.checked; renderTrend(); });
    }
    var keys = L.bucketKeys(r.from, r.to, gran), ds = [];
    TREND_DEFS.forEach(function (d) {
      if (!S.trendOn[d[0]]) return;
      ds.push({ label: d[1], data: L.series(S.rows, d[2], gran, r.from, r.to).values, borderColor: d[3], backgroundColor: d[3], borderDash: DASH[d[0]], tension: 0.25, pointRadius: keys.length > 60 ? 0 : 3, borderWidth: 2 });
    });
    mk('c_trend', { type: 'line', data: { labels: keys.map(function (k) { return L.bucketLabel(k, gran); }), datasets: ds },
      options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'Complaints' }, ticks: { precision: 0 } }, x: { ticks: { maxTicksLimit: 14 } } } } }, S.rows.length > 0 && ds.length > 0);
  }
  function renderGrade() {
    var R = S.rows, tot = R.length, g = L.groupBy(R, function (c) { return c.declared_grade; });
    var codes = M.coal_grade_master.map(function (x) { return x.grade_code; }).filter(function (k) { return g[k]; });
    var slip = codes.map(function (k) { return L.count(g[k], function (c) { return c._potentialSlip; }); });
    mk('c_grade', { type: 'bar', data: { labels: codes, datasets: [{ label: 'Complaints', data: codes.map(function (k) { return g[k].length; }), backgroundColor: cv('--blue') }, { label: 'Potential grade slippage', data: slip, backgroundColor: cv('--red') }] },
      options: Object.assign(clickable(function (i) { setFilters({ grade: codes[i] }); }), { plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { afterLabel: function (x) { return x.datasetIndex === 0 ? pct(x.parsed.y, tot) + ' of complaints' : ''; } } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }) }, codes.length > 0);
    $('gradeTable').innerHTML = '<table><thead><tr><th>Grade</th><th>Complaints</th><th>% of total</th><th>Potential grade slippage</th></tr></thead><tbody>' +
      codes.map(function (k, i) { return '<tr><td>' + k + '</td><td>' + g[k].length + '</td><td>' + pct(g[k].length, tot) + '</td><td>' + slip[i] + ' (' + pct(slip[i], g[k].length) + ')</td></tr>'; }).join('') + '</tbody></table>';
  }
  function renderLoading() {
    var R = S.rows, tot = R.length, sites = M.loadingSites, cnt = L.tally(R, function (c) { return c.loading_site; });
    var pc = S.prev ? L.tally(S.prev, function (c) { return c.loading_site; }) : null;
    mk('c_loading', { type: 'bar', data: { labels: sites, datasets: [{ label: 'Complaints', data: sites.map(function (s) { return cnt[s] || 0; }), backgroundColor: [cv('--blue'), cv('--orange'), cv('--grey')] }] },
      options: barOpts(false, Object.assign(clickable(function (i) { setFilters({ site: sites[i] }); }), { plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (x) { return x.parsed.y + ' complaints (' + pct(x.parsed.y, tot) + ')'; } } } } })) }, tot > 0);
    $('loadingTable').innerHTML = '<table><thead><tr><th>Site of loading</th><th>Complaints</th><th>%</th><th>Trend vs previous period</th></tr></thead><tbody>' + sites.map(function (s) {
      var n = cnt[s] || 0, t = '—';
      if (pc) { var p = pc[s] || 0; t = p === 0 ? (n ? '▲ new (0 before)' : '■ no change') : (n === p ? '■ 0%' : (n > p ? '▲ +' : '▼ ') + Math.round((n - p) * 100 / p) + '%') + ' (prev ' + p + ')'; }
      return '<tr><td>' + s + '</td><td>' + n + '</td><td>' + pct(n, tot) + '</td><td>' + t + '</td></tr>'; }).join('') + '</tbody></table>';
  }
  function renderRes() {
    var gran = $('resGran').value, r = rangeFor(gran), keys = L.bucketKeys(r.from, r.to, gran);
    var closeDate = function (c) { return c.resolution_date || (c._open ? null : c.status_date); };
    var recv = L.series(S.rows, function () { return true; }, gran, r.from, r.to).values;
    var resd = L.series(S.rows, function (c) { return c._resolved; }, gran, r.from, r.to, closeDate).values;
    var openAt = keys.map(function (k) {
      var end = L.bucketEnd(k, gran), n = 0;
      S.rows.forEach(function (c) { if (c.complaint_date <= end) { var cd = closeDate(c); if (!cd || cd > end) n++; } });
      return n;
    });
    mk('c_res', { type: 'bar', data: { labels: keys.map(function (k) { return L.bucketLabel(k, gran); }), datasets: [
      { type: 'bar', label: 'Received', data: recv, backgroundColor: cv('--blue') }, { type: 'bar', label: 'Resolved', data: resd, backgroundColor: cv('--green') },
      { type: 'line', label: 'Remaining open (at period end)', data: openAt, borderColor: cv('--red'), backgroundColor: cv('--red'), borderDash: [6, 3], tension: 0.25, pointRadius: keys.length > 40 ? 0 : 3 }] },
      options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { ticks: { maxTicksLimit: 14 } } } } }, S.rows.length > 0);
  }
  var SHAPES = ['circle', 'triangle', 'rect', 'rectRot', 'cross', 'star', 'circle', 'triangle', 'rect'];
  function renderScatter() {
    var by = $('scatterBy').value, pts = S.rows.filter(function (c) { return c._ash !== null && c._moist !== null; }), sets = {};
    pts.forEach(function (c) { var k = by === 'sub' ? c._sub : c._groups[0]; (sets[k] = sets[k] || []).push({ x: c._moist, y: c._ash, c: c }); });
    var keys = by === 'sub' ? SUBS.filter(function (k) { return sets[k]; }) : M.groups.map(function (g) { return g.id; }).filter(function (k) { return sets[k]; });
    var ds = keys.map(function (k, i) {
      var col = by === 'sub' ? SUB_COL[SUBS.indexOf(k)] : GROUP[k].color;
      return { label: by === 'sub' ? k : GROUP[k].label, data: sets[k], backgroundColor: col + 'cc', borderColor: col, pointStyle: SHAPES[i % SHAPES.length], pointRadius: 4, pointHoverRadius: 7 };
    });
    mk('c_scatter', { type: 'scatter', data: { datasets: ds }, options: Object.assign(clickable(function (i, d) { var p = ds[d].data[i]; if (p) openDetail(p.c.complaint_id); }), {
      plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: function (x) { var c = x.raw.c; return [c.complaint_id + ' · ' + c._sub, c._area + ' · ' + c._mine, 'Declared grade ' + c.declared_grade + ' · ' + L.fmtDate(c.complaint_date), 'Ash ' + c._ash + '% · Moisture ' + c._moist + '%']; } } } },
      scales: { x: { title: { display: true, text: 'Moisture %' } }, y: { title: { display: true, text: 'Ash %' } } } }) }, pts.length > 0);
  }
  var QP = { ash: ['Ash %', 'ash_declared', 'ash_tested', 'ash_reported'], moisture: ['Moisture %', 'moisture_declared', 'moisture_tested', 'moisture_reported'],
    gcv: ['GCV (kcal/kg)', 'gcv_declared', 'gcv_tested', 'gcv_reported'], oversize: ['Oversize %', null, 'oversize_pct_tested', 'oversize_pct_est'],
    shale: ['Shale %', null, 'shale_pct_tested', 'shale_pct_est'], sandstone: ['Sandstone %', null, 'sandstone_pct_tested', 'sandstone_pct_est'] };
  function renderQTrend() {
    var sel = $('qParam'), cur = sel.value, avail = Object.keys(QP).filter(function (k) { return S.rows.some(function (c) { return [1, 2, 3].some(function (j) { return QP[k][j] && c[QP[k][j]] !== null && c[QP[k][j]] !== undefined; }); }); });
    if (sel.getAttribute('data-k') !== avail.join()) {
      sel.innerHTML = avail.map(function (k) { return '<option value="' + k + '">' + QP[k][0] + '</option>'; }).join(''); sel.setAttribute('data-k', avail.join());
      if (avail.indexOf(cur) >= 0) sel.value = cur;
    }
    if (!avail.length) { mk('c_qtrend', {}, false); return; }
    var q = QP[sel.value], r = rangeFor('month'), keys = L.bucketKeys(r.from, r.to, 'month'), g = L.groupBy(S.rows, function (c) { return c.complaint_date.slice(0, 7); });
    var line = function (field, label, col, dash) {
      if (!field) return null;
      return { label: label, borderColor: col, backgroundColor: col, borderDash: dash, spanGaps: true, tension: 0.25, borderWidth: 2, pointRadius: 3,
        data: keys.map(function (k) { var v = L.avg((g[k] || []).map(function (c) { return c[field] === undefined ? null : c[field]; })); return v === null ? null : +v.toFixed(1); }) };
    };
    var ds = [line(q[1], 'Declared / expected', cv('--grey'), [8, 4]), line(q[2], 'Tested', cv('--blue'), []), line(q[3], 'Consumer reported', cv('--orange'), [2, 3])].filter(Boolean);
    mk('c_qtrend', { type: 'line', data: { labels: keys.map(function (k) { return L.bucketLabel(k, 'month'); }), datasets: ds },
      options: { plugins: { legend: { position: 'bottom' } }, scales: { y: { title: { display: true, text: q[0] } } } } }, true);
  }
  function hist(id, rows, declFn, actFn, edges, xlabel) {
    var n = edges.length - 1, lab = [], i;
    for (i = 0; i < n; i++) lab.push(i === 0 ? '<' + edges[1] : i === n - 1 ? edges[i] + '+' : edges[i] + '–' + edges[i + 1]);
    var bin = function (v) { for (var j = 0; j < n; j++) if (v < edges[j + 1]) return j; return n - 1; };
    var a = lab.map(function () { return 0; }), d = lab.map(function () { return 0; }), any = false;
    rows.forEach(function (c) { var v = actFn(c); if (v !== null && v !== undefined) { a[bin(v)]++; any = true; } if (declFn) { var x = declFn(c); if (x !== null && x !== undefined) d[bin(x)]++; } });
    var ds = []; if (declFn) ds.push({ label: 'Declared / expected', data: d, backgroundColor: cv('--grey') });
    ds.push({ label: declFn ? 'Actual (tested, else reported)' : 'Complaints', data: a, backgroundColor: cv('--blue') });
    mk(id, { type: 'bar', data: { labels: lab, datasets: ds }, options: { plugins: { legend: { display: !!declFn, position: 'bottom' } }, scales: { x: { title: { display: true, text: xlabel } }, y: { beginAtZero: true, title: { display: true, text: 'Complaints' }, ticks: { precision: 0 } } } } }, any);
  }

  /* ================= tables ================= */
  function rowHtml(c) {
    var isNew = S.fresh[c.complaint_id] && Date.now() - S.fresh[c.complaint_id] < 90000;
    var cats = c.complaint_categories.slice(0, 3).map(function (n) { return '<span class="pill">' + esc(n) + '</span>'; }).join('') + (c.complaint_categories.length > 3 ? '<span class="pill">+' + (c.complaint_categories.length - 3) + '</span>' : '');
    if (c._potentialSlip) cats += '<span class="pill st-exam" title="Declared grade differs from claimed/tested grade. Not an authorised finding.">⚠ Potential slippage</span>';
    return '<tr class="click" tabindex="0" data-id="' + esc(c.complaint_id) + '"><td><b>' + esc(c.complaint_id) + '</b>' + (isNew ? ' <span class="pill new">NEW</span>' : '') + '</td><td>' + L.fmtDate(c.complaint_date) + ' ' + esc(c.complaint_time || '') + '</td><td>' + esc(c._sub) + '</td><td>' + esc(c._area) + '</td><td>' + esc(c._mine) + '</td><td>' + esc(c.loading_site) + '</td><td>' + esc(c.declared_grade) + '</td><td>' + cats + '</td><td>' + U.statusPill(c) + '</td></tr>';
  }
  var THEAD = '<thead><tr><th>Complaint ID</th><th>Date</th><th>Subsidiary</th><th>Area</th><th>Mine</th><th>Loading Site</th><th>Grade</th><th>Complaint</th><th>Status</th></tr></thead>';
  function sorted() { return S.rows.slice().sort(function (a, b) { return b._ts - a._ts || (a.complaint_id < b.complaint_id ? 1 : -1); }); }
  function renderTables() {
    var s = sorted();
    $('recentTable').innerHTML = s.length ? '<table>' + THEAD + '<tbody>' + s.slice(0, 15).map(rowHtml).join('') + '</tbody></table>' : '<p class="note">No complaints match the current filters.</p>';
    var per = 25, pages = Math.max(1, Math.ceil(s.length / per)); if (S.page > pages) S.page = pages;
    $('listTable').innerHTML = s.length ? '<table>' + THEAD + '<tbody>' + s.slice((S.page - 1) * per, S.page * per).map(rowHtml).join('') + '</tbody></table>' : '<p class="note">No complaints match the current filters.</p>';
    $('pager').innerHTML = '<span class="note">' + s.length + ' complaints · page ' + S.page + ' of ' + pages + '</span><button class="btn small" id="pgPrev"' + (S.page <= 1 ? ' disabled' : '') + '>‹ Previous</button><button class="btn small" id="pgNext"' + (S.page >= pages ? ' disabled' : '') + '>Next ›</button>';
    $('rpCount').textContent = s.length + ' complaints match the current filters and will be exported.';
  }

  /* ================= detail ================= */
  function kv(label, v) { return '<div><span>' + esc(label) + '</span>' + (v === null || v === undefined || v === '' ? '—' : v) + '</div>'; }
  function yn(v) { return v ? esc(v) : '—'; }
  function openDetail(id) {
    var c = S.all.filter(function (x) { return x.complaint_id === id; })[0]; if (!c) return;
    var sub = M.subById[c.subsidiary_id] || {}, h = '';
    h += '<div class="warnbox">' + (c.data_source === 'DEMO' ? '<b>DEMO RECORD</b> — synthetic data, not an official CIL complaint. ' : '') + 'Priority: ' + U.priorityPill(c.priority) + ' · Status: ' + U.statusPill(c) + '</div>';
    h += '<h3>Complaint Information</h3><div class="kv">' + kv('Complaint ID', esc(c.complaint_id)) + kv('Date', L.fmtDate(c.complaint_date) + ' ' + esc(c.complaint_time || '')) + kv('Customer', esc(c.consumer_name) + ' (' + esc(c.consumer_id || '—') + ')') +
      kv('Source', esc(c.source)) + kv('Reference no.', esc(c.reference_no)) + kv('Categories', esc((c.complaint_categories || []).join(', '))) + kv('Assigned to', esc(c.assigned_to)) + kv('Status date', L.fmtDate(c.status_date)) + '</div>';
    h += '<h3>Supply Information</h3><div class="kv">' + kv('Subsidiary', esc(sub.subsidiary_name || c.subsidiary_id)) + kv('Area', esc(c._area)) + kv('Mine', esc(c._mine)) + kv('Location', esc(c._loc)) + kv('Loading site', esc(c.loading_site)) +
      kv('Dispatch mode', esc(c.dispatch_mode)) + kv('Date of loading', L.fmtDate(c.date_of_loading)) + kv('Date of dispatch', L.fmtDate(c.date_of_dispatch)) + kv('Date of receipt', L.fmtDate(c.date_of_receipt)) +
      kv('Rake / truck no.', esc(c.vehicle_no)) + kv('RR / challan no.', esc(c.rr_challan_no)) + kv('Invoice no.', esc(c.invoice_no)) + kv('Declared grade', esc(c.declared_grade)) + kv('Claimed grade', esc(c.claimed_grade)) +
      kv('Tested grade', esc(c.tested_grade)) + kv('Quantity supplied', dash(c.quantity, 't')) + kv('Quantity complained', dash(c.quantity_complained, 't')) + '</div>';
    if (c._potentialSlip) h += '<p class="warnbox">⚠ <b>Potential Grade Slippage</b>: declared ' + esc(c.declared_grade) + ' vs ' + esc(c.tested_grade ? 'tested ' + c.tested_grade : 'claimed ' + c.claimed_grade) + ' (difference ' + (c._gradeDiff > 0 ? '+' : '') + c._gradeDiff + ' grade step(s)). This is a calculation only, not an authorised determination.</p>';
    h += '<h3>Quality Information</h3><div class="table-wrap"><table><thead><tr><th>Parameter</th><th>Declared / expected</th><th>Tested</th><th>Consumer reported</th></tr></thead><tbody>' +
      [['Ash', 'ash_declared', 'ash_tested', 'ash_reported', '%'], ['Moisture', 'moisture_declared', 'moisture_tested', 'moisture_reported', '%'], ['GCV', 'gcv_declared', 'gcv_tested', 'gcv_reported', 'kcal/kg'],
        ['Oversize >' + THR + ' mm', null, 'oversize_pct_tested', 'oversize_pct_est', '%'], ['Shale', null, 'shale_pct_tested', 'shale_pct_est', '%'], ['Sandstone', null, 'sandstone_pct_tested', 'sandstone_pct_est', '%']].map(function (r) {
        return '<tr><td>' + r[0] + '</td><td>' + (r[1] ? dash(c[r[1]], r[4]) : '—') + '</td><td>' + dash(c[r[2]], r[4]) + '</td><td>' + dash(c[r[3]], r[4]) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<p class="note">Ash difference (information only): ' + (c._ashDiff === null ? '—' : (c._ashDiff > 0 ? '+' : '') + c._ashDiff + ' percentage points') + '. No regulatory acceptance or rejection is calculated.</p>';
    h += '<div class="kv">' + kv('Declared size', esc(c.declared_size)) + kv('Observed size', esc(c.observed_size)) + kv('Observed max size', dash(c.observed_max_size_mm, 'mm')) + kv('>' + THR + ' mm present', yn(c.oversize_present)) + kv('Oversize pieces', dash(c.oversize_pieces)) +
      kv('Undersize / fines', dash(c.undersize_pct, '%')) + kv('Shale observed', yn(c.shale_observed)) + kv('Sandstone observed', yn(c.sandstone_observed)) +
      kv('Other extraneous material', esc(['stone', 'soil', 'metal', 'wood', 'other'].filter(function (k) { return c['ext_' + k]; }).join(', ') || '—') + (c.ext_pct_est ? ' (~' + c.ext_pct_est + '%)' : '')) + '</div>';
    h += '<h3>Investigation</h3><div class="kv">' + kv('Sample collected', yn(c.sample_collected)) + kv('Sample date', L.fmtDate(c.sample_date)) + kv('Laboratory', esc(c.laboratory)) + kv('Test result', esc(c.test_result)) + kv('Investigation remarks', esc(c.investigation_remarks)) + '</div>';
    h += '<h3>Resolution</h3><div class="kv">' + kv('Action taken', esc(c.action_taken)) + kv('Response', esc(c.response)) + kv('Resolution date', L.fmtDate(c.resolution_date)) + kv('Resolution time', c._resDays === null ? '—' : c._resDays + ' days') + kv('Closure remarks', esc(c.closure_remarks)) + '</div>';
    h += '<h3>Documents / Evidence</h3>' + ((c.attachments || []).length ? '<ul>' + c.attachments.map(function (a) { return '<li>' + esc(a.type) + ' — ' + esc(a.file_name) + (a.demo_only ? ' <span class="note">(demo placeholder, no file stored)</span>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="note">No documents recorded.</p>') +
      '<p class="note">Documents are confidential. They must never be public; the live version needs private storage with access control.</p>';
    h += '<p class="note">Data source: ' + esc(c.data_source) + ' · Created ' + esc(c.created_at) + ' · Updated ' + esc(c.updated_at) + '</p>';
    $('detailTitle').textContent = 'Complaint Details — ' + c.complaint_id; $('detailBody').innerHTML = h; $('detailBg').classList.add('open');
  }
  function closeDetail() { $('detailBg').classList.remove('open'); }

  /* ================= export ================= */
  function download(name, mime, text) {
    var a = document.createElement('a'), url = URL.createObjectURL(new Blob([text], { type: mime }));
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 500);
  }
  function fname(ext) { return 'coal-quality-complaints_' + L.today() + '_' + S.rows.length + 'rows.' + ext; }
  function exportCsv() { download(fname('csv'), 'text/csv;charset=utf-8', L.toCsv(sorted())); U.toast('CSV downloaded: ' + S.rows.length + ' complaints (current filters)'); }
  function exportXls() { download(fname('xls'), 'application/vnd.ms-excel', L.toXls(sorted())); U.toast('Excel file downloaded: ' + S.rows.length + ' complaints'); }
  function exportPdf() {
    var w = window.open('', '_blank'); if (!w) { U.toast('Pop-up blocked. Allow pop-ups, or use Print and choose "Save as PDF".'); return; }
    var s = sorted(), shown = s.slice(0, 300), fl = describeFilters();
    var rows = shown.map(function (c) { return '<tr><td>' + esc(c.complaint_id) + '</td><td>' + L.fmtDate(c.complaint_date) + '</td><td>' + esc(c._sub) + '</td><td>' + esc(c._area) + '</td><td>' + esc(c._mine) + '</td><td>' + esc(c.loading_site) + '</td><td>' + esc(c.declared_grade) + '</td><td>' + esc(c.complaint_categories.join(', ')) + '</td><td>' + esc(c.status) + '</td></tr>'; }).join('');
    var k = L.KPIS.map(function (x) { return esc(x.label) + ': <b>' + L.count(S.rows, x.test) + '</b>'; }).join(' &nbsp;|&nbsp; ');
    w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Coal Quality Complaint Report</title><style>body{font-family:Arial,sans-serif;font-size:12px;margin:16px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:3px 5px;text-align:left}th{background:#eee}.d{background:#fff4d6;border:1px solid #e2a93a;padding:6px;margin:8px 0}</style></head><body>' +
      '<h2>Coal Quality Complaint Report — Coal India Limited &amp; Subsidiaries</h2><div class="d"><b>DEMO DATA — NOT OFFICIAL CIL COMPLAINT STATISTICS.</b> Demo data is synthetic.</div>' +
      '<p>Generated: ' + L.fmtDateTime() + '<br>Filters: ' + (fl.length ? esc(fl.join(' · ')) : 'none') + '</p><p>' + k + '</p><p>' + s.length + ' complaints' + (s.length > shown.length ? ' (first ' + shown.length + ' shown; use CSV/Excel for all)' : '') + '</p>' +
      '<table><thead><tr><th>ID</th><th>Date</th><th>Subsidiary</th><th>Area</th><th>Mine</th><th>Site</th><th>Grade</th><th>Complaint</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></body></html>');
    w.document.close(); w.focus(); setTimeout(function () { w.print(); }, 400);
  }

  /* ================= live simulation / auto refresh ================= */
  function simulate() {
    I.submit(CQ.Demo.generateLivePayload()).then(function (res) {
      if (res.ok) U.toast('New simulated complaint: ' + res.id);
      else U.toast('Simulation failed: ' + res.errors.map(function (e) { return e.message; }).join(' '), 6000);
    });
  }
  function setAutoSim(on) {
    clearInterval(S.simTimer); S.simTimer = null;
    if (on) S.simTimer = setInterval(simulate, +$('simEvery').value * 1000);
    $('autoSimBtn').textContent = 'AUTO LIVE SIMULATION: ' + (on ? 'ON' : 'OFF'); $('autoSimBtn').classList.toggle('primary', on);
  }
  function setAuto(on) {
    S.auto = on; clearInterval(S.autoTimer); S.autoTimer = null;
    if (on) S.autoTimer = setInterval(function () { load(); }, (CQ.Settings.get('auto_refresh_sec') || 30) * 1000);
    $('autoRefreshBtn').textContent = on ? 'ON' : 'OFF'; $('autoRefreshBtn').classList.toggle('primary', on);
  }

  /* ================= routing ================= */
  function route() {
    var h = (location.hash || '#dashboard').replace('#', '').split('?')[0]; if (!VIEWS[h]) h = 'dashboard';
    S.view = h; $('viewTitle').textContent = VIEWS[h];
    var els = document.querySelectorAll('[data-views]'); for (var i = 0; i < els.length; i++) els[i].hidden = els[i].getAttribute('data-views').split(' ').indexOf(h) < 0;
    $('listTitle').textContent = h === 'search' ? 'Search Results' : h === 'reports' ? 'Complaints in this report' : 'Live Complaints';
    U.setActive(h);
    if (h === 'search') setTimeout(function () { $('bigSearch').focus(); }, 50);
    renderCharts();
  }

  /* ================= start ================= */
  function init() {
    U.mountShell('dashboard');
    S.f = defaultFilters();
    buildFilterOptions(); writeFilters();
    try { var pq = sessionStorage.getItem('cq_pending_q'); if (pq) { S.f.q = pq; sessionStorage.removeItem('cq_pending_q'); $('bigSearch').value = pq; $('globalSearch').value = pq; } } catch (e) {}
    $('applyBtn').onclick = applyFromUi;
    $('resetBtn').onclick = function () { S.f = defaultFilters(); $('f_range').value = ''; writeFilters(); refresh(); };
    $('f_fy').onchange = onFyChange; $('f_range').onchange = onRange;
    $('f_from').onchange = $('f_to').onchange = function () { $('f_fy').value = ''; };
    $('f_sub').onchange = function () { $('f_area').value = ''; $('f_mine').value = ''; $('f_loc').value = ''; fillHierarchy(); };
    $('f_area').onchange = function () { var a = M.areaById[$('f_area').value]; if (a) $('f_sub').value = a.subsidiary_id; $('f_mine').value = ''; $('f_loc').value = ''; fillHierarchy(); };
    $('f_mine').onchange = function () { var m = M.mineById[$('f_mine').value]; if (m) { $('f_sub').value = m.subsidiary_id; fillHierarchy(); $('f_area').value = m.area_id; } $('f_loc').value = ''; fillHierarchy(); };
    $('f_loc').onchange = function () { var l = M.locById[$('f_loc').value]; if (l) { $('f_sub').value = l.subsidiary_id; fillHierarchy(); $('f_area').value = l.area_id; fillHierarchy(); $('f_mine').value = l.mine_id; fillHierarchy(); $('f_loc').value = l.location_id; } };
    document.querySelectorAll('.filters select, .filters input').forEach(function (e) { e.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') applyFromUi(); }); });
    ['areaTop', 'mineTop', 'trendGran', 'resGran', 'scatterBy', 'qParam'].forEach(function (id) { $(id).onchange = function () { renderCharts(); }; });
    var qt = null, onQ = function (v) { clearTimeout(qt); qt = setTimeout(function () { S.f.q = v; S.page = 1; $('bigSearch').value = v; $('globalSearch').value = v; refresh(); }, 250); };
    $('globalSearch').oninput = function () { onQ(this.value); if (S.view !== 'search' && this.value) { /* stay on the current view */ } };
    $('bigSearch').oninput = function () { onQ(this.value); };
    document.addEventListener('click', function (e) {
      var tr = e.target.closest && e.target.closest('tr.click'); if (tr) openDetail(tr.getAttribute('data-id'));
      if (e.target.id === 'pgPrev') { S.page--; renderTables(); } if (e.target.id === 'pgNext') { S.page++; renderTables(); }
      if (e.target.id === 'detailBg') closeDetail();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDetail(); if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('click')) openDetail(e.target.getAttribute('data-id')); });
    $('detailClose').onclick = closeDetail;
    $('exCsv').onclick = $('rpCsv').onclick = exportCsv; $('exXls').onclick = $('rpXls').onclick = exportXls; $('exPdf').onclick = $('rpPdf').onclick = exportPdf;
    $('exPrint').onclick = $('rpPrint').onclick = function () { window.print(); };
    $('refreshBtn').onclick = function () { load().then(function () { U.toast('Refreshed'); }); };
    $('autoRefreshBtn').onclick = function () { setAuto(!S.auto); };
    $('simBtn').onclick = simulate; $('autoSimBtn').onclick = function () { setAutoSim(!S.simTimer); };
    $('simEvery').onchange = function () { if (S.simTimer) setAutoSim(true); };
    $('dataMode').onchange = function () { if (!D.setMode(this.value)) { U.toast('Coming in Live Integration'); this.value = 'demo'; } };
    window.addEventListener('hashchange', route);
    document.addEventListener('cq:theme', function () { refresh(); });
    D.current.subscribe(function () { load(); });
    if (window.innerWidth < 900) $('filtersCard').open = false;
    setAuto(true); route(); load();
  }
  try { init(); } catch (e) { document.getElementById('page').insertAdjacentHTML('afterbegin', U.errorHtml('The dashboard could not start.', e)); throw e; }
})();
