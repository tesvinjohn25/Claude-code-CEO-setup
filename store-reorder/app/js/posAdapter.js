// ============================================================================
// RELINK POINT — the only file that knows what the POS export looks like.
//
// Today ACTIVE_FORMAT describes the synthetic fixture in
// app/demo-data.csv. When the real LiquorPOS export
// arrives: add a new format object with the real column names (and any
// parsing quirks), point ACTIVE_FORMAT at it, and re-run the test suite.
// Nothing outside this file should ever mention a POS column name.
// ============================================================================

export const FAKE_EXPORT_FORMAT = {
  id: "fake-v1",
  label: "Synthetic LiquorPOS export (placeholder until real file arrives)",
  columns: {
    barcode: "Barcode",
    name: "Description",
    size: "Size",
    packSize: "Pack",
    distributor: "Vendor",
    section: "Dept",
    onHand: "On Hand",
  },
};

export const ACTIVE_FORMAT = FAKE_EXPORT_FORMAT;

// Normalize one raw CSV record into the app's internal product shape.
// Returns { product } or { error } — never throws on bad data, because a
// bad row must become a report line, not a crashed import.
export function normalizeRow(rec, format = ACTIVE_FORMAT) {
  const col = format.columns;
  const get = (key) => rec[col[key]] ?? "";

  const barcode = get("barcode");
  const name = get("name");
  const packRaw = get("packSize");
  const onHandRaw = get("onHand");

  if (!barcode) return { error: "missing barcode" };
  if (!name) return { error: "missing description" };

  const packSize = Number(packRaw);
  if (!Number.isInteger(packSize) || packSize < 1) {
    return { error: `invalid pack size "${packRaw}"` };
  }

  const onHandUnits = Number(onHandRaw);
  if (!Number.isFinite(onHandUnits) || onHandUnits < 0 || !Number.isInteger(onHandUnits)) {
    return { error: `invalid on-hand quantity "${onHandRaw}"` };
  }

  return {
    product: {
      barcode,
      name,
      size: get("size"),
      packSize,
      distributor: get("distributor") || "(no distributor)",
      section: get("section") || "(no section)",
      onHandUnits,
    },
  };
}

// Check that the export's header contains every column the format expects.
export function missingColumns(header, format = ACTIVE_FORMAT) {
  return Object.values(format.columns).filter((c) => !header.includes(c));
}
