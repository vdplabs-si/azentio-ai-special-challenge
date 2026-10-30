import { describe, it, expect } from "bun:test";
import { REGIONS } from "@/content/catalogue";
import { coarsenPeriod, coarsenRegion, findLocationMentions } from "@/server/learning/coarsen";

describe("coarsenRegion", () => {
  it("keeps REGIONS values unchanged", () => {
    for (const r of REGIONS) expect(coarsenRegion(r)).toBe(r);
    expect(coarsenRegion("middle east")).toBe("Middle East");
  });
  it("maps countries and cities to broad regions", () => {
    expect(coarsenRegion("Dubai")).toBe("Middle East");
    expect(coarsenRegion("Riyadh, Saudi Arabia")).toBe("Middle East");
    expect(coarsenRegion("Lagos")).toBe("Africa");
    expect(coarsenRegion("Nairobi, Kenya")).toBe("Africa");
    expect(coarsenRegion("Mumbai")).toBe("South Asia");
    expect(coarsenRegion("Kuala Lumpur")).toBe("South East Asia");
    expect(coarsenRegion("Southeast Asia")).toBe("South East Asia");
    expect(coarsenRegion("London, UK")).toBe("Europe");
  });
  it("falls back to Other", () => {
    expect(coarsenRegion("Toronto")).toBe("Other");
    expect(coarsenRegion("")).toBe("Other");
    expect(coarsenRegion(null)).toBe("Other");
  });
  it("does not match place names inside other words", () => {
    expect(coarsenRegion("Romania")).toBe("Other"); // contains "oman"
  });
  it("always returns a REGIONS value", () => {
    for (const s of ["Doha", "Jakarta", "Paris", "Mars", "Karachi"]) expect(REGIONS).toContain(coarsenRegion(s));
  });
});

describe("findLocationMentions", () => {
  it("finds city/country mentions for redaction, not broad regions", () => {
    const m = findLocationMentions("A bank in Dubai and another in New Delhi; overall the Middle East is growing.");
    expect(m.map((x) => x.term.toLowerCase())).toEqual(["dubai", "new delhi"]);
    expect(m[0]!.region).toBe("Middle East");
    expect(m[1]!.region).toBe("South Asia");
  });
});

describe("coarsenPeriod", () => {
  const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
  it("labels half-years with the start of that half", () => {
    const p = coarsenPeriod(d("2026-03-14"));
    expect(p.label).toBe("2026 H1");
    expect(p.periodStart.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    const q = coarsenPeriod(d("2026-07-01"), d("2026-11-30"));
    expect(q.label).toBe("2026 H2");
    expect(q.periodStart.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });
  it("labels spans across halves", () => {
    expect(coarsenPeriod(d("2025-11-01"), d("2026-02-01")).label).toBe("2025 H2–2026 H1");
  });
  it("supports yearly granularity", () => {
    const p = coarsenPeriod(d("2026-03-14"), d("2026-04-01"), "year");
    expect(p.label).toBe("2026");
    expect(p.periodStart.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(coarsenPeriod(d("2025-03-14"), d("2026-04-01"), "year").label).toBe("2025–2026");
  });
  it("ignores an end before the start", () => {
    expect(coarsenPeriod(d("2026-08-01"), d("2026-01-01")).label).toBe("2026 H2");
  });
});
