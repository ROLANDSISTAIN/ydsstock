/**
 * Unités de vente et conversions.
 *
 * Chaque article a une unité de stock et une ou plusieurs unités de vente.
 * Une conversion dit combien d'unités de stock contient une unité de vente
 * (ex. 1 carton de pointes = 25 kg).
 */

export interface UnitConversion {
  /** Nom de l'unité de vente (« carton », « paquet »…). */
  unit: string;
  /** Nombre d'unités de stock dans une unité de vente. */
  stockUnitsPerUnit: number;
}

export interface Article {
  stockUnit: string;
  conversions: UnitConversion[];
}

function factorFor(article: Article, unit: string): number {
  if (unit === article.stockUnit) return 1;
  const conv = article.conversions.find((c) => c.unit === unit);
  if (!conv) throw new Error(`Unité « ${unit} » non définie pour cet article`);
  if (!(conv.stockUnitsPerUnit > 0)) throw new RangeError(`Conversion invalide pour « ${unit} »`);
  return conv.stockUnitsPerUnit;
}

/** Convertit une quantité d'une unité de l'article vers une autre. */
export function convert(article: Article, quantity: number, from: string, to: string): number {
  return (quantity * factorFor(article, from)) / factorFor(article, to);
}

/**
 * Surface couverte par des tôles, en m².
 * La largeur utile (après recouvrement) est plus petite que la largeur de la feuille.
 */
export function coveredArea(sheets: number, lengthM: number, usefulWidthM: number): number {
  if (!(usefulWidthM > 0)) throw new RangeError(`Largeur utile invalide : ${usefulWidthM} m`);
  return sheets * lengthM * usefulWidthM;
}
