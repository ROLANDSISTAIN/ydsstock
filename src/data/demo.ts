/**
 * Données d'exemple d'Aciéra Tôles SARL (entreprise fictive).
 * Mêmes chiffres que les maquettes, pour comparer facilement.
 */
import type { Coil, CoilConsumption } from './types';

export const demoCoils: Coil[] = [
  { id: 'B-2409-017', material: 'galvanise', thicknessMm: 0.35, widthM: 1.22, color: 'Brut', supplier: 'Sidérurgie du Golfe', receivedOn: '2026-09-12', initialKg: 5000, remainingKg: 2140, pricePerKg: 685, location: 'Allée A · rack 2', status: 'en_cours' },
  { id: 'B-2409-021', material: 'prelaque', thicknessMm: 0.35, widthM: 1.22, color: 'Bleu', ral: 'RAL 5010', supplier: 'ColorSteel Import', receivedOn: '2026-09-18', initialKg: 4800, remainingKg: 4800, pricePerKg: 790, location: 'Allée A · rack 4', status: 'en_stock' },
  { id: 'B-2408-009', material: 'prelaque', thicknessMm: 0.4, widthM: 1.22, color: 'Rouge brique', ral: 'RAL 8004', supplier: 'ColorSteel Import', receivedOn: '2026-08-27', initialKg: 5200, remainingKg: 410, pricePerKg: 805, location: 'Allée B · rack 1', status: 'en_cours' },
  { id: 'B-2409-004', material: 'aluzinc', thicknessMm: 0.3, widthM: 1.22, color: 'Brut', supplier: 'Sidérurgie du Golfe', receivedOn: '2026-09-03', initialKg: 4500, remainingKg: 3120, pricePerKg: 720, location: 'Allée B · rack 3', status: 'en_cours' },
  { id: 'B-2407-030', material: 'galvanise', thicknessMm: 0.25, widthM: 1.0, color: 'Brut', supplier: 'Sidérurgie du Golfe', receivedOn: '2026-07-29', initialKg: 3800, remainingKg: 0, pricePerKg: 660, location: '—', status: 'terminee' },
];

export const demoConsumptions: CoilConsumption[] = [
  { coilId: 'B-2409-017', date: '2026-09-16', orderRef: 'OF-2026-0129', consumedKg: 710, producedM: 207 },
  { coilId: 'B-2409-017', date: '2026-09-23', orderRef: 'OF-2026-0137', consumedKg: 960, producedM: 281 },
  { coilId: 'B-2409-017', date: '2026-09-28', orderRef: 'OF-2026-0142', consumedKg: 1190, producedM: 348 },
];
