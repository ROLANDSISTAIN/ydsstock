/**
 * Lectures et calculs dérivés de la base (aucune modification).
 */
import { clientBalance, creditUsagePct, type LedgerEntry } from '../domain/accounts';
import type { Fcfa } from '../domain/money';
import { isAbnormalLoss } from '../domain/production';
import { lengthFromWeight } from '../domain/steel';
import type { Article, Coil, Database, PayMode, SalesDocument } from './schema';

/* ---------- Comptes clients ---------- */

export function clientLedger(db: Database, clientId: string): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  for (const d of db.documents) {
    if (d.clientId !== clientId) continue;
    if (d.type === 'facture') entries.push({ kind: 'facture', amount: d.totals.total });
    if (d.type === 'avoir') entries.push({ kind: 'avoir', amount: d.totals.total });
  }
  for (const p of db.payments) if (p.clientId === clientId) entries.push({ kind: 'reglement', amount: p.amount });
  return entries;
}

/** Ce que le client doit (positif) ou son avance (négatif). */
export function clientBalanceOf(db: Database, clientId: string): Fcfa {
  return clientBalance(clientLedger(db, clientId));
}

export function invoicePaid(db: Database, docId: string): Fcfa {
  let paid = 0;
  for (const p of db.payments) for (const a of p.allocations) if (a.docId === docId) paid += a.amount;
  return paid;
}

/** Reste à payer sur une facture (0 si réglée ou annulée par un avoir). */
export function invoiceDue(db: Database, docId: string): Fcfa {
  const doc = db.documents.find((d) => d.id === docId);
  if (!doc || doc.type !== 'facture' || doc.creditNoteId) return 0;
  return Math.max(0, doc.totals.total - invoicePaid(db, docId));
}

export type InvoiceState = 'payee' | 'partielle' | 'impayee' | 'annulee';

