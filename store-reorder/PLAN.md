# Store Reorder & Multi-Store Inventory Tool — Plan for Codex

**Builder:** Codex. **Client:** the store owner (Dad) + 2 partner stores.
**Deliverable:** a phone-friendly web app, live on GitHub Pages.

---

## 1. Vision

Today the knowledge of what to reorder lives entirely in the owner's head. Every
week he walks the shelves and builds each distributor's order from memory. That
is the mechanism behind "the store won't run without me."

The end state: a live inventory system shared by three stores that already
borrow stock from each other. Each store sees its own stock against preferred
levels, gets alerted when something runs low, checks the partner stores before
spending money at a distributor, reserves stock from partners with an
approve/pickup/deliver flow, and gets reports on everything that moved.

**But we ship in priority order.** The MVP below is deliberately small so there
is a tangible working website first; everything else layers on top.

---

## 2. MVP — the tangible website to use now (P0)

One store, one browser, no backend. Everything runs on GitHub Pages with
localStorage. This alone replaces the memory-walk.

1. **Product list** — name, distributor, section/category, pack size, and a
   **preferred level (par) entered manually per product** — it varies for each
   product, so it is always editable. Quantities are tracked in **cases +
   bottles** (e.g. par = 5 cases; on hand = 4 cases 6 bottles).
2. **LiquorPOS CSV import** — load the real product list in one go from the
   POS's Excel/CSV export. No typing hundreds of items.
3. **Count screen** — fast number entry down the list, grouped by shelf
   section. Phone-first, numeric keyboard, big touch targets.
4. **Low-stock alerts with suggestions** — the home screen compares on-hand to
   par for every product. Anything under par (Johnnie Walker par 5 cases, on
   hand 4 → flagged) shows as an alert with the suggested action: "order N
   from distributor X" (order qty = par − on hand, rounded up to pack size).
   In the MVP the suggestion is always a distributor order; checking partner
   stores comes in P2.
5. **Order sheets** — one per distributor, generated from the low-stock list,
   ready to print or paste into WhatsApp.
6. **Backup** — export/import all data as one JSON file so nothing is lost if
   the browser clears.
7. **Deployed on GitHub Pages.**

**MVP is done when:** an employee counts the shelves on a phone, the owner
opens the site, sees what's low, and sends each distributor order in five
minutes.

### MVP tech
- Static single-page app, simple build, GitHub Pages.
- All state behind a small `StorageAdapter` module over localStorage — this is
  the seam that lets P1 swap in cloud sync without a rewrite.

---

## 3. P1 — Live online inventory (first add-on)

Makes the inventory checkable from anywhere, which everything multi-store
depends on.

1. **Cloud sync backend** — free tier Supabase (plain Postgres + row-level
   security). Static app stays on GitHub Pages, talks to Supabase directly.
   localStorage remains the offline working copy; last-write-wins per product.
2. **Owner dashboard from home** — items below par, items at zero, days since
   last count per section, sorted worst-first.
3. **Running stock** — counts set the number; deliveries and quick
   adjustments (+/−) move it between counts. No POS sales feed yet — weekly
   counts keep it honest.
4. **Simple sign-in** — one shared login per store, nothing fancier.

---

## 4. P2 — The three-store triangle

The partner stores join. This is where the low-stock suggestion gets smart and
the informal borrowing becomes a real workflow.

1. **Multi-store model + visibility** — every product row belongs to a store;
   same products matched across stores by name/barcode. Any store can look up
   an item and see on-hand at all three; each store edits only its own.
2. **Partner-first low-stock suggestions (automated)** — when an item falls
   below par, the app automatically checks the other two stores:
   - a partner is **above par** on it → suggest "request N from Store B",
   - no partner surplus → the item goes to the distributor order list.
   This runs deterministically on every sync — no AI needed (see §7).
3. **Reservation requests** — from a low-stock suggestion (or manually), send
   a request to a partner store to **reserve** N cases/bottles for later
   pickup. The receiving store sees the request and taps approve or decline.
   Approved stock shows as "reserved" in their inventory so it isn't sold out
   from under the deal.
