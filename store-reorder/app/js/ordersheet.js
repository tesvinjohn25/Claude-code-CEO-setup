import { formatUnits } from "./units.js";

// Plain-text order sheet for one distributor — clean enough to paste
// straight into WhatsApp or an email body.
export function sheetText(group, meta = {}) {
  const lines = [];
  const date = meta.date ?? new Date().toISOString().slice(0, 10);
  lines.push(`ORDER — ${group.distributor}`);
  if (meta.storeName) lines.push(meta.storeName);
  lines.push(date);
  lines.push("");
  for (const item of group.lines) {
    const label = item.size ? `${item.name} ${item.size}` : item.name;
    lines.push(`${item.suggestedCases} cs — ${label}`);
  }
  lines.push("");
  lines.push(`${group.lines.length} item${group.lines.length === 1 ? "" : "s"}`);
  return lines.join("\n");
}

// One-line explanation of the arithmetic behind a suggestion (plan §10.10).
export function explainSuggestion(item) {
  return (
    `par ${formatUnits(item.parUnits, item.packSize)} − ` +
    `on hand ${formatUnits(item.onHandUnits, item.packSize)} = ` +
    `short ${item.shortageUnits} btl → ` +
    `${item.suggestedCases} cs (pack of ${item.packSize})`
  );
}