export function invoiceState(db: Database, doc: SalesDocument): InvoiceState {
  if (doc.creditNoteId) return 'annulee';
  const due = invoiceDue(db, doc.id);
  if (due === 0) return 'payee';
  return due < doc.totals.total ? 'partielle' : 'impayee';
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T12:00:00`) - Date.parse(`${fromIso}T12:00:00`)) / 86_400_000);
}

/* ---------- Ventes ---------- */

const inRange = (date: string, from: string, to: string) => date >= from && date <= to;

export interface SalesSummary {
  /** Chiffre d'affaires hors taxe, avoirs déduits. */
  revenue: Fcfa;
  cost: number;
  margin: Fcfa;
  marginPct: number;
  invoices: number;
}

export function salesSummary(db: Database, from: string, to: string): SalesSummary {
  let revenue = 0;
  let cost = 0;
  let invoices = 0;
  for (const d of db.documents) {
    if (!inRange(d.date, from, to)) continue;
    if (d.type === 'facture') {
      revenue += d.totals.net;
      cost += d.costTotal;
      invoices++;
    } else if (d.type === 'avoir') {
      revenue -= d.totals.net;
      cost -= d.costTotal;
    }
  }
  const margin = Math.round(revenue - cost);
  return { revenue, cost, margin, marginPct: revenue > 0 ? (margin / revenue) * 100 : 0, invoices };
}

export function cashIn(db: Database, from: string, to: string): { total: Fcfa; byMode: Record<PayMode, Fcfa> } {
  const byMode: Record<PayMode, Fcfa> = { especes: 0, mobile_money: 0, virement: 0, cheque: 0 };
  let total = 0;
  for (const p of db.payments) {
    if (!inRange(p.date, from, to)) continue;
    byMode[p.mode] += p.amount;
    total += p.amount;
  }
  return { total, byMode };
}

export function expensesTotal(db: Database, from: string, to: string): Fcfa {
  return db.expenses.filter((e) => inRange(e.date, from, to)).reduce((s, e) => s + e.amount, 0);
}

export function totalReceivables(db: Database): Fcfa {
  return db.clients.reduce((s, c) => s + Math.max(0, clientBalanceOf(db, c.id)), 0);
}

export function overdueReceivables(db: Database, today: string, days = 30): Fcfa {
  return db.documents
    .filter((d) => d.type === 'facture' && daysBetween(d.date, today) > days)
    .reduce((s, d) => s + invoiceDue(db, d.id), 0);
}

export function topArticles(db: Database, from: string, to: string, limit = 5) {
  const map = new Map<string, { articleId: string; label: string; unit: string; quantity: number; revenue: number; cost: number }>();
  for (const d of db.documents) {
    if (!inRange(d.date, from, to) || (d.type !== 'facture' && d.type !== 'avoir')) continue;
    const sign = d.type === 'facture' ? 1 : -1;
    for (const l of d.lines) {
      const row = map.get(l.articleId) ?? { articleId: l.articleId, label: l.label, unit: l.unit, quantity: 0, revenue: 0, cost: 0 };
      row.quantity += sign * l.quantity;
      row.revenue += sign * l.amount;
      row.cost += sign * l.quantity * l.unitCost;
      map.set(l.articleId, row);
    }
  }
  return [...map.values()]
    .filter((r) => r.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
    .map((r) => ({ ...r, marginPct: r.revenue > 0 ? ((r.revenue - r.cost) / r.revenue) * 100 : 0 }));
}

/* ---------- Stock et bobines ---------- */

export function coilLengthLeft(c: Coil): number {
  return lengthFromWeight(c.remainingKg, { widthM: c.widthM, thicknessMm: c.thicknessMm });
}

export const LOW_COIL_RATIO = 0.15;
export const isCoilLow = (c: Coil) => c.remainingKg > 0 && c.remainingKg / c.initialKg < LOW_COIL_RATIO;
export const isArticleLow = (a: Article) => a.active && a.minStock > 0 && a.stock <= a.minStock;

/** Consommation moyenne par jour ouvré d'un article sur les 30 derniers jours (sorties par vente). */
export function dailyUsage(db: Database, articleId: string, today: string): number {
  let out = 0;
  for (const m of db.stockMoves) {
    if (m.articleId === articleId && m.reason === 'vente' && daysBetween(m.date, today) <= 30) out -= m.delta;
  }
  return out / 26;
}

/* ---------- Alertes ---------- */

export interface Alert {
  level: 'crit' | 'warn' | 'info';
  title: string;
  detail: string;
  link: string;
}

export function alerts(db: Database, today: string): Alert[] {
  const list: Alert[] = [];
  const fmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  for (const c of db.coils) {
    if (isCoilLow(c)) {
      list.push({ level: 'crit', title: `Bobine ${c.ref} presque finie`, detail: `${fmt.format(c.remainingKg)} kg restants (≈ ${fmt.format(coilLengthLeft(c))} m).`, link: `/bobines/${c.id}` });
    }
  }
  for (const a of db.articles) {
    if (!isArticleLow(a)) continue;
    const usage = dailyUsage(db, a.id, today);
    const days = usage > 0 ? Math.floor(a.stock / usage) : undefined;
    list.push({
      level: a.stock <= 0 ? 'crit' : 'warn',
      title: `${a.name} : stock bas`,
      detail: `${fmt.format(a.stock)} ${a.unit} en stock, minimum ${fmt.format(a.minStock)}.${days === undefined ? '' : days < 2 ? ' Rupture imminente au rythme actuel.' : ` Épuisé dans ≈ ${days} jours au rythme actuel.`}`,
      link: `/articles/${a.id}`,
    });
  }
  for (const c of db.clients) {
    if (!c.creditAllowed || c.creditLimit <= 0) continue;
    const bal = clientBalanceOf(db, c.id);
    const pct = creditUsagePct(bal, c.creditLimit);
    if (pct >= 90) {
      list.push({ level: 'crit', title: `${c.name} proche du plafond`, detail: `${fmt.format(bal)} FCFA dus sur un plafond de ${fmt.format(c.creditLimit)}.`, link: `/clients/${c.id}` });
    }
  }
  const overdue = new Map<string, { count: number; amount: number; oldest: number }>();
  for (const d of db.documents) {
    if (d.type !== 'facture') continue;
    const due = invoiceDue(db, d.id);
    const age = daysBetween(d.date, today);
    if (due > 0 && age > 30) {
      const row = overdue.get(d.clientId) ?? { count: 0, amount: 0, oldest: 0 };
      row.count++;
      row.amount += due;
      row.oldest = Math.max(row.oldest, age);
      overdue.set(d.clientId, row);
    }
  }
  for (const [clientId, row] of overdue) {
    const client = db.clients.find((c) => c.id === clientId);
    list.push({
      level: 'warn',
      title: `${client?.name ?? 'Client'} : ${row.count} facture${row.count > 1 ? 's' : ''} en retard`,
      detail: `${fmt.format(row.amount)} FCFA impayés depuis plus de 30 jours (la plus ancienne : ${row.oldest} jours).`,
      link: `/clients/${clientId}`,
    });
  }
  for (const o of db.productionOrders) {
    if (o.status === 'cloture' && o.result && o.closedOn && daysBetween(o.closedOn, today) <= 14 && isAbnormalLoss(o.result.yieldPct)) {
      list.push({ level: 'warn', title: `Perte anormale sur ${o.number}`, detail: `Rendement ${o.result.yieldPct.toFixed(1).replace('.', ',')} % contre 97 % attendu (${o.machine}).`, link: `/production/${o.id}` });
    }
    if (o.status === 'en_cours' && daysBetween(o.createdOn, today) >= 2) {
      list.push({ level: 'info', title: `${o.number} toujours en cours`, detail: `Lancé il y a ${daysBetween(o.createdOn, today)} jours : pensez à le clôturer avec la pesée.`, link: `/production/${o.id}` });
    }
  }
  const order = { crit: 0, warn: 1, info: 2 };
  return list.sort((a, b) => order[a.level] - order[b.level]);
}
