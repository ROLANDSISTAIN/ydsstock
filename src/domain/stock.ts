/**
 * Mouvements de stock.
 *
 * Règle YDSstock : le stock négatif est interdit par défaut. Une sortie qui
 * ferait passer un article sous zéro est refusée, sauf autorisation explicite
 * (qui sera alors tracée dans le journal).
 */

export class StockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StockError';
  }
}

/** Quantités en unité de stock ; on arrondit à 3 décimales pour éviter les restes de calcul (0,1 + 0,2). */
export function roundQty(q: number): number {
  return Math.round(q * 1000) / 1000;
}

/**
 * Nouveau niveau de stock après un mouvement (delta positif = entrée, négatif = sortie).
 * Lève StockError si le résultat est négatif et que ce n'est pas autorisé.
 */
export function applyStockMove(current: number, delta: number, label: string, allowNegative = false): number {
  if (!Number.isFinite(delta)) throw new StockError(`Quantité invalide pour ${label}`);
  const next = roundQty(current + delta);
  if (next < 0 && !allowNegative) {
    throw new StockError(
      `Stock insuffisant pour ${label} : ${formatQty(current)} disponible, ${formatQty(-delta)} demandé`,
    );
  }
  return next;
}

/**
 * Coût moyen pondéré après une entrée en stock.
 * Si le stock existant est nul ou négatif, le nouveau coût est celui de l'entrée.
 */
export function weightedAverageCost(stockQty: number, stockCost: number, inQty: number, inCost: number): number {
  if (inQty <= 0) return stockCost;
  if (stockQty <= 0) return inCost;
  return (stockQty * stockCost + inQty * inCost) / (stockQty + inQty);
}

function formatQty(q: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(q);
}
