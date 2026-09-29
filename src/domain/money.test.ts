import { discountAmount, formatFcfa, roundFcfa } from './money';

describe('roundFcfa', () => {
  it('arrondit à l’unité, 0,5 vers le haut', () => {
    expect(roundFcfa(1234.4)).toBe(1234);
    expect(roundFcfa(1234.5)).toBe(1235);
  });
  it('traite les avoirs (montants négatifs) symétriquement', () => {
    expect(roundFcfa(-1234.5)).toBe(-1235);
    expect(roundFcfa(-0.2)).toBe(0);
  });
  it('refuse un montant non fini', () => {
    expect(() => roundFcfa(Number.NaN)).toThrow(RangeError);
  });
});

describe('formatFcfa', () => {
  it('groupe les milliers et ajoute l’unité', () => {
    // Intl fr-FR sépare les milliers par une espace fine insécable.
    expect(formatFcfa(2845600).replace(/\s/g, ' ')).toBe('2 845 600 FCFA');
    expect(formatFcfa(950, false)).toBe('950');
  });
});

describe('discountAmount', () => {
  it('calcule une remise pro arrondie', () => {
    expect(discountAmount(275_400, 5)).toBe(13_770);
    expect(discountAmount(99_999, 8)).toBe(8_000);
  });
  it('refuse une remise hors 0–100 %', () => {
    expect(() => discountAmount(1000, 120)).toThrow(RangeError);
  });
});
