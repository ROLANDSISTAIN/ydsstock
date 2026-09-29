import { convert, coveredArea } from './units';

const pointes = {
  stockUnit: 'kg',
  conversions: [
    { unit: 'paquet', stockUnitsPerUnit: 1 },
    { unit: 'carton', stockUnitsPerUnit: 25 },
  ],
};

describe('convert', () => {
  it('convertit cartons ↔ kg', () => {
    expect(convert(pointes, 2, 'carton', 'kg')).toBe(50);
    expect(convert(pointes, 75, 'kg', 'carton')).toBe(3);
  });
  it('refuse une unité inconnue', () => {
    expect(() => convert(pointes, 1, 'sac', 'kg')).toThrow(/non définie/);
  });
});

describe('coveredArea', () => {
  it('utilise la largeur utile, pas la largeur de feuille', () => {
    expect(coveredArea(12, 4.2, 1.0)).toBeCloseTo(50.4, 6);
  });
});
