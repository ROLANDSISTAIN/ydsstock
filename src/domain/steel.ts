/**
 * Calculs sur l'acier : conversion poids ↔ longueur d'une bobine.
 *
 * Formule (cahier des charges, section « Règles métier ») :
 *   L (m) = P (kg) ÷ (7,85 × largeur (m) × épaisseur (mm))
 *
 * 7,85 = masse en kg d'1 m² d'acier de 1 mm d'épaisseur (densité 7 850 kg/m³).
 * Le revêtement (galvanisation, aluzinc, peinture) alourdit la tôle : un
 * coefficient par type corrige le calcul. Les valeurs par défaut ci-dessous
 * sont à ajuster avec les fiches fournisseurs du client.
 */

export const STEEL_KG_PER_M2_PER_MM = 7.85;

export type CoilMaterial = 'galvanise' | 'aluzinc' | 'prelaque';

/** Coefficient multiplicateur de masse lié au revêtement (1 = acier nu). Réglable. */
export const DEFAULT_COATING_FACTOR: Record<CoilMaterial, number> = {
  galvanise: 1,
  aluzinc: 1,
  prelaque: 1,
};

export interface SheetFormat {
  /** Largeur de la bobine, en mètres (ex. 1,22). */
  widthM: number;
  /** Épaisseur nominale, en millimètres (ex. 0,35). */
  thicknessMm: number;
  /** Coefficient de revêtement, 1 par défaut. */
  coatingFactor?: number;
}

function assertFormat({ widthM, thicknessMm, coatingFactor = 1 }: SheetFormat): void {
  if (!(widthM > 0)) throw new RangeError(`Largeur invalide : ${widthM} m`);
  if (!(thicknessMm > 0)) throw new RangeError(`Épaisseur invalide : ${thicknessMm} mm`);
  if (!(coatingFactor > 0)) throw new RangeError(`Coefficient invalide : ${coatingFactor}`);
}

/** Masse d'un mètre linéaire de bobine, en kg. */
export function kgPerMeter(format: SheetFormat): number {
  assertFormat(format);
  const { widthM, thicknessMm, coatingFactor = 1 } = format;
  return STEEL_KG_PER_M2_PER_MM * widthM * thicknessMm * coatingFactor;
}

/** Longueur (m) correspondant à un poids (kg). */
export function lengthFromWeight(weightKg: number, format: SheetFormat): number {
  if (weightKg < 0) throw new RangeError(`Poids négatif : ${weightKg} kg`);
  return weightKg / kgPerMeter(format);
}

/** Poids (kg) correspondant à une longueur (m). */
export function weightFromLength(lengthM: number, format: SheetFormat): number {
  if (lengthM < 0) throw new RangeError(`Longueur négative : ${lengthM} m`);
  return lengthM * kgPerMeter(format);
}
