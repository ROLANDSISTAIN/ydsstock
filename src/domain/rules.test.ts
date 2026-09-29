import { applyStockMove, roundQty, StockError, weightedAverageCost } from './stock';
import { nextNumber } from './numbering';
import { checkCredit, clientBalance, CreditError, creditUsagePct } from './accounts';

describe('stock', () => {
  it('ajoute et retire', () => {
    expect(applyStockMove(100, 25.5, 'Bac')).toBe(125.5);
    expect(applyStockMove(100, -40, 'Bac')).toBe(60);
  });
  it('refuse un stock négatif par défaut', () => {
    expect(() => applyStockMove(10, -12, 'Bac 0,35 bleu')).toThrow(StockError);
    expect(() => applyStockMove(10, -12, 'Bac 0,35 bleu')).toThrow(/10 disponible, 12 demandé/);
  });
  it('l’autorise sur demande explicite', () => {
    expect(applyStockMove(10, -12, 'Bac', true)).toBe(-2);
  });
  it('élimine les restes de calcul', () => {
    expect(roundQty(0.1 + 0.2)).toBe(0.3);
  });
  it('calcule le coût moyen pondéré', () => {
    expect(weightedAverageCost(100, 2400, 100, 2600)).toBe(2500);
    expect(weightedAverageCost(0, 2400, 50, 2600)).toBe(2600);
    expect(weightedAverageCost(100, 2400, 0, 9999)).toBe(2400);
  });
});

describe('numérotation', () => {
  it('suit une séquence continue par année', () => {
    const a = nextNumber({}, 'FA', 2026);
    expect(a.number).toBe('FA-2026-00001');
    const b = nextNumber(a.counters, 'FA', 2026);
    expect(b.number).toBe('FA-2026-00002');
    expect(nextNumber(b.counters, 'FA', 2027).number).toBe('FA-2027-00001');
    expect(nextNumber(b.counters, 'DV', 2026).number).toBe('DV-2026-00001');
  });
  it('ne modifie pas les compteurs d’origine', () => {
    const counters = { 'FA-2026': 4 };
    nextNumber(counters, 'FA', 2026);
    expect(counters).toEqual({ 'FA-2026': 4 });
  });
});

describe('compte client', () => {
  it('calcule le solde dû', () => {
    expect(
      clientBalance([
        { kind: 'facture', amount: 500_000 },
        { kind: 'reglement', amount: 200_000 },
        { kind: 'avoir', amount: 50_000 },
      ]),
    ).toBe(250_000);
  });
  it('refuse le crédit à un client comptoir', () => {
    expect(() => checkCredit('Client comptoir', { creditAllowed: false, creditLimit: 0 }, 0, 1)).toThrow(CreditError);
  });
  it('accepte une vente payée en entier sans condition', () => {
    expect(() => checkCredit('Client comptoir', { creditAllowed: false, creditLimit: 0 }, 0, 0)).not.toThrow();
  });
  it('bloque au-delà du plafond', () => {
    const policy = { creditAllowed: true, creditLimit: 3_000_000 };
    expect(() => checkCredit('Ets Kodjo BTP', policy, 2_940_000, 100_000)).toThrow(/Plafond de crédit dépassé/);
    expect(() => checkCredit('Ets Kodjo BTP', policy, 2_940_000, 60_000)).not.toThrow();
  });
  it('donne la part du plafond utilisée', () => {
    expect(creditUsagePct(2_940_000, 3_000_000)).toBe(98);
    expect(creditUsagePct(-10, 3_000_000)).toBe(0);
  });
});
