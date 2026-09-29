import { kgPerMeter, lengthFromWeight, weightFromLength } from './steel';

const galva035 = { widthM: 1.22, thicknessMm: 0.35 };

describe('conversion poids ↔ longueur', () => {
  it('reproduit l’exemple du cahier des charges (5 000 kg ≈ 1 492 m)', () => {
    expect(lengthFromWeight(5000, galva035)).toBeCloseTo(1491.7, 1);
  });
  it('donne la masse d’un mètre linéaire', () => {
    expect(kgPerMeter(galva035)).toBeCloseTo(3.352, 3);
  });
  it('est réversible', () => {
    const m = lengthFromWeight(2140, galva035);
    expect(weightFromLength(m, galva035)).toBeCloseTo(2140, 6);
  });
  it('applique le coefficient de revêtement', () => {
    const heavier = { ...galva035, coatingFactor: 1.04 };
    expect(lengthFromWeight(5000, heavier)).toBeLessThan(lengthFromWeight(5000, galva035));
  });
  it('refuse les formats et poids impossibles', () => {
    expect(() => lengthFromWeight(100, { widthM: 0, thicknessMm: 0.35 })).toThrow(RangeError);
    expect(() => lengthFromWeight(100, { widthM: 1.22, thicknessMm: -1 })).toThrow(RangeError);
    expect(() => lengthFromWeight(-5, galva035)).toThrow(RangeError);
  });
});
