import * as cmd from './commands';
import { clientBalanceOf, invoiceDue, invoiceState, salesSummary } from './queries';
import { emptyDatabase, WALK_IN_CLIENT_ID, type Database } from './schema';
import { buildDemoDatabase, demoCompany } from './seed';
import { execute } from './transaction';

const NOW = new Date('2026-09-29T10:00:00');

/** Petite base : 2 articles, 1 client pro, 1 bobine. */
function base() {
  let db = emptyDatabase(demoCompany);
  const run = <R,>(f: (d: Database, c: cmd.Ctx) => R): R => {
    const out = execute(db, f, NOW);
    db = out.db;
    return out.result;
  };
  const bac = run((d, c) => cmd.createArticle(d, c, { ref: 'BAC35', name: 'Bac 0,35 bleu', family: 'toles', saleMode: 'cut', unit: 'ml', price: 4500, cost: 3000, minStock: 100, fabricated: true, swatch: '', openingStock: 100 }));
  const pointes = run((d, c) => cmd.createArticle(d, c, { ref: 'PT80', name: 'Pointes 80', family: 'clous', saleMode: 'unit', unit: 'kg', price: 1400, cost: 800, minStock: 10, fabricated: true, swatch: '', openingStock: 50 }));
  const pro = run((d, c) => cmd.createClient(d, c, { name: 'Ets Kodjo BTP', phone: '', address: '', category: 'pro', discountPct: 8, creditAllowed: true, creditLimit: 350_000 }));
  const coil = run((d, c) => cmd.receiveCoil(d, c, { ref: 'B-1', material: 'galvanise', thicknessMm: 0.35, widthM: 1.22, color: '', ral: '', supplier: 'Fournisseur', weighedKg: 5000, invoicedKg: 5000, pricePerKg: 685, location: '' }));
  return { get db() { return db; }, run, bac, pointes, pro, coil };
}

describe('vente (facture)', () => {
  it('sort le stock, numérote et enregistre le paiement', () => {
    const t = base();
    const inv = t.run((d, c) => cmd.createInvoice(d, c, { clientId: WALK_IN_CLIENT_ID, lines: [{ articleId: t.bac.id, sheets: 10, lengthM: 4 }, { articleId: t.pointes.id, quantity: 5 }] }, { amount: 'total', mode: 'especes' }));
    expect(inv.number).toBe('FA-2026-00001');
    expect(inv.totals.total).toBe(10 * 4 * 4500 + 5 * 1400);
    expect(t.db.articles.find((a) => a.id === t.bac.id)!.stock).toBe(60);
    expect(t.db.articles.find((a) => a.id === t.pointes.id)!.stock).toBe(45);
    expect(invoiceState(t.db, inv)).toBe('payee');
    expect(t.db.payments[0]!.number).toBe('RG-2026-00001');
  });

  it('est tout ou rien : une ligne en rupture annule toute la vente', () => {
    const t = base();
    const before = t.db;
    expect(() =>
      t.run((d, c) => cmd.createInvoice(d, c, { clientId: WALK_IN_CLIENT_ID, lines: [{ articleId: t.pointes.id, quantity: 5 }, { articleId: t.bac.id, sheets: 30, lengthM: 4 }] }, { amount: 'total', mode: 'especes' })),
    ).toThrow(/Stock insuffisant/);
    expect(t.db).toBe(before); // base inchangée
    expect(t.db.articles.find((a) => a.id === t.pointes.id)!.stock).toBe(50);
    expect(t.db.counters['FA-2026']).toBeUndefined(); // aucun numéro consommé
  });

  it('refuse le crédit au client comptoir', () => {
    const t = base();
    expect(() => t.run((d, c) => cmd.createInvoice(d, c, { clientId: WALK_IN_CLIENT_ID, lines: [{ articleId: t.pointes.id, quantity: 1 }] }))).toThrow(/droit au crédit/);
  });

  it('applique la remise pro et bloque au-delà du plafond', () => {
    const t = base();
    const inv = t.run((d, c) => cmd.createInvoice(d, c, { clientId: t.pro.id, lines: [{ articleId: t.bac.id, sheets: 20, lengthM: 4 }] }));
    expect(inv.totals.discount).toBe(Math.round(360_000 * 0.08));
    expect(clientBalanceOf(t.db, t.pro.id)).toBe(331_200);
    expect(() => t.run((d, c) => cmd.createInvoice(d, c, { clientId: t.pro.id, lines: [{ articleId: t.pointes.id, quantity: 20 }] }))).toThrow(/Plafond de crédit dépassé/);
  });
});

