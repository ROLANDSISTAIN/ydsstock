/** Libellés et formats d'affichage en français. */
import type { CoilMaterial } from '../domain/steel';
import type { CoilStatus, Family, PayMode } from '../data/schema';
import type { InvoiceState } from '../data/queries';

export const materialLabel: Record<CoilMaterial, string> = {
  galvanise: 'Galvanisé',
  aluzinc: 'Aluzinc',
  prelaque: 'Prélaqué',
};

export const coilStatusLabel: Record<CoilStatus, string> = {
  en_stock: 'En stock',
  en_cours: 'Entamée',
  terminee: 'Terminée',
  rebutee: 'Mise au rebut',
};

export const familyLabel: Record<Family, string> = {
  toles: 'Tôles',
  accessoires: 'Accessoires',
  clous: 'Clous et pointes',
  fil: 'Fil',
  negoce: 'Négoce',
  sous_produits: 'Sous-produits',
};

export const payModeLabel: Record<PayMode, string> = {
  especes: 'Espèces',
  mobile_money: 'Mobile money',
  virement: 'Virement',
  cheque: 'Chèque',
};

export const invoiceStateLabel: Record<InvoiceState, string> = {
  payee: 'Payée',
  partielle: 'Paiement partiel',
  impayee: 'Impayée',
  annulee: 'Annulée par avoir',
};

export const invoiceStateTone: Record<InvoiceState, string> = {
  payee: 'good',
  partielle: 'warn',
  impayee: 'crit',
  annulee: 'mute',
};

const intFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const decFmts = new Map<number, Intl.NumberFormat>();
const decFmt = (d: number) => {
  let f = decFmts.get(d);
  if (!f) {
    f = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
    decFmts.set(d, f);
  }
  return f;
};
const qtyFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

export const int = (n: number) => intFmt.format(Math.round(n));
export const dec = (n: number, digits = 1) => decFmt(digits).format(n);
/** Quantité sans zéros inutiles : 12 ; 12,5 ; 12,25. */
export const qty = (n: number) => qtyFmt.format(n);
export const fcfa = (n: number) => `${intFmt.format(Math.round(n))} FCFA`;

/** « 2026-09-28 » → « 28/09/2026 », sans passer par Date (pas de décalage de fuseau). */
export function frDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const longDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export function frLongDate(iso: string): string {
  const s = longDate.format(new Date(`${iso}T12:00:00`));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function frDateTime(isoTs: string): string {
  const d = new Date(isoTs);
  return `${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Lecture tolérante d'un nombre saisi : accepte « 1 234,5 » comme « 1234.5 ». */
export function parseNumber(text: string): number {
  const cleaned = text.replace(/[\s  ]/g, '').replace(',', '.');
  if (cleaned === '') return Number.NaN;
  return Number(cleaned);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function monthStart(iso: string): string {
  return `${iso.slice(0, 8)}01`;
}
