/**
 * Base de démonstration d'Aciéra Tôles SARL (entreprise fictive).
 *
 * Tout est créé en rejouant les vraies commandes, à des dates passées :
 * les stocks, les comptes clients et la numérotation sont donc cohérents
 * exactement comme ils le seraient après quelques semaines d'utilisation.
 */
import * as cmd from './commands';
import { emptyDatabase, WALK_IN_CLIENT_ID, type Company, type Database, type PayMode } from './schema';
import { execute } from './transaction';
import { clientBalanceOf } from './queries';

export const demoCompany: Company = {
  name: 'Aciéra Tôles SARL',
  address: 'Zone industrielle, lot 14',
  phone: '90 00 00 00',
  email: 'contact@aciera-toles.example',
  taxId: '1000000000',
  rccm: 'RCCM 2019 B 0000',
  vatPct: 0,
  invoiceFooter: 'Merci de votre confiance. Marchandise vendue ni reprise ni échangée sans avoir.',
};

/** Générateur pseudo-aléatoire reproductible (même démo à chaque fois). */
function prng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function daysAgo(today: Date, n: number, hour = 10, minute = 0): Date {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function buildDemoDatabase(today = new Date()): Database {
  let db = emptyDatabase(demoCompany);
  const run = <R>(when: Date, f: (draft: Database, ctx: cmd.Ctx) => R): R | undefined => {
    try {
      const out = execute(db, f, when);
      db = out.db;
      return out.result;
    } catch {
      return undefined; // une vente de démo impossible (stock, crédit) est simplement ignorée
    }
  };
  const start = daysAgo(today, 62, 8);

  /* Articles */
  const A: Record<string, string> = {};
  const articles: [string, string, cmd.ArticleInput['family'], 'cut' | 'unit', string, number, number, number, boolean, string, number][] = [
    ['BAC35-GA', 'Bac acier 0,35 galvanisé', 'toles', 'cut', 'ml', 3900, 2500, 300, true, '#9aa5b0', 600],
    ['BAC35-BL', 'Bac acier 0,35 prélaqué bleu', 'toles', 'cut', 'ml', 4500, 2950, 300, true, '#1f4e8c', 2600],
    ['BAC40-RB', 'Bac acier 0,40 rouge brique', 'toles', 'cut', 'ml', 5200, 3450, 200, true, '#8c3b2a', 0],
    ['OND30-GA', 'Tôle ondulée 0,30 galvanisée', 'toles', 'cut', 'ml', 3200, 2100, 500, true, '#a9b3bd', 900],
    ['OND30-AZ', 'Tôle ondulée 0,30 aluzinc', 'toles', 'cut', 'ml', 3500, 2300, 300, true, '#c2c8cc', 900],
    ['TUI40-RG', 'Tôle tuile 0,40 rouge grainée', 'toles', 'cut', 'ml', 5800, 3900, 150, true, '#a3452f', 1500],
    ['TRANS-PO', 'Tôle translucide polyester', 'negoce', 'cut', 'ml', 6800, 4900, 30, false, '#d8e3c9', 120],
    ['FAI35-BL', 'Faîtière 0,35 bleu (2 m)', 'accessoires', 'unit', 'pièce', 3500, 2100, 40, true, '#1f4e8c', 420],
    ['FAI30-GA', 'Faîtière 0,30 galvanisée (2 m)', 'accessoires', 'unit', 'pièce', 2800, 1700, 40, true, '#9aa5b0', 420],
    ['RIV35-BL', 'Rive 0,35 bleu (2 m)', 'accessoires', 'unit', 'pièce', 2800, 1650, 30, true, '#1f4e8c', 92],
    ['GOU-GA', 'Gouttière galvanisée (2 m)', 'accessoires', 'unit', 'pièce', 4200, 2600, 20, true, '#9aa5b0', 45],
    ['CLOS-BAC', 'Closoir mousse pour bac', 'negoce', 'unit', 'pièce', 450, 180, 200, false, '#3d3d3d', 1200],
    ['PT80-GA', 'Pointes à tôle galvanisées 80 mm', 'clous', 'unit', 'kg', 1400, 820, 200, true, '#7f8a95', 1600],
    ['PC70', 'Pointes tête plate 70 mm', 'clous', 'unit', 'kg', 950, 560, 300, true, '#6b6b6b', 1420],
    ['PC100', 'Pointes tête plate 100 mm', 'clous', 'unit', 'kg', 950, 560, 300, true, '#5d5d5d', 980],
    ['FIL14', 'Fil recuit 1,4 mm', 'fil', 'unit', 'kg', 1100, 700, 100, true, '#555555', 380],
    ['VIS63', 'Vis autoperceuses 6,3×25 (boîte de 100)', 'negoce', 'unit', 'boîte', 6500, 4600, 20, false, '#b0892f', 160],
    ['MAST', 'Mastic d’étanchéité 310 ml', 'negoce', 'unit', 'pièce', 2500, 1600, 12, false, '#d6d0c2', 34],
    ['CHUTES', 'Chutes de tôle', 'sous_produits', 'unit', 'kg', 250, 0, 0, false, '#8a8a8a', 0],
  ];
  for (const [ref, name, family, saleMode, unit, price, cost, minStock, fabricated, swatch, openingStock] of articles) {
    const a = run(start, (d, c) => cmd.createArticle(d, c, { ref, name, family, saleMode, unit, price, cost, minStock, fabricated, swatch, openingStock }));
    if (a) A[ref] = a.id;
  }

  /* Clients */
  const C: Record<string, string> = { comptoir: WALK_IN_CLIENT_ID };
  const clients: [string, string, string, cmd.ClientInput['category'], number, boolean, number][] = [
    ['batisseur', 'Quincaillerie Le Bâtisseur', '91 11 22 33', 'pro', 5, true, 3_000_000],
    ['kodjo', 'Ets Kodjo BTP', '92 44 55 66', 'pro', 8, true, 3_000_000],
    ['mawuli', 'Mawuli Construction', '93 77 88 99', 'pro', 5, true, 5_000_000],
    ['afi', 'Afi Amegbor', '96 12 34 56', 'comptoir', 0, false, 0],
  ];
  for (const [key, name, phone, category, discountPct, creditAllowed, creditLimit] of clients) {
    const c = run(start, (d, x) => cmd.createClient(d, x, { name, phone, address: '', category, discountPct, creditAllowed, creditLimit }));
    if (c) C[key] = c.id;
  }

  /* Bobines */
  const B: Record<string, string> = {};
  const coils: [string, cmd.CoilInput['material'], number, number, string, string, string, number, number, number, string, number][] = [
    ['B-2407-030', 'galvanise', 0.25, 1.0, 'Brut', '', 'Sidérurgie du Golfe', 3800, 3815, 660, 'Allée C · rack 1', 62],
    ['B-2408-009', 'prelaque', 0.4, 1.22, 'Rouge brique', 'RAL 8004', 'ColorSteel Import', 5200, 5200, 805, 'Allée B · rack 1', 40],
    ['B-2409-004', 'aluzinc', 0.3, 1.22, 'Brut', '', 'Sidérurgie du Golfe', 4500, 4520, 720, 'Allée B · rack 3', 26],
    ['B-2409-017', 'galvanise', 0.35, 1.22, 'Brut', '', 'Sidérurgie du Golfe', 5000, 5000, 685, 'Allée A · rack 2', 17],
    ['B-2409-021', 'prelaque', 0.35, 1.22, 'Bleu', 'RAL 5010', 'ColorSteel Import', 4800, 4830, 790, 'Allée A · rack 4', 11],
  ];
  for (const [ref, material, thicknessMm, widthM, color, ral, supplier, weighedKg, invoicedKg, pricePerKg, location, ago] of coils) {
    const when = daysAgo(today, ago, 9);
    const c = run(when, (d, x) => cmd.receiveCoil(d, x, { ref, material, thicknessMm, widthM, color, ral, supplier, weighedKg, invoicedKg, pricePerKg, location, receivedOn: cmd.isoDate(when) }));
    if (c) B[ref] = c.id;
  }

  /* Production : ordres lancés le matin, clôturés à midi */
  const produce = (ago: number, coil: string, machine: string, lines: [string, number, number][], after: number, consumables: number, machineCost: number) => {
    const order = run(daysAgo(today, ago, 7, 40), (d, x) =>
      cmd.createProductionOrder(d, x, { coilId: B[coil]!, machine, lines: lines.map(([ref, sheets, lengthM]) => ({ articleId: A[ref]!, sheets, lengthM })), note: '' }),
    );
    if (!order) return;
    run(daysAgo(today, ago, 11, 30), (d, x) =>
      cmd.closeProductionOrder(d, x, order.id, {
        weightAfterKg: after,
        consumables,
        machineCost,
        lines: lines.map(([ref, sheets, lengthM]) => ({ articleId: A[ref]!, sheets, lengthM })),
        scrapArticleId: A.CHUTES,
      }),
    );
  };
  produce(60, 'B-2407-030', 'Profileuse 2', [['OND30-GA', 600, 3.1]], 0, 30_000, 140_000);
  produce(38, 'B-2408-009', 'Profileuse 1', [['BAC40-RB', 300, 4.0]], 410, 38_000, 150_000);
  produce(15, 'B-2409-017', 'Profileuse 1', [['BAC35-GA', 69, 3.0]], 4290, 8_000, 28_000);
  produce(8, 'B-2409-017', 'Profileuse 1', [['BAC35-GA', 60, 3.0], ['BAC35-GA', 24, 4.2]], 3330, 10_000, 38_000);
  produce(3, 'B-2409-004', 'Profileuse 2', [['OND30-AZ', 150, 3.0]], 3120, 12_000, 42_000);
  produce(1, 'B-2409-017', 'Profileuse 1', [['BAC35-GA', 40, 4.2], ['BAC35-GA', 60, 3.0]], 2140, 12_000, 45_000);

  /* Ventes des 45 derniers jours */
  const rnd = prng(20260929);
  const pick = <T,>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  const cutRefs = ['BAC35-GA', 'BAC35-BL', 'OND30-GA', 'OND30-AZ', 'TUI40-RG', 'BAC40-RB'];
  const lengths = [2.5, 3.0, 3.0, 3.5, 4.0, 4.2, 5.0];
  const modes: PayMode[] = ['especes', 'especes', 'mobile_money', 'mobile_money', 'virement'];

  // Lignes de vente plausibles, limitées à ce qui est réellement en stock à ce moment-là
  const saleLines = (big: boolean): cmd.LineInput[] => {
    const stockOf = (ref: string) => db.articles.find((a) => a.id === A[ref])?.stock ?? 0;
    const tole = pick(cutRefs);
    const sheets = big ? 20 + Math.floor(rnd() * 40) : 4 + Math.floor(rnd() * 14);
    const lengthM = pick(lengths);
    const lines: cmd.LineInput[] = [];
    if (stockOf(tole) >= sheets * lengthM) lines.push({ articleId: A[tole]!, sheets, lengthM });
    const add = (ref: string, quantity: number) => {
      if (stockOf(ref) >= quantity) lines.push({ articleId: A[ref]!, quantity });
    };
    const fai = tole.includes('BL') ? 'FAI35-BL' : 'FAI30-GA';
    if (rnd() < 0.7) add(fai, 1 + Math.floor(sheets / 6));
    if (rnd() < 0.8) add('PT80-GA', Math.max(2, Math.round(sheets / 3)));
    if (rnd() < 0.3) add('VIS63', 1 + Math.floor(rnd() * 3));
    if (rnd() < 0.25) add('PC70', 5 + Math.floor(rnd() * 20));
    return lines;
  };

  for (let ago = 45; ago >= 0; ago--) {
    const date = daysAgo(today, ago, 8);
    if (date.getDay() === 0) continue; // fermé le dimanche
    const count = ago === 0 ? 4 : 2 + Math.floor(rnd() * 4);
    for (let i = 0; i < count; i++) {
      const when = daysAgo(today, ago, 8 + i * 2, Math.floor(rnd() * 50));
      const r = rnd();
      if (r < 0.55) {
        // Comptoir : payé en entier tout de suite
        const client = rnd() < 0.8 ? C.comptoir! : C.afi!;
        const mode = pick(modes);
        run(when, (d, x) => cmd.createInvoice(d, x, { clientId: client, lines: saleLines(false) }, { amount: 'total', mode }));
      } else {
        const key = r < 0.72 ? 'batisseur' : r < 0.86 ? 'mawuli' : 'kodjo';
        const payRatio = key === 'kodjo' ? 0 : rnd() < 0.5 ? 1 : 0.5;
        run(when, (d, x) => {
          const lines = saleLines(true);
          // Crédit d'abord, puis règlement éventuel de tout ou partie
          const inv = cmd.createInvoice(d, x, { clientId: C[key]!, lines });
          const amount = Math.round(inv.totals.total * payRatio);
          if (amount > 0) cmd.recordPayment(d, x, { clientId: C[key]!, amount, mode: pick(modes), docId: inv.id });
          return inv;
        });
      }
    }
  }

  /* Un paiement partiel ancien pour avoir une facture en retard chez Le Bâtisseur */
  const bat = C.batisseur!;
  const batDue = clientBalanceOf(db, bat);
  if (batDue > 400_000) run(daysAgo(today, 5, 15), (d, x) => cmd.recordPayment(d, x, { clientId: bat, amount: 250_000, mode: 'virement', note: 'Acompte sur relevé' }));

  /* Un devis ouvert et un avoir */
  run(daysAgo(today, 0, 9, 15), (d, x) =>
    cmd.createQuote(d, x, {
      clientId: C.mawuli!,
      lines: [
        { articleId: A['BAC35-BL']!, sheets: 80, lengthM: 5.0 },
        { articleId: A['FAI35-BL']!, quantity: 20 },
        { articleId: A['RIV35-BL']!, quantity: 16 },
        { articleId: A['VIS63']!, quantity: 12 },
      ],
      note: 'Chantier école primaire, livraison souhaitée sous 10 jours',
    }),
  );
  const lastComptoir = [...db.documents].reverse().find((doc) => doc.type === 'facture' && doc.clientId === WALK_IN_CLIENT_ID && doc.date < cmd.isoDate(daysAgo(today, 3)));
  if (lastComptoir) run(daysAgo(today, 2, 16), (d, x) => cmd.createCreditNote(d, x, lastComptoir.id, 'Erreur de couleur, client remboursé', 'especes'));

  /* Dépenses */
  const expenses: [number, string, string, number, PayMode][] = [
    [40, 'Électricité usine (août)', 'Énergie', 612_000, 'virement'],
    [30, 'Transport bobines port → usine', 'Transport', 180_000, 'especes'],
    [25, 'Salaires journaliers atelier', 'Personnel', 450_000, 'especes'],
    [18, 'Lames de cisaille', 'Maintenance', 95_000, 'especes'],
    [10, 'Électricité usine (septembre)', 'Énergie', 588_000, 'virement'],
    [4, 'Carburant camion de livraison', 'Transport', 65_000, 'especes'],
    [1, 'Salaires journaliers atelier', 'Personnel', 450_000, 'especes'],
  ];
  for (const [ago, label, category, amount, mode] of expenses) {
    run(daysAgo(today, ago, 17), (d, x) => cmd.recordExpense(d, x, { label, category, amount, mode }));
  }

  return db;
}
