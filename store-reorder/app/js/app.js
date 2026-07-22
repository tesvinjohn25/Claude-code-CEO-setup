import { StorageAdapter } from "./store.js";
import { importExport } from "./importer.js";
import { toUnits, toCasesBottles, formatUnits } from "./units.js";
import { lowStock, zeroStock, unsetPar, orderSuggestions } from "./reorder.js";
import { sheetText, explainSuggestion } from "./ordersheet.js";
import { exportBackup, importBackup } from "./backup.js";
import { loadDemoData } from "./demo.js";

const storage = new StorageAdapter();
let state = storage.load();
let currentTab = "low";
let inventoryFilter = "";
let needsParOnly = false;

const view = document.getElementById("view");
const freshness = document.getElementById("freshness");

function save() { storage.save(state); }

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function fmtDate(iso) {
  if (!iso) return "never";
  const d = new Date(iso);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function productCount() { return Object.keys(state.products).length; }

// ---------------------------------------------------------------- rendering

function render() {
  document.querySelectorAll(".tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === currentTab);
  });
  freshness.textContent = state.lastImport
    ? `inventory as of ${fmtDate(state.lastImport.at)}`
    : "no inventory loaded";

  if (productCount() === 0 && currentTab !== "data") {
    view.innerHTML = `
      <div class="empty">
        <p>No products yet.</p>
        <p>Go to <b>Data</b> and import your POS export to get started —
        or try the app with sample data:</p>
        <div class="actions">
          <button class="action" id="load-demo">Load demo data</button>
        </div>
      </div>`;
    wireDemoButton();
    return;
  }

  updateTabBadge();

  if (currentTab === "low") renderLow();
  else if (currentTab === "inventory") renderInventory();
  else if (currentTab === "orders") renderOrders();
  else renderData();
}

// Red count on the Low Stock tab so the situation is visible from any screen.
function updateTabBadge() {
  const n = lowStock(state.products).length;
  const btn = document.querySelector('[data-tab="low"]');
  btn.innerHTML = n > 0 ? `Low&nbsp;Stock <span class="count">${n}</span>` : "Low&nbsp;Stock";
}

// Mini bar showing on-hand relative to par — scannable without reading numbers.
function stockBar(p) {
  const pct = Math.max(0, Math.min(100, Math.round((p.onHandUnits / p.parUnits) * 100)));
  return `<div class="stockbar"><div class="${p.onHandUnits === 0 ? "zero" : "low"}" style="width:${Math.max(pct, 3)}%"></div></div>`;
}

function renderLow() {
  const low = lowStock(state.products);
  const zero = zeroStock(state.products);
  const noPar = unsetPar(state.products);
  let html = "";

  if (low.length > 0) {
    const distributors = new Set(low.filter((p) => p.suggestedCases > 0).map((p) => p.distributor));
    const totalCases = low.reduce((s, p) => s + p.suggestedCases, 0);
    html += `
      <div class="card summary-row">
        <div><b>${low.length}</b> item${low.length === 1 ? "" : "s"} to order ·
             <b>${totalCases}</b> cs across <b>${distributors.size}</b> distributor${distributors.size === 1 ? "" : "s"}</div>
        <button class="action" id="go-orders">Order sheets →</button>
      </div>`;
  }

  if (noPar.length > 0) {
    html += `<button class="notice warn linklike" id="go-needs-par">${noPar.length} product${noPar.length === 1 ? " has" : "s have"} no par level yet — tap to set them ›</button>`;
  }

  html += `<h2>Below par (${low.length})</h2><div class="card">`;
  html += low.length === 0
    ? `<div class="empty">Nothing below par. 🎉</div>`
    : low.map((p) => `
        <div class="item" data-barcode="${esc(p.barcode)}">
          <div style="flex:1">
            <div class="name">${esc(p.name)} <span class="sub">${esc(p.size)}</span></div>
            <div class="sub">${esc(p.distributor)} · ${esc(p.section)}</div>
            ${stockBar(p)}
            <div class="explain">${esc(explainSuggestion(p))}</div>
          </div>
          <div class="qty">
            <span class="badge ${p.onHandUnits === 0 ? "zero" : "low"}">order ${p.suggestedCases} cs</span>
            <div class="sub">${formatUnits(p.onHandUnits, p.packSize)} / par ${formatUnits(p.parUnits, p.packSize)}</div>
          </div>
        </div>`).join("");
  html += `</div>`;

  html += `<h2>Zero stock (${zero.length})</h2><div class="card">`;
  html += zero.length === 0
    ? `<div class="empty">No products at zero.</div>`
    : zero.map((p) => `
        <div class="item">
          <div>
            <div class="name">${esc(p.name)} <span class="sub">${esc(p.size)}</span></div>
            <div class="sub">${esc(p.distributor)} · ${esc(p.section)}</div>
          </div>
          <div class="qty"><span class="badge zero">0</span></div>
        </div>`).join("");
  html += `</div>`;
  view.innerHTML = html;

  document.getElementById("go-orders")?.addEventListener("click", () => {
    currentTab = "orders";
    render();
  });
  document.getElementById("go-needs-par")?.addEventListener("click", () => {
    currentTab = "inventory";
    needsParOnly = true;
    inventoryFilter = "";
    render();
  });
}

