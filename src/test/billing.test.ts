import { describe, it, expect } from "vitest";
import { billTotal, units } from "@/lib/billing";

describe("billing", () => {
  it("charges fixed per-unit rate", () => {
    expect(billTotal({ rent: 3000, water_prev: 10, water_curr: 15, electric_prev: 100, electric_curr: 150, water_rate: 18, electric_rate: 8 })).toBe(3000 + 90 + 400);
  });
  it("never negative units", () => {
    expect(units(20, 10)).toBe(0);
  });
});
