/**
 * Accès aux données.
 *
 * L'interface reste la même quel que soit le stockage : aujourd'hui des
 * données d'exemple en mémoire, demain SQLite local synchronisé avec le
 * serveur de l'usine. Les écrans ne dépendent que de cette interface.
 */
import type { Coil, CoilConsumption } from './types';
import { demoCoils, demoConsumptions } from './demo';

export interface CoilRepository {
  list(): Promise<Coil[]>;
  get(id: string): Promise<Coil | undefined>;
  consumptions(coilId: string): Promise<CoilConsumption[]>;
}

export function createDemoCoilRepository(): CoilRepository {
  const coils = structuredClone(demoCoils);
  const uses = structuredClone(demoConsumptions);
  return {
    async list() {
      return coils;
    },
    async get(id) {
      return coils.find((c) => c.id === id);
    },
    async consumptions(coilId) {
      return uses
        .filter((u) => u.coilId === coilId)
        .sort((a, b) => b.date.localeCompare(a.date));
    },
  };
}
