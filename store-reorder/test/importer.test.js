import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { importExport } from "../app/js/importer.js";

const FIXTURE = readFileSync(
  new URL("./fixtures/fake-liquorpos-export.csv", import.meta.url),
  "utf8",
);

describe("POS export import (plan §3.1, §12)", () => {
  test("imports the full fixture with no bad rows", () => {
    const { products, report } = importExport(FIXTURE, {}, { filename: "fixture.csv" });
    expect(report.ok).toBe(true);
    expect(report.imported).toBe(40);
    expect(report.badRows).toEqual([]);
    expect(Object.keys(products).length).toBe(40);

    const jw = products["080432400630"];
    expect(jw.name).toBe("Johnnie Walker Black");
    expect(jw.packSize).toBe(12);
    expect(jw.onHandUnits).toBe(54);
    expect(jw.distributor).toBe("Southern Glazers");
    expect(jw.parUnits).toBe(null);
  });

  test("re-import preserves par levels (the load-bearing P0a scenario)", () => {
    const first = importExport(FIXTURE, {});
    first.products["080432400630"].parUnits = 60;

    const second = importExport(FIXTURE, first.products);
    expect(second.products["080432400630"].parUnits).toBe(60);
    expect(second.products["080432400630"].onHandUnits).toBe(54);
  });

  test("re-importing the same file twice changes nothing (idempotent)", () => {
    const first = importExport(FIXTURE, {});
    const second = importExport(FIXTURE, first.products);
    expect(second.products).toEqual(first.products);
  });

  test("re-import refreshes on-hand from the new file", () => {
    const first = importExport(FIXTURE, {});
    first.products["080432400630"].parUnits = 60;
    const updated = FIXTURE.replace(
      "080432400630,Johnnie Walker Black,750ml,12,Whiskey,Southern Glazers,54",
      "080432400630,Johnnie Walker Black,750ml,12,Whiskey,Southern Glazers,30",
    );
    const second = importExport(updated, first.products);
    expect(second.products["080432400630"].onHandUnits).toBe(30);
    expect(second.products["080432400630"].parUnits).toBe(60);
  });

  test("bad rows are reported with line numbers, not silently skipped", () => {
    const csv = [
      "Barcode,Description,Size,Pack,Dept,Vendor,On Hand",
      "111,Good Vodka,750ml,12,Vodka,Acme,10",
      ",Missing Barcode,750ml,12,Vodka,Acme,10",
      "222,Bad Pack,750ml,zero,Vodka,Acme,10",
      "333,Bad OnHand,750ml,12,Vodka,Acme,-3",
      "111,Duplicate Barcode,750ml,12,Vodka,Acme,10",
    ].join("\n");
    const { products, report } = importExport(csv, {});
    expect(report.ok).toBe(true);
    expect(report.imported).toBe(1);
    expect(Object.keys(products)).toEqual(["111"]);
    expect(report.badRows).toEqual([
      { line: 3, reason: "missing barcode" },
      { line: 4, reason: 'invalid pack size "zero"' },
      { line: 5, reason: 'invalid on-hand quantity "-3"' },
      { line: 6, reason: "duplicate barcode 111" },
    ]);
  });

  test("missing expected columns fails loudly and keeps existing data", () => {
    const existing = importExport(FIXTURE, {}).products;
    const { products, report } = importExport("Wrong,Header\n1,2", existing);
    expect(report.ok).toBe(false);
    expect(report.error).toContain("missing expected column");
    expect(products).toEqual(existing);
  });

  test("empty file fails loudly", () => {
    const { report } = importExport("", {});
    expect(report.ok).toBe(false);
  });
});