describe('devis, avoir et règlements', () => {
  it('transforme un devis en facture une seule fois', () => {
    const t = base();
    const q = t.run((d, c) => cmd.createQuote(d, c, { clientId: t.pro.id, lines: [{ articleId: t.pointes.id, quantity: 10 }] }));
    expect(q.number).toBe('DV-2026-00001');
    expect(t.db.articles.find((a) => a.id === t.pointes.id)!.stock).toBe(50); // un devis ne sort pas le stock
    const inv = t.run((d, c) => cmd.convertQuote(d, c, q.id));
    expect(inv.sourceId).toBe(q.id);
    expect(t.db.documents.find((d) => d.id === q.id)!.status).toBe('transforme');
    expect(() => t.run((d, c) => cmd.convertQuote(d, c, q.id))).toThrow(/n’est plus ouvert/);
  });

  it('l’avoir remet en stock, annule la dette et ne touche pas la facture', () => {
    const t = base();
    const inv = t.run((d, c) => cmd.createInvoice(d, c, { clientId: t.pro.id, lines: [{ articleId: t.pointes.id, quantity: 10 }] }));
    const frozen = JSON.stringify({ ...inv });
    const av = t.run((d, c) => cmd.createCreditNote(d, c, inv.id, 'Retour client'));
    expect(av.number).toBe('AV-2026-00001');
    expect(t.db.articles.find((a) => a.id === t.pointes.id)!.stock).toBe(50);
    expect(clientBalanceOf(t.db, t.pro.id)).toBe(0);
    const stored = t.db.documents.find((d) => d.id === inv.id)!;
    expect(stored.creditNoteId).toBe(av.id);
    expect(JSON.stringify({ ...stored, creditNoteId: undefined })).toBe(frozen);
    expect(() => t.run((d, c) => cmd.createCreditNote(d, c, inv.id, 'Encore'))).toThrow(/déjà un avoir/);
  });

  it('rembourse automatiquement un client comptoir', () => {
    const t = base();
    const inv = t.run((d, c) => cmd.createInvoice(d, c, { clientId: WALK_IN_CLIENT_ID, lines: [{ articleId: t.pointes.id, quantity: 3 }] }, { amount: 'total', mode: 'mobile_money' }));
    t.run((d, c) => cmd.createCreditNote(d, c, inv.id, 'Erreur'));
    expect(clientBalanceOf(t.db, WALK_IN_CLIENT_ID)).toBe(0);
    expect(t.db.payments.at(-1)!.amount).toBe(-4200);
  });

  it('répartit un règlement sur les factures les plus anciennes', () => {
    const t = base();
    const a = t.run((d, c) => cmd.createInvoice(d, c, { clientId: t.pro.id, lines: [{ articleId: t.pointes.id, quantity: 10 }], date: '2026-09-01' }));
    const b = t.run((d, c) => cmd.createInvoice(d, c, { clientId: t.pro.id, lines: [{ articleId: t.pointes.id, quantity: 10 }], date: '2026-09-10' }));
    const due = a.totals.total;
    t.run((d, c) => cmd.recordPayment(d, c, { clientId: t.pro.id, amount: due + 1000, mode: 'virement' }));
    expect(invoiceDue(t.db, a.id)).toBe(0);
    expect(invoiceDue(t.db, b.id)).toBe(b.totals.total - 1000);
  });
});

