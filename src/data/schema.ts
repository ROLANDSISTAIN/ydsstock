/**
 * Schéma de la base YDSstock.
 *
 * Unités : montants en FCFA entiers, poids en kg, longueurs en m.
 * Le stock d'un article est exprimé dans son unité de stock (`unit`) :
 * mètres linéaires pour les tôles vendues à la coupe, pièces, kg, boîtes… pour le reste.
 * Dates : 'AAAA-MM-JJ' ; horodatages : ISO complet.
 */
import type { Fcfa } from '../domain/money';
import type { Counters } from '../domain/numbering';
import type { DocumentTotals } from '../domain/sales';
import type { CoilMaterial } from '../domain/steel';

export const SCHEMA_VERSION = 1;

export interface Company {
  name: string;
  address: string;
  phone: string;
  email: string;
  /** Numéro d'identification fiscale. */
  taxId: string;
  rccm: string;
  /** TVA appliquée sur les ventes, en %. 0 = pas de TVA sur les documents. */
  vatPct: number;
  invoiceFooter: string;
}

export type Family = 'toles' | 'accessoires' | 'clous' | 'fil' | 'negoce' | 'sous_produits';

export interface Article {
  id: string;
  ref: string;
  name: string;
  family: Family;
  /** 'cut' : vendu en N feuilles × L m (stock en m linéaires) ; 'unit' : à l'unité. */
  saleMode: 'cut' | 'unit';
  /** Unité de stock et de prix : 'ml', 'pièce', 'kg', 'boîte'… */
  unit: string;
  price: Fcfa;
  /** Coût unitaire moyen pondéré (coût de revient pour le fabriqué, d'achat pour le négoce). */
  cost: number;
  stock: number;
  minStock: number;
  fabricated: boolean;
  /** Couleur d'aperçu dans le catalogue (hex). */
  swatch: string;
  active: boolean;
}

export type CoilStatus = 'en_stock' | 'en_cours' | 'terminee' | 'rebutee';

export interface Coil {
  id: string;
  /** Numéro de la bobine (étiquette fournisseur). */
  ref: string;
  material: CoilMaterial;
  thicknessMm: number;
  widthM: number;
  color: string;
  ral: string;
  supplier: string;
  receivedOn: string;
  initialKg: number;
  /** Poids facturé par le fournisseur, pour voir l'écart avec la pesée. */
  invoicedKg: number;
  remainingKg: number;
  pricePerKg: Fcfa;
  location: string;
  status: CoilStatus;
}

export interface ProductionLine {
  articleId: string;
  sheets: number;
  lengthM: number;
}

export interface ProductionResultSnapshot {
  consumedKg: number;
  producedM: number;
  theoreticalM: number;
  yieldPct: number;
  scrapM: number;
  scrapKg: number;
  materialCost: Fcfa;
  totalCost: Fcfa;
  costPerMeter: Fcfa;
}

export interface ProductionOrder {
  id: string;
  number: string;
  createdOn: string;
  machine: string;
  coilId: string;
  status: 'en_cours' | 'cloture' | 'annule';
  lines: ProductionLine[];
  /** Poids de la bobine au lancement. */
  weightBeforeKg: number;
  weightAfterKg?: number;
  consumables: Fcfa;
  machineCost: Fcfa;
  closedOn?: string;
  result?: ProductionResultSnapshot;
  /** Client pour qui la production est faite (sur-mesure), s'il y en a un. */
  clientId?: string;
  note: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  address: string;
  category: 'comptoir' | 'pro';
  discountPct: number;
  creditAllowed: boolean;
  creditLimit: Fcfa;
  active: boolean;
}

export interface DocLine {
  articleId: string;
  label: string;
  saleMode: 'cut' | 'unit';
  sheets?: number;
  lengthM?: number;
  /** Quantité en unité de stock (m linéaires pour une ligne à la coupe). */
  quantity: number;
  unit: string;
  unitPrice: Fcfa;
  amount: Fcfa;
  /** Coût unitaire au moment de la vente, pour la marge. */
  unitCost: number;
}

export type DocType = 'devis' | 'facture' | 'avoir';

export interface SalesDocument {
  id: string;
  type: DocType;
  number: string;
  date: string;
  /** Validité du devis. */
  validUntil?: string;
  clientId: string;
  lines: DocLine[];
  discountPct: number;
  vatPct: number;
  totals: DocumentTotals;
  /** Coût total des lignes (pour la marge). */
  costTotal: number;
  /**
   * devis : ouvert → transforme | annule
   * facture : validee (jamais modifiée) ; `creditNoteId` si un avoir l'annule
   * avoir : validee
   */
  status: 'ouvert' | 'transforme' | 'annule' | 'validee';
  /** Document d'origine (devis transformé, facture annulée par l'avoir). */
  sourceId?: string;
  creditNoteId?: string;
  note: string;
  createdAt: string;
}

export type PayMode = 'especes' | 'mobile_money' | 'virement' | 'cheque';

export interface Allocation {
  docId: string;
  amount: Fcfa;
}

export interface Payment {
  id: string;
  number: string;
  date: string;
  clientId: string;
  amount: Fcfa;
  mode: PayMode;
  /** Répartition sur les factures ; le reste éventuel est une avance. */
  allocations: Allocation[];
  note: string;
}

export interface Expense {
  id: string;
  number: string;
  date: string;
  label: string;
  category: string;
  amount: Fcfa;
  mode: PayMode;
}

export type MoveReason = 'vente' | 'avoir' | 'production' | 'inventaire' | 'achat' | 'ouverture';

export interface StockMove {
  id: string;
  date: string;
  articleId: string;
  delta: number;
  after: number;
  reason: MoveReason;
  ref: string;
}

export interface AuditEntry {
  at: string;
  action: string;
  detail: string;
}

export interface Database {
  version: number;
  counters: Counters;
  company: Company;
  articles: Article[];
  coils: Coil[];
  productionOrders: ProductionOrder[];
  clients: Client[];
  documents: SalesDocument[];
  payments: Payment[];
  expenses: Expense[];
  stockMoves: StockMove[];
  audit: AuditEntry[];
}

/** Identifiant du client comptoir, toujours présent. */
export const WALK_IN_CLIENT_ID = 'comptoir';

export function emptyDatabase(company: Company): Database {
  return {
    version: SCHEMA_VERSION,
    counters: {},
    company,
    articles: [],
    coils: [],
    productionOrders: [],
    clients: [
      { id: WALK_IN_CLIENT_ID, name: 'Client comptoir', phone: '', address: '', category: 'comptoir', discountPct: 0, creditAllowed: false, creditLimit: 0, active: true },
    ],
    documents: [],
    payments: [],
    expenses: [],
    stockMoves: [],
    audit: [],
  };
}