// The search input is rendered ONCE and never rebuilt while typing — only the
// list below it re-renders. Rebuilding the input on each keystroke destroys
// focus and closes the phone keyboard.
function renderInventory() {
  view.innerHTML = `
    <input type="search" id="inv-search" placeholder="Search products or sections" value="${esc(inventoryFilter)}">
    ${needsParOnly ? `<button class="chip" id="clear-needs-par">Showing: needs par ✕</button>` : ""}
    <div id="inv-list"></div>`;

  document.getElementById("inv-search").addEventListener("input", (e) => {
    inventoryFilter = e.target.value;
    renderInventoryList();
  });
  document.getElementById("clear-needs-par")?.addEventListener("click", () => {
    needsParOnly = false;
    renderInventory();
  });

  renderInventoryList();
}

function renderInventoryList() {
  const q = inventoryFilter.toLowerCase();
  const all = Object.values(state.products)
    .filter((p) => p.active !== false) // delisted products stay hidden
    .filter((p) => !needsParOnly || p.parUnits == null)
    .filter((p) => !q || p.name.toLowerCase().includes(q) || p.section.toLowerCase().includes(q))
    .sort((a, b) => a.section.localeCompare(b.section) || a.name.localeCompare(b.name));

  const bySection = new Map();
  for (const p of all) {
    if (!bySection.has(p.section)) bySection.set(p.section, []);
    bySection.get(p.section).push(p);
  }

  let html = "";
  if (all.length === 0) {
    html = `<div class="empty">No matching products.</div>`;
  }
  for (const [section, items] of bySection) {
    html += `<h2>${esc(section)}</h2><div class="card">`;
    html += items.map((p) => {
      const par = p.parUnits == null
        ? `<span class="badge low">set par</span>`
        : `<span class="sub">par ${formatUnits(p.parUnits, p.packSize)}</span>`;
      return `
        <div class="item" data-barcode="${esc(p.barcode)}">
          <div>
            <div class="name">${esc(p.name)} <span class="sub">${esc(p.size)}</span></div>
            <div class="sub">${esc(p.distributor)} · pack of ${p.packSize}</div>
          </div>
          <div class="qty">
            <div>${formatUnits(p.onHandUnits, p.packSize)}</div>
            ${par}
          </div>
        </div>`;
    }).join("");
    html += `</div>`;
  }

  const list = document.getElementById("inv-list");
  list.innerHTML = html;
  list.querySelectorAll(".item[data-barcode]").forEach((el) => {
    el.addEventListener("click", () => openParEditor(el.dataset.barcode));
  });
}

