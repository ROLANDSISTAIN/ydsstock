import { createDemoCoilRepository } from './repository';
import { demoCoils, demoConsumptions } from './demo';

describe('cohérence des données d’exemple', () => {
  it('le poids restant = poids initial − consommations (bobine B-2409-017)', () => {
    const coil = demoCoils.find((c) => c.id === 'B-2409-017')!;
    const used = demoConsumptions
      .filter((u) => u.coilId === coil.id)
      .reduce((s, u) => s + u.consumedKg, 0);
    expect(coil.initialKg - used).toBe(coil.remainingKg);
  });

  it('aucune bobine n’a un poids restant négatif ou supérieur à l’initial', () => {
    for (const c of demoCoils) {
      expect(c.remainingKg).toBeGreaterThanOrEqual(0);
      expect(c.remainingKg).toBeLessThanOrEqual(c.initialKg);
    }
  });

  it('le dépôt renvoie les consommations de la plus récente à la plus ancienne', async () => {
    const repo = createDemoCoilRepository();
    const uses = await repo.consumptions('B-2409-017');
    expect(uses.map((u) => u.orderRef)).toEqual(['OF-2026-0142', 'OF-2026-0137', 'OF-2026-0129']);
  });
});
