/**
 * Accès des écrans à la base.
 *
 * Les écrans lisent `db` (et les calculs de queries.ts) et ne modifient la base
 * qu'avec `run(commande)`, qui exécute la commande en « tout ou rien » puis
 * enregistre la base sur l'appareil.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { isoDate, type Ctx } from './commands';
import { loadDatabase, saveDatabase } from './persistence';
import type { Database } from './schema';
import { buildDemoDatabase } from './seed';
import { errorMessage, execute } from './transaction';

export type RunResult<R> = { ok: true; result: R } | { ok: false; error: string };
export type SaveState = 'saved' | 'saving' | 'error' | 'memory';

interface Toast {
  id: number;
  text: string;
  tone: 'good' | 'crit';
}

interface Store {
  db: Database;
  today: string;
  saveState: SaveState;
  run<R>(command: (draft: Database, ctx: Ctx) => R, success?: string | ((r: R) => string)): RunResult<R>;
  replaceDatabase(db: Database, message: string): void;
  notify(text: string, tone?: Toast['tone']): void;
}

const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore hors de StoreProvider');
  return s;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dbRef = useRef<Database | null>(null);
  const saving = useRef<Promise<void>>(Promise.resolve());
  const persistent = useRef(true);

  useEffect(() => {
    let cancelled = false;
    loadDatabase()
      .then((stored) => {
        const initial = stored ?? buildDemoDatabase();
        if (cancelled) return;
        dbRef.current = initial;
        setDb(initial);
        if (!stored) void persist(initial);
      })
      .catch(() => {
        // Navigation privée ou stockage bloqué : on travaille en mémoire et on le dit.
        persistent.current = false;
        const initial = buildDemoDatabase();
        dbRef.current = initial;
        setDb(initial);
        setSaveState('memory');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const notify = useCallback((text: string, tone: Toast['tone'] = 'good') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'crit' ? 6000 : 3000);
  }, []);

  function persist(next: Database): Promise<void> {
    if (!persistent.current) return Promise.resolve();
    setSaveState('saving');
    saving.current = saving.current
      .then(() => saveDatabase(next))
      .then(() => {
        if (dbRef.current === next) setSaveState('saved');
      })
      .catch(() => setSaveState('error'));
    return saving.current;
  }

  const run: Store['run'] = (command, success) => {
    const current = dbRef.current;
    if (!current) return { ok: false, error: 'Base pas encore chargée' };
    try {
      const out = execute(current, command);
      dbRef.current = out.db;
      setDb(out.db);
      void persist(out.db);
      if (success) notify(typeof success === 'function' ? success(out.result) : success);
      return { ok: true, result: out.result };
    } catch (e) {
      const error = errorMessage(e);
      notify(error, 'crit');
      return { ok: false, error };
    }
  };

  const replaceDatabase = (next: Database, message: string) => {
    dbRef.current = next;
    setDb(next);
    void persist(next);
    notify(message);
  };

  if (!db) {
    return (
      <div className="boot" role="status">
        <b>YDSstock</b>
        <span>Ouverture de la base…</span>
      </div>
    );
  }

  return (
    <StoreContext.Provider value={{ db, today: isoDate(new Date()), saveState, run, replaceDatabase, notify }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>{t.text}</div>
        ))}
      </div>
    </StoreContext.Provider>
  );
}
