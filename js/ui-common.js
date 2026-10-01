/* PRESENTATION LAYER - parts shared by all three pages: header, menu, theme, small helpers */
(function () {
  'use strict';
  var CQ = (window.CQ = window.CQ || {});
  var U = (CQ.UI = {});

  U.esc = function (s) { return CQ.Logic.esc(s); };

  /* theme */
  U.applyTheme = function (t) {
    if (!t) t = (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
    return t;
  };
  U.applyTheme(CQ.Settings.get('theme'));
  U.toggleTheme = function () {
    var t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    CQ.Settings.set('theme', t); U.applyTheme(t);
    document.dispatchEvent(new CustomEvent('cq:theme'));
  };

  U.toast = function (msg, ms) {
    var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, ms || 3500);
  };
  /* friendly error box that also shows the real error text (team rule 8) */
  U.errorHtml = function (friendly, err) {
    return '<div class="err"><b>' + U.esc(friendly) + '</b><br><small>Error text to pass on: ' + U.esc(err && err.message ? err.message : err) + '</small></div>';
  };

  var NAV = [
    ['dashboard', 'Dashboard', 'dashboard.html#dashboard'],
    ['live', 'Live Complaints', 'dashboard.html#live'],
    ['register', 'Register Complaint', 'index.html'],
    ['search', 'Complaint Search', 'dashboard.html#search'],
    ['management', 'Management Summary', 'dashboard.html#management'],
    ['analytics', 'Detailed Analytics', 'dashboard.html#analytics'],
    ['grp', 'Analysis'],
    ['subsidiary', 'Subsidiary Analysis', 'dashboard.html#subsidiary'],
    ['area', 'Area Analysis', 'dashboard.html#area'],
    ['mine', 'Mine Analysis', 'dashboard.html#mine'],
    ['quality', 'Quality Analysis', 'dashboard.html#quality'],
    ['grade', 'Grade Analysis', 'dashboard.html#grade'],
    ['loading', 'Loading Site Analysis', 'dashboard.html#loading'],
    ['trend', 'Trend Analysis', 'dashboard.html#trend'],
    ['reports', 'Reports', 'dashboard.html#reports'],
    ['grp', 'Administration'],
    ['master', 'Master Data', 'admin.html#master'],
    ['import', 'Data Import', 'admin.html#import'],
    ['settings', 'Settings', 'admin.html#settings']
  ];

  U.setActive = function (key) {
    var links = document.querySelectorAll('.nav a');
    for (var i = 0; i < links.length; i++) links[i].classList.toggle('active', links[i].getAttribute('data-key') === key);
    var s = document.getElementById('sidebar'); if (s) s.classList.remove('open');
  };

  U.refreshBanner = function () {
    var a = CQ.Data.current, b = document.getElementById('demoBanner'), badge = document.getElementById('topBadge');
    if (!b) return;
    if (a.info.live) {
      b.className = 'live-banner'; b.innerHTML = '<b>● LIVE DATA</b> — Source: Connected Data Source';
      if (badge) badge.innerHTML = '<span class="badge-live">● LIVE DATA</span>';
    } else {
      b.className = 'demo-banner';
      b.innerHTML = '<b>DEMO DATA — NOT OFFICIAL CIL COMPLAINT STATISTICS.</b> Demo data is synthetic and is not official Coal India Limited complaint statistics. Area, mine and grade lists are placeholders.';
      if (badge) badge.innerHTML = '<span class="badge-demo">● DEMO DATA</span>';
    }
  };

  /* Build header + menu around the page's <main id="page"> */
  U.mountShell = function (activeKey) {
    var page = document.getElementById('page');
    var shell = document.createElement('div'); shell.className = 'shell';
    var nav = NAV.map(function (n) {
      return n[0] === 'grp' ? '<div class="grp">' + n[1] + '</div>' :
        '<a href="' + n[2] + '" data-key="' + n[0] + '"' + (n[0] === activeKey ? ' class="active"' : '') + '>' + n[1] + '</a>';
    }).join('');
    shell.innerHTML =
      '<aside class="sidebar" id="sidebar"><div class="brand"><b>Coal Quality Complaint Monitor</b><span>Coal India Limited &amp; Subsidiaries</span></div><nav class="nav">' + nav + '</nav></aside>' +
      '<div class="content"><header class="topbar"><button class="icon-btn menu-btn" id="menuBtn" aria-label="Open menu">☰ Menu</button>' +
      '<div class="grow"><h1>COAL QUALITY COMPLAINT DASHBOARD</h1><div class="sub">Coal India Limited &amp; Subsidiaries</div></div>' +
      '<input type="search" id="globalSearch" placeholder="Search ID, consumer, invoice, RR/challan, mine, area, grade…" aria-label="Global search">' +
      '<span id="topBadge"></span><button class="icon-btn" id="themeBtn" aria-label="Switch dark or light theme" title="Dark / light theme">◐</button></header>' +
      '<div id="demoBanner" class="demo-banner"></div></div>';
    document.body.insertBefore(shell, document.body.firstChild);
    shell.querySelector('.content').appendChild(page);
    document.getElementById('menuBtn').onclick = function () { document.getElementById('sidebar').classList.toggle('open'); };
    document.getElementById('themeBtn').onclick = U.toggleTheme;
    var gs = document.getElementById('globalSearch');
    gs.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !document.getElementById('dashRoot')) {
        try { sessionStorage.setItem('cq_pending_q', gs.value); } catch (x) {}
        location.href = 'dashboard.html#search';
      }
    });
    U.refreshBanner();
  };

  U.statusPill = function (c) {
    var cls = c._resolved ? 'st-done' : c._exam ? 'st-exam' : c._open ? 'st-open' : 'st-other';
    var ic = c._resolved ? '✔ ' : c._exam ? '◐ ' : c._open ? '● ' : '○ ';
    return '<span class="pill ' + cls + '">' + ic + U.esc(c.status) + '</span>';
  };
  U.priorityPill = function (p) { return '<span class="pill pr-' + String(p).toLowerCase() + '">' + (p === 'Critical' ? '⚠ ' : p === 'High' ? '▲ ' : '') + U.esc(p) + '</span>'; };
})();
