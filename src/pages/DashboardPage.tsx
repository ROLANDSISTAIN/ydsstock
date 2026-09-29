import { Link } from 'react-router-dom';
import { alerts, cashIn, coilLengthLeft, expensesTotal, isCoilLow, overdueReceivables, salesSummary, topArticles, totalReceivables } from '../data/queries';
import { useStore } from '../data/store';
import { Empty, Meter, PageHead, Panel, Pill, Stat } from '../ui/components';
import { addDays, dec, fcfa, frDate, frLongDate, int, materialLabel, monthStart, payModeLabel, qty } from '../ui/format';

export function DashboardPage() {
  const { db, today } = useStore();
  const day = salesSummary(db, today, today);
  const yesterday = salesSummary(db, addDays(today, -1), addDays(today, -1));
  const month = salesSummary(db, monthStart(today), today);
  const cash = cashIn(db, today, today);
  const monthExpenses = expensesTotal(db, monthStart(today), today);
  const receivables = totalReceivables(db);
  const overdue = overdueReceivables(db, today);
  const list = alerts(db, today);
  const coils = db.coils.filter((c) => c.status === 'en_cours' || c.status === 'en_stock').sort((a, b) => a.remainingKg / a.initialKg - b.remainingKg / b.initialKg);
  const top = topArticles(db, monthStart(today), today);
  const running = db.productionOrders.filter((o) => o.status === 'en_cours');
  const trend = yesterday.revenue > 0 ? ((day.revenue - yesterday.revenue) / yesterday.revenue) * 100 : undefined;
  const modes = Object.entries(cash.byMode).filter(([, v]) => v !== 0);

  return (
    <>
      <PageHead
        title="Tableau de bord"
        sub={`${frLongDate(today)} · ${db.company.name}`}
        actions={<Link className="btn primary" to="/caisse">Nouvelle vente</Link>}
      />
      <div className="kpis">
        <div className="panel">
          <Stat label="Ventes du jour (HT)" value={int(day.revenue)} unit="FCFA" detail={<>{trend !== undefined && <span className={trend >= 0 ? 'up' : 'down'}>{trend >= 0 ? '+' : ''}{dec(trend, 0)} %</span>} {trend !== undefined ? 'vs veille · ' : ''}{day.invoices} facture{day.invoices > 1 ? 's' : ''}</>} />
        </div>
        <div className="panel">
          <Stat label="Marge du jour" value={day.revenue > 0 ? dec(day.marginPct, 1) : '—'} unit={day.revenue > 0 ? '%' : undefined} detail={`${fcfa(day.margin)} sur coût de revient réel`} />
        </div>
        <div className="panel">
          <Stat label="Encaissé aujourd’hui" value={int(cash.total)} unit="FCFA" detail={modes.length ? modes.map(([m, v]) => `${payModeLabel[m as keyof typeof payModeLabel]} ${int(v)}`).join(' · ') : 'Aucun encaissement'} />
        </div>
        <div className="panel">
          <Stat label="Créances clients" value={int(receivables)} unit="FCFA" detail={overdue > 0 ? <><span className="down">{int(overdue)}</span> en retard de +30 j</> : 'Aucun retard'} />
        </div>
      </div>

      <div className="cols">
        <div className="stack">
          <Panel title="Ventes des 14 derniers jours" aside={<span className="label">milliers FCFA HT</span>}>
            <SalesChart />
          </Panel>
          <Panel title="Ce mois-ci">
            <div className="split">
              <Stat label="Chiffre d’affaires HT" value={int(month.revenue / 1000)} unit="k FCFA" detail={`${month.invoices} factures`} />
              <Stat label="Marge brute" value={dec(month.marginPct, 1)} unit="%" detail={fcfa(month.margin)} />
              <Stat label="Après dépenses" value={int((month.margin - monthExpenses) / 1000)} unit="k FCFA" tone={month.margin - monthExpenses < 0 ? 'down' : undefined} detail={`Dépenses : ${fcfa(monthExpenses)}`} />
            </div>
          </Panel>
          <Panel title="Bobines disponibles" aside={<Link to="/bobines" className="link">Tout voir</Link>}>
            {coils.length ? (
              coils.map((c) => {
                const pct = (c.remainingKg / c.initialKg) * 100;
                return (
                  <Link to={`/bobines/${c.id}`} className="coil-row" key={c.id}>
                    <div><b className="mono">{c.ref}</b> · {materialLabel[c.material]} {dec(c.thicknessMm, 2)}{c.color !== 'Brut' ? ` ${c.color.toLowerCase()}` : ''}</div>
                    <div className="muted small">{int(c.remainingKg)} kg · ≈ {int(coilLengthLeft(c))} m</div>
                    <Meter pct={pct} tone={isCoilLow(c) ? 'low' : ''} />
                  </Link>
                );
              })
            ) : (
              <Empty>Aucune bobine en stock. Réceptionnez-en une depuis l’écran Bobines.</Empty>
            )}
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Alertes" aside={list.length ? <Pill tone={list.some((a) => a.level === 'crit') ? 'crit' : 'warn'}>{list.length}</Pill> : undefined}>
            {list.length ? (
              <ul className="alerts">
                {list.map((a, i) => (
                  <li key={i}>
                    <span className={`sev ${a.level}`} />
                    <Link to={a.link}>
                      <b>{a.title}</b>
                      <p>{a.detail}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Rien à signaler.</Empty>
            )}
          </Panel>
          {running.length > 0 && (
            <Panel title="Production en cours">
              <ul className="plain">
                {running.map((o) => (
                  <li key={o.id}>
                    <Link to={`/production/${o.id}`}><b className="mono">{o.number}</b></Link> · {o.machine} · depuis le {frDate(o.createdOn)}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title="Meilleures ventes du mois">
            {top.length ? (
              <div className="scroll">
                <table>
                  <thead><tr><th>Article</th><th className="num">Quantité</th><th className="num">CA</th><th className="num">Marge</th></tr></thead>
                  <tbody>
                    {top.map((t) => (
                      <tr key={t.articleId}>
                        <td><Link to={`/articles/${t.articleId}`}>{t.label}</Link></td>
                        <td className="num">{qty(t.quantity)} {t.unit}</td>
                        <td className="num">{int(t.revenue / 1000)} k</td>
                        <td className="num">{dec(t.marginPct, 0)} %</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>Pas encore de vente ce mois-ci.</Empty>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

function SalesChart() {
  const { db, today } = useStore();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const values = days.map((d) => salesSummary(db, d, d).revenue / 1000);
  const W = 640, H = 200, pl = 44, pr = 8, pt = 16, pb = 28;
  const rawMax = Math.max(...values, 1);
  const step = niceStep(rawMax / 4);
  const max = Math.ceil(rawMax / step) * step;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / max);
  const bw = (W - pl - pr) / days.length;
  const weekday = (iso: string) => ['D', 'L', 'M', 'M', 'J', 'V', 'S'][new Date(`${iso}T12:00:00`).getDay()];
  const last = values.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`Ventes des 14 derniers jours, aujourd’hui ${int(values[last] ?? 0)} milliers FCFA`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="var(--line)" />
          <text x={pl - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{int(t)}</text>
        </g>
      ))}
      {values.map((v, i) => {
        const x = pl + i * bw + 4;
        const w = bw - 8;
        const isToday = i === last;
        return (
          <g key={days[i]}>
            <title>{`${frDate(days[i]!)} : ${int(v * 1000)} FCFA`}</title>
            <rect x={x} y={y(v)} width={w} height={Math.max(0, y(0) - y(v))} rx="3" fill={isToday ? 'var(--accent)' : 'var(--faint)'} opacity={isToday ? 1 : 0.5} />
            <text x={x + w / 2} y={H - 10} textAnchor="middle" fontSize="11" fill={isToday ? 'var(--fg)' : 'var(--muted)'} fontWeight={isToday ? 600 : 400}>{weekday(days[i]!)}</text>
          </g>
        );
      })}
      <text x={pl + last * bw + bw / 2} y={Math.max(12, y(values[last] ?? 0) - 6)} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="var(--fg)">{int(values[last] ?? 0)}</text>
    </svg>
  );
}

function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}
