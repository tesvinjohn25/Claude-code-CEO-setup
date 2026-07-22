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
  const badRows = [];
  let imported = 0;

  for (const rec of records) {
    const result = normalizeRow(rec);
    if (result.error) {
      badRows.push({ line: rec.__line, reason: result.error });
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
    };
    imported++;
  }

  return {
    products,
    report: {
      ok: true,
      imported,
      badRows,
      formatId: ACTIVE_FORMAT.id,
      filename: meta.filename ?? null,
      importedAt: meta.importedAt ?? new Date().toISOString(),
    },
  };
}
