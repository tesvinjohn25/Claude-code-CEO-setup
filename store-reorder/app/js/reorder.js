// Deterministic reorder math. Plan §10: suggestions are never negative,
// always whole packs, and the arithmetic is exposed for display.

export function shortageUnits(product) {
  if (product.parUnits == null) return 0;
  return Math.max(0, product.parUnits - product.onHandUnits);
}

export function suggestedCases(product) {
  const s = shortageUnits(product);
  if (s <= 0) return 0;
  return Math.ceil(s / product.packSize);
}

export function lowStock(products) {
  return Object.values(products)
    .filter((p) => p.parUnits != null && p.onHandUnits < p.parUnits)
    .map((p) => ({ ...p, shortageUnits: shortageUnits(p), suggestedCases: suggestedCases(p) }))
    .sort((a, b) => b.shortageUnits / b.parUnits - a.shortageUnits / a.parUnits);
}

export function zeroStock(products) {
  return Object.values(products)
    .filter((p) => p.onHandUnits === 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function unsetPar(products) {
  return Object.values(products).filter((p) => p.parUnits == null);
}

// Group order suggestions by distributor for the order sheets.
export function orderSuggestions(products) {
  const byDistributor = new Map();
  for (const item of lowStock(products)) {
    if (item.suggestedCases <= 0) continue;
    if (!byDistributor.has(item.distributor)) byDistributor.set(item.distributor, []);
    byDistributor.get(item.distributor).push(item);
  }
  return [...byDistributor.entries()]
    .map(([distributor, lines]) => ({
      distributor,
      lines: lines.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.distributor.localeCompare(b.distributor));
}
