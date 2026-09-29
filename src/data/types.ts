/**
 * Types de données partagés par l'interface et le stockage.
 * Les montants sont en FCFA entiers, les poids en kg, les longueurs en m.
 */
import type { Fcfa } from '../domain/money';
import type { CoilMaterial } from '../domain/steel';

export type CoilStatus = 'en_stock' | 'en_cours' | 'terminee' | 'rebutee';

export interface Coil {
  id: string;
  material: CoilMaterial;
  thicknessMm: number;
  widthM: number;
  color: string;
  ral?: string;
  supplier: string;
  receivedOn: string; // ISO AAAA-MM-JJ
  initialKg: number;
  remainingKg: number;
  pricePerKg: Fcfa;
  location: string;
  status: CoilStatus;
}

export interface CoilConsumption {
  coilId: string;
  date: string; // ISO
  orderRef: string;
  consumedKg: number;
  producedM: number;
}
