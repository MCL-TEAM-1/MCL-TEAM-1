# CLAUDE.md - read this first, in every session

## About us
- We are a team of 4-5 people from Mahanadi Coalfields Limited (MCL) at an
  IIM Sambalpur MDP. We are NOT programmers.
- Explain everything in plain English, in short sentences. If you must use a
  technical word, explain it in one line.
- We build ONE small web tool in phases. Only one Claude session works at a
  time. The Progress Log at the end of this file is our handover logbook.

## What we are building
- A tool with at most 3 pages: index.html (entry page), dashboard.html
  (dashboard) and at most one more page.
- Every record has location, urgency (Low / Medium / High) and status
  (Open / In progress / Resolved), plus the columns in "Our tool" below.
- All data is MADE UP. Never add real names, phone numbers, employee IDs or
  real MCL figures.

## Technical rules
1. Plain HTML, CSS and JavaScript only. Pages stay in the top folder; SQL
   files go in the database folder. No frameworks, no npm, no package.json,
   no build step.
2. Vercel publishes the site from the main branch. Use relative links only,
   e.g. href="dashboard.html".
3. Load Supabase from the jsDelivr CDN, then our settings, in this order:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="config.js"></script>
   Then create the client like this (do not call the variable "supabase"):
     const db = window.supabase.createClient(window.SUPABASE_URL,
                                              window.SUPABASE_PUBLISHABLE_KEY);
4. The Project URL and the publishable key live only in config.js. Never use
   or ask for a secret key, a service_role key or the database password.
5. For charts, load Chart.js from the jsDelivr CDN.
6. No login or sign-up. Anyone with the link can use the tool.
7. You may not be able to reach our database. Do NOT try to test the database
   connection. Write the code; we test it on the live website.
8. If anything fails, show a friendly message on the page that also includes
   the actual error text, so we can pass it on.
9. Every page must work well on a mobile phone: large buttons, readable text,
   no sideways scrolling. Use the same header and menu on every page.
10. Never delete config.js or CLAUDE.md.

## Database rules
- Our Data Keeper runs all SQL by pasting it into the Supabase SQL Editor.
  You cannot run SQL yourself.
- Give SQL as ONE block that runs in one go. Also save it in the database
  folder: 01-setup.sql, then 02-..., 03-... for later changes.
- One table. It must have: id uuid primary key default gen_random_uuid()
  and created_at timestamptz not null default now().
- Enable Row Level Security. Add policies that let the roles anon and
  authenticated SELECT, INSERT and UPDATE. No delete.
- Always include: grant select, insert, update on the table to anon,
  authenticated; (new Supabase projects need it, or the website gets
  "permission denied").
- Never drop a table or delete rows.
- Avoid changing the table after Phase 1. If a change is really needed, give
  one small block and explain it in one sentence.

## How to work with us
- Make one change at a time. Do not change parts that already work unless we
  ask.
- After each change, reply in 3 short bullets: what you changed and what we
  should test on the live website.
- Commit and push your work at every stopping point.

## Takeover and handover
- At the START of every session: read the Progress Log below and summarize it
  in 3 bullets (what exists, what works, what is next).
- At a "save point": add a new entry at the end of the Progress Log (phase,
  builder, what was built, what works, known problems, next step). Then
  commit and push.

## Our tool (filled in during Phase 1)
- Team: MCL team 1 (IIM Sambalpur MDP)
- Tool name: Coal Quality Complaint Monitor (Coal India Limited & subsidiaries)
- Problem: See consumer complaints about coal quality (grade slippage, ash, moisture, shale, sandstone, oversize >100 mm, GCV, extraneous material) in one live dashboard.
- Who records / who decides: Consumers / sales and quality staff record; CIL management and subsidiary quality cells decide.
- Table name and columns: complaints (see database/01-setup.sql; not used yet). Version 1 keeps demo data in the browser.
- Pages: index.html = entry page (Register Complaint); dashboard.html = dashboard (all views, switched by menu); admin.html = master data, data import, settings
- Code folders: css/style.css; js/ = master-data.js (master data), logic.js (application), demo-generator.js + data-layer.js (data), integration.js (integration), ui-common.js + dashboard.js + register.js + admin.js (presentation)

## Progress Log (newest entry at the bottom)
- Phase 0 (starter): placeholder index.html, config.js without settings and
  this CLAUDE.md. Next: Phase 1 - the table and the entry page.
- Phase 1 (Claude, 2026-10-01): Built the whole first version on DEMO DATA (about 1,400 made-up complaints made in the browser, all marked data_source = DEMO). Entry form, dashboard with 13 menu views (KPIs, 20+ charts, filters, search, detail pop-up, CSV/Excel/PDF/print export, live simulation), admin page (master data viewer, test of the POST /api/complaints checks, settings). Complaints saved on the entry page show on the dashboard without reload. Dark/light theme, mobile layout. Tested in a browser without the database. Works: everything above. Known problems: Chart.js loads from the jsDelivr CDN (could not be tested from the build machine, so please check the charts on the live site); no map (no verified coordinates); Area/Mine/Grade lists are placeholders, not official; no login; documents record file names only. Next step: Data Keeper loads official master data; run database/01-setup.sql; connect a live adapter in js/data-layer.js.
