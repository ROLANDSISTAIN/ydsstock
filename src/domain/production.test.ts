import { analyseProduction, isAbnormalLoss, productionCost } from './production';

const format = { widthM: 1.22, thicknessMm: 0.35 };

describe('analyseProduction (OF-2026-0142 de la maquette)', () => {
  const result = analyseProduction({
    format,
    consumedKg: 1190,
    lines: [
      { sheets: 40, lengthM: 4.2 },
      { sheets: 60, lengthM: 3.0 },
    ],
  });

  it('additionne les mètres produits', () => {
    expect(result.producedM).toBeCloseTo(348, 6);
  });
  it('calcule le théorique et le rendement', () => {
    expect(result.theoreticalM).toBeCloseTo(355.02, 2);
    expect(result.yieldPct).toBeCloseTo(98.02, 2);
  });
  it('déduit les chutes en mètres et en kg', () => {
    expect(result.scrapM).toBeCloseTo(7.02, 2);
    expect(result.scrapKg).toBeCloseTo(23.5, 1);
  });
});

describe('contrôles de cohérence', () => {
  it('refuse une production supérieure à la matière consommée', () => {
    expect(() =>
      analyseProduction({ format, consumedKg: 100, lines: [{ sheets: 20, lengthM: 3 }] }),
    ).toThrow(/vérifier la pesée/);
  });
  it('refuse un nombre de feuilles non entier', () => {
    expect(() =>
      analyseProduction({ format, consumedKg: 1000, lines: [{ sheets: 2.5, lengthM: 3 }] }),
    ).toThrow(RangeError);
  });
  it('signale une perte anormale sous 94 % (objectif 97 %, tolérance 3 %)', () => {
    expect(isAbnormalLoss(93.1)).toBe(true);
    expect(isAbnormalLoss(96.4)).toBe(false);
  });
});

describe('productionCost', () => {
  it('calcule le coût de revient par mètre', () => {
    const cost = productionCost({
      consumedKg: 1190,
      pricePerKg: 685,
      consumables: 12_000,
      machineAndLabour: 45_000,
      producedM: 348,
    });
    expect(cost.material).toBe(815_150);
    expect(cost.total).toBe(872_150);
    expect(cost.perMeter).toBe(2_506);
  });
});
