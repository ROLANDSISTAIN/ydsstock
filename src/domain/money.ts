/**
 * Montants en franc CFA (FCFA / XOF).
 *
 * Règle YDSstock : le FCFA n'a pas de centimes. Tous les montants stockés
 * sont des entiers ; l'arrondi se fait à l'unité, sur chaque ligne de document.
 */

/** Un montant en FCFA, toujours entier. */
export type Fcfa = number;

/** Arrondit à l'unité (arrondi commercial : 0,5 monte). */
export function roundFcfa(value: number): Fcfa {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Montant invalide : ${value}`);
  }
  // Math.round arrondit -0,5 vers 0 : on traite les négatifs (avoirs) symétriquement.
  const rounded = Math.sign(value) * Math.round(Math.abs(value));
  return rounded === 0 ? 0 : rounded;
}

const groupFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/** « 1 234 500 FCFA » (espaces insécables fines, comme sur une facture). */
export function formatFcfa(value: Fcfa, withUnit = true): string {
  const text = groupFormatter.format(roundFcfa(value));
  return withUnit ? `${text} FCFA` : text;
}

/** Applique un pourcentage de remise et renvoie le montant de la remise, arrondi. */
export function discountAmount(amount: Fcfa, percent: number): Fcfa {
  if (percent < 0 || percent > 100) {
    throw new RangeError(`Remise hors limites : ${percent} %`);
  }
  return roundFcfa((amount * percent) / 100);
}