function openParEditor(barcode) {
  const p = state.products[barcode];
  if (!p) return;
  const cur = p.parUnits == null ? { cases: "", bottles: "" } : toCasesBottles(p.parUnits, p.packSize);
  view.innerHTML = `
    <h2>${esc(p.name)} ${esc(p.size)}</h2>
    <div class="card">
      <div class="sub">${esc(p.distributor)} · ${esc(p.section)} · pack of ${p.packSize}</div>
      <p>On hand: <b>${formatUnits(p.onHandUnits, p.packSize)}</b></p>
      <p><b>Preferred level (par)</b> — the minimum you want on the shelf:</p>
      <div class="par-inputs">
        <input type="number" id="par-cases" min="0" inputmode="numeric" value="${cur.cases}">
        <span class="unit-label">cases</span>
        <input type="number" id="par-bottles" min="0" inputmode="numeric" value="${cur.bottles}">
        <span class="unit-label">bottles</span>
      </div>
      <div class="actions">
        <button class="action" id="par-save">Save par</button>
        <button class="action secondary" id="par-clear">Clear par</button>
        <button class="action secondary" id="par-back">Back</button>
      </div>
    </div>`;

  // Clamp to whole non-negative numbers so junk input ("-3", "2.5", "abc")
  // can never throw inside toUnits or store a nonsense par.
  const cleanQty = (id) => Math.max(0, Math.floor(Number(document.getElementById(id).value) || 0));

  document.getElementById("par-save").addEventListener("click", () => {
    p.parUnits = toUnits(cleanQty("par-cases"), cleanQty("par-bottles"), p.packSize);
    save();
    render(); // full render keeps the Low Stock tab badge in sync
  });
  document.getElementById("par-clear").addEventListener("click", () => {
    p.parUnits = null;
    save();
    render();
  });
  document.getElementById("par-back").addEventListener("click", render);
}

function renderOrders() {
  const groups = orderSuggestions(state.products);
  let html = "";
  if (groups.length === 0) {
    html = `<div class="empty">No orders needed — nothing is below par.</div>`;
  } else {
    const totalCases = groups.reduce((s, g) => s + g.lines.reduce((s2, l) => s2 + l.suggestedCases, 0), 0);
    html += `<div class="card summary-row"><div><b>${groups.length}</b> order sheet${groups.length === 1 ? "" : "s"} · <b>${totalCases}</b> cases total — copy each into WhatsApp or print</div></div>`;
  }
  for (const g of groups) {
    const text = sheetText(g, { storeName: state.storeName });
    html += `
      <h2>${esc(g.distributor)} (${g.lines.length})</h2>
      <pre class="sheet">${esc(text)}</pre>
      <div class="actions no-print">
        <button class="action" data-copy="${esc(encodeURIComponent(text))}">Copy for WhatsApp</button>
      </div>`;
  }
  if (groups.length > 0) {
    html += `<div class="actions no-print"><button class="action secondary" id="print-all">Print all sheets</button></div>`;
  }
  view.innerHTML = html;

  view.querySelectorAll("[data-copy]").forEach((b) => {
    b.addEventListener("click", async () => {
      await navigator.clipboard.writeText(decodeURIComponent(b.dataset.copy));
      b.textContent = "Copied ✓";
      setTimeout(() => { b.textContent = "Copy for WhatsApp"; }, 1500);
    });
  });
  document.getElementById("print-all")?.addEventListener("click", () => window.print());
}

