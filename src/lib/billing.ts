/** Units used, never negative. */
export const units = (prev: number, curr: number) => Math.max(0, Number(curr) - Number(prev));

/** Bill total = rent + other fee + water units × water rate + electric units × electric rate. */
export function billTotal(b: {
  rent: number; water_prev: number; water_curr: number; electric_prev: number; electric_curr: number;
  water_rate: number; electric_rate: number; other_fee?: number | null;
}) {
  return (
    Number(b.rent) +
    Number(b.other_fee ?? 0) +
    units(b.water_prev, b.water_curr) * Number(b.water_rate) +
    units(b.electric_prev, b.electric_curr) * Number(b.electric_rate)
  );
}
