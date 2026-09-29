/** Libellés et formats d'affichage en français. */
import type { CoilMaterial } from '../domain/steel';
import type { CoilStatus } from '../data/types';

export const materialLabel: Record<CoilMaterial, string> = {
  galvanise: 'Galvanisé',
  aluzinc: 'Aluzinc',
  prelaque: 'Prélaqué',
};

export const statusLabel: Record<CoilStatus, string> = {
  en_stock: 'En stock',
  en_cours: 'En cours',
  terminee: 'Terminée',
  rebutee: 'Rebutée',
};

const intFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const decFmt = (d: number) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

export const int = (n: number) => intFmt.format(Math.round(n));
export const dec = (n: number, digits = 1) => decFmt(digits).format(n);

/** « 2026-09-28 » → « 28/09/2026 », sans passer par Date (pas de décalage de fuseau). */
export function frDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
