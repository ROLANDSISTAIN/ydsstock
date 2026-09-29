import { useState } from 'react';
import * as cmd from '../data/commands';
import type { PayMode } from '../data/schema';
import { useStore } from '../data/store';
import { Empty, Field, NumberInput, PageHead, Panel, Stat } from '../ui/components';
import { fcfa, frDate, int, monthStart, parseNumber, payModeLabel } from '../ui/format';

const CATEGORIES = ['Énergie', 'Transport', 'Personnel', 'Maintenance', 'Loyer', 'Taxes', 'Divers'];

export function ExpensesPage() {
  const { db, run, today } = useStore();
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]!);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<PayMode>('especes');
  const [date, setDate] = useState(today);
  const list = [...db.expenses].sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
  const month = list.filter((e) => e.date >= monthStart(today));
  const byCat = CATEGORIES.map((c) => ({ c, v: month.filter((e) => e.category === c).reduce((s, e) => s + e.amount, 0) })).filter((x) => x.v > 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = run((d, c) => cmd.recordExpense(d, c, { label, category, amount: parseNumber(amount), mode, date }), (x) => `Dépense ${x.number} enregistrée`);
    if (r.ok) {
      setLabel('');
      setAmount('');
    }
  };

  return (
    <>
      <PageHead title="Dépenses" sub="Charges hors achats de matière, pour connaître le vrai résultat" />
      <div className="cols">
        <div className="stack">
          <Panel title="Nouvelle dépense">
            <form onSubmit={submit} className="form grid2">
              <Field label="Libellé" wide>{(id) => <input id={id} value={label} onChange={(e) => setLabel(e.target.value)} required placeholder="Carburant camion, facture d’électricité…" />}</Field>
              <Field label="Catégorie">{(id) => <select id={id} value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>}</Field>
              <Field label="Montant">{(id) => <NumberInput id={id} value={amount} onChange={(t) => setAmount(t)} suffix="FCFA" min={1} />}</Field>
              <Field label="Payé par">{(id) => <select id={id} value={mode} onChange={(e) => setMode(e.target.value as PayMode)}>{(Object.keys(payModeLabel) as PayMode[]).map((m) => <option key={m} value={m}>{payModeLabel[m]}</option>)}</select>}</Field>
              <Field label="Date">{(id) => <input id={id} type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />}</Field>
              <div className="form-actions wide"><button type="submit" className="btn primary" disabled={!(parseNumber(amount) > 0)}>Enregistrer</button></div>
            </form>
          </Panel>
          <Panel title="Historique">
            {list.length ? (
              <div className="scroll">
                <table>
                  <thead><tr><th>Date</th><th>Libellé</th><th>Catégorie</th><th className="num">Montant</th></tr></thead>
                  <tbody>{list.map((e) => <tr key={e.id}><td>{frDate(e.date)}</td><td>{e.label}<br /><span className="muted small mono">{e.number} · {payModeLabel[e.mode]}</span></td><td>{e.category}</td><td className="num">{int(e.amount)}</td></tr>)}</tbody>
                </table>
              </div>
            ) : (
              <Empty>Aucune dépense enregistrée.</Empty>
            )}
          </Panel>
        </div>
        <Panel title="Ce mois-ci">
          <Stat label="Total des dépenses" value={int(month.reduce((s, e) => s + e.amount, 0))} unit="FCFA" />
          {byCat.length > 0 && (
            <table className="gap-t">
              <tbody>{byCat.sort((a, b) => b.v - a.v).map((x) => <tr key={x.c}><td>{x.c}</td><td className="num">{fcfa(x.v)}</td></tr>)}</tbody>
            </table>
          )}
        </Panel>
      </div>
    </>
  );
}
