/* MASTER DATA LAYER
   Reference lists: subsidiary, area, mine, location, grade, category, status, quality parameter.
   IMPORTANT: Area / Mine / Location / Grade rows below are DEMO PLACEHOLDERS, not official CIL master data.
   In the live version these tables are loaded from an authorised source (see database/ and admin.html). */
(function () {
  'use strict';
  var CQ = (window.CQ = window.CQ || {});
  var M = (CQ.Master = {});
  M.IS_DEMO_MASTER = true;

  function S(id, name, region, level) {
    return { subsidiary_id: id, subsidiary_name: name, subsidiary_code: id, state_region: region, active_status: true, level: level };
  }
  M.subsidiary_master = [
    S('CIL', 'Coal India Limited', 'Parent organisation', 'Parent'),
    S('ECL', 'Eastern Coalfields Limited', 'West Bengal / Jharkhand', 'Subsidiary'),
    S('BCCL', 'Bharat Coking Coal Limited', 'Jharkhand', 'Subsidiary'),
    S('CCL', 'Central Coalfields Limited', 'Jharkhand', 'Subsidiary'),
    S('NCL', 'Northern Coalfields Limited', 'Madhya Pradesh / Uttar Pradesh', 'Subsidiary'),
    S('WCL', 'Western Coalfields Limited', 'Maharashtra / Madhya Pradesh', 'Subsidiary'),
    S('SECL', 'South Eastern Coalfields Limited', 'Chhattisgarh / Madhya Pradesh', 'Subsidiary'),
    S('MCL', 'Mahanadi Coalfields Limited', 'Odisha', 'Subsidiary'),
    S('CMPDI', 'Central Mine Planning & Design Institute Limited', 'Jharkhand (planning/design reference)', 'Reference')
  ];
  var SUB_STATES = { ECL: ['West Bengal', 'Jharkhand'], BCCL: ['Jharkhand'], CCL: ['Jharkhand'],
    NCL: ['Madhya Pradesh', 'Uttar Pradesh'], WCL: ['Maharashtra', 'Madhya Pradesh'],
    SECL: ['Chhattisgarh', 'Madhya Pradesh'], MCL: ['Odisha'] };
  var AREA_COUNT = { ECL: 5, BCCL: 4, CCL: 5, NCL: 4, WCL: 5, SECL: 6, MCL: 5 };
  var MINE_TYPES = ['Opencast', 'Opencast', 'Underground', 'Mixed/Other'];

  M.area_master = []; M.mine_master = []; M.loading_location_master = [];
  M.subsidiary_master.filter(function (s) { return s.level === 'Subsidiary'; }).forEach(function (s, si) {
    var code = s.subsidiary_code, states = SUB_STATES[code];
    for (var a = 1; a <= AREA_COUNT[code]; a++) {
      var st = states[(a - 1) % states.length];
      var area = { area_id: code + '-A' + a, subsidiary_id: code, area_name: code + ' Demo Area ' + a,
        area_code: 'D-' + code + '-A' + a, state: st, district: 'Demo District', active_status: true };
      M.area_master.push(area);
      var nm = 2 + ((a + si) % 2);
      for (var m = 1; m <= nm; m++) {
        var mine = { mine_id: area.area_id + '-M' + m, subsidiary_id: code, area_id: area.area_id,
          mine_name: code + ' Demo Mine ' + a + '.' + m, mine_code: 'D-' + code + '-' + a + '-' + m,
          mine_type: MINE_TYPES[(a + m + si) % 4], district: 'Demo District', state: st, active_status: true };
        M.mine_master.push(mine);
        var types = ['Siding', 'Road Sale']; if ((a + m) % 3 === 0) types.push('Other');
        types.forEach(function (t, li) {
          M.loading_location_master.push({ location_id: mine.mine_id + '-L' + (li + 1), subsidiary_id: code,
            area_id: area.area_id, mine_id: mine.mine_id, location_name: mine.mine_name + ' - ' + t + ' ' + (li + 1),
            location_code: 'D-' + code + '-' + a + '-' + m + '-L' + (li + 1), loading_type: t,
            district: 'Demo District', state: st, active_status: true, latitude: null, longitude: null });
        });
      }
    }
  });

  M.coal_grade_master = [];
  for (var g = 1; g <= 17; g++) {
    M.coal_grade_master.push({ grade_id: 'G' + g, grade_code: 'G' + g, grade_name: 'Grade G' + g, grade_order: g,
      grade_category: 'Non-coking (illustrative)', applicable_period: 'To be set from official source', active_status: true });
  }

  /* Groups used by the dashboard: many categories roll up into one group. */
  M.groups = [
    { id: 'slippage', label: 'Grade Slippage', color: '#2f6db5' },
    { id: 'ash', label: 'Ash', color: '#a0785a' },
    { id: 'moisture', label: 'Moisture', color: '#1fa5c4' },
    { id: 'shale', label: 'Shale', color: '#8e6bbf' },
    { id: 'sandstone', label: 'Sandstone', color: '#d9a21b' },
    { id: 'oversize', label: 'Oversize >100 mm', color: '#e0672a' },
    { id: 'gcv', label: 'GCV', color: '#c0392b' },
    { id: 'extraneous', label: 'Extraneous Material', color: '#4aa56b' },
    { id: 'other', label: 'Other', color: '#8a939e' }
  ];
  var CATS = [
    ['Grade Slippage', 'slippage'], ['Excess Ash', 'ash'], ['Excess Moisture', 'moisture'], ['Excess Shale', 'shale'],
    ['Excess Sandstone', 'sandstone'], ['Oversize Coal', 'oversize'], ['More than 100 mm Coal Size', 'oversize'],
    ['Undersize/Fines', 'other'], ['Stone/Foreign Material', 'extraneous'], ['Excess Extraneous Matter', 'extraneous'],
    ['Low GCV', 'gcv'], ['High GCV Variation', 'gcv'], ['Poor Coal Quality', 'other'], ['Mixed Grade', 'other'],
    ['Wrong Grade Supplied', 'other'], ['Size Variation', 'other'], ['Moisture Variation', 'moisture'],
    ['Ash Variation', 'ash'], ['Other Quality Issue', 'other']
  ];
  M.complaint_category_master = CATS.map(function (c, i) {
    return { category_id: 'CAT' + (i + 1), category_name: c[0], category_group: c[1], active_status: true };
  });
  M.categoryGroup = {}; CATS.forEach(function (c) { M.categoryGroup[c[0]] = c[1]; });

  /* phase: open | exam | testing | investigation | resolved | closed | other ; final = no more work expected */
  var ST = [
    ['New', 'New', 'open', false], ['Acknowledged', 'Acknowledged', 'open', false],
    ['Under Examination', 'Under Examination', 'exam', false], ['Sample Collection Pending', 'Testing', 'testing', false],
    ['Sample Collected', 'Testing', 'testing', false], ['Under Testing', 'Testing', 'testing', false],
    ['Investigation in Progress', 'Investigation', 'investigation', false], ['Response Pending', 'Investigation', 'investigation', false],
    ['Resolved', 'Resolved', 'resolved', true], ['Closed', 'Closed', 'closed', true],
    ['Rejected/Not Admitted', 'Other', 'other', true], ['Duplicate', 'Other', 'other', true], ['Reopened', 'Other', 'open', false]
  ];
  M.complaint_status_master = ST.map(function (s, i) {
    return { status_id: 'ST' + (i + 1), status_name: s[0], display_group: s[1], phase: s[2], is_final: s[3], sort_order: i + 1, active_status: true };
  });
  M.statusByName = {}; M.complaint_status_master.forEach(function (s) { M.statusByName[s.status_name] = s; });
  M.statusGroups = ['New', 'Acknowledged', 'Under Examination', 'Testing', 'Investigation', 'Resolved', 'Closed', 'Other'];

  M.quality_parameter_master = [
    { param_id: 'ASH', name: 'Ash', unit: '%', tolerance_configured: false },
    { param_id: 'MOIST', name: 'Moisture', unit: '%', tolerance_configured: false },
    { param_id: 'GCV', name: 'GCV', unit: 'kcal/kg', tolerance_configured: false },
    { param_id: 'OVERSIZE', name: 'Oversize coal (>threshold mm)', unit: '%', tolerance_configured: false },
    { param_id: 'UNDERSIZE', name: 'Undersize / fines', unit: '%', tolerance_configured: false },
    { param_id: 'SHALE', name: 'Shale', unit: '%', tolerance_configured: false },
    { param_id: 'SANDSTONE', name: 'Sandstone', unit: '%', tolerance_configured: false },
    { param_id: 'EXTRANEOUS', name: 'Other extraneous material', unit: '%', tolerance_configured: false }
  ];

  M.priorities = ['Normal', 'High', 'Critical'];
  M.sources = ['Consumer Portal', 'Email', 'Letter', 'Telephone', 'Field Inspection', 'Customer Meeting', 'External API', 'Mobile App', 'Other'];
  M.loadingSites = ['Siding', 'Road Sale', 'Other'];
  M.loadingTypes = ['Siding', 'Road Sale', 'Other', 'Not Available'];
  M.dispatchModes = ['Rail', 'Road'];
  M.mineTypes = ['Opencast', 'Underground', 'Mixed/Other'];
  M.attachmentTypes = ['Laboratory report', 'Sample report', 'Photographs', 'Invoice', 'RR/Challan', 'Dispatch documents', 'Consumer letter', 'Other supporting documents'];

  /* lookups */
  function idx(list, key) { var o = {}; list.forEach(function (r) { o[r[key]] = r; }); return o; }
  M.subById = idx(M.subsidiary_master, 'subsidiary_id');
  M.areaById = idx(M.area_master, 'area_id');
  M.mineById = idx(M.mine_master, 'mine_id');
  M.locById = idx(M.loading_location_master, 'location_id');
  M.gradeByCode = idx(M.coal_grade_master, 'grade_code');
  M.complaintSubsidiaries = function () { return M.subsidiary_master.filter(function (s) { return s.level === 'Subsidiary' && s.active_status; }); };
  M.areasOf = function (sub) { return M.area_master.filter(function (a) { return !sub || a.subsidiary_id === sub; }); };
  M.minesOf = function (area, sub) { return M.mine_master.filter(function (m) { return (!area || m.area_id === area) && (!sub || m.subsidiary_id === sub); }); };
  M.locationsOf = function (mine, area, sub) { return M.loading_location_master.filter(function (l) { return (!mine || l.mine_id === mine) && (!area || l.area_id === area) && (!sub || l.subsidiary_id === sub); }); };
  M.gradeIndex = function (code) { var g = M.gradeByCode[code]; return g ? g.grade_order : null; };

  /* Find a master row by id, code or name (case-insensitive). Used by the API layer. */
  M.resolve = function (list, idKey, codeKey, nameKey, value, parentOk) {
    if (value === null || value === undefined || value === '') return null;
    var v = String(value).trim().toLowerCase();
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (parentOk && !parentOk(r)) continue;
      if ([r[idKey], r[codeKey], r[nameKey]].some(function (x) { return x && String(x).toLowerCase() === v; })) return r;
    }
    return null;
  };

  /* simple per-browser settings */
  var DEF = { theme: '', oversize_threshold_mm: 100, auto_refresh_sec: 30 };
  CQ.Settings = {
    get: function (k) { try { var v = localStorage.getItem('cq_set_' + k); if (v !== null) return JSON.parse(v); } catch (e) {} return DEF[k]; },
    set: function (k, v) { try { localStorage.setItem('cq_set_' + k, JSON.stringify(v)); } catch (e) {} }
  };
})();
