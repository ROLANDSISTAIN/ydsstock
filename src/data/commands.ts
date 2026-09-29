/**
 * Opérations métier sur la base.
 *
 * Chaque commande reçoit un brouillon de la base (copie) et le modifie.
 * Elle est exécutée par `execute` (transaction.ts) : si elle lève une erreur,
 * la copie est jetée et la base d'origine reste intacte (tout ou rien).
 * Les calculs viennent tous de src/domain.
 */
import { checkCredit } from '../domain/accounts';
import { roundFcfa, type Fcfa } from '../domain/money';
import { nextNumber, type DocPrefix } from '../domain/numbering';
import { analyseProduction, productionCost } from '../domain/production';
import { lineAmount, totalsFromAmounts } from '../domain/sales';
import { applyStockMove, roundQty, weightedAverageCost } from '../domain/stock';
import type { CoilMaterial } from '../domain/steel';
import { clientBalanceOf, invoiceDue } from './queries';
import type {
  Article,
  Client,
  Coil,
  Company,
  Database,
  DocLine,
  DocType,
  MoveReason,
  PayMode,
  ProductionLine,
  SalesDocument,
} from './schema';

export class BusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessError';
  }
}

export interface Ctx {
  now: Date;
}

/* ---------- Outils ---------- */

export function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function newId(): string {
  return globalThis.crypto.randomUUID();
}

function log(db: Database, ctx: Ctx, action: string, detail: string): void {
  db.audit.push({ at: ctx.now.toISOString(), action, detail });
}

function number(db: Database, ctx: Ctx, prefix: DocPrefix, date?: string): string {
  const year = date ? Number(date.slice(0, 4)) : ctx.now.getFullYear();
  const { number: n, counters } = nextNumber(db.counters, prefix, year);
  db.counters = counters;
  return n;
}

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new BusinessError(`${what} introuvable`);
  return value;
}

export function articleById(db: Database, id: string): Article {
  return need(db.articles.find((a) => a.id === id), 'Article');
}
export function clientById(db: Database, id: string): Client {
  return need(db.clients.find((c) => c.id === id), 'Client');
}
export function coilById(db: Database, id: string): Coil {
  return need(db.coils.find((c) => c.id === id), 'Bobine');
}
export function docById(db: Database, id: string): SalesDocument {
  return need(db.documents.find((d) => d.id === id), 'Document');
}

function positive(value: number, label: string): void {
  if (!(Number.isFinite(value) && value > 0)) throw new BusinessError(`${label} doit être supérieur à zéro`);
}
function notNegative(value: number, label: string): void {
  if (!(Number.isFinite(value) && value >= 0)) throw new BusinessError(`${label} ne peut pas être négatif`);
}
function required(value: string, label: string): string {
  const v = value.trim();
  if (!v) throw new BusinessError(`${label} est obligatoire`);
  return v;
}

function moveStock(db: Database, article: Article, delta: number, reason: MoveReason, ref: string, date: string): void {
  article.stock = applyStockMove(article.stock, delta, article.name);
  db.stockMoves.push({ id: newId(), date, articleId: article.id, delta: roundQty(delta), after: article.stock, reason, ref });
}

/* ---------- Entreprise ---------- */

export function updateCompany(db: Database, ctx: Ctx, company: Company): void {
  required(company.name, 'Le nom de l’entreprise');
  if (company.vatPct < 0 || company.vatPct > 50) throw new BusinessError('Taux de TVA invalide');
  db.company = { ...company };
  log(db, ctx, 'Paramètres modifiés', company.name);
}

/* ---------- Articles et stock ---------- */

export interface ArticleInput {
  ref: string;
  name: string;
  family: Article['family'];
  saleMode: Article['saleMode'];
  unit: string;
  price: Fcfa;
  cost: number;
  minStock: number;
  fabricated: boolean;
  swatch: string;
  openingStock?: number;
}

