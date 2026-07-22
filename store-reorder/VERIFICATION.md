# P0a Verification — traceability table (plan §13.5)

Run the suite: `bun test store-reorder` (32 tests).
Phone E2E: `CHROMIUM_PATH=/opt/pw-browsers/chromium bun store-reorder/test/mobile-check.js`.
Six-week usage simulation (imports with sales/deliveries, delist/return,
new product, corrupted row, backup/wipe/restore, junk par input, ~1400
independent assertions): `CHROMIUM_PATH=/opt/pw-browsers/chromium bun
store-reorder/test/simulate-weeks.js`.

| Requirement (plan §) | Implemented in | Proven by | Status |
|---|---|---|---|
| §3.1 Import POS export (barcode key, all fields) | `app/js/importer.js`, `posAdapter.js` | `importer.test.js` "imports the full fixture" | ✅ (synthetic fixture) |
| §3.1 Pars survive re-imports | `importer.js` merge | `importer.test.js` "re-import preserves par levels" | ✅ |
| §3.1 Re-import refreshes on-hand | `importer.js` | `importer.test.js` "re-import refreshes on-hand" | ✅ |
| §3.1 Same file twice changes nothing | `importer.js` | `importer.test.js` "idempotent" | ✅ |
| §3.1 Bad rows reported, not silently skipped (§13 risk) | `posAdapter.js` `normalizeRow` | `importer.test.js` "bad rows are reported with line numbers" | ✅ |
| §3.1 Import time + filename shown; "inventory as of" wording | `app.js` Data tab + top bar | `mobile-check.js` + screenshot `2-import-done` | ✅ |
| §3.2 Par entry in cases+bottles, base units internally | `units.js`, par editor in `app.js` | `units.test.js` round-trip invariant; screenshot `3-par-editor` | ✅ |
| §3.3 Low-stock list vs par; zero-stock separate; refresh time visible | `reorder.js`, `app.js` Low tab | `reorder.test.js`; screenshot `4-low-stock` | ✅ |
| §3.4 Suggestions grouped by distributor, rounded up to pack | `reorder.js` | `reorder.test.js` "never negative and always whole cases" (invariant sweep), "group by distributor" | ✅ |
| §3.4 Plan worked example (par 60u, on hand 54u, pack 12 → 1 cs) | `reorder.js` | `units.test.js` + `reorder.test.js` "plan worked example" | ✅ |
| §3.5 Order sheets: printable + WhatsApp text | `ordersheet.js`, print CSS | `reorder.test.js` "golden master"; screenshot `5-order-sheet` | ✅ |
| §10.10 Arithmetic shown for every suggestion | `ordersheet.js` `explainSuggestion` | `reorder.test.js` "suggestion explanation"; visible in screenshot `4-low-stock` | ✅ |
| §3.6 JSON backup export/restore round-trips | `backup.js` | `backup.test.js` "export then import reproduces the exact state" | ✅ |
| §3.6 Last-backup reminder shown | `app.js` Data tab | screenshot `2-import-done` (Data tab) | ✅ |
| §3 StorageAdapter seam for P1; corrupt storage safe | `store.js` | `backup.test.js` StorageAdapter cases | ✅ |
| §12 Usable one-handed on mid-range Android | `style.css` (52px targets, bottom tabs) | `mobile-check.js` full flow at 393×851, screenshots 1–5 | ✅ |
| §12 Multi-cycle real use holds up (weekly re-imports, delist/return, bad rows, restore) | importer `active` flag, input clamping | `simulate-weeks.js` 6-week run, ~1400 assertions | ✅ |
| §3 Deployed on GitHub Pages | `app/` is pure static | — | ⬜ pending: enable Pages for `store-reorder/app` |
| §15.1 Real export columns verified | `posAdapter.js` `ACTIVE_FORMAT` | — | ⬜ **pending real file** — running on synthetic format `fake-v1`; relink steps in README |
| §13.7 Human gate: value moment (owner approves an order sheet) | — | owner sign-off | ⬜ pending |
| §13.7 Human gate: one real weekly cycle before P0b | — | owner sign-off | ⬜ pending |
