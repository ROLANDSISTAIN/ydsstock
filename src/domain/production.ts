/**
 * Production : rendement matière, chutes et coût de revient d'un ordre de fabrication.
 */
import { roundFcfa, type Fcfa } from './money';
import { lengthFromWeight, weightFromLength, type SheetFormat } from './steel';

export interface ProducedLine {
  /** Nombre de feuilles produites. */
  sheets: number;
  /** Longueur de chaque feuille, en mètres. */
  lengthM: number;
}

export interface ProductionInput {
  format: SheetFormat;
  /** Poids de bobine consommé (pesée avant − pesée après), en kg. */
  consumedKg: number;
  lines: ProducedLine[];
}

export interface ProductionResult {
  /** Mètres vendables produits. */
  producedM: number;
  /** Mètres théoriquement disponibles dans le poids consommé. */
  theoreticalM: number;
  /** Rendement, en % (mètres produits ÷ mètres théoriques). */
  yieldPct: number;
  /** Chutes, en mètres et en kg. */
  scrapM: number;
  scrapKg: number;
}

export function producedMeters(lines: ProducedLine[]): number {
  return lines.reduce((sum, { sheets, lengthM }) => {
    if (!Number.isInteger(sheets) || sheets < 0) {
      throw new RangeError(`Nombre de feuilles invalide : ${sheets}`);
    }
    if (!(lengthM > 0)) throw new RangeError(`Longueur de feuille invalide : ${lengthM} m`);
    return sum + sheets * lengthM;
  }, 0);
}

export function analyseProduction({ format, consumedKg, lines }: ProductionInput): ProductionResult {
  const producedM = producedMeters(lines);
  const theoreticalM = lengthFromWeight(consumedKg, format);
  if (theoreticalM === 0) {
    throw new RangeError('Aucune matière consommée : rendement impossible à calculer');
  }
  // Une production supérieure au théorique signale une erreur de pesée ou de saisie.
  if (producedM > theoreticalM * 1.005) {
    throw new RangeError(
      `Production (${producedM.toFixed(1)} m) supérieure à la matière consommée (${theoreticalM.toFixed(1)} m) : vérifier la pesée`,
    );
  }
  const scrapM = Math.max(0, theoreticalM - producedM);
  return {
    producedM,
    theoreticalM,
    yieldPct: (producedM / theoreticalM) * 100,
    scrapM,
    scrapKg: weightFromLength(scrapM, format),
  };
}

/** Vrai si le rendement passe sous l'objectif moins la tolérance (alerte « perte anormale »). */
export function isAbnormalLoss(yieldPct: number, targetPct = 97, tolerancePct = 3): boolean {
  return yieldPct < targetPct - tolerancePct;
}

export interface CostInput {
  consumedKg: number;
  pricePerKg: Fcfa;
  consumables: Fcfa;
  machineAndLabour: Fcfa;
  producedM: number;
}

/** Coût de revient total et par mètre produit, en FCFA. */
export function productionCost({ consumedKg, pricePerKg, consumables, machineAndLabour, producedM }: CostInput): {
  material: Fcfa;
  total: Fcfa;
  perMeter: Fcfa;
} {
  if (!(producedM > 0)) throw new RangeError('Aucune production : coût par mètre impossible');
  const material = roundFcfa(consumedKg * pricePerKg);
  const total = material + roundFcfa(consumables) + roundFcfa(machineAndLabour);
  return { material, total, perMeter: roundFcfa(total / producedM) };
}