export function createArticle(db: Database, ctx: Ctx, input: ArticleInput): Article {
  const ref = required(input.ref, 'La référence').toUpperCase();
  if (db.articles.some((a) => a.ref === ref)) throw new BusinessError(`La référence ${ref} existe déjà`);
  notNegative(input.price, 'Le prix');
  notNegative(input.cost, 'Le coût');
  notNegative(input.minStock, 'Le stock minimum');
  const article: Article = {
    id: newId(),
    ref,
    name: required(input.name, 'Le nom'),
    family: input.family,
    saleMode: input.saleMode,
    unit: input.saleMode === 'cut' ? 'ml' : required(input.unit, 'L’unité'),
    price: roundFcfa(input.price),
    cost: input.cost,
    stock: 0,
    minStock: input.minStock,
    fabricated: input.fabricated,
    swatch: input.swatch || '#8a96a3',
    active: true,
  };
  db.articles.push(article);
  if (input.openingStock && input.openingStock > 0) {
    moveStock(db, article, input.openingStock, 'ouverture', 'Stock d’ouverture', isoDate(ctx.now));
  }
  log(db, ctx, 'Article créé', `${article.ref} · ${article.name}`);
  return article;
}

export function updateArticle(
  db: Database,
  ctx: Ctx,
  id: string,
  patch: Partial<Pick<Article, 'name' | 'price' | 'minStock' | 'swatch' | 'active' | 'family'>>,
): void {
  const a = articleById(db, id);
  if (patch.name !== undefined) a.name = required(patch.name, 'Le nom');
  if (patch.price !== undefined) {
    notNegative(patch.price, 'Le prix');
    a.price = roundFcfa(patch.price);
  }
  if (patch.minStock !== undefined) {
    notNegative(patch.minStock, 'Le stock minimum');
    a.minStock = patch.minStock;
  }
  if (patch.swatch !== undefined) a.swatch = patch.swatch;
  if (patch.active !== undefined) a.active = patch.active;
  if (patch.family !== undefined) a.family = patch.family;
  log(db, ctx, 'Article modifié', `${a.ref} · ${a.name}`);
}

/** Inventaire : on saisit la quantité comptée, l'écart devient un mouvement tracé. */
export function countStock(db: Database, ctx: Ctx, articleId: string, counted: number, note: string): void {
  notNegative(counted, 'La quantité comptée');
  const a = articleById(db, articleId);
  const delta = roundQty(counted - a.stock);
  if (delta === 0) throw new BusinessError('Aucun écart : le stock compté est égal au stock théorique');
  moveStock(db, a, delta, 'inventaire', note.trim() || 'Inventaire', isoDate(ctx.now));
  log(db, ctx, 'Inventaire', `${a.ref} : écart ${delta} ${a.unit}`);
}

/** Entrée d'articles achetés (négoce, consommables revendus) avec mise à jour du coût moyen. */
export function purchaseArticle(db: Database, ctx: Ctx, articleId: string, quantity: number, unitCost: Fcfa, supplier: string): void {
  positive(quantity, 'La quantité');
  notNegative(unitCost, 'Le coût d’achat');
  const a = articleById(db, articleId);
  a.cost = weightedAverageCost(a.stock, a.cost, quantity, unitCost);
  moveStock(db, a, quantity, 'achat', supplier.trim() || 'Achat', isoDate(ctx.now));
  log(db, ctx, 'Entrée en stock', `${a.ref} : +${quantity} ${a.unit} à ${unitCost} FCFA`);
}

/* ---------- Bobines ---------- */

export interface CoilInput {
  ref: string;
  material: CoilMaterial;
  thicknessMm: number;
  widthM: number;
  color: string;
  ral: string;
  supplier: string;
  weighedKg: number;
  invoicedKg: number;
  pricePerKg: Fcfa;
  location: string;
  receivedOn?: string;
}

