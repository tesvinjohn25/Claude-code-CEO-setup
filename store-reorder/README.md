# Store Reorder — P0a app

Phone-friendly, static, no backend. See `PLAN.md` for the full roadmap.

```
store-reorder/
├── PLAN.md            # the plan (source of truth)
├── VERIFICATION.md    # traceability table (plan §13.5)
├── app/               # the deployable static site
│   ├── index.html
│   ├── css/style.css
│   ├── demo-data.csv       # synthetic POS export (bundled demo data)
│   └── js/
│       ├── posAdapter.js   # ← THE RELINK POINT (see below)
│       ├── csv.js          # CSV parsing
│       ├── importer.js     # import + merge (pars survive re-imports)
│       ├── units.js        # cases+bottles ↔ base units
│       ├── reorder.js      # low stock + order suggestions
│       ├── ordersheet.js   # WhatsApp/print text + arithmetic explanations
│       ├── backup.js       # JSON backup/restore
│       ├── store.js        # StorageAdapter (localStorage now, cloud in P1)
│       ├── demo.js         # "Load demo data" button logic + preset pars
│       └── app.js          # UI
└── test/
    ├── *.test.js           # bun test suite (runs against app/demo-data.csv)
    └── mobile-check.js     # Playwright phone-viewport E2E
```

## Run locally

```bash
# any static server works; from the repo root:
cd store-reorder/app && python3 -m http.server 8080
# then open http://localhost:8080 (phone: use your machine's LAN IP)
```

## Test

```bash
bun test store-reorder                                    # unit + scenario suite
CHROMIUM_PATH=/opt/pw-browsers/chromium \
  bun store-reorder/test/mobile-check.js                  # phone E2E + screenshots
```

## Deploy to GitHub Pages

Serve the `store-reorder/app/` directory (repo Settings → Pages, or a
workflow that publishes that folder). The app is pure static files — no build
step.

## Relinking the real LiquorPOS export (when it arrives)

The app currently runs against a **synthetic** export
(`app/demo-data.csv`). Every assumption about the POS
file lives in **one file**: `app/js/posAdapter.js`.

When you have the real export:

1. Save an anonymized copy as `test/fixtures/real-liquorpos-export.csv`
   (replace any sensitive values; keep the exact headers and formatting).
2. In `posAdapter.js`, add a `REAL_EXPORT_FORMAT` object mapping the app's
   fields (`barcode`, `name`, `size`, `packSize`, `distributor`, `section`,
   `onHand`) to the real column names, and point `ACTIVE_FORMAT` at it.
   Handle any quirks (units in cases instead of bottles, packed columns,
   encodings) inside `normalizeRow` for that format only.
3. Point the importer tests at the real fixture and run
   `bun test store-reorder` — the same scenarios (pars survive re-import,
   idempotency, bad-row reporting) must pass against the real file.
4. Update `VERIFICATION.md` row "real export verified" with the evidence.

Nothing outside `posAdapter.js` (plus the test fixture wiring) should need to
change.
