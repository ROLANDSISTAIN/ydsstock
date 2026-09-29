/**
 * Enregistrement de la base sur l'appareil (IndexedDB du navigateur).
 *
 * Étape suivante prévue : SQLite local + synchronisation avec le serveur de
 * l'usine. Le reste de l'application ne dépend que de load/save.
 */
import { SCHEMA_VERSION, type Database } from './schema';

const DB_NAME = 'ydsstock';
const STORE = 'state';
const KEY = 'database';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadDatabase(): Promise<Database | undefined> {
  const idb = await open();
  return new Promise((resolve, reject) => {
    const req = idb.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result as Database | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDatabase(db: Database): Promise<void> {
  const idb = await open();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(db, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Vérifie qu'un fichier de sauvegarde ressemble bien à une base YDSstock. */
export function parseBackup(text: string): Database {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Ce fichier n’est pas une sauvegarde YDSstock (format illisible)');
  }
  const db = data as Partial<Database>;
  const keys: (keyof Database)[] = ['company', 'articles', 'coils', 'productionOrders', 'clients', 'documents', 'payments', 'expenses', 'stockMoves', 'audit', 'counters'];
  if (!db || typeof db !== 'object' || keys.some((k) => !(k in db))) {
    throw new Error('Ce fichier n’est pas une sauvegarde YDSstock complète');
  }
  if (db.version !== SCHEMA_VERSION) {
    throw new Error(`Sauvegarde en version ${db.version}, cette application lit la version ${SCHEMA_VERSION}`);
  }
  return db as Database;
}
