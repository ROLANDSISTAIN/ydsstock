/**
 * Lignes de vente et totaux d'un document (devis, facture, ticket).
 *
 * Deux façons de vendre :
 * - « à la coupe » : tôles vendues au mètre linéaire, en N feuilles de L mètres ;
 * - « à l'unité » : pièce, kg, boîte, paquet, carton…
 */
import { discountAmount, roundFcfa, type Fcfa } from './money';

export type SaleLine =
  | { kind: 'cut'; sheets: number; lengthM: number; pricePerMeter: Fcfa }
  | { kind: 'unit'; quantity: number; unitPrice: Fcfa };

/** Mètres linéaires d'une ligne à la coupe. */
export function linearMeters(line: Extract<SaleLine, { kind: 'cut' }>): number {
  return line.sheets * line.lengthM;
}

/** Montant d'une ligne, arrondi à l'unité (règle FCFA). */
export function lineAmount(line: SaleLine): Fcfa {
  if (line.kind === 'cut') {
    if (!Number.isInteger(line.sheets) || line.sheets <= 0) {
      throw new RangeError(`Nombre de feuilles invalide : ${line.sheets}`);
    }
    if (!(line.lengthM > 0)) throw new RangeError(`Longueur invalide : ${line.lengthM} m`);
    return roundFcfa(linearMeters(line) * line.pricePerMeter);
  }
  if (!(line.quantity > 0)) throw new RangeError(`Quantité invalide : ${line.quantity}`);
  return roundFcfa(line.quantity * line.unitPrice);
}

export interface DocumentTotals {
  subtotal: Fcfa;
  discount: Fcfa;
  total: Fcfa;
}

/** Totaux d'un document avec remise client en pourcentage (0 pour un client comptoir). */
export function documentTotals(lines: SaleLine[], discountPct = 0): DocumentTotals {
  const subtotal = lines.reduce((sum, line) => sum + lineAmount(line), 0);
  const discount = discountAmount(subtotal, discountPct);
  return { subtotal, discount, total: subtotal - discount };
}

/**
 * Vérifie si une vente à crédit reste sous le plafond du client.
 * Renvoie le montant encore disponible (négatif si la vente dépasse).
 */
export function creditHeadroom(outstanding: Fcfa, limit: Fcfa, saleTotal: Fcfa): Fcfa {
  return limit - outstanding - saleTotal;
}
