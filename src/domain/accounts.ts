/**
 * Compte client : factures, avoirs et règlements.
 *
 * Solde dû = factures − avoirs − règlements. Un solde positif est une créance.
 */
import type { Fcfa } from './money';

export interface LedgerEntry {
  kind: 'facture' | 'avoir' | 'reglement';
  amount: Fcfa;
}

export function clientBalance(entries: LedgerEntry[]): Fcfa {
  return entries.reduce((sum, e) => (e.kind === 'facture' ? sum + e.amount : sum - e.amount), 0);
}

export class CreditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CreditError';
  }
}

export interface CreditPolicy {
  creditAllowed: boolean;
  creditLimit: Fcfa;
}

/**
 * Vérifie qu'une vente laissant `unpaid` FCFA impayés est acceptable pour ce client.
 * Lève CreditError sinon. `balance` = ce que le client doit déjà.
 */
export function checkCredit(clientName: string, policy: CreditPolicy, balance: Fcfa, unpaid: Fcfa): void {
  if (unpaid <= 0) return;
  if (!policy.creditAllowed) {
    throw new CreditError(`${clientName} n’a pas droit au crédit : la vente doit être payée en entier`);
  }
  const after = balance + unpaid;
  if (after > policy.creditLimit) {
    const fmt = new Intl.NumberFormat('fr-FR');
    throw new CreditError(
      `Plafond de crédit dépassé pour ${clientName} : ${fmt.format(after)} FCFA dus après la vente, plafond ${fmt.format(policy.creditLimit)} FCFA`,
    );
  }
}

/** Part du plafond utilisée, en % (0 si pas de plafond). */
export function creditUsagePct(balance: Fcfa, limit: Fcfa): number {
  return limit > 0 ? (Math.max(0, balance) / limit) * 100 : 0;
}