4. **Transfer status tracking (Uber-Eats style)** — every approved request
   moves through statuses: **requested → approved → reserved → picked up →
   delivered**, shown as a progress bar both stores can see. Inventory updates
   are driven by the status automatically:
   - *picked up* → deducted from the giving store,
   - *delivered* → added to the receiving store.
   No manual re-entry of transferred stock — this closes the "how do we input
   what we took from Store B" gap.
5. **Transfer balances** — a running page of what each store owes the others,
   so the borrowing stays fair and visible.

---

## 5. P3 — Reports & intelligence (save for later)

Valuable, but nothing here blocks daily use. Build only after P2 is real.

1. **Activity report** — everything in one place per week/month/season: what
   went low, what was ordered from distributors, what was taken from / given
   to partner stores, per product and per store. Exportable.
2. **AI-assisted reservation triage** — when a reservation request comes in,
   an LLM looks at the receiving store's own stock, par, and recent movement
   for that product and drafts a recommendation ("you're at 9 cases against a
   par of 5 and it barely moves — approving 2 cases is safe"). **The owner
   always makes the final call**; the AI only suggests.
3. **Seasonal product-placement suggestions** — after the store layout is
   given to the app, use the seasonal report data to suggest placement
   changes. Most speculative feature; last in line.
4. **Combined distributor orders** — merge the three stores' orders to hit
   case minimums / free-delivery thresholds, with a per-store split sheet.

---

## 6. Priority summary

| Tier | What | Why this order |
|---|---|---|
| **P0 (MVP)** | Product list w/ manual par (cases+bottles), CSV import, count screen, low-stock alerts + order suggestion, order sheets, backup, GitHub Pages | Usable website now; replaces the memory-walk |
| **P1** | Supabase sync, from-home dashboard, running stock, login | "Check inventory online" — foundation for multi-store |
| **P2** | 3-store visibility, auto partner-check on low stock, reservations w/ approve, status-driven transfers, balances | The triangle + efficient stock use across stores |
| **P3** | Reports, AI reservation triage, seasonal placement suggestions, combined orders | Nice-to-have intelligence on top of real data |

---

## 7. Redistribution: deterministic vs LLM

**Decision: do the core redistribution deterministically. Add the LLM only as
an optional advisory layer in P3.**

- The actual decision — "who is below par, who is above par, how many cases
  can move" — is arithmetic over data we already have (on-hand, par, pack
  size, transfer cost/effort). Simple rules cover it: never take a store below
  its own par; move stock only when surplus ≥ requested; prefer the nearer /
  owing store. Deterministic rules are free, instant, offline-capable,
  explainable, and never hallucinate a number.
- An LLM API adds per-call cost, latency, an API key to manage, and
  non-reproducible answers — a bad trade for the core loop.
- Where an LLM **is** worth it: judgment calls with fuzzy context — the P3
  reservation triage ("is giving away 2 cases wise given the season?") and
  placement suggestions. There it drafts advice; the owner decides.

---

## 8. Data model (target shape at P2)

- `stores` — id, name.
- `products` — id, store_id, name, barcode?, distributor, pack_size
  (bottles/case), par_cases, par_bottles, on_hand_cases, on_hand_bottles,
  section, last_counted_at.
- `counts` — id, store_id, product_id, counted_cases, counted_bottles,
  counted_at, counted_by.
- `reservations` — id, product_ref, qty_cases, qty_bottles, from_store_id,
  to_store_id, status (requested/approved/declined/reserved/picked_up/
  delivered/cancelled), requested_at, status_history[].
- `orders` — id, store_id, distributor, created_at, lines[{product_id, qty}],
  status (draft/sent/received).

MVP keeps `products` + `counts` in localStorage; P1 moves them to Supabase;
P2 adds `stores` + `reservations` and store scoping.

---

## 9. Principles for Codex

- Ship P0 completely before touching P1 — a small working site beats a big
  half-built one.
- Phone-first: everything works one-handed on a mid-range Android.
- Never lose data: backup/export works in every phase; sync failures fall
  back to localStorage silently.
- Par levels and inventory are always manually editable — the owner's
  judgment overrides the system everywhere.
- Inventory changes should be driven by workflow events (count entered,
  delivery received, transfer status changed), never by duplicate manual
  entry.
- No accounts/permissions complexity: one login per store, trust between the
  three owners.
