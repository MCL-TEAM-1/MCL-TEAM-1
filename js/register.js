/* PRESENTATION LAYER - entry page. The form is built from the list below, then sent through CQ.Integration.submit(). */
(function () {
  'use strict';
  var CQ = window.CQ, M = CQ.Master, L = CQ.Logic, U = CQ.UI, I = CQ.Integration, esc = U.esc;
  function $(id) { return document.getElementById(id); }
  var THR = CQ.Settings.get('oversize_threshold_mm') || 100;
  var YN = ['Yes', 'No'];
  function plain(a) { return a; }

  var SECTIONS = [
    { title: 'A. Complaint Identification', open: true, fields: [
      { id: 'complaint_id', label: 'Complaint ID', type: 'ro', hint: 'Made automatically when you save.' },
      { id: 'complaint_date', label: 'Complaint Date', type: 'date', req: 1 }, { id: 'complaint_time', label: 'Complaint Time', type: 'time' },
      { id: 'consumer_name', label: 'Consumer / Customer Name', type: 'text', req: 1, hint: 'Use a made-up name, e.g. Demo Power Plant 1' },
      { id: 'consumer_id', label: 'Consumer / Customer ID', type: 'text' }, { id: 'contact', label: 'Contact Details', type: 'text', hint: 'Demo only: do not enter real phone numbers.' },
      { id: 'source', label: 'Source of Complaint', type: 'select', req: 1, opts: M.sources }, { id: 'reference_no', label: 'Complaint Reference Number', type: 'text' } ] },
    { title: 'B. Coal Supply Details', open: true, fields: [
      { id: 'subsidiary_id', label: 'Subsidiary', type: 'select', req: 1 }, { id: 'area_id', label: 'Area', type: 'select', req: 1 },
      { id: 'mine_id', label: 'Mine', type: 'select', req: 1 }, { id: 'location_id', label: 'Location / Loading Point', type: 'select', req: 1 },
      { id: 'loading_site', label: 'Site of Loading', type: 'radio', req: 1, opts: M.loadingSites, full: 1 },
      { id: 'date_of_loading', label: 'Date of Loading', type: 'date' }, { id: 'date_of_dispatch', label: 'Date of Dispatch', type: 'date' }, { id: 'date_of_receipt', label: 'Date of Receipt', type: 'date' },
      { id: 'dispatch_mode', label: 'Dispatch Mode (Rail / Road)', type: 'select', opts: M.dispatchModes }, { id: 'vehicle_no', label: 'Rake / Truck Number', type: 'text' },
      { id: 'rr_challan_no', label: 'RR / Challan Number', type: 'text' }, { id: 'invoice_no', label: 'Invoice Number', type: 'text' },
      { id: 'coal_size', label: 'Coal Size', type: 'text', hint: 'e.g. 0-100 mm' }, { id: 'quantity', label: 'Quantity Supplied', type: 'num', unit: 't' },
      { id: 'quantity_complained', label: 'Quantity Complained Against', type: 'num', unit: 't' } ] },
    { title: 'C. Coal Grade', open: true, fields: [
      { id: 'declared_grade', label: 'Declared Grade', type: 'select', req: 1, hint: 'From the configurable grade master' },
      { id: 'claimed_grade', label: 'Grade Received / Consumer Claimed Grade', type: 'select' }, { id: 'tested_grade', label: 'Tested Grade (if tested)', type: 'select' } ] },
    { title: 'D. Primary Complaint Category (choose one or more)', open: true, fields: [{ id: 'complaint_categories', label: 'Complaint categories', type: 'cats', req: 1, full: 1 }] },
    { title: 'E. Quality Parameters', open: false, fields: [
      { type: 'sub', label: 'Ash' }, { id: 'ash_declared', label: 'Declared / Expected Ash', type: 'num', unit: '%' }, { id: 'ash_tested', label: 'Tested Ash', type: 'num', unit: '%' },
      { id: 'ash_reported', label: 'Consumer Reported Ash', type: 'num', unit: '%' }, { id: 'ash_diff', label: 'Ash Difference (information only)', type: 'calc', unit: '% points' },
      { type: 'sub', label: 'Moisture' }, { id: 'moisture_declared', label: 'Declared / Expected Moisture', type: 'num', unit: '%' }, { id: 'moisture_tested', label: 'Tested Moisture', type: 'num', unit: '%' },
      { id: 'moisture_reported', label: 'Consumer Reported Moisture', type: 'num', unit: '%' }, { id: 'moisture_diff', label: 'Moisture Difference (information only)', type: 'calc', unit: '% points' },
      { type: 'sub', label: 'GCV' }, { id: 'gcv_declared', label: 'Declared / Expected GCV', type: 'num', unit: 'kcal/kg' }, { id: 'gcv_tested', label: 'Tested GCV', type: 'num', unit: 'kcal/kg' },
      { id: 'gcv_reported', label: 'Consumer Reported GCV', type: 'num', unit: 'kcal/kg' }, { id: 'gcv_diff', label: 'GCV Difference (information only)', type: 'calc', unit: 'kcal/kg' },
      { type: 'sub', label: 'Size' }, { id: 'declared_size', label: 'Declared Size', type: 'text', hint: 'e.g. 0-100 mm' }, { id: 'observed_size', label: 'Observed Size', type: 'text' },
      { id: 'undersize_pct', label: 'Undersize / Fines', type: 'num', unit: '%' },
      { type: 'note', label: 'Oversize, shale, sandstone and other extraneous material are recorded in sections G and H below. The tool does not decide acceptance or rejection: no official tolerance is configured.' } ] },
    { title: 'F. Grade Slippage Analysis (calculated)', open: false, fields: [{ id: 'slippage', type: 'slip', full: 1 }] },
    { title: 'G. Shale / Sandstone / Other Extraneous Material', open: false, fields: [
      { type: 'sub', label: 'Shale' }, { id: 'shale_complaint', label: 'Shale Complaint', type: 'select', opts: YN }, { id: 'shale_observed', label: 'Shale Observed', type: 'select', opts: YN },
      { id: 'shale_pct_est', label: 'Estimated Shale', type: 'num', unit: '%' }, { id: 'shale_pct_tested', label: 'Tested Shale', type: 'num', unit: '%' },
      { id: 'shale_qty', label: 'Shale Quantity', type: 'num', unit: 't' }, { id: 'shale_remarks', label: 'Remarks', type: 'text' },
      { type: 'sub', label: 'Sandstone' }, { id: 'sandstone_complaint', label: 'Sandstone Complaint', type: 'select', opts: YN }, { id: 'sandstone_observed', label: 'Sandstone Observed', type: 'select', opts: YN },
      { id: 'sandstone_pct_est', label: 'Estimated Sandstone', type: 'num', unit: '%' }, { id: 'sandstone_pct_tested', label: 'Tested Sandstone', type: 'num', unit: '%' },
      { id: 'sandstone_qty', label: 'Sandstone Quantity', type: 'num', unit: 't' }, { id: 'sandstone_remarks', label: 'Remarks', type: 'text' },
      { type: 'sub', label: 'Other Extraneous Material' }, { id: 'ext', label: 'Material found', type: 'ext', full: 1 },
      { id: 'ext_other_desc', label: 'If "Other", describe', type: 'text' }, { id: 'ext_pct_est', label: 'Estimated % / quantity', type: 'num', unit: '%' }, { id: 'ext_remarks', label: 'Remarks', type: 'text', full: 1 } ] },
    { title: 'H. Coal Size Complaint — Oversize Coal (>' + THR + ' mm)', open: false, fields: [
      { id: 'declared_max_size_mm', label: 'Declared Maximum Size', type: 'num', unit: 'mm' }, { id: 'observed_max_size_mm', label: 'Observed Maximum Size', type: 'num', unit: 'mm' },
      { id: 'oversize_present', label: '>' + THR + ' mm Coal Present', type: 'select', opts: YN }, { id: 'oversize_pct_est', label: 'Estimated >' + THR + ' mm', type: 'num', unit: '%' },
      { id: 'oversize_pct_tested', label: 'Tested >' + THR + ' mm', type: 'num', unit: '%' }, { id: 'oversize_pieces', label: 'Number of Oversize Pieces', type: 'num', unit: 'pieces' },
      { id: 'oversize_remarks', label: 'Remarks', type: 'text', full: 1 } ] },
    { title: 'I. Status and Priority', open: true, fields: [
      { id: 'status', label: 'Complaint Status', type: 'select', req: 1, opts: M.complaint_status_master.map(function (s) { return s.status_name; }) },
      { id: 'status_date', label: 'Status Date', type: 'date' }, { id: 'assigned_to', label: 'Assigned Officer / Department', type: 'text', hint: 'Department name only, e.g. MCL Quality Cell' },
      { id: 'priority', label: 'Priority (set by you)', type: 'select', req: 1, opts: M.priorities },
      { id: 'resolution_date', label: 'Resolution Date', type: 'date', hint: 'Required if status is Resolved or Closed' }, { id: 'closure_remarks', label: 'Closure Remarks', type: 'text', full: 1 } ] },
    { title: 'J. Investigation and Resolution (optional)', open: false, fields: [
      { id: 'sample_collected', label: 'Sample Collected', type: 'select', opts: YN }, { id: 'sample_date', label: 'Sample Date', type: 'date' }, { id: 'laboratory', label: 'Laboratory', type: 'text' },
      { id: 'test_result', label: 'Test Result', type: 'text', full: 1 }, { id: 'investigation_remarks', label: 'Investigation Remarks', type: 'text', full: 1 },
      { id: 'action_taken', label: 'Action Taken', type: 'text', full: 1 }, { id: 'response', label: 'Response to Consumer', type: 'text', full: 1 } ] },
    { title: 'K. Documents / Evidence (optional)', open: false, fields: [{ id: 'attach', type: 'attach', full: 1 }] }
  ];
  var ALL = []; SECTIONS.forEach(function (s) { s.fields.forEach(function (f) { if (f.id) ALL.push(f); }); });

  function optsFor(f) {
    var o = f.opts;
    if (f.id === 'subsidiary_id') return M.complaintSubsidiaries().map(function (s) { return [s.subsidiary_id, s.subsidiary_code + ' - ' + s.subsidiary_name]; });
    if (f.id === 'area_id') return M.areasOf($('f_subsidiary_id') ? $('f_subsidiary_id').value : '').map(function (a) { return [a.area_id, a.area_name]; });
    if (f.id === 'mine_id') return []; if (f.id === 'location_id') return [];
    if (f.id === 'declared_grade' || f.id === 'claimed_grade' || f.id === 'tested_grade') return M.coal_grade_master.map(function (g) { return [g.grade_code, g.grade_code]; });
    return (o || []).map(function (x) { return [x, x]; });
  }
  function field(f) {
    var cls = f.full ? ' class="full"' : '', lab = esc(f.label || '') + (f.unit ? ' (' + esc(f.unit) + ')' : '') + (f.req ? ' <span class="req" aria-label="required">*</span>' : '');
    var id = 'f_' + f.id, hint = f.hint ? '<div class="fhint">' + esc(f.hint) + '</div>' : '';
    if (f.type === 'sub') return '<div class="sub-h">' + esc(f.label) + '</div>';
    if (f.type === 'note') return '<div class="full note">' + esc(f.label) + '</div>';
    if (f.type === 'select') return '<div' + cls + '><label for="' + id + '">' + lab + '</label><select id="' + id + '"><option value="">Select…</option>' + optsFor(f).map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join('') + '</select>' + hint + '</div>';
    if (f.type === 'radio') return '<div' + cls + ' id="' + id + '"><label>' + lab + '</label><div class="checks">' + f.opts.map(function (o, i) { return '<label><input type="radio" name="' + id + '" value="' + esc(o) + '"> ' + esc(o) + '</label>'; }).join('') + '</div></div>';
    if (f.type === 'cats') return '<div' + cls + ' id="' + id + '"><label>' + lab + '</label><div class="checks">' + M.complaint_category_master.map(function (c) { return '<label><input type="checkbox" name="cat" value="' + esc(c.category_name) + '"> ' + esc(c.category_name.replace('More than 100 mm', 'More than ' + THR + ' mm').replace('Oversize Coal', 'Oversize Coal (>' + THR + ' mm)')) + '</label>'; }).join('') + '</div></div>';
    if (f.type === 'ext') return '<div' + cls + '><label>' + lab + '</label><div class="checks">' + ['stone', 'soil', 'metal', 'wood', 'other'].map(function (k) { return '<label><input type="checkbox" id="f_ext_' + k + '"> ' + k.charAt(0).toUpperCase() + k.slice(1) + '</label>'; }).join('') + '</div></div>';
    if (f.type === 'slip') return '<div' + cls + ' id="slipBox"></div>';
    if (f.type === 'attach') return '<div' + cls + '><div class="warnbox">Documents are confidential. In demo mode only the <b>file name</b> is recorded; the file itself is not uploaded or shared. The live version needs private storage with access control.</div><div class="fields" style="padding:10px 0 0">' + M.attachmentTypes.map(function (t, i) { return '<div><label for="att' + i + '">' + esc(t) + '</label><input type="file" id="att' + i + '" data-type="' + esc(t) + '"></div>'; }).join('') + '</div></div>';
    var type = f.type === 'num' ? 'number' : f.type === 'ro' || f.type === 'calc' ? 'text' : f.type;
    var extra = f.type === 'num' ? ' step="any" inputmode="decimal"' : f.type === 'ro' || f.type === 'calc' ? ' readonly' : '';
    return '<div' + cls + '><label for="' + id + '">' + lab + '</label><input type="' + type + '" id="' + id + '"' + extra + '>' + hint + '</div>';
  }

  function build() {
    $('complaintForm').innerHTML = SECTIONS.map(function (s) {
      return '<details class="form-sec"' + (s.open ? ' open' : '') + '><summary>' + esc(s.title) + '</summary><div class="fields">' + s.fields.map(field).join('') + '</div></details>';
    }).join('') + '<div class="sticky-submit"><button type="submit" class="btn primary" id="saveBtn">Save Complaint</button><button type="button" class="btn" id="clearBtn">Clear Form</button><a class="btn" href="dashboard.html">Open Dashboard →</a></div>';
  }
  function fillDeps() {
    var sub = $('f_subsidiary_id').value, area = $('f_area_id').value, mine = $('f_mine_id').value;
    function fill(id, label, items, keep) {
      var el = $(id); el.innerHTML = '<option value="">' + label + '</option>' + items.map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join('');
      el.value = items.some(function (o) { return o[0] === keep; }) ? keep : '';
    }
    fill('f_area_id', sub ? 'Select area…' : 'Select subsidiary first…', sub ? M.areasOf(sub).map(function (a) { return [a.area_id, a.area_name]; }) : [], area);
    area = $('f_area_id').value;
    fill('f_mine_id', area ? 'Select mine…' : 'Select area first…', area ? M.minesOf(area).map(function (m) { return [m.mine_id, m.mine_name]; }) : [], mine);
    mine = $('f_mine_id').value;
    fill('f_location_id', mine ? 'Select location…' : 'Select mine first…', mine ? M.locationsOf(mine).map(function (l) { return [l.location_id, l.location_name + ' (' + l.loading_type + ')']; }) : [], $('f_location_id').value);
  }
  function v(id) { var e = $('f_' + id); return e ? e.value : ''; }
  function n(id) { var x = v(id); return x === '' ? null : Number(x); }
  function diff(pre) {
    var d = n(pre + '_declared'), a = n(pre + '_tested'); if (a === null) a = n(pre + '_reported');
    $('f_' + pre + '_diff').value = d !== null && a !== null ? (Math.round((a - d) * 10) / 10 > 0 ? '+' : '') + Math.round((a - d) * 10) / 10 : '';
  }
  function slip() {
    var d = v('declared_grade'), c = v('claimed_grade'), t = v('tested_grade'), di = M.gradeIndex(d), oi = M.gradeIndex(t || c);
    var flag = di !== null && oi !== null && di !== oi;
    $('slipBox').innerHTML = '<div class="kv"><div><span>Declared Grade</span>' + (d || '—') + '</div><div><span>Consumer Claimed Grade</span>' + (c || '—') + '</div><div><span>Tested Grade</span>' + (t || '—') + '</div>' +
      '<div><span>Declared GCV / Tested GCV</span>' + (v('gcv_declared') || '—') + ' / ' + (v('gcv_tested') || '—') + ' kcal/kg</div><div><span>Declared Ash / Tested Ash</span>' + (v('ash_declared') || '—') + ' / ' + (v('ash_tested') || '—') + ' %</div>' +
      '<div><span>Grade Difference (steps)</span>' + (di !== null && oi !== null ? (oi - di > 0 ? '+' : '') + (oi - di) : '—') + '</div><div><span>Grade Slippage Flag</span>' + (flag ? '<b>⚠ Potential Grade Slippage</b>' : 'No grade difference') + '</div></div>' +
      '<p class="note">This is a calculation only. A complaint is not valid or invalid because of these numbers; an authorised determination must be recorded separately.</p>';
  }

  function collect() {
    var p = {};
    ALL.forEach(function (f) {
      if (['ro', 'calc', 'slip', 'attach', 'ext', 'cats', 'radio'].indexOf(f.type) >= 0) return;
      var x = v(f.id); p[f.id] = x === '' ? (f.type === 'num' ? null : '') : (f.type === 'num' ? Number(x) : x);
    });
    delete p.complaint_id;
    var site = document.querySelector('input[name="f_loading_site"]:checked'); p.loading_site = site ? site.value : '';
    p.complaint_categories = Array.prototype.map.call(document.querySelectorAll('input[name="cat"]:checked'), function (e) { return e.value; });
    ['stone', 'soil', 'metal', 'wood', 'other'].forEach(function (k) { p['ext_' + k] = $('f_ext_' + k).checked; });
    p.attachments = []; Array.prototype.forEach.call(document.querySelectorAll('input[type=file]'), function (e) { if (e.files && e.files[0]) p.attachments.push({ type: e.getAttribute('data-type'), file_name: e.files[0].name, size: e.files[0].size, demo_only: true }); });
    return p;
  }
  function showNextId() {
    var a = CQ.Data.current; Promise.resolve(a.load()).then(function (rows) { $('f_complaint_id').value = 'Next: ' + I.nextId(rows) + ' (auto)'; }).catch(function (e) { $('f_complaint_id').value = 'Auto-generated on save'; });
  }
  function reset() {
    $('complaintForm').reset(); fillDeps();
    $('f_complaint_date').value = L.today(); $('f_complaint_time').value = L.nowTime(); $('f_status_date').value = L.today();
    $('f_status').value = 'New'; $('f_priority').value = 'Normal'; ['ash', 'moisture', 'gcv'].forEach(diff); slip(); showNextId();
  }
  var FIELD_ALIAS = { subsidiary: 'subsidiary_id', area: 'area_id', mine: 'mine_id', location: 'location_id' };
  function onSubmit(e) {
    e.preventDefault();
    Array.prototype.forEach.call(document.querySelectorAll('.invalid'), function (x) { x.classList.remove('invalid'); });
    $('saveBtn').disabled = true;
    I.submit(collect()).then(function (res) {
      $('saveBtn').disabled = false; var box = $('formMsg');
      if (res.ok) {
        box.innerHTML = '<div class="okbox"><b>Saved.</b> Complaint ID <b>' + esc(res.id) + '</b> was registered (' + esc(CQ.Data.current.info.label) + '). <a href="dashboard.html#live">See it on the dashboard →</a></div>';
        reset();
      } else {
        box.innerHTML = '<div class="err"><b>Please fix these before saving:</b><ul style="margin:6px 0 0 18px">' + res.errors.map(function (x) { return '<li>' + esc(x.message) + '</li>'; }).join('') + '</ul></div>';
        res.errors.forEach(function (x) { var el = $('f_' + (FIELD_ALIAS[x.field] || x.field)) || $('f_' + x.field); if (el) { el.classList.add('invalid'); var d = el.closest('details'); if (d) d.open = true; } });
      }
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function init() {
    U.mountShell('register'); build(); fillDeps();
    var f = $('complaintForm');
    f.addEventListener('submit', onSubmit);
    $('clearBtn').onclick = function () { reset(); $('formMsg').innerHTML = ''; };
    $('f_subsidiary_id').onchange = fillDeps; $('f_area_id').onchange = fillDeps; $('f_mine_id').onchange = fillDeps;
    $('f_location_id').onchange = function () { var l = M.locById[this.value]; if (l && M.loadingSites.indexOf(l.loading_type) >= 0) { var r = document.querySelector('input[name="f_loading_site"][value="' + l.loading_type + '"]'); if (r) r.checked = true; } };
    f.addEventListener('input', function () { ['ash', 'moisture', 'gcv'].forEach(diff); slip(); });
    f.addEventListener('change', slip);
    reset();
  }
  try { init(); } catch (e) { document.getElementById('page').insertAdjacentHTML('afterbegin', U.errorHtml('The form could not start.', e)); throw e; }
})();