export function receiveCoil(db: Database, ctx: Ctx, input: CoilInput): Coil {
  const ref = required(input.ref, 'Le numéro de bobine').toUpperCase();
  if (db.coils.some((c) => c.ref === ref)) throw new BusinessError(`La bobine ${ref} existe déjà`);
  positive(input.thicknessMm, 'L’épaisseur');
  if (input.thicknessMm > 3) throw new BusinessError('Épaisseur en millimètres : 0,35 et non 35');
  positive(input.widthM, 'La largeur');
  if (input.widthM > 3) throw new BusinessError('Largeur en mètres : 1,22 et non 1220');
  positive(input.weighedKg, 'Le poids pesé');
  notNegative(input.invoicedKg, 'Le poids facturé');
  positive(input.pricePerKg, 'Le prix au kg');
  const coil: Coil = {
    id: newId(),
    ref,
    material: input.material,
    thicknessMm: input.thicknessMm,
    widthM: input.widthM,
    color: input.color.trim() || 'Brut',
    ral: input.ral.trim(),
    supplier: required(input.supplier, 'Le fournisseur'),
    receivedOn: input.receivedOn ?? isoDate(ctx.now),
    initialKg: input.weighedKg,
    invoicedKg: input.invoicedKg || input.weighedKg,
    remainingKg: input.weighedKg,
    pricePerKg: roundFcfa(input.pricePerKg),
    location: input.location.trim(),
    status: 'en_stock',
  };
  db.coils.push(coil);
  log(db, ctx, 'Bobine réceptionnée', `${coil.ref} · ${coil.initialKg} kg · ${coil.supplier}`);
  return coil;
}

/** Mise au rebut d'une bobine (défaut, rouille) : le poids restant sort du stock. */
export function scrapCoil(db: Database, ctx: Ctx, coilId: string, reason: string): void {
  const coil = coilById(db, coilId);
  if (db.productionOrders.some((o) => o.coilId === coilId && o.status === 'en_cours')) {
    throw new BusinessError('Cette bobine est sur un ordre de fabrication en cours');
  }
  if (coil.status === 'terminee' || coil.status === 'rebutee') throw new BusinessError('Bobine déjà sortie du stock');
  const kg = coil.remainingKg;
  coil.remainingKg = 0;
  coil.status = 'rebutee';
  log(db, ctx, 'Bobine mise au rebut', `${coil.ref} : ${kg} kg · ${required(reason, 'Le motif')}`);
}

/* ---------- Production ---------- */

export interface ProductionInput {
  coilId: string;
  machine: string;
  lines: ProductionLine[];
  clientId?: string;
  note: string;
}

export function createProductionOrder(db: Database, ctx: Ctx, input: ProductionInput) {
  const coil = coilById(db, input.coilId);
  if (coil.status === 'terminee' || coil.status === 'rebutee' || coil.remainingKg <= 0) {
    throw new BusinessError(`La bobine ${coil.ref} est vide`);
  }
  if (db.productionOrders.some((o) => o.coilId === coil.id && o.status === 'en_cours')) {
    throw new BusinessError(`La bobine ${coil.ref} est déjà sur un ordre en cours : clôturez-le d’abord`);
  }
  if (!input.lines.length) throw new BusinessError('Ajoutez au moins une ligne à produire');
  for (const l of input.lines) {
    const a = articleById(db, l.articleId);
    if (a.saleMode !== 'cut') throw new BusinessError(`${a.name} n’est pas une tôle vendue au mètre`);
    if (!Number.isInteger(l.sheets) || l.sheets <= 0) throw new BusinessError('Nombre de feuilles invalide');
    positive(l.lengthM, 'La longueur');
  }
  const date = isoDate(ctx.now);
  const order = {
    id: newId(),
    number: number(db, ctx, 'OF', date),
    createdOn: date,
    machine: required(input.machine, 'La machine'),
    coilId: coil.id,
    status: 'en_cours' as const,
    lines: input.lines.map((l) => ({ ...l })),
    weightBeforeKg: coil.remainingKg,
    consumables: 0,
    machineCost: 0,
    clientId: input.clientId,
    note: input.note.trim(),
  };
  coil.status = 'en_cours';
  db.productionOrders.push(order);
  log(db, ctx, 'Ordre de fabrication lancé', `${order.number} · bobine ${coil.ref}`);
  return order;
}

