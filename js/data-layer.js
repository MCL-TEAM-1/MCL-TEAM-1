/* DATA LAYER
   The dashboard only talks to "CQ.Data.current". Every adapter offers the same four things:
     load()        -> Promise of all complaints
     insert(c)     -> Promise, saves one complaint and tells subscribers
     subscribe(fn) -> fn() is called whenever data changes (this is the real-time hook)
     info          -> label, live (true only when really connected), sourceTag
   Only the Demo adapter works in version 1. The others are placeholders for the live release
   (for Supabase: load = select, insert = insert, subscribe = realtime channel). */
(function () {
  'use strict';
  var CQ = (window.CQ = window.CQ || {});
  var D = (CQ.Data = {});
  var KEY = 'cq_demo_extras_v1';

  function readExtras() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function writeExtras(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); return true; } catch (e) { return false; } }

  var listeners = [], chan = null;
  try { chan = new BroadcastChannel('cq-demo'); chan.onmessage = function () { fire(); }; } catch (e) { chan = null; }
  window.addEventListener('storage', function (e) { if (e.key === KEY) fire(); });
  function fire() { listeners.slice().forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); }

  var base = null;
  var demo = {
    id: 'demo',
    info: { label: 'Demo Data', live: false, sourceTag: 'DEMO', available: true, description: 'Synthetic complaints made in your browser' },
    lastSync: null,
    cache: [],
    load: function () {
      if (!base) base = CQ.Demo.generateBase();
      var all = base.concat(readExtras());
      all.forEach(function (c) { CQ.Logic.enrich(c); });
      demo.cache = all; demo.lastSync = new Date();
      return Promise.resolve(all);
    },
    insert: function (c) {
      var ex = readExtras(); ex.push(c);
      if (!writeExtras(ex)) return Promise.reject(new Error('Browser storage is full or blocked, so the demo complaint could not be saved.'));
      try { if (chan) chan.postMessage('changed'); } catch (e) {}
      fire();
      return Promise.resolve(c);
    },
    subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (x) { return x !== fn; }); }; },
    clearMine: function () { writeExtras([]); try { if (chan) chan.postMessage('changed'); } catch (e) {} fire(); },
    myCount: function () { return readExtras().length; }
  };

  function placeholder(id, label) {
    return { id: id, info: { label: label, live: false, sourceTag: id.toUpperCase(), available: false, description: 'Coming in Live Integration' },
      load: function () { return Promise.reject(new Error(label + ' is not connected yet (coming in Live Integration).')); },
      insert: function () { return Promise.reject(new Error(label + ' is not connected yet.')); },
      subscribe: function () { return function () {}; } };
  }
  D.adapters = { demo: demo, api: placeholder('api', 'External API'), webhook: placeholder('webhook', 'Webhook'),
    database: placeholder('database', 'Database'), csv: placeholder('csv', 'CSV Import') };
  D.current = demo;
  D.setMode = function (id) { var a = D.adapters[id]; if (!a || !a.info.available) return false; D.current = a; return true; };
})();
