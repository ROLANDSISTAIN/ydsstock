import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useStore } from './data/store';
import { ArticlePage, ArticlesPage } from './pages/ArticlesPage';
import { ClientPage, ClientsPage } from './pages/ClientsPage';
import { CoilPage, CoilsPage } from './pages/CoilsPage';
import { DashboardPage } from './pages/DashboardPage';
import { DocumentPage, DocumentsPage } from './pages/DocumentsPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { PointOfSalePage } from './pages/PointOfSalePage';
import { PrintPage } from './pages/PrintPage';
import { ProductionOrderPage, ProductionPage } from './pages/ProductionPage';
import { SettingsPage } from './pages/SettingsPage';

const I = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>,
  pos: <><rect x="3" y="7" width="18" height="13" rx="1.5" /><path d="M7 7V4h10v3M7 12h4M7 16h10" /></>,
  docs: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4M9 12h7M9 16h7" /></>,
  clients: <><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .6 3 2.8 3 6" /></>,
  articles: <><path d="M3 7l9-4 9 4-9 4z" /><path d="M3 7v10l9 4 9-4V7M12 11v10" /></>,
  coils: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3" /></>,
  production: <path d="M3 20h18M5 20V10l5 3V10l5 3V6h4v14" />,
  expenses: <><rect x="3" y="6" width="18" height="13" rx="1.5" /><path d="M3 10h18M7 15h4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
};

const groups: { label: string; items: { to: string; label: string; icon: keyof typeof I }[] }[] = [
  { label: 'Pilotage', items: [{ to: '/tableau', label: 'Tableau de bord', icon: 'dashboard' }] },
  { label: 'Ventes', items: [{ to: '/caisse', label: 'Caisse', icon: 'pos' }, { to: '/documents', label: 'Documents', icon: 'docs' }, { to: '/clients', label: 'Clients', icon: 'clients' }] },
  { label: 'Stock et usine', items: [{ to: '/articles', label: 'Articles', icon: 'articles' }, { to: '/bobines', label: 'Bobines', icon: 'coils' }, { to: '/production', label: 'Production', icon: 'production' }] },
  { label: 'Gestion', items: [{ to: '/depenses', label: 'Dépenses', icon: 'expenses' }, { to: '/parametres', label: 'Paramètres', icon: 'settings' }] },
];

const saveLabel = { saved: 'Enregistré sur cet appareil', saving: 'Enregistrement…', error: 'Échec de l’enregistrement', memory: 'Non enregistré (stockage bloqué)' };

export function App() {
  const location = useLocation();
  if (location.pathname.endsWith('/imprimer')) {
    return (
      <Routes>
        <Route path="/documents/:id/imprimer" element={<PrintPage />} />
      </Routes>
    );
  }
  return <Shell />;
}

function Shell() {
  const { db, saveState } = useStore();
  return (
    <div className="app">
      <aside className="rail">
        <div className="brand">
          YDSstock<small>{db.company.name}</small>
        </div>
        <nav className="nav" aria-label="Navigation principale">
          {groups.map((g) => (
            <div className="nav-group" key={g.label}>
              <span className="nav-label">{g.label}</span>
              {g.items.map((n) => (
                <NavLink key={n.to} to={n.to}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">{I[n.icon]}</svg>
                  <span>{n.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className={`rail-foot save-${saveState}`}>
          <b>Comptable</b>
          <span>{saveLabel[saveState]}</span>
        </div>
      </aside>
      <main>
        {saveState === 'error' || saveState === 'memory' ? (
          <p className="banner crit" role="alert">
            {saveState === 'memory'
              ? 'Ce navigateur bloque l’enregistrement : les saisies seront perdues à la fermeture. Évitez la navigation privée.'
              : 'La dernière saisie n’a pas pu être enregistrée sur l’appareil. Faites une sauvegarde depuis Paramètres.'}
          </p>
        ) : null}
        <Routes>
          <Route path="/" element={<Navigate to="/tableau" replace />} />
          <Route path="/tableau" element={<DashboardPage />} />
          <Route path="/caisse" element={<PointOfSalePage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/documents/:id" element={<DocumentPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/:id" element={<ClientPage />} />
          <Route path="/articles" element={<ArticlesPage />} />
          <Route path="/articles/:id" element={<ArticlePage />} />
          <Route path="/bobines" element={<CoilsPage />} />
          <Route path="/bobines/:id" element={<CoilPage />} />
          <Route path="/production" element={<ProductionPage />} />
          <Route path="/production/:id" element={<ProductionOrderPage />} />
          <Route path="/depenses" element={<ExpensesPage />} />
          <Route path="/parametres" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/tableau" replace />} />
        </Routes>
      </main>
    </div>
  );
}