function renderData() {
  const li = state.lastImport;
  view.innerHTML = `
    <h2>POS import</h2>
    <div class="card">
      <p class="sub">Import the item export from the POS (CSV). Re-importing refreshes
      stock numbers; your par levels are kept.</p>
      <p>Last import: <b>${li ? `${fmtDate(li.at)} — ${esc(li.filename ?? "?")} (${li.imported} products${li.badRows?.length ? `, ${li.badRows.length} bad rows` : ""})` : "never"}</b></p>
      <div class="actions">
        <label class="action" for="import-file">Import POS export (CSV)</label>
        <input type="file" id="import-file" accept=".csv,text/csv">
      </div>
      <div id="import-report"></div>
    </div>

    <h2>Demo data</h2>
    <div class="card">
      <p class="sub">Load a 40-product sample inventory (with a few par levels
      preset) to try the app. Replaces whatever is currently loaded.</p>
      <div class="actions">
        <button class="action secondary" id="load-demo">Load demo data</button>
      </div>
    </div>

    <h2>Backup</h2>
    <div class="card">
      <p class="sub">Everything you've entered (par levels) lives only in this
      browser — back it up regularly.</p>
      <p>Last backup: <b>${fmtDate(state.lastBackupAt)}</b></p>
      <div class="actions">
        <button class="action" id="backup-export">Download backup file</button>
        <label class="action secondary" for="backup-file">Restore from backup</label>
        <input type="file" id="backup-file" accept=".json,application/json">
      </div>
      <div id="backup-report"></div>
    </div>

    <h2>Store</h2>
    <div class="card">
      <p class="sub">Shown on order sheets.</p>
      <input type="text" id="store-name" placeholder="Store name" value="${esc(state.storeName)}">
    </div>`;

  document.getElementById("import-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const { products, report } = importExport(String(reader.result), state.products, { filename: file.name });
      const box = document.getElementById("import-report");
      if (!report.ok) {
        box.innerHTML = `<div class="notice warn">Import failed: ${esc(report.error)}</div>`;
        return;
      }
      state.products = products;
      state.lastImport = {
        at: report.importedAt,
        filename: report.filename,
        imported: report.imported,
        badRows: report.badRows,
      };
      save();
      const bad = report.badRows.length
        ? `<div class="notice warn">Skipped ${report.badRows.length} bad row(s):<br>` +
          report.badRows.slice(0, 10).map((r) => `line ${r.line}: ${esc(r.reason)}`).join("<br>") +
          (report.badRows.length > 10 ? "<br>…" : "") + `</div>`
        : "";
      const gone = report.delisted
        ? `<div class="notice warn">${report.delisted} product(s) no longer in the export — hidden from lists (pars kept in case they return).</div>`
        : "";
      box.innerHTML = `<div class="notice ok">Imported ${report.imported} products from ${esc(file.name)}.</div>${bad}${gone}`;
      renderDataHeaderOnly();
    };
    reader.readAsText(file);
  });

  document.getElementById("backup-export").addEventListener("click", () => {
    state.lastBackupAt = new Date().toISOString();
    save();
    const blob = new Blob([exportBackup(state)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `store-reorder-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    renderData();
  });

  document.getElementById("backup-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importBackup(String(reader.result));
      const box = document.getElementById("backup-report");
      if (result.error) {
        box.innerHTML = `<div class="notice warn">Restore failed: ${esc(result.error)}</div>`;
        return;
      }
      state = result.state;
      save();
      box.innerHTML = `<div class="notice ok">Backup restored — ${productCount()} products.</div>`;
      renderDataHeaderOnly();
    };
    reader.readAsText(file);
  });

  document.getElementById("store-name").addEventListener("change", (e) => {
    state.storeName = e.target.value;
    save();
  });

  wireDemoButton();
}

function wireDemoButton() {
  const btn = document.getElementById("load-demo");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "Loading…";
    try {
      const { products, report } = await loadDemoData();
      state.products = products;
      state.lastImport = {
        at: report.importedAt,
        filename: report.filename,
        imported: report.imported,
        badRows: report.badRows,
      };
      if (!state.storeName) state.storeName = "Demo Store";
      save();
      currentTab = "low";
      render();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Load demo data";
      alert(`Demo load failed: ${err.message}`);
    }
  });
}

// Refresh the freshness line without re-rendering (keeps report notices visible).
function renderDataHeaderOnly() {
  freshness.textContent = state.lastImport
    ? `inventory as of ${fmtDate(state.lastImport.at)}`
    : "no inventory loaded";
}

// ------------------------------------------------------------------- wiring

document.querySelectorAll(".tab").forEach((b) => {
  b.addEventListener("click", () => {
    currentTab = b.dataset.tab;
    needsParOnly = false; // tab bar always opens the full inventory view
    render();
  });
});

render();
