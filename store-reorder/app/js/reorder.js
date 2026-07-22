// Deterministic reorder math.
//
// The owner's confirmed rule: reorder when on-hand falls below the average
// monthly sales. That is the default here — the "effective par" for a
// product is its manual par if the owner set one, otherwise
// ceil(avgMonthlySales × coverMonths) with coverMonths defaulting to 1.
// Dead-catalog items (no sales, no manual par) never alert: the owner keeps
// them on purpose for rare special orders.
//
// Negative on-hand (sold before the inventory update) counts as 0 in the
// math and is surfaced separately via needsInventoryFix().

export const DEFAULT_COVER_MONTHS = 1;

function activeProducts(products) {
  return Object.values(products).filter((p) => p.active !== false);
}

export function effectiveOnHand(p) {
  return Math.max(0, p.onHandUnits);
}

// Manual par wins; otherwise derived from sales velocity; null = no target.
export function effectivePar(p, coverMonths = DEFAULT_COVER_MONTHS) {
  if (p.parUnits != null) return p.parUnits;
  if (p.avgMonthlyUnits > 0) return Math.ceil(p.avgMonthlyUnits * coverMonths);
  return null;
}

export function parSource(p) {
  if (p.parUnits != null) return "manual";
  if (p.avgMonthlyUnits > 0) return "auto";
  return null;
}

export function shortageUnits(p, coverMonths = DEFAULT_COVER_MONTHS) {
  const par = effectivePar(p, coverMonths);
  if (par == null) return 0;
  return Math.max(0, par - effectiveOnHand(p));
}

export function suggestedCases(p, coverMonths = DEFAULT_COVER_MONTHS) {
  const s = shortageUnits(p, coverMonths);
  if (s <= 0) return 0;
  return Math.ceil(s / p.packSize);
}

export function lowStock(products, coverMonths = DEFAULT_COVER_MONTHS) {
  return activeProducts(products)
    .filter((p) => {
      const par = effectivePar(p, coverMonths);
      return par != null && par > 0 && effectiveOnHand(p) < par;
    })
    .map((p) => ({
      ...p,
      effParUnits: effectivePar(p, coverMonths),
      parSource: parSource(p),
      shortageUnits: shortageUnits(p, coverMonths),
      suggestedCases: suggestedCases(p, coverMonths),
    }))
    .sort((a, b) => b.shortageUnits / b.effParUnits - a.shortageUnits / a.effParUnits);
}

// Zero list stays meaningful at 8k products: only items that actually sell
// (or that the owner set a par on) — not the intentional dead catalog.
export function zeroStock(products) {
  return activeProducts(products)
    .filter((p) => p.onHandUnits <= 0 && (p.avgMonthlyUnits > 0 || p.parUnits != null))
    .sort((a, b) => (b.avgMonthlyUnits ?? 0) - (a.avgMonthlyUnits ?? 0));
}

// Products whose on-hand is negative: the inventory record needs fixing.
export function needsInventoryFix(products) {
  return activeProducts(products)
    .filter((p) => p.onHandUnits < 0)
    .sort((a, b) => a.onHandUnits - b.onHandUnits);
}

// "Set par" prompts only matter for exports without sales history (the demo
// format) — with real sales data the auto par covers everything that moves.
export function unsetPar(products) {
  return activeProducts(products)
    .filter((p) => p.parUnits == null && p.avgMonthlyUnits == null);
}

export function orderSuggestions(products, coverMonths = DEFAULT_COVER_MONTHS) {
  const byDistributor = new Map();
  for (const item of lowStock(products, coverMonths)) {
    if (item.suggestedCases <= 0) continue;
    const key = item.distributor || "Order list";
    if (!byDistributor.has(key)) byDistributor.set(key, []);
    byDistributor.get(key).push(item);
  }
  return [...byDistributor.entries()]
    .map(([distributor, lines]) => ({
      distributor,
      lines: lines.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.distributor.localeCompare(b.distributor));
}