export interface CloseInput {
  weightAfterKg: number;
  consumables: Fcfa;
  machineCost: Fcfa;
  /** Lignes réellement produites (peuvent différer du prévu). */
  lines: ProductionLine[];
  scrapArticleId?: string;
}

export function closeProductionOrder(db: Database, ctx: Ctx, orderId: string, input: CloseInput) {
  const order = need(db.productionOrders.find((o) => o.id === orderId), 'Ordre de fabrication');
  if (order.status !== 'en_cours') throw new BusinessError(`${order.number} n’est plus en cours`);
  const coil = coilById(db, order.coilId);
  notNegative(input.weightAfterKg, 'Le poids après production');
  if (input.weightAfterKg >= order.weightBeforeKg) {
    throw new BusinessError(`Poids après (${input.weightAfterKg} kg) supérieur ou égal au poids avant (${order.weightBeforeKg} kg)`);
  }
  notNegative(input.consumables, 'Les consommables');
  notNegative(input.machineCost, 'Les frais machine');
  const lines = input.lines.filter((l) => l.sheets > 0);
  if (!lines.length) throw new BusinessError('Aucune feuille produite');

  const consumedKg = order.weightBeforeKg - input.weightAfterKg;
  const format = { widthM: coil.widthM, thicknessMm: coil.thicknessMm };
  let analysis;
  try {
    analysis = analyseProduction({ format, consumedKg, lines });
  } catch (e) {
    throw new BusinessError((e as Error).message);
  }
  const cost = productionCost({
    consumedKg,
    pricePerKg: coil.pricePerKg,
    consumables: input.consumables,
    machineAndLabour: input.machineCost,
    producedM: analysis.producedM,
  });

  const date = isoDate(ctx.now);
  for (const l of lines) {
    const a = articleById(db, l.articleId);
    const meters = roundQty(l.sheets * l.lengthM);
    a.cost = weightedAverageCost(a.stock, a.cost, meters, cost.perMeter);
    moveStock(db, a, meters, 'production', order.number, date);
  }
  if (input.scrapArticleId && analysis.scrapKg > 0) {
    const scrap = articleById(db, input.scrapArticleId);
    moveStock(db, scrap, roundQty(analysis.scrapKg), 'production', `${order.number} (chutes)`, date);
  }

  coil.remainingKg = input.weightAfterKg;
  coil.status = input.weightAfterKg <= 0 ? 'terminee' : 'en_cours';

  order.lines = lines.map((l) => ({ ...l }));
  order.weightAfterKg = input.weightAfterKg;
  order.consumables = roundFcfa(input.consumables);
  order.machineCost = roundFcfa(input.machineCost);
  order.status = 'cloture';
  order.closedOn = date;
  order.result = {
    consumedKg,
    producedM: analysis.producedM,
    theoreticalM: analysis.theoreticalM,
    yieldPct: analysis.yieldPct,
    scrapM: analysis.scrapM,
    scrapKg: analysis.scrapKg,
    materialCost: cost.material,
    totalCost: cost.total,
    costPerMeter: cost.perMeter,
  };
  log(db, ctx, 'Ordre de fabrication clôturé', `${order.number} · ${analysis.producedM.toFixed(1)} m · rendement ${analysis.yieldPct.toFixed(1)} %`);
  return order;
}

export function cancelProductionOrder(db: Database, ctx: Ctx, orderId: string, reason: string): void {
  const order = need(db.productionOrders.find((o) => o.id === orderId), 'Ordre de fabrication');
  if (order.status !== 'en_cours') throw new BusinessError('Seul un ordre en cours peut être annulé');
  const coil = coilById(db, order.coilId);
  order.status = 'annule';
  order.note = [order.note, `Annulé : ${required(reason, 'Le motif')}`].filter(Boolean).join(' · ');
  if (coil.status === 'en_cours' && coil.remainingKg === coil.initialKg) coil.status = 'en_stock';
  log(db, ctx, 'Ordre de fabrication annulé', `${order.number} · ${reason}`);
}

