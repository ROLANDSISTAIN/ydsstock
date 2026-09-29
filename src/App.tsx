import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { CoilsPage } from './pages/CoilsPage';
import { UpcomingPage } from './pages/UpcomingPage';

const nav = [
  { to: '/tableau', label: 'Tableau de bord', icon: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></> },
  { to: '/caisse', label: 'Caisse', icon: <><rect x="3" y="7" width="18" height="13" rx="1.5" /><path d="M7 7V4h10v3M7 12h4M7 16h10" /></> },
  { to: '/bobines', label: 'Bobines', icon: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3" /></> },
  { to: '/production', label: 'Production', icon: <path d="M3 20h18M5 20V10l5 3V10l5 3V6h4v14" /> },
];

export function App() {
  return (
    <div className="app">
      <aside className="rail">
        <div className="brand">
          YDSstock<small>Aciéra Tôles SARL</small>
        </div>
        <nav className="nav" aria-label="Navigation principale">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">{n.icon}</svg>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="rail-foot">
          <b>Comptable</b>Version 0.1 · prototype
        </div>
      </aside>
      <main>
        <p className="demo"><span>Prototype</span>Données d’exemple d’Aciéra Tôles (entreprise fictive).</p>
        <Routes>
          <Route path="/" element={<Navigate to="/bobines" replace />} />
          <Route path="/bobines" element={<CoilsPage />} />
          <Route path="/tableau" element={<UpcomingPage title="Tableau de bord" phase="Phase 4 · Pilotage" items={['Ventes, marge et encaissements du jour', 'Créances clients et retards', 'Alertes : bobines presque finies, crédit dépassé, pertes anormales', 'Prévisions de rupture']} />} />
          <Route path="/caisse" element={<UpcomingPage title="Caisse" phase="Phase 3 · Ventes et clients" items={['Vente à la coupe (feuilles × longueur) et à l’unité', 'Remises pro et plafonds de crédit', 'Paiements : espèces, mobile money, virement, chèque, crédit', 'Ticket 80 mm, facture A4, envoi WhatsApp']} />} />
          <Route path="/production" element={<UpcomingPage title="Production" phase="Phase 2 · Production" items={['Ordres de fabrication par profileuse', 'Pesée avant et après, chutes, rendement', 'Coût de revient réel par mètre', 'Alerte perte anormale']} />} />
          <Route path="*" element={<Navigate to="/bobines" replace />} />
        </Routes>
      </main>
    </div>
  );
}
