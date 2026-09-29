import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as cmd from '../data/commands';
import { clientBalanceOf, invoiceDue, invoicePaid, invoiceState } from '../data/queries';
import type { DocType, PayMode, SalesDocument } from '../data/schema';
import { useStore } from '../data/store';
import { ConfirmButton, Empty, Field, Modal, NumberInput, PageHead, Panel, Pill } from '../ui/components';
import { fcfa, frDate, int, invoiceStateLabel, invoiceStateTone, parseNumber, payModeLabel, qty } from '../ui/format';

export const docTypeLabel: Record<DocType, string> = { devis: 'Devis', facture: 'Facture', avoir: 'Avoir' };

export function DocStatus({ doc }: { doc: SalesDocument }) {
  const { db, today } = useStore();
  if (doc.type === 'facture') {
    const s = invoiceState(db, doc);
    return <Pill tone={invoiceStateTone[s]}>{invoiceStateLabel[s]}</Pill>;
  }
  if (doc.type === 'devis') {
    if (doc.status === 'transforme') return <Pill tone="good">Transformé en facture</Pill>;
    if (doc.status === 'annule') return <Pill>Annulé</Pill>;
    if (doc.validUntil && doc.validUntil < today) return <Pill tone="warn">Expiré</Pill>;
    return <Pill tone="info">Ouvert</Pill>;
  }
  return <Pill>Avoir</Pill>;
}

const PAGE = 60;

