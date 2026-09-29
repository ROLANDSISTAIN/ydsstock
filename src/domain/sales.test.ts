import { creditHeadroom, documentTotals, lineAmount } from './sales';

describe('lineAmount', () => {
  it('vend les tôles au mètre linéaire : 12 feuilles × 4,20 m × 4 500', () => {
    expect(lineAmount({ kind: 'cut', sheets: 12, lengthM: 4.2, pricePerMeter: 4500 })).toBe(226_800);
  });
  it('vend à l’unité : 5 kg de pointes × 1 400', () => {
    expect(lineAmount({ kind: 'unit', quantity: 5, unitPrice: 1400 })).toBe(7_000);
  });
  it('arrondit chaque ligne à l’unité', () => {
    expect(lineAmount({ kind: 'unit', quantity: 2.5, unitPrice: 333 })).toBe(833);
  });
  it('refuse les quantités impossibles', () => {
    expect(() => lineAmount({ kind: 'cut', sheets: 0, lengthM: 3, pricePerMeter: 4500 })).toThrow(RangeError);
    expect(() => lineAmount({ kind: 'unit', quantity: -1, unitPrice: 100 })).toThrow(RangeError);
  });
});

describe('documentTotals (ticket de la maquette, client pro à 5 %)', () => {
  const totals = documentTotals(
    [
      { kind: 'cut', sheets: 12, lengthM: 4.2, pricePerMeter: 4500 },
      { kind: 'unit', quantity: 6, unitPrice: 3500 },
      { kind: 'unit', quantity: 5, unitPrice: 1400 },
    ],
    5,
  );
  it('calcule sous-total, remise et total', () => {
    expect(totals).toEqual({ subtotal: 254_800, discount: 12_740, total: 242_060 });
  });
});

describe('creditHeadroom', () => {
  it('bloque une vente qui dépasse le plafond (Ets Kodjo BTP)', () => {
    expect(creditHeadroom(2_940_000, 3_000_000, 100_000)).toBe(-40_000);
  });
});
