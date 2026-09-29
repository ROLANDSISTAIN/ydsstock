import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { creditUsagePct } from '../domain/accounts';
import { lineAmount, totalsFromAmounts } from '../domain/sales';
import * as cmd from '../data/commands';
import { clientBalanceOf } from '../data/queries';
import { WALK_IN_CLIENT_ID, type Article, type Family, type PayMode } from '../data/schema';
import { useStore } from '../data/store';
import { Field, NumberInput, PageHead, Panel, Swatch } from '../ui/components';
import { dec, familyLabel, fcfa, int, parseNumber, payModeLabel, qty } from '../ui/format';

interface CartLine {
  key: number;
  articleId: string;
  sheets: string;
  lengthM: string;
  quantity: string;
  price: string;
}

let nextKey = 1;

export function PointOfSalePage() {
  const { db, run } = useStore();
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [clientId, setClientId] = useState(WALK_IN_CLIENT_ID);
  const [family, setFamily] = useState<Family | 'tout'>('tout');
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<PayMode>('especes');
  const [payAll, setPayAll] = useState(true);
  const [paidText, setPaidText] = useState('');
  const [note, setNote] = useState('');

  const client = db.clients.find((c) => c.id === clientId)!;
  const balance = clientBalanceOf(db, clientId);
  const articles = db.articles.filter((a) => a.active && (a.family !== 'sous_produits' || a.stock > 0));
  const families = [...new Set(articles.map((a) => a.family))];
  const visible = articles.filter(
    (a) => (family === 'tout' || a.family === family) && `${a.ref} ${a.name}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const computed = useMemo(
    () =>
      cart.map((l) => {
        const a = db.articles.find((x) => x.id === l.articleId)!;
        const price = parseNumber(l.price);
        try {
          if (a.saleMode === 'cut') {
            const sheets = parseNumber(l.sheets);
            const len = parseNumber(l.lengthM);
            const amount = lineAmount({ kind: 'cut', sheets, lengthM: len, pricePerMeter: price });
            return { line: l, article: a, amount, qty: sheets * len, error: '' };
          }
          const q = parseNumber(l.quantity);
          return { line: l, article: a, amount: lineAmount({ kind: 'unit', quantity: q, unitPrice: price }), qty: q, error: '' };
        } catch {
          return { line: l, article: a, amount: 0, qty: 0, error: 'Quantité ou prix à corriger' };
        }
      }),
    [cart, db.articles],
  );
  const hasErrors = computed.some((c) => c.error);
  const totals = totalsFromAmounts(computed.map((c) => c.amount), client.discountPct, db.company.vatPct);
  const paid = client.creditAllowed && !payAll ? parseNumber(paidText) || 0 : totals.total;
  const unpaid = totals.total - paid;
  const overLimit = client.creditAllowed && balance + unpaid > client.creditLimit;

  const add = (a: Article) => {
    if (a.saleMode === 'unit') {
      const existing = cart.find((l) => l.articleId === a.id);
      if (existing) {
        update(existing.key, { quantity: String((parseNumber(existing.quantity) || 0) + 1) });
        return;
      }
    }
    setCart((c) => [...c, { key: nextKey++, articleId: a.id, sheets: '1', lengthM: '3', quantity: '1', price: String(a.price) }]);
  };
  const update = (key: number, patch: Partial<CartLine>) => setCart((c) => c.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: number) => setCart((c) => c.filter((l) => l.key !== key));

  const toInput = (): cmd.SaleInput => ({
    clientId,
    note,
    lines: computed.map(({ line, article }) =>
      article.saleMode === 'cut'
        ? { articleId: article.id, sheets: parseNumber(line.sheets), lengthM: parseNumber(line.lengthM), unitPrice: parseNumber(line.price) }
        : { articleId: article.id, quantity: parseNumber(line.quantity), unitPrice: parseNumber(line.price) },
    ),
  });

  const checkout = () => {
    const r = run(
      (d, c) => cmd.createInvoice(d, c, toInput(), paid > 0 ? { amount: payAll || !client.creditAllowed ? 'total' : paid, mode } : undefined),
      (inv) => `Facture ${inv.number} enregistrée`,
    );
    if (r.ok) navigate(`/documents/${r.result.id}`);
  };
  const saveQuote = () => {
    const r = run((d, c) => cmd.createQuote(d, c, toInput()), (q) => `Devis ${q.number} enregistré`);
    if (r.ok) navigate(`/documents/${r.result.id}`);
  };

  return (
    <>
      <PageHead title="Caisse" sub="Touchez un article pour l’ajouter. Les tôles se vendent en feuilles × longueur." />
      <div className="pos">
        <section>
          <div className="search">
            <input type="search" placeholder="Rechercher un article ou une référence…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Rechercher un article" />
          </div>
          <div className="chips" role="group" aria-label="Familles">
            <button type="button" className="chip" aria-pressed={family === 'tout'} onClick={() => setFamily('tout')}>Tout</button>
            {families.map((f) => (
              <button type="button" key={f} className="chip" aria-pressed={family === f} onClick={() => setFamily(f)}>{familyLabel[f]}</button>
            ))}
          </div>
          <div className="catalog">
            {visible.map((a) => (
              <button type="button" key={a.id} className="prod" onClick={() => add(a)} disabled={a.stock <= 0}>
                <Swatch color={a.swatch} />
                <b>{a.name}</b>
                <span className={`s${a.stock <= a.minStock ? ' low' : ''}`}>{a.stock <= 0 ? 'Rupture' : `Stock : ${qty(a.stock)} ${a.unit}`}</span>
                <span className="p">{int(a.price)} FCFA / {a.unit}</span>
              </button>
            ))}
            {!visible.length && <p className="empty">Aucun article ne correspond.</p>}
          </div>
          {cart.length > 0 && (
            <button type="button" className="pos-bar" onClick={() => document.getElementById('ticket')?.scrollIntoView({ behavior: 'smooth' })}>
              <span>Voir la vente · {cart.length} article{cart.length > 1 ? 's' : ''}</span>
              <span>{int(totals.total)} FCFA</span>
            </button>
          )}
        </section>

        <Panel id="ticket" className="ticket" title="Vente en cours" aside={cart.length ? <button type="button" className="link" onClick={() => setCart([])}>Vider</button> : undefined}>
          <Field label="Client" hint={client.creditAllowed ? `Remise ${client.discountPct} % · doit ${fcfa(Math.max(0, balance))} sur ${fcfa(client.creditLimit)} (${dec(creditUsagePct(balance, client.creditLimit), 0)} %)` : client.id === WALK_IN_CLIENT_ID ? 'Paiement comptant obligatoire' : 'Sans crédit : paiement comptant'}>
            {(id) => (
              <select id={id} value={clientId} onChange={(e) => { setClientId(e.target.value); setPayAll(true); }}>
                {db.clients.filter((c) => c.active).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.discountPct ? ` · remise ${c.discountPct} %` : ''}</option>
                ))}
              </select>
            )}
          </Field>

          <div className="lines">
            {computed.map(({ line, article, amount, qty: q, error }) => (
              <div className="line" key={line.key}>
                <div className="line-h">
                  <b>{article.name}</b>
                  <span className="mono">{error ? '—' : int(amount)}</span>
                  <button type="button" className="x" onClick={() => remove(line.key)} aria-label={`Retirer ${article.name}`}>×</button>
                </div>
                <div className="line-ctl">
                  {article.saleMode === 'cut' ? (
                    <>
                      <NumberInput value={line.sheets} onChange={(t) => update(line.key, { sheets: t })} suffix="feuilles" />
                      <span>×</span>
                      <NumberInput value={line.lengthM} onChange={(t) => update(line.key, { lengthM: t })} suffix="m" />
                    </>
                  ) : (
                    <NumberInput value={line.quantity} onChange={(t) => update(line.key, { quantity: t })} suffix={article.unit} />
                  )}
                  <NumberInput value={line.price} onChange={(t) => update(line.key, { price: t })} suffix={`F/${article.unit}`} />
                </div>
                {error ? <p className="line-err">{error}</p> : q > article.stock ? <p className="line-err">Stock insuffisant : {qty(article.stock)} {article.unit} disponibles</p> : article.saleMode === 'cut' ? <p className="line-info">{qty(q)} ml</p> : null}
              </div>
            ))}
            {!cart.length && <p className="empty">Aucun article. Ajoutez-en depuis le catalogue.</p>}
          </div>

          <dl className="tot">
            <dt>Sous-total</dt><dd>{int(totals.subtotal)}</dd>
            {totals.discount > 0 && <><dt>Remise {client.discountPct} %</dt><dd>−{int(totals.discount)}</dd></>}
            {totals.vat > 0 && <><dt>TVA {db.company.vatPct} %</dt><dd>{int(totals.vat)}</dd></>}
            <dt className="big">Total</dt><dd className="big">{int(totals.total)} <small>FCFA</small></dd>
          </dl>

          <div className="label">Paiement</div>
          <div className="pay" role="group" aria-label="Mode de paiement">
            {(Object.keys(payModeLabel) as PayMode[]).map((m) => (
              <button type="button" key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>{payModeLabel[m]}</button>
            ))}
          </div>
          {client.creditAllowed && (
            <div className="credit-choice">
              <label className="check"><input type="checkbox" checked={payAll} onChange={(e) => setPayAll(e.target.checked)} /> Payé en entier</label>
              {!payAll && (
                <Field label="Montant payé maintenant" hint={`Reste à crédit : ${fcfa(Math.max(0, unpaid))}`}>
                  {(id) => <NumberInput id={id} value={paidText} onChange={(t) => setPaidText(t)} placeholder="0" suffix="FCFA" />}
                </Field>
              )}
              {overLimit && <p className="line-err">Plafond de crédit dépassé : encaissez davantage ou réduisez la vente.</p>}
            </div>
          )}
          <Field label="Note (facultatif)">
            {(id) => <input id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Chantier, livraison…" />}
          </Field>
          <div className="ticket-actions">
            <button type="button" className="btn" disabled={!cart.length || hasErrors} onClick={saveQuote}>Faire un devis</button>
            <button type="button" className="btn primary" disabled={!cart.length || hasErrors || overLimit} onClick={checkout}>
              {paid >= totals.total ? `Encaisser ${int(totals.total)} FCFA` : `Valider la facture`}
            </button>
          </div>
        </Panel>
      </div>
    </>
  );
}