/* ---------- Clients ---------- */

export type ClientInput = Omit<Client, 'id' | 'active'>;

export function createClient(db: Database, ctx: Ctx, input: ClientInput): Client {
  const name = required(input.name, 'Le nom du client');
  if (db.clients.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    throw new BusinessError(`Un client s’appelle déjà ${name}`);
  }
  validateClient(input);
  const client: Client = { ...input, name, id: newId(), active: true };
  db.clients.push(client);
  log(db, ctx, 'Client créé', name);
  return client;
}

export function updateClient(db: Database, ctx: Ctx, id: string, input: ClientInput): void {
  const c = clientById(db, id);
  validateClient(input);
  Object.assign(c, { ...input, name: required(input.name, 'Le nom du client') });
  log(db, ctx, 'Client modifié', c.name);
}

function validateClient(input: ClientInput) {
  if (input.discountPct < 0 || input.discountPct > 50) throw new BusinessError('La remise doit être entre 0 et 50 %');
  notNegative(input.creditLimit, 'Le plafond de crédit');
}

/* ---------- Ventes ---------- */

export interface LineInput {
  articleId: string;
  sheets?: number;
  lengthM?: number;
  quantity?: number;
  /** Prix unitaire négocié ; prix catalogue si absent. */
  unitPrice?: Fcfa;
}

export interface SaleInput {
  clientId: string;
  lines: LineInput[];
  note?: string;
  date?: string;
}

function buildLines(db: Database, lines: LineInput[]): DocLine[] {
  if (!lines.length) throw new BusinessError('Le document est vide');
  return lines.map((l) => {
    const a = articleById(db, l.articleId);
    const unitPrice = roundFcfa(l.unitPrice ?? a.price);
    notNegative(unitPrice, 'Le prix');
    try {
      if (a.saleMode === 'cut') {
        const sheets = l.sheets ?? 0;
        const lengthM = l.lengthM ?? 0;
        const amount = lineAmount({ kind: 'cut', sheets, lengthM, pricePerMeter: unitPrice });
        return { articleId: a.id, label: a.name, saleMode: 'cut', sheets, lengthM, quantity: roundQty(sheets * lengthM), unit: a.unit, unitPrice, amount, unitCost: a.cost };
      }
      const quantity = l.quantity ?? 0;
      const amount = lineAmount({ kind: 'unit', quantity, unitPrice });
      return { articleId: a.id, label: a.name, saleMode: 'unit', quantity: roundQty(quantity), unit: a.unit, unitPrice, amount, unitCost: a.cost };
    } catch (e) {
      throw new BusinessError(`${a.name} : ${(e as Error).message}`);
    }
  });
}

function makeDoc(db: Database, ctx: Ctx, type: DocType, prefix: DocPrefix, clientId: string, lines: DocLine[], note: string, date: string, discountPct: number): SalesDocument {
  const totals = totalsFromAmounts(lines.map((l) => l.amount), discountPct, db.company.vatPct);
  return {
    id: newId(),
    type,
    number: number(db, ctx, prefix, date),
    date,
    clientId,
    lines,
    discountPct,
    vatPct: db.company.vatPct,
    totals,
    costTotal: lines.reduce((s, l) => s + l.quantity * l.unitCost, 0),
    status: type === 'devis' ? 'ouvert' : 'validee',
    note: note.trim(),
    createdAt: ctx.now.toISOString(),
  };
}

export function createQuote(db: Database, ctx: Ctx, input: SaleInput, validDays = 15): SalesDocument {
  const client = clientById(db, input.clientId);
  const date = input.date ?? isoDate(ctx.now);
  const doc = makeDoc(db, ctx, 'devis', 'DV', client.id, buildLines(db, input.lines), input.note ?? '', date, client.discountPct);
  const until = new Date(`${date}T12:00:00`);
  until.setDate(until.getDate() + validDays);
  doc.validUntil = isoDate(until);
  db.documents.push(doc);
  log(db, ctx, 'Devis créé', `${doc.number} · ${client.name} · ${doc.totals.total} FCFA`);
  return doc;
}