describe('production', () => {
  it('consomme la bobine, entre les tôles en stock au coût de revient réel', () => {
    const t = base();
    const of = t.run((d, c) => cmd.createProductionOrder(d, c, { coilId: t.coil.id, machine: 'Profileuse 1', lines: [{ articleId: t.bac.id, sheets: 40, lengthM: 4.2 }], note: '' }));
    expect(of.number).toBe('OF-2026-00001');
    expect(() => t.run((d, c) => cmd.createProductionOrder(d, c, { coilId: t.coil.id, machine: 'P2', lines: [{ articleId: t.bac.id, sheets: 1, lengthM: 3 }], note: '' }))).toThrow(/déjà sur un ordre en cours/);
    const done = t.run((d, c) =>
      cmd.closeProductionOrder(d, c, of.id, { weightAfterKg: 3810, consumables: 12_000, machineCost: 45_000, lines: [{ articleId: t.bac.id, sheets: 40, lengthM: 4.2 }, { articleId: t.bac.id, sheets: 60, lengthM: 3 }] }),
    );
    expect(done.result!.producedM).toBeCloseTo(348, 6);
    expect(done.result!.costPerMeter).toBe(2506);
    expect(t.db.coils[0]!.remainingKg).toBe(3810);
    const bac = t.db.articles.find((a) => a.id === t.bac.id)!;
    expect(bac.stock).toBe(448);
    expect(bac.cost).toBeCloseTo((100 * 3000 + 348 * 2506) / 448, 6);
  });

  it('refuse une pesée incohérente sans rien modifier', () => {
    const t = base();
    const of = t.run((d, c) => cmd.createProductionOrder(d, c, { coilId: t.coil.id, machine: 'P1', lines: [{ articleId: t.bac.id, sheets: 10, lengthM: 3 }], note: '' }));
    expect(() => t.run((d, c) => cmd.closeProductionOrder(d, c, of.id, { weightAfterKg: 4990, consumables: 0, machineCost: 0, lines: [{ articleId: t.bac.id, sheets: 100, lengthM: 3 }] }))).toThrow(/vérifier la pesée/);
    expect(t.db.productionOrders[0]!.status).toBe('en_cours');
    expect(t.db.coils[0]!.remainingKg).toBe(5000);
  });

  it('refuse les saisies d’unités absurdes à la réception', () => {
    const t = base();
    expect(() => t.run((d, c) => cmd.receiveCoil(d, c, { ref: 'B-2', material: 'galvanise', thicknessMm: 35, widthM: 1.22, color: '', ral: '', supplier: 'F', weighedKg: 5000, invoicedKg: 0, pricePerKg: 700, location: '' }))).toThrow(/0,35 et non 35/);
  });
});

describe('base de démonstration', () => {
  const demo = buildDemoDatabase(NOW);

  it('contient une activité réaliste', () => {
    expect(demo.documents.filter((d) => d.type === 'facture').length).toBeGreaterThan(60);
    expect(demo.productionOrders.filter((o) => o.status === 'cloture').length).toBe(6);
    expect(demo.documents.some((d) => d.type === 'devis' && d.status === 'ouvert')).toBe(true);
    expect(demo.documents.some((d) => d.type === 'avoir')).toBe(true);
    expect(salesSummary(demo, '2026-09-29', '2026-09-29').invoices).toBeGreaterThan(0);
  });

  it('n’a aucun stock négatif et des mouvements qui tombent juste', () => {
    for (const a of demo.articles) {
      expect(a.stock).toBeGreaterThanOrEqual(0);
      const sum = demo.stockMoves.filter((m) => m.articleId === a.id).reduce((s, m) => s + m.delta, 0);
      expect(sum).toBeCloseTo(a.stock, 3);
    }
  });

  it('respecte les plafonds de crédit et la numérotation continue', () => {
    for (const c of demo.clients) {
      if (c.creditAllowed) expect(clientBalanceOf(demo, c.id)).toBeLessThanOrEqual(c.creditLimit);
      else expect(clientBalanceOf(demo, c.id)).toBeLessThanOrEqual(0);
    }
    const invoices = demo.documents.filter((d) => d.type === 'facture').map((d) => Number(d.number.slice(-5)));
    expect(invoices).toEqual(invoices.map((_, i) => i + 1));
  });

  it('retrouve le poids restant de la bobine B-2409-017', () => {
    expect(demo.coils.find((c) => c.ref === 'B-2409-017')!.remainingKg).toBe(2140);
  });
});
