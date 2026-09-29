/**
 * Exécution « tout ou rien ».
 *
 * La commande travaille sur une copie complète de la base. Si elle réussit,
 * la copie devient la nouvelle base ; si elle échoue, la copie est jetée et
 * rien n'a changé : impossible d'enregistrer une vente à moitié.
 */
import type { Ctx } from './commands';
import type { Database } from './schema';

export function execute<R>(db: Database, command: (draft: Database, ctx: Ctx) => R, now = new Date()): { db: Database; result: R } {
  const draft = structuredClone(db);
  const result = command(draft, { now });
  return { db: draft, result };
}

/** Message lisible pour l'utilisateur, quelle que soit l'erreur. */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Opération impossible';
}
