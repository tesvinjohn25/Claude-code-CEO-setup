# Store Reorder & Multi-Store Inventory Tool — Plan for Codex

**Builder:** Codex. **Client:** the store owner (Dad) + 2 partner stores.
**Deliverable:** a phone-friendly web app, live on GitHub Pages.

---

## 1. Vision

Today the knowledge of what to reorder lives entirely in the owner's head. Every
week he walks the shelves and builds each distributor's order from memory. That
is the mechanism behind "the store won't run without me."

This tool replaces memory with data, in three steps:

1. **Reorder tool (V1)** — an employee counts the shelves, the app drafts one
   clean order per distributor, the owner reviews in five minutes.
2. **Live inventory (V2)** — the inventory is always up to date and stored in
   the cloud, so the owner can open the app from anywhere and see current stock
   and what's running low — without being in the store.
3. **Three-store network (V3)** — the three stores already borrow stock from
   each other informally. Bring all three onto the same system so each store
   can see the other two stores' inventory, log transfers between stores, and
   use stock **efficiently across the triangle**: before ordering from a
   distributor, check whether a partner store has surplus.

---

## 2. Phase V1 — Single-store reorder tool (must have, day 2 deadline)

Order quantity = **par level − counted, rounded up to pack size**.

1. **Product list**: name, distributor, pack size, par level, shelf
   section/category. Add, edit, delete. Saved in the browser (localStorage).
2. **LiquorPOS import**: the POS exports its item list to Excel. Build an
   importer that reads that file (saved as CSV) and loads the real product list
   in one go — no typing hundreds of items. Ask the owner to email the export
   before starting.
3. **Count screen**: fast number entry down the list, grouped by shelf section
   or category. Big touch targets, numeric keyboard, phone-first.
4. **Order sheets**: one per distributor, ready to print or copy straight into
   WhatsApp.
5. **Backup**: export and import all data as a single JSON file, so nothing is
   ever lost if the browser clears.
6. **Wow feature**: photograph the handwritten count sheet, upload the photo to
   ChatGPT, ask it for JSON in the app's format, paste the result into the
   app's import box. (App side: a paste-JSON import box with validation and a
   copyable prompt template.)
7. **Deployed on GitHub Pages.**

### V1 tech
- Static single-page app (plain HTML/JS or a small framework — keep the build
  simple enough for GitHub Pages).
- All state in localStorage behind a small storage module (`StorageAdapter`)
  — this abstraction is what lets V2 swap in cloud sync without a rewrite.

---

## 3. Phase V2 — Live online inventory

**Goal:** the owner can check inventory from anywhere, any time, and instantly
see what's low — the app is no longer a weekly counting tool but a live view of
the store.

1. **Cloud sync backend.** GitHub Pages is static, so add a free-tier hosted
   database (Supabase or Firebase — pick one; Supabase preferred for plain
   Postgres + row-level security). The static app stays on GitHub Pages and
   talks to the backend directly.
2. **Offline-first.** localStorage remains the working copy; sync to the cloud
   when online. Last-write-wins per product is acceptable at this scale.
3. **Running stock level.** Track `on_hand` per product, updated by:
   - shelf counts (a count sets the number),
   - deliveries received (+),
   - optional quick adjustments (breakage, samples, corrections).
   Full POS sales integration is out of scope for now; weekly counts keep the
   numbers honest.
4. **Low-stock dashboard.** A home screen showing: items below par, items at
   zero, and "days since last count" per section — sorted worst-first. This is
   the page the owner opens on his phone from home.
5. **Simple sign-in.** One shared login per store is enough (email + password
   or magic link). No user management UI.

---

## 4. Phase V3 — The three-store triangle

**Goal:** the three stores run on the same system, see each other's inventory,
log the borrowing that already happens informally, and use stock efficiently
across all three before spending money at distributors.

1. **Multi-store data model.** Every product row belongs to a `store_id`.
   Products are matched across stores by name/barcode so "Jameson 750ml at
   Store A" and the same item at Store B are recognized as the same product.
2. **Cross-store visibility.** From any store's app, look up an item and see
   on-hand at all three stores. A store's staff can see partner inventory but
   only edit their own.
3. **Transfer log.** When Store A takes 2 cases from Store B:
   - record a transfer (item, qty, from-store, to-store, date, who),
   - Store B's on-hand goes down, Store A's goes up — automatically,
   - a running balance page shows what each store owes the others, so the
     informal borrowing stays fair and visible.
4. **Efficient reordering across the triangle.** When the reorder sheet is
   generated at Store A:
   - for each item below par, first check whether Store B or C is **above**
     par (surplus),
   - if yes, suggest a transfer instead of (or before) a distributor order,
   - the distributor order sheet then covers only what the network as a whole
     actually needs.
5. **Combined orders (nice to have).** Optionally merge the three stores'
   distributor orders into one to hit case minimums / free-delivery thresholds,
   with a per-store split sheet for delivery day.

---

## 5. Data model (target shape, V3)

- `stores` — id, name.
- `products` — id, store_id, name, barcode?, distributor, pack_size,
  par_level, section, on_hand, last_counted_at.
- `counts` — id, store_id, product_id, counted_qty, counted_at, counted_by.
- `transfers` — id, product_ref, qty, from_store_id, to_store_id, date, note.
- `orders` — id, store_id, distributor, created_at, lines[{product_id, qty}],
  status (draft/sent/received).

V1 stores `products` + `counts` in localStorage; V2 moves them to the backend;
V3 adds `stores` + `transfers` and store scoping.

---

## 6. Build order & milestones

| Milestone | Contents | Done when |
|---|---|---|
| M1 (day 1–2) | V1 features 1–7 | Owner drafts a real weekly order from an employee's count, live on GitHub Pages |
| M2 | Cloud sync + low-stock dashboard | Owner checks stock from home on his phone |
| M3 | Second + third store onboarded, cross-store visibility | Any store can look up an item across all three |
| M4 | Transfer log + balances | A real borrow is logged and both stores' numbers update |
| M5 | Transfer-first reorder suggestions | A weekly order sheet includes "take from Store B" lines |

## 7. Principles for Codex

- Phone-first: everything must work one-handed on a mid-range Android.
- Never lose data: backup/export works in every phase; sync failures fall back
  to localStorage silently.
- Keep V1 shippable on its own — V2/V3 must not delay the day-2 deadline.
- No accounts/permissions complexity: one login per store, trust between the
  three owners.