export interface PaymentNow {
  /** Montant payé à la vente, ou 'total' pour tout payer. */
  amount: Fcfa | 'total';
  mode: PayMode;
}

/**
 * Facture validée : sort le stock, contrôle le crédit, enregistre le paiement éventuel.
 * Tout se fait dans la même opération.
 */
export function createInvoice(db: Database, ctx: Ctx, input: SaleInput, payment?: PaymentNow, sourceQuoteId?: string): SalesDocument {
  const client = clientById(db, input.clientId);
  const date = input.date ?? isoDate(ctx.now);
  const doc = makeDoc(db, ctx, 'facture', 'FA', client.id, buildLines(db, input.lines), input.note ?? '', date, client.discountPct);
  if (sourceQuoteId) doc.sourceId = sourceQuoteId;

  const paid = payment ? (payment.amount === 'total' ? doc.totals.total : roundFcfa(payment.amount)) : 0;
  notNegative(paid, 'Le montant payé');
  if (paid > doc.totals.total) throw new BusinessError('Le montant payé dépasse le total : rendez la monnaie et saisissez le total');
  try {
    checkCredit(client.name, client, clientBalanceOf(db, client.id), doc.totals.total - paid);
  } catch (e) {
    throw new BusinessError((e as Error).message);
  }

  for (const l of doc.lines) moveStock(db, articleById(db, l.articleId), -l.quantity, 'vente', doc.number, date);
  db.documents.push(doc);
  if (payment && paid > 0) {
    db.payments.push({
      id: newId(),
      number: number(db, ctx, 'RG', date),
      date,
      clientId: client.id,
      amount: paid,
      mode: payment.mode,
      allocations: [{ docId: doc.id, amount: paid }],
      note: `Paiement ${doc.number}`,
    });
  }
  log(db, ctx, 'Facture validée', `${doc.number} · ${client.name} · ${doc.totals.total} FCFA · payé ${paid}`);
  return doc;
}

export function convertQuote(db: Database, ctx: Ctx, quoteId: string, payment?: PaymentNow): SalesDocument {
  const quote = docById(db, quoteId);
  if (quote.type !== 'devis') throw new BusinessError('Ce document n’est pas un devis');
  if (quote.status !== 'ouvert') throw new BusinessError(`Le devis ${quote.number} n’est plus ouvert`);
  const invoice = createInvoice(
    db,
    ctx,
    {
      clientId: quote.clientId,
      lines: quote.lines.map((l) => ({ articleId: l.articleId, sheets: l.sheets, lengthM: l.lengthM, quantity: l.quantity, unitPrice: l.unitPrice })),
      note: quote.note,
    },
    payment,
    quote.id,
  );
  quote.status = 'transforme';
  log(db, ctx, 'Devis transformé', `${quote.number} → ${invoice.number}`);
  return invoice;
}

export function cancelQuote(db: Database, ctx: Ctx, quoteId: string): void {
  const quote = docById(db, quoteId);
  if (quote.type !== 'devis' || quote.status !== 'ouvert') throw new BusinessError('Seul un devis ouvert peut être annulé');
  quote.status = 'annule';
  log(db, ctx, 'Devis annulé', quote.number);
}

/**
 * Avoir total : annule une facture, remet les articles en stock. La facture n'est jamais modifiée.
 * Avec `refundMode`, l'argent déjà encaissé et devenu trop-perçu est rendu au client
 * (règlement négatif), ce qui est obligatoire pour un client comptoir.
 */
