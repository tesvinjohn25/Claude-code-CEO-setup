import { parseCsvWithHeader } from "./csv.js";
import { normalizeRow, missingColumns, ACTIVE_FORMAT } from "./posAdapter.js";

// Import a POS export. Merges into the existing product map by barcode:
// POS-owned fields (name, size, pack, distributor, section, on-hand) are
// refreshed; app-owned fields (par) always survive re-imports.
//
// Returns { products, report }. Never throws on bad rows — they land in
// report.badRows with line numbers and reasons.
export function importExport(csvText, existingProducts = {}, meta = {}) {
  const { header, records } = parseCsvWithHeader(csvText);

  const missing = missingColumns(header);
  if (header.length === 0 || missing.length > 0) {
    return {
      products: existingProducts,
      report: {
        ok: false,
        error: header.length === 0
          ? "file is empty"
          : `export is missing expected column(s): ${missing.join(", ")}`,
        imported: 0,
        badRows: [],
      },
    };
  }

  const products = { ...existingProducts };
  const seenBarcodes = new Set();
  const badRowBarcodes = new Set();
  const badRows = [];
  let imported = 0;

  for (const rec of records) {
    const result = normalizeRow(rec);
    if (result.error) {
      badRows.push({ line: rec.__line, reason: result.error });
      // If the broken row still carried a barcode, remember it so the
      // product isn't wrongly treated as delisted below.
      const bc = rec[ACTIVE_FORMAT.columns.barcode];
      if (bc) badRowBarcodes.add(bc);
      continue;
    }
    const p = result.product;
    if (seenBarcodes.has(p.barcode)) {
      badRows.push({ line: rec.__line, reason: `duplicate barcode ${p.barcode}` });
      continue;
    }
    seenBarcodes.add(p.barcode);

    const existing = products[p.barcode];
    products[p.barcode] = {
      ...p,
      parUnits: existing?.parUnits ?? null, // app-owned: survives re-import
      active: true,
    };
    imported++;
  }

  // Products absent from this export are delisted: hidden from every list
  // but kept (with their par) in case they return in a later export.
  // Products whose row was merely broken keep their previous data.
  let delisted = 0;
  for (const [barcode, p] of Object.entries(products)) {
    if (seenBarcodes.has(barcode) || badRowBarcodes.has(barcode)) continue;
    if (p.active !== false) delisted++;
    products[barcode] = { ...p, active: false };
  }

  return {
    products,
    report: {
      ok: true,
      imported,
      badRows,
      delisted,
      formatId: ACTIVE_FORMAT.id,
      filename: meta.filename ?? null,
      importedAt: meta.importedAt ?? new Date().toISOString(),
    },
  };
}
