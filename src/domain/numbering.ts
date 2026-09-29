/**
 * Numérotation continue des documents : FA-2026-00001, FA-2026-00002…
 *
 * Règle YDSstock : pas de trou dans la numérotation. Le compteur n'avance que
 * quand un document est réellement enregistré (dans la même opération « tout
 * ou rien »), et repart à 1 chaque année civile.
 */

export type DocPrefix = 'DV' | 'FA' | 'AV' | 'RG' | 'OF' | 'BR' | 'DP';

/** Compteurs par préfixe et par année : { 'FA-2026': 1873 }. */
export type Counters = Record<string, number>;

export function counterKey(prefix: DocPrefix, year: number): string {
  return `${prefix}-${year}`;
}

export function formatNumber(prefix: DocPrefix, year: number, n: number): string {
  return `${prefix}-${year}-${String(n).padStart(5, '0')}`;
}

/** Renvoie le prochain numéro et les compteurs mis à jour (sans modifier l'entrée). */
export function nextNumber(counters: Counters, prefix: DocPrefix, year: number): { number: string; counters: Counters } {
  const key = counterKey(prefix, year);
  const n = (counters[key] ?? 0) + 1;
  return { number: formatNumber(prefix, year, n), counters: { ...counters, [key]: n } };
}
