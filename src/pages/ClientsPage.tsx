import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { creditUsagePct } from '../domain/accounts';
import * as cmd from '../data/commands';
import { clientBalanceOf, invoiceDue } from '../data/queries';
import { WALK_IN_CLIENT_ID, type Client } from '../data/schema';
import { useStore } from '../data/store';
import { Empty, Field, Meter, Modal, NumberInput, PageHead, Panel, Pill, Stat } from '../ui/components';
import { dec, fcfa, frDate, int, parseNumber, payModeLabel } from '../ui/format';
import { DocStatus, docTypeLabel, PaymentModal } from './DocumentsPage';

export function ClientsPage() {
  const { db } = useStore();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const rows = db.clients
    .filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()) || c.phone.includes(search.trim()))
    .map((c) => ({ c, balance: clientBalanceOf(db, c.id) }))
    .sort((a, b) => (a.c.id === WALK_IN_CLIENT_ID ? -1 : b.c.id === WALK_IN_CLIENT_ID ? 1 : b.balance - a.balance));

  return (
    <>
      <PageHead title="Clients" sub="Comptes clients, remises et plafonds de crédit" actions={<button type="button" className="btn primary" onClick={() => setCreating(true)}>Nouveau client</button>} />
      <div className="toolbar"><input type="search" className="grow" placeholder="Nom ou téléphone…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Rechercher un client" /></div>
      <Panel>
        <div className="scroll">
          <table>
            <thead><tr><th>Client</th><th>Catégorie</th><th className="num">Remise</th><th className="num">Doit</th><th>Crédit utilisé</th></tr></thead>
            <tbody>
              {rows.map(({ c, balance }) => {
                const pct = creditUsagePct(balance, c.creditLimit);
                return (
                  <tr key={c.id}>
                    <td><Link to={`/clients/${c.id}`}>{c.name}</Link>{!c.active && <> <Pill>Inactif</Pill></>}<br /><span className="muted small">{c.phone}</span></td>
                    <td>{c.category === 'pro' ? 'Professionnel' : 'Particulier'}</td>
                    <td className="num">{c.discountPct ? `${c.discountPct} %` : '—'}</td>
                    <td className="num">{balance > 0 ? int(balance) : balance < 0 ? <span className="up">avance {int(-balance)}</span> : '—'}</td>
                    <td className="meter-cell">{c.creditAllowed ? <><Meter pct={pct} tone={pct >= 90 ? 'crit' : pct >= 70 ? 'low' : ''} /><span className="muted small">{dec(pct, 0)} % de {int(c.creditLimit / 1000)} k</span></> : <span className="muted small">Comptant</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      {creating && <ClientModal onClose={() => setCreating(false)} />}
    </>
  );
}

function ClientModal({ client, onClose }: { client?: Client; onClose: () => void }) {
  const { run } = useStore();
  const [name, setName] = useState(client?.name ?? '');
  const [phone, setPhone] = useState(client?.phone ?? '');
  const [address, setAddress] = useState(client?.address ?? '');
  const [category, setCategory] = useState<Client['category']>(client?.category ?? 'pro');
  const [discount, setDiscount] = useState(String(client?.discountPct ?? 0));
  const [creditAllowed, setCreditAllowed] = useState(client?.creditAllowed ?? false);
  const [limit, setLimit] = useState(String(client?.creditLimit ?? 0));
  const isWalkIn = client?.id === WALK_IN_CLIENT_ID;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: cmd.ClientInput = { name, phone, address, category, discountPct: parseNumber(discount) || 0, creditAllowed: creditAllowed && !isWalkIn, creditLimit: creditAllowed ? parseNumber(limit) || 0 : 0 };
    const r = client ? run((d, c) => cmd.updateClient(d, c, client.id, input), 'Client enregistré') : run((d, c) => cmd.createClient(d, c, input), (cl) => `Client ${cl.name} créé`);
    if (r.ok) onClose();
  };
  return (
    <Modal title={client ? `Modifier ${client.name}` : 'Nouveau client'} onClose={onClose}>
      <form onSubmit={submit} className="form grid2">
        <Field label="Nom ou raison sociale" wide>{(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} required disabled={isWalkIn} />}</Field>
        <Field label="Téléphone">{(id) => <input id={id} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />}</Field>
        <Field label="Catégorie">
          {(id) => (
            <select id={id} value={category} onChange={(e) => setCategory(e.target.value as Client['category'])} disabled={isWalkIn}>
              <option value="pro">Professionnel</option>
              <option value="comptoir">Particulier</option>
            </select>
          )}
        </Field>
        <Field label="Adresse" wide>{(id) => <input id={id} value={address} onChange={(e) => setAddress(e.target.value)} />}</Field>
        <Field label="Remise habituelle">{(id) => <NumberInput id={id} value={discount} onChange={(t) => setDiscount(t)} suffix="%" min={0} />}</Field>
        {!isWalkIn && (
          <div className="field">
            <span className="label-like">Crédit</span>
            <label className="check"><input type="checkbox" checked={creditAllowed} onChange={(e) => setCreditAllowed(e.target.checked)} /> Autorisé à payer plus tard</label>
          </div>
        )}
        {creditAllowed && !isWalkIn && <Field label="Plafond de crédit" hint="Au-delà, les ventes à crédit sont bloquées">{(id) => <NumberInput id={id} value={limit} onChange={(t) => setLimit(t)} suffix="FCFA" min={0} />}</Field>}
        <div className="form-actions wide">
          <button type="button" className="btn" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn primary">Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
}

export function ClientPage() {
  const { id } = useParams();
  const { db } = useStore();
  const [modal, setModal] = useState<'edit' | 'pay' | null>(null);
  const client = db.clients.find((c) => c.id === id);

  const statement = useMemo(() => {
    if (!client) return [];
    const rows: { date: string; order: number; label: string; link?: string; debit: number; credit: number; key: string }[] = [];
    for (const d of db.documents) {
      if (d.clientId !== client.id || d.type === 'devis') continue;
      rows.push({ key: d.id, date: d.date, order: d.type === 'facture' ? 0 : 1, label: `${docTypeLabel[d.type]} ${d.number}`, link: `/documents/${d.id}`, debit: d.type === 'facture' ? d.totals.total : 0, credit: d.type === 'avoir' ? d.totals.total : 0 });
    }
    for (const p of db.payments) {
      if (p.clientId !== client.id) continue;
      rows.push({ key: p.id, date: p.date, order: 2, label: `${p.amount < 0 ? 'Remboursement' : 'Règlement'} ${p.number} · ${payModeLabel[p.mode]}`, debit: p.amount < 0 ? -p.amount : 0, credit: p.amount > 0 ? p.amount : 0 });
    }
    rows.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
    let running = 0;
    return rows.map((r) => ({ ...r, balance: (running += r.debit - r.credit) }));
  }, [db, client]);

  if (!client) return <><PageHead title="Client introuvable" back={{ to: '/clients', label: 'Clients' }} /><Empty>Ce client n’existe pas.</Empty></>;
  const balance = clientBalanceOf(db, client.id);
  const invoices = db.documents.filter((d) => d.clientId === client.id && d.type === 'facture');
  const revenue = invoices.reduce((s, d) => s + d.totals.total, 0);
  const openInvoices = invoices.filter((d) => invoiceDue(db, d.id) > 0);
  const quotes = db.documents.filter((d) => d.clientId === client.id && d.type === 'devis' && d.status === 'ouvert');

  return (
    <>
      <PageHead
        back={{ to: '/clients', label: 'Clients' }}
        title={client.name}
        sub={[client.category === 'pro' ? 'Professionnel' : 'Particulier', client.phone, client.address].filter(Boolean).join(' · ')}
        actions={
          <>
            <button type="button" className="btn" onClick={() => setModal('edit')}>Modifier</button>
            {balance > 0 && <button type="button" className="btn primary" onClick={() => setModal('pay')}>Encaisser</button>}
          </>
        }
      />
      <div className="kpis three">
        <div className="panel"><Stat label="Doit aujourd’hui" value={int(Math.max(0, balance))} unit="FCFA" detail={balance < 0 ? `Avance de ${fcfa(-balance)}` : `${openInvoices.length} facture${openInvoices.length > 1 ? 's' : ''} non soldée${openInvoices.length > 1 ? 's' : ''}`} /></div>
        <div className="panel"><Stat label="Plafond de crédit" value={client.creditAllowed ? int(client.creditLimit) : '—'} unit={client.creditAllowed ? 'FCFA' : undefined} detail={client.creditAllowed ? `${dec(creditUsagePct(balance, client.creditLimit), 0)} % utilisé` : 'Paiement comptant'} /></div>
        <div className="panel"><Stat label="Chiffre d’affaires" value={int(revenue)} unit="FCFA" detail={`${invoices.length} factures · remise ${client.discountPct} %`} /></div>
      </div>
      <div className="cols">
        <Panel title="Relevé de compte">
          {statement.length ? (
            <div className="scroll">
              <table>
                <thead><tr><th>Date</th><th>Opération</th><th className="num">Débit</th><th className="num">Crédit</th><th className="num">Solde</th></tr></thead>
                <tbody>
                  {[...statement].reverse().map((r) => (
                    <tr key={r.key}>
                      <td>{frDate(r.date)}</td>
                      <td>{r.link ? <Link to={r.link}>{r.label}</Link> : r.label}</td>
                      <td className="num">{r.debit ? int(r.debit) : ''}</td>
                      <td className="num">{r.credit ? int(r.credit) : ''}</td>
                      <td className="num">{int(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>Aucune opération pour ce client.</Empty>
          )}
        </Panel>
        <div className="stack">
          <Panel title="Factures à encaisser">
            {openInvoices.length ? (
              <ul className="plain">
                {openInvoices.map((d) => (
                  <li key={d.id}><Link className="mono" to={`/documents/${d.id}`}>{d.number}</Link> · {frDate(d.date)} · reste <b>{fcfa(invoiceDue(db, d.id))}</b></li>
                ))}
              </ul>
            ) : (
              <Empty>Tout est réglé.</Empty>
            )}
          </Panel>
          {quotes.length > 0 && (
            <Panel title="Devis ouverts">
              <ul className="plain">
                {quotes.map((d) => (
                  <li key={d.id}><Link className="mono" to={`/documents/${d.id}`}>{d.number}</Link> · {fcfa(d.totals.total)} <DocStatus doc={d} /></li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
      {modal === 'edit' && <ClientModal client={client} onClose={() => setModal(null)} />}
      {modal === 'pay' && <PaymentModal clientId={client.id} onClose={() => setModal(null)} />}
    </>
  );
}
