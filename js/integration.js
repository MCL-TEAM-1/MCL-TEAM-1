/* INTEGRATION LAYER
   This is the single "front door" for new complaints, whatever their origin:
   the entry form, the demo simulator, a pasted JSON test, and later POST /api/complaints, webhooks or CSV.
   Steps: normalise -> validate -> make Complaint ID -> save through the Data Layer -> subscribers refresh.
   In the live release the same steps must run on a SERVER (the browser can be bypassed), then save to the database. */
(function () {
  'use strict';
  var CQ = (window.CQ = window.CQ || {});
  var M = CQ.Master, L = CQ.Logic;
  var I = (CQ.Integration = {});

  I.connectors = [
    { id: 'api', label: 'External API', detail: 'POST /api/complaints with JSON', status: 'Coming in Live Integration' },
    { id: 'webhook', label: 'Webhook', detail: 'ERP / CRM / portal pushes a complaint when it is created', status: 'Coming in Live Integration' },
    { id: 'database', label: 'Database', detail: 'Supabase table "complaints" + real-time channel', status: 'Coming in Live Integration' },
    { id: 'csv', label: 'CSV / Excel upload', detail: 'Bulk upload with the same validation', status: 'Coming in Live Integration' }
  ];
  I.examplePayload = {
    complaint_date: L.today(), complaint_time: '10:30', consumer_name: 'Demo Power Plant 1', source: 'External API',
    subsidiary: 'MCL', area: 'MCL Demo Area 1', mine: 'MCL Demo Mine 1.1', location: 'MCL Demo Mine 1.1 - Siding 1',
    loading_site: 'Siding', declared_grade: 'G9', claimed_grade: 'G11',
    complaint_categories: ['Grade Slippage', 'Excess Ash'], ash_declared: 28.5, ash_reported: 34.2, moisture_reported: 9.5, gcv_reported: 4200,
    status: 'New', priority: 'Normal'
  };

  /* Accept names, codes or ids for subsidiary / area / mine / location and return an internal complaint object. */
  I.normalize = function (p) {
    var errs = [], c = {}, k;
    for (k in p) if (Object.prototype.hasOwnProperty.call(p, k)) c[k] = p[k];
    var sub = M.resolve(M.subsidiary_master, 'subsidiary_id', 'subsidiary_code', 'subsidiary_name', c.subsidiary_id || c.subsidiary, function (r) { return r.level === 'Subsidiary'; });
    if (c.subsidiary_id || c.subsidiary) { if (!sub) errs.push({ field: 'subsidiary', message: 'Unknown subsidiary: ' + (c.subsidiary_id || c.subsidiary) }); else c.subsidiary_id = sub.subsidiary_id; }
    var area = M.resolve(M.area_master, 'area_id', 'area_code', 'area_name', c.area_id || c.area, function (r) { return !sub || r.subsidiary_id === sub.subsidiary_id; });
    if (c.area_id || c.area) { if (!area) errs.push({ field: 'area', message: 'Area "' + (c.area_id || c.area) + '" not found for this subsidiary.' }); else c.area_id = area.area_id; }
    var mine = M.resolve(M.mine_master, 'mine_id', 'mine_code', 'mine_name', c.mine_id || c.mine, function (r) { return !area || r.area_id === area.area_id; });
    if (c.mine_id || c.mine) { if (!mine) errs.push({ field: 'mine', message: 'Mine "' + (c.mine_id || c.mine) + '" not found for this area.' }); else c.mine_id = mine.mine_id; }
    var loc = M.resolve(M.loading_location_master, 'location_id', 'location_code', 'location_name', c.location_id || c.location, function (r) { return !mine || r.mine_id === mine.mine_id; });
    if (c.location_id || c.location) { if (!loc) errs.push({ field: 'location', message: 'Location "' + (c.location_id || c.location) + '" not found for this mine.' }); else c.location_id = loc.location_id; }
    ['subsidiary', 'area', 'mine', 'location'].forEach(function (x) { delete c[x]; });
    /* blank text -> null for numbers, numbers typed as text -> numbers */
    L.NUM_FIELDS.forEach(function (f) { if (c[f] === '' || c[f] === undefined) c[f] = null; else if (c[f] !== null && !isNaN(c[f])) c[f] = Number(c[f]); });
    if (typeof c.complaint_categories === 'string') c.complaint_categories = c.complaint_categories.split(/[;,]/).map(function (s) { return s.trim(); }).filter(Boolean);
    /* common aliases used by outside systems */
    if (c.ash !== undefined && c.ash_reported === undefined) { c.ash_reported = c.ash; delete c.ash; }
    if (c.moisture !== undefined && c.moisture_reported === undefined) { c.moisture_reported = c.moisture; delete c.moisture; }
    if (c.gcv !== undefined && c.gcv_reported === undefined) { c.gcv_reported = c.gcv; delete c.gcv; }
    if (c.oversize_percentage !== undefined && c.oversize_pct_est === undefined) { c.oversize_pct_est = c.oversize_percentage; delete c.oversize_percentage; }
    if (c.shale_percentage !== undefined && c.shale_pct_est === undefined) { c.shale_pct_est = c.shale_percentage; delete c.shale_percentage; }
    if (c.sandstone_percentage !== undefined && c.sandstone_pct_est === undefined) { c.sandstone_pct_est = c.sandstone_percentage; delete c.sandstone_percentage; }
    if (c.quantity === undefined && c.quantity_supplied !== undefined) { c.quantity = c.quantity_supplied; }
    c.complaint_time = c.complaint_time || L.nowTime();
    c.status = c.status || 'New'; c.priority = c.priority || 'Normal';
    c.status_date = c.status_date || c.complaint_date;
    c.complaint_categories = c.complaint_categories || [];
    c.attachments = c.attachments || [];
    return { complaint: c, errors: errs };
  };

  I.nextId = function (rows) {
    var max = 0; rows.forEach(function (c) { var n = parseInt(String(c.complaint_id).replace(/\D/g, '').slice(-6), 10); if (!isNaN(n) && n > max) max = n; });
    return CQ.Demo.idFor(max + 1);
  };

  /* Returns Promise -> {ok:true, id, complaint} or {ok:false, errors:[{field,message}]} (never rejects for bad data) */
  I.submit = function (payload) {
    var adapter = CQ.Data.current;
    return Promise.resolve(adapter.cache && adapter.cache.length ? adapter.cache : adapter.load()).then(function (rows) {
      if (!payload || typeof payload !== 'object') return { ok: false, errors: [{ field: '', message: 'The complaint must be a JSON object.' }] };
      var n = I.normalize(payload), c = n.complaint;
      var ids = {}; rows.forEach(function (r) { ids[r.complaint_id] = 1; });
      var v = L.validate(c, { existingIds: ids });
      var errors = n.errors.concat(v.errors.filter(function (e) {
        /* skip "required" noise already explained by a lookup error */
        return !n.errors.some(function (x) { return x.field + '_id' === e.field || x.field === e.field; });
      }));
      if (errors.length) return { ok: false, errors: errors };
      if (!c.complaint_id) c.complaint_id = I.nextId(rows);
      var nowIso = new Date().toISOString();
      c.data_source = adapter.info.sourceTag; c.created_at = nowIso; c.updated_at = nowIso;
      return adapter.insert(c).then(function () { return { ok: true, id: c.complaint_id, complaint: c }; });
    }).catch(function (e) { return { ok: false, errors: [{ field: '', message: 'Could not save: ' + (e && e.message ? e.message : e) }] }; });
  };
})();
