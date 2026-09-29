import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { amountInWords } from '../domain/words';
import { invoiceDue, invoicePaid } from '../data/queries';
import { useStore } from '../data/store';
import { frDate, int, qty } from '../ui/format';
import { docTypeLabel } from './DocumentsPage';

/** Document au format A4, prêt à imprimer ou à enregistrer en PDF depuis le navigateur. */
export function PrintPage() {
  const { id } = useParams();
  const { db } = useStore();
  const doc = db.documents.find((d) => d.id === id);

  useEffect(() => {
    document.documentElement.classList.add('printing');
    return () => document.documentElement.classList.remove('printing');
  }, []);

  if (!doc) return <p className="empty">Document introuvable.</p>;
  const client = db.clients.find((c) => c.id === doc.clientId)!;
  const co = db.company;
  const t = doc.totals;
  const source = doc.sourceId ? db.documents.find((d) => d.id === doc.sourceId) : undefined;

  return (
    <div className="print-shell">
      <div className="print-bar no-print">
        <Link to={`/documents/${doc.id}`} className="btn">← Retour</Link>
        <button type="button" className="btn primary" onClick={() => window.print()}>Imprimer ou enregistrer en PDF</button>
      </div>
      <article className="a4">
        <header className="a4-head">
          <div>
            <div className="a4-company">{co.name}</div>
            <div>{co.address}</div>
            <div>Tél. {co.phone}{co.email ? ` · ${co.email}` : ''}</div>
            <div>{co.rccm}{co.taxId ? ` · NIF ${co.taxId}` : ''}</div>
          </div>
          <div className="a4-doc">
            <div className="a4-type">{docTypeLabel[doc.type]}</div>
            <div className="mono">{doc.number}</div>
            <div>Date : {frDate(doc.date)}</div>
            {doc.validUntil && <div>Valable jusqu’au {frDate(doc.validUntil)}</div>}
            {source && <div>{doc.type === 'avoir' ? 'Annule la facture' : 'Suivant devis'} {source.number}</div>}
          </div>
        </header>

        <section className="a4-client">
          <div className="label">Client</div>
          <b>{client.name}</b>
          {client.address && <div>{client.address}</div>}
          {client.phone && <div>Tél. {client.phone}</div>}
        </section>

        <table className="a4-table">
          <thead>
            <tr><th>Désignation</th><th className="num">Quantité</th><th className="num">Prix unitaire</th><th className="num">Montant</th></tr>
          </thead>
          <tbody>
            {doc.lines.map((l, i) => (
              <tr key={i}>
                <td>{l.label}</td>
                <td className="num">{l.saleMode === 'cut' ? `${l.sheets} × ${qty(l.lengthM ?? 0)} m = ${qty(l.quantity)} ml` : `${qty(l.quantity)} ${l.unit}`}</td>
                <td className="num">{int(l.unitPrice)}</td>
                <td className="num">{int(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="a4-bottom">
          <p className="a4-words">
            Arrêté{doc.type === 'facture' ? 'e la présente facture' : doc.type === 'devis' ? ' le présent devis' : ' le présent avoir'} à la somme de :<br />
            <b>{amountInWords(t.total)}</b>
          </p>
          <dl className="a4-totals">
            <dt>Sous-total</dt><dd>{int(t.subtotal)}</dd>
            {t.discount > 0 && <><dt>Remise {doc.discountPct} %</dt><dd>−{int(t.discount)}</dd></>}
            {t.vat > 0 && <><dt>Total HT</dt><dd>{int(t.net)}</dd><dt>TVA {doc.vatPct} %</dt><dd>{int(t.vat)}</dd></>}
            <dt className="strong">Total {t.vat > 0 ? 'TTC' : ''}</dt><dd className="strong">{int(t.total)} FCFA</dd>
            {doc.type === 'facture' && (
              <>
                <dt>Déjà payé</dt><dd>{int(invoicePaid(db, doc.id))}</dd>
                <dt className="strong">Reste à payer</dt><dd className="strong">{int(invoiceDue(db, doc.id))} FCFA</dd>
              </>
            )}
          </dl>
        </div>

        {doc.note && <p className="a4-note">{doc.note}</p>}
        <div className="a4-sign">
          <div>Le client</div>
          <div>Pour {co.name}</div>
        </div>
        <footer className="a4-foot">{co.invoiceFooter}</footer>
      </article>
    </div>
  );
}
