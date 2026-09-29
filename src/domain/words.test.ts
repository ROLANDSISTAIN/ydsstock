import { amountInWords, numberToFrenchWords } from './words';

describe('montant en lettres', () => {
  it.each([
    [1, 'un'],
    [17, 'dix-sept'],
    [21, 'vingt et un'],
    [71, 'soixante et onze'],
    [80, 'quatre-vingts'],
    [81, 'quatre-vingt-un'],
    [91, 'quatre-vingt-onze'],
    [99, 'quatre-vingt-dix-neuf'],
    [100, 'cent'],
    [200, 'deux cents'],
    [201, 'deux cent un'],
    [1000, 'mille'],
    [2000, 'deux mille'],
    [200_000, 'deux cent mille'],
    [80_000, 'quatre-vingt mille'],
    [1_000_000, 'un million'],
    [2_845_600, 'deux millions huit cent quarante-cinq mille six cents'],
    [242_060, 'deux cent quarante-deux mille soixante'],
  ])('%i → %s', (n, words) => {
    expect(numberToFrenchWords(n)).toBe(words);
  });

  it('formule la mention de facture', () => {
    expect(amountInWords(242_060)).toBe('Deux cent quarante-deux mille soixante francs CFA');
    expect(amountInWords(1)).toBe('Un franc CFA');
  });

  it('refuse un montant non entier', () => {
    expect(() => numberToFrenchWords(1.5)).toThrow(RangeError);
  });
});