export function createCreditNote(db: Database, ctx: Ctx, invoiceId: string, reason: string, refundMode?: PayMode): SalesDocument {
  const inv = docById(db, invoiceId);
  if (inv.type !== 'facture') throw new BusinessError('Un avoir ne peut annuler qu’une facture');
  if (inv.creditNoteId) throw new BusinessError(`${inv.number} a déjà un avoir`);
  const client = clientById(db, inv.clientId);
  const date = isoDate(ctx.now);
  const credit: SalesDocument = {
    ...structuredClone(inv),
    id: newId(),
    type: 'avoir',
    number: number(db, ctx, 'AV', date),
    date,
    status: 'validee',
    sourceId: inv.id,
    creditNoteId: undefined,
    note: `Annule ${inv.number} · ${required(reason, 'Le motif')}`,
    createdAt: ctx.now.toISOString(),
  };
  for (const l of credit.lines) moveStock(db, articleById(db, l.articleId), l.quantity, 'avoir', credit.number, date);
  db.documents.push(credit);
  inv.creditNoteId = credit.id;

  const overpaid = -clientBalanceOf(db, client.id);
  if (overpaid > 0 && (refundMode || client.category === 'comptoir')) {
    const refund = Math.min(overpaid, credit.totals.total);
    db.payments.push({
      id: newId(),
      number: number(db, ctx, 'RG', date),
      date,
      clientId: client.id,
      amount: -refund,
      mode: refundMode ?? 'especes',
      allocations: [],
      note: `Remboursement ${credit.number}`,
    });
  }
  log(db, ctx, 'Avoir émis', `${credit.number} annule ${inv.number} · ${reason}`);
  return credit;
}

/* ---------- Règlements et dépenses ---------- */

export interface PaymentInput {
  clientId: string;
  amount: Fcfa;
  mode: PayMode;
  /** Facture visée ; sinon répartition automatique sur les plus anciennes. */
  docId?: string;
  note?: string;
  date?: string;
}

export function recordPayment(db: Database, ctx: Ctx, input: PaymentInput) {
  const client = clientById(db, input.clientId);
  const amount = roundFcfa(input.amount);
  positive(amount, 'Le montant');
  const date = input.date ?? isoDate(ctx.now);
  let rest = amount;
  const allocations: { docId: string; amount: Fcfa }[] = [];
  const targets = input.docId
    ? [docById(db, input.docId)]
    : db.documents
        .filter((d) => d.type === 'facture' && d.clientId === client.id)
        .sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));
  for (const doc of targets) {
    if (rest <= 0) break;
    if (doc.clientId !== client.id) throw new BusinessError('Cette facture appartient à un autre client');
    const due = invoiceDue(db, doc.id);
    if (due <= 0) continue;
    const part = Math.min(due, rest);
    allocations.push({ docId: doc.id, amount: part });
    rest -= part;
  }
  if (input.docId && rest > 0) {
    throw new BusinessError('Le montant dépasse le reste à payer de cette facture');
  }
  if (rest > 0 && client.id === 'comptoir') {
    throw new BusinessError('Le client comptoir ne peut pas laisser d’avance');
  }
  const payment = { id: newId(), number: number(db, ctx, 'RG', date), date, clientId: client.id, amount, mode: input.mode, allocations, note: (input.note ?? '').trim() };
  db.payments.push(payment);
  log(db, ctx, 'Règlement encaissé', `${payment.number} · ${client.name} · ${amount} FCFA`);
  return payment;
}

export interface ExpenseInput {
  label: string;
  category: string;
  amount: Fcfa;
  mode: PayMode;
  date?: string;
}

export function recordExpense(db: Database, ctx: Ctx, input: ExpenseInput) {
  positive(input.amount, 'Le montant');
  const date = input.date ?? isoDate(ctx.now);
  const expense = {
    id: newId(),
    number: number(db, ctx, 'DP', date),
    date,
    label: required(input.label, 'Le libellé'),
    category: required(input.category, 'La catégorie'),
    amount: roundFcfa(input.amount),
    mode: input.mode,
  };
  db.expenses.push(expense);
  log(db, ctx, 'Dépense enregistrée', `${expense.number} · ${expense.label} · ${expense.amount} FCFA`);
  return expense;
}
