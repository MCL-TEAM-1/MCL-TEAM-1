/* PRESENTATION LAYER - admin page: master-data viewer, integration notes, settings. */
(function () {
  'use strict';
  var CQ = window.CQ, M = CQ.Master, L = CQ.Logic, U = CQ.UI, I = CQ.Integration, esc = U.esc;
  function $(id) { return document.getElementById(id); }
  var TABLES = [
    ['subsidiary_master', 'subsidiary_master (Subsidiary)', ['subsidiary_id', 'subsidiary_name', 'subsidiary_code', 'state_region', 'active_status', 'level']],
    ['area_master', 'area_master (Area)', ['area_id', 'subsidiary_id', 'area_name', 'area_code', 'state', 'district', 'active_status']],
    ['mine_master', 'mine_master (Mine)', ['mine_id', 'subsidiary_id', 'area_id', 'mine_name', 'mine_code', 'mine_type', 'district', 'state', 'active_status']],
    ['loading_location_master', 'loading_location_master (Location / loading point)', ['location_id', 'subsidiary_id', 'area_id', 'mine_id', 'location_name', 'location_code', 'loading_type', 'district', 'state', 'active_status']],
    ['coal_grade_master', 'coal_grade_master (Grade)', ['grade_id', 'grade_code', 'grade_name', 'grade_category', 'applicable_period', 'active_status']],
    ['complaint_category_master', 'complaint_category_master (Category)', ['category_id', 'category_name', 'category_group', 'active_status']],
    ['complaint_status_master', 'complaint_status_master (Status)', ['status_id', 'status_name', 'display_group', 'phase', 'is_final', 'sort_order']],
    ['quality_parameter_master', 'quality_parameter_master (Quality parameter)', ['param_id', 'name', 'unit', 'tolerance_configured']]
  ];
  function tab() {
    var h = (location.hash || '#master').replace('#', ''); if (['master', 'import', 'settings'].indexOf(h) < 0) h = 'master';
    document.querySelectorAll('section[data-tab]').forEach(function (s) { s.hidden = s.getAttribute('data-tab') !== h; });
    document.querySelectorAll('a[data-tab]').forEach(function (a) { a.classList.toggle('primary', a.getAttribute('data-tab') === h); });
    $('adminTitle').textContent = { master: 'Master Data', import: 'Data Import', settings: 'Settings' }[h]; U.setActive(h);
  }
  function renderMaster() {
    var def = TABLES.filter(function (t) { return t[0] === $('mtSel').value; })[0], sub = $('mtSub').value;
    var rows = M[def[0]].filter(function (r) { return !sub || !r.subsidiary_id || r.subsidiary_id === sub; });
    $('mtCount').textContent = rows.length + ' rows' + (M.IS_DEMO_MASTER && ['area_master', 'mine_master', 'loading_location_master', 'coal_grade_master'].indexOf(def[0]) >= 0 ? ' (DEMO placeholders, not official)' : '');
    $('mtTable').innerHTML = '<table><thead><tr>' + def[2].map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.slice(0, 500).map(function (r) { return '<tr>' + def[2].map(function (c) { return '<td>' + esc(r[c]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }
  function init() {
    U.mountShell('master');
    $('mtSel').innerHTML = TABLES.map(function (t) { return '<option value="' + t[0] + '">' + t[1] + '</option>'; }).join('');
    $('mtSub').innerHTML = '<option value="">All</option>' + M.complaintSubsidiaries().map(function (s) { return '<option value="' + s.subsidiary_id + '">' + s.subsidiary_code + '</option>'; }).join('');
    $('mtSel').onchange = $('mtSub').onchange = renderMaster; renderMaster();
    $('connRows').innerHTML = I.connectors.map(function (c) { return '<tr><td><b>' + esc(c.label) + '</b></td><td>' + esc(c.detail) + '</td><td><span class="pill st-other">' + esc(c.status) + '</span></td></tr>'; }).join('');
    function ex() { $('apiBody').value = JSON.stringify(I.examplePayload, null, 2); }
    ex(); $('apiReset').onclick = ex;
    $('apiSend').onclick = function () {
      var body; try { body = JSON.parse($('apiBody').value); } catch (e) { $('apiOut').innerHTML = U.errorHtml('That is not valid JSON.', e); return; }
      I.submit(body).then(function (r) {
        $('apiOut').innerHTML = r.ok ? '<div class="okbox"><b>201 Created</b> — Complaint ID ' + esc(r.id) + ' saved in demo mode. <a href="dashboard.html#live">Open Live Complaints →</a></div>'
          : '<div class="err"><b>400 Rejected</b><ul style="margin:6px 0 0 18px">' + r.errors.map(function (x) { return '<li>' + esc(x.message) + '</li>'; }).join('') + '</ul></div>';
      });
    };
    $('csvTpl').onclick = function () {
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([L.toCsv([])], { type: 'text/csv' })); a.download = 'complaint-template.csv'; a.click();
    };
    $('setTheme').value = CQ.Settings.get('theme') || ''; $('setThr').value = CQ.Settings.get('oversize_threshold_mm'); $('setRefresh').value = CQ.Settings.get('auto_refresh_sec');
    $('setSave').onclick = function () {
      var th = parseInt($('setThr').value, 10), rf = parseInt($('setRefresh').value, 10);
      if (!(th > 0) || !(rf >= 5)) { U.toast('Threshold must be above 0 and refresh at least 5 seconds.'); return; }
      CQ.Settings.set('theme', $('setTheme').value); U.applyTheme($('setTheme').value); CQ.Settings.set('oversize_threshold_mm', th); CQ.Settings.set('auto_refresh_sec', rf); U.toast('Settings saved');
    };
    function cnt() { $('myCount').textContent = 'Complaints you added in this browser: ' + CQ.Data.adapters.demo.myCount(); }
    cnt(); $('clearMine').onclick = function () { CQ.Data.adapters.demo.clearMine(); cnt(); U.toast('Removed'); };
    window.addEventListener('hashchange', tab); tab();
  }
  try { init(); } catch (e) { document.getElementById('page').insertAdjacentHTML('afterbegin', U.errorHtml('The page could not start.', e)); throw e; }
})();