export function DocumentsPage() {
  const { db } = useStore();
  const [type, setType] = useState<DocType | 'tout'>('tout');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const clientName = (id: string) => db.clients.find((c) => c.id === id)?.name ?? '';

  const docs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.documents
      .filter((d) => (type === 'tout' || d.type === type) && (!q || d.number.toLowerCase().includes(q) || clientName(d.clientId).toLowerCase().includes(q)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [db, type, search]);

  return (
    <>
      <PageHead title="Documents" sub="Devis, factures et avoirs, du plus récent au plus ancien" actions={<Link className="btn primary" to="/caisse">Nouvelle vente</Link>} />
      <div className="toolbar">
        <div className="chips" role="group" aria-label="Type de document">
          {(['tout', 'facture', 'devis', 'avoir'] as const).map((t) => (
            <button type="button" key={t} className="chip" aria-pressed={type === t} onClick={() => { setType(t); setLimit(PAGE); }}>
              {t === 'tout' ? 'Tous' : `${docTypeLabel[t]}s`}
            </button>
          ))}
        </div>
        <input type="search" className="grow" placeholder="Numéro ou client…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Rechercher un document" />
      </div>
      <Panel>
        {docs.length ? (
          <div className="scroll">
            <table>
              <thead><tr><th>Numéro</th><th>Date</th><th>Client</th><th className="num">Total</th><th className="num">Reste dû</th><th>État</th></tr></thead>
              <tbody>
                {docs.slice(0, limit).map((d) => (
                  <tr key={d.id}>
                    <td><Link className="mono" to={`/documents/${d.id}`}>{d.number}</Link></td>
                    <td>{frDate(d.date)}</td>
                    <td>{clientName(d.clientId)}</td>
                    <td className="num">{d.type === 'avoir' ? '−' : ''}{int(d.totals.total)}</td>
                    <td className="num">{d.type === 'facture' ? int(invoiceDue(db, d.id)) || '—' : '—'}</td>
                    <td><DocStatus doc={d} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Aucun document ne correspond.</Empty>
        )}
        {docs.length > limit && (
          <div className="more"><button type="button" className="btn" onClick={() => setLimit((l) => l + PAGE)}>Afficher plus ({docs.length - limit} restants)</button></div>
        )}
      </Panel>
    </>
  );
}

export function whatsappText(doc: SalesDocument, company: string, clientName: string): string {
  const lines = doc.lines.map((l) => `• ${l.label} : ${l.saleMode === 'cut' ? `${l.sheets} × ${qty(l.lengthM ?? 0)} m` : `${qty(l.quantity)} ${l.unit}`} = ${int(l.amount)} F`);
  return [
    `*${company}*`,
    `${docTypeLabel[doc.type]} ${doc.number} du ${frDate(doc.date)}`,
    `Client : ${clientName}`,
    '',
    ...lines,
    '',
    doc.totals.discount ? `Remise : −${int(doc.totals.discount)} F` : '',
    `*Total : ${fcfa(doc.totals.total)}*`,
    doc.validUntil ? `Valable jusqu’au ${frDate(doc.validUntil)}` : '',
  ]
    .filter((l, i, all) => l !== '' || (all[i - 1] !== '' && i > 0))
    .join('\n');
}

export function DocumentPage() {
  const { id } = useParams();
  const { db } = useStore();
  const doc = db.documents.find((d) => d.id === id);
  const [modal, setModal] = useState<'pay' | 'convert' | 'credit' | null>(null);
  if (!doc) return <><PageHead title="Document introuvable" back={{ to: '/documents', label: 'Documents' }} /><Empty>Ce document n’existe pas ou plus.</Empty></>;

  const client = db.clients.find((c) => c.id === doc.clientId)!;
  const source = doc.sourceId ? db.documents.find((d) => d.id === doc.sourceId) : undefined;
  const creditNote = doc.creditNoteId ? db.documents.find((d) => d.id === doc.creditNoteId) : undefined;
  const converted = doc.type === 'devis' ? db.documents.find((d) => d.sourceId === doc.id) : undefined;
  const due = doc.type === 'facture' ? invoiceDue(db, doc.id) : 0;
  const payments = db.payments.filter((p) => p.allocations.some((a) => a.docId === doc.id) || (doc.type === 'avoir' && p.note.includes(doc.number)));
  const wa = `https://wa.me/?text=${encodeURIComponent(whatsappText(doc, db.company.name, client.name))}`;

  return (
    <>
      <PageHead
        back={{ to: '/documents', label: 'Documents' }}
        title={<>{docTypeLabel[doc.type]} <span className="mono title-num">{doc.number}</span></>}
        sub={<>{frDate(doc.date)} · <Link to={`/clients/${client.id}`}>{client.name}</Link></>}
        actions={
          <>
            <DocStatus doc={doc} />
            <Link className="btn" to={`/documents/${doc.id}/imprimer`}>Imprimer</Link>
            <a className="btn" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>
            {doc.type === 'devis' && doc.status === 'ouvert' && <button type="button" className="btn primary" onClick={() => setModal('convert')}>Transformer en facture</button>}
            {doc.type === 'facture' && due > 0 && <button type="button" className="btn primary" onClick={() => setModal('pay')}>Encaisser</button>}
          </>
        }
      />

      <div className="doc-links">
        {source && <p>Origine : <Link to={`/documents/${source.id}`} className="mono">{source.number}</Link></p>}
        {converted && <p>Facture : <Link to={`/documents/${converted.id}`} className="mono">{converted.number}</Link></p>}
        {creditNote && <p>Annulée par l’avoir <Link to={`/documents/${creditNote.id}`} className="mono">{creditNote.number}</Link></p>}
        {doc.validUntil && doc.status === 'ouvert' && <p>Valable jusqu’au {frDate(doc.validUntil)}</p>}
        {doc.note && <p>Note : {doc.note}</p>}
      </div>

      <div className="cols">
        <Panel title="Lignes">
          <DocLinesTable doc={doc} />
        </Panel>
        <div className="stack">
          <Panel title="Montants">
            <DocTotals doc={doc} />
            {doc.type === 'facture' && (
              <dl className="tot">
                <dt>Déjà payé</dt><dd>{int(invoicePaid(db, doc.id))}</dd>
                <dt className="strong">Reste dû</dt><dd className="strong">{int(due)}</dd>
              </dl>
            )}
            {doc.type === 'facture' && (
              <p className="small muted">Marge : {fcfa(doc.totals.net - doc.costTotal)} ({doc.totals.net > 0 ? Math.round(((doc.totals.net - doc.costTotal) / doc.totals.net) * 100) : 0} %)</p>
            )}
          </Panel>
          {payments.length > 0 && (
            <Panel title={doc.type === 'avoir' ? 'Remboursement' : 'Règlements'}>
              <ul className="plain">
                {payments.map((p) => {
                  const part = p.allocations.find((a) => a.docId === doc.id)?.amount ?? p.amount;
                  return <li key={p.id}><span className="mono">{p.number}</span> · {frDate(p.date)} · {payModeLabel[p.mode]} · <b>{fcfa(part)}</b></li>;
                })}
              </ul>
            </Panel>
          )}
          {doc.type === 'facture' && !doc.creditNoteId && (
            <Panel title="Corriger cette facture">
              <p className="small muted">Une facture validée ne se modifie pas. Pour l’annuler, émettez un avoir : les articles reviennent en stock et la dette du client est effacée.</p>
              <button type="button" className="btn" onClick={() => setModal('credit')}>Émettre un avoir</button>
            </Panel>
          )}
          {doc.type === 'devis' && doc.status === 'ouvert' && <CancelQuote id={doc.id} />}
        </div>
      </div>

      {modal === 'pay' && <PaymentModal clientId={client.id} docId={doc.id} max={due} onClose={() => setModal(null)} />}
      {modal === 'convert' && <ConvertModal doc={doc} onClose={() => setModal(null)} />}
      {modal === 'credit' && <CreditNoteModal doc={doc} onClose={() => setModal(null)} />}
    </>
  );
}

export function DocLinesTable({ doc }: { doc: SalesDocument }) {
  return (
    <div className="scroll">
      <table>
        <thead><tr><th>Article</th><th className="num">Quantité</th><th className="num">Prix</th><th className="num">Montant</th></tr></thead>
        <tbody>
          {doc.lines.map((l, i) => (
            <tr key={i}>
              <td><Link to={`/articles/${l.articleId}`}>{l.label}</Link></td>
              <td className="num">{l.saleMode === 'cut' ? <>{l.sheets} × {qty(l.lengthM ?? 0)} m<br /><span className="muted small">{qty(l.quantity)} ml</span></> : `${qty(l.quantity)} ${l.unit}`}</td>
              <td className="num">{int(l.unitPrice)}</td>
              <td className="num">{int(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DocTotals({ doc }: { doc: SalesDocument }) {
  const t = doc.totals;
  return (
    <dl className="tot">
      <dt>Sous-total</dt><dd>{int(t.subtotal)}</dd>
      {t.discount > 0 && <><dt>Remise {doc.discountPct} %</dt><dd>−{int(t.discount)}</dd></>}
      {t.vat > 0 && <><dt>Total HT</dt><dd>{int(t.net)}</dd><dt>TVA {doc.vatPct} %</dt><dd>{int(t.vat)}</dd></>}
      <dt className="big">Total</dt><dd className="big">{int(t.total)} <small>FCFA</small></dd>
    </dl>
  );
}

function CancelQuote({ id }: { id: string }) {
  const { run } = useStore();
  return (
    <Panel title="Le client renonce ?">
      <ConfirmButton confirmLabel="Confirmer l’annulation" onConfirm={() => run((d, c) => cmd.cancelQuote(d, c, id), 'Devis annulé')}>Annuler le devis</ConfirmButton>
    </Panel>
  );
}

function PayModeChoice({ mode, setMode }: { mode: PayMode; setMode: (m: PayMode) => void }) {
  return (
    <div className="pay" role="group" aria-label="Mode de paiement">
      {(Object.keys(payModeLabel) as PayMode[]).map((m) => (
        <button type="button" key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>{payModeLabel[m]}</button>
      ))}
    </div>
  );
}

export function PaymentModal({ clientId, docId, max, onClose }: { clientId: string; docId?: string; max?: number; onClose: () => void }) {
  const { run } = useStore();
  const [amount, setAmount] = useState(max ? String(max) : '');
  const [mode, setMode] = useState<PayMode>('especes');
  const [note, setNote] = useState('');
  const n = parseNumber(amount);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = run((d, c) => cmd.recordPayment(d, c, { clientId, docId, amount: n, mode, note }), (p) => `Règlement ${p.number} enregistré`);
    if (r.ok) onClose();
  };
  return (
    <Modal title="Encaisser un règlement" onClose={onClose}>
      <form onSubmit={submit} className="form">
        <Field label="Montant" hint={max !== undefined ? `Reste dû : ${fcfa(max)}` : 'Réparti automatiquement sur les factures les plus anciennes'}>
          {(id) => <NumberInput id={id} value={amount} onChange={(t) => setAmount(t)} suffix="FCFA" min={1} />}
        </Field>
        <div className="label">Mode</div>
        <PayModeChoice mode={mode} setMode={setMode} />
        <Field label="Référence (facultatif)">{(id) => <input id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="N° de chèque, de transaction…" />}</Field>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn primary" disabled={!(n > 0)}>Encaisser {n > 0 ? fcfa(n) : ''}</button>
        </div>
      </form>
    </Modal>
  );
}

function ConvertModal({ doc, onClose }: { doc: SalesDocument; onClose: () => void }) {
  const { db, run } = useStore();
  const navigate = useNavigate();
  const client = db.clients.find((c) => c.id === doc.clientId)!;
  const [choice, setChoice] = useState<'total' | 'part' | 'none'>(client.creditAllowed ? 'none' : 'total');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<PayMode>('especes');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payment = choice === 'total' ? { amount: 'total' as const, mode } : choice === 'part' ? { amount: parseNumber(amount), mode } : undefined;
    const r = run((d, c) => cmd.convertQuote(d, c, doc.id, payment), (inv) => `Facture ${inv.number} créée`);
    if (r.ok) navigate(`/documents/${r.result.id}`);
  };
  return (
    <Modal title={`Facturer le devis ${doc.number}`} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <p className="small muted">La facture reprend les lignes et les prix du devis. Le stock sera sorti maintenant.</p>
        <div className="radios">
          <label className="check"><input type="radio" name="pay" checked={choice === 'total'} onChange={() => setChoice('total')} /> Payé en entier ({fcfa(doc.totals.total)})</label>
          {client.creditAllowed && <label className="check"><input type="radio" name="pay" checked={choice === 'part'} onChange={() => setChoice('part')} /> Acompte</label>}
          {client.creditAllowed && <label className="check"><input type="radio" name="pay" checked={choice === 'none'} onChange={() => setChoice('none')} /> À crédit (solde actuel {fcfa(Math.max(0, clientBalanceOf(db, client.id)))})</label>}
        </div>
        {choice === 'part' && <Field label="Montant de l’acompte">{(id) => <NumberInput id={id} value={amount} onChange={(t) => setAmount(t)} suffix="FCFA" min={1} />}</Field>}
        {choice !== 'none' && <PayModeChoice mode={mode} setMode={setMode} />}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn primary">Créer la facture</button>
        </div>
      </form>
    </Modal>
  );
}

function CreditNoteModal({ doc, onClose }: { doc: SalesDocument; onClose: () => void }) {
  const { db, run } = useStore();
  const navigate = useNavigate();
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState<PayMode>('especes');
  const paid = invoicePaid(db, doc.id);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = run((d, c) => cmd.createCreditNote(d, c, doc.id, reason, paid > 0 ? mode : undefined), (av) => `Avoir ${av.number} émis`);
    if (r.ok) navigate(`/documents/${r.result.id}`);
  };
  return (
    <Modal title={`Annuler la facture ${doc.number}`} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <p className="small muted">Un avoir de {fcfa(doc.totals.total)} va être émis. Les articles reviennent en stock.</p>
        <Field label="Motif">{(id) => <input id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Retour client, erreur de couleur…" required />}</Field>
        {paid > 0 && (
          <>
            <p className="small">Le client avait déjà payé {fcfa(paid)}. Ce qui dépasse ses autres dettes lui est remboursé, par :</p>
            <PayModeChoice mode={mode} setMode={setMode} />
          </>
        )}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Retour</button>
          <button type="submit" className="btn primary danger" disabled={!reason.trim()}>Émettre l’avoir</button>
        </div>
      </form>
    </Modal>
  );
}
