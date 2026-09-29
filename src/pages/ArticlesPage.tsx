import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as cmd from '../data/commands';
import { dailyUsage, isArticleLow } from '../data/queries';
import type { Article, Family, MoveReason } from '../data/schema';
import { useStore } from '../data/store';
import { Empty, Field, Modal, NumberInput, PageHead, Panel, Pill, Stat, Swatch } from '../ui/components';
import { dec, familyLabel, fcfa, frDate, int, parseNumber, qty } from '../ui/format';

const reasonLabel: Record<MoveReason, string> = { vente: 'Vente', avoir: 'Retour (avoir)', production: 'Production', inventaire: 'Inventaire', achat: 'Achat', ouverture: 'Stock d’ouverture' };

export function ArticlesPage() {
  const { db } = useStore();
  const [search, setSearch] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [creating, setCreating] = useState(false);
  const q = search.trim().toLowerCase();
  const list = db.articles.filter((a) => (!q || `${a.ref} ${a.name}`.toLowerCase().includes(q)) && (!onlyLow || isArticleLow(a)));
  const families = (Object.keys(familyLabel) as Family[]).filter((f) => list.some((a) => a.family === f));
  const value = db.articles.reduce((s, a) => s + Math.max(0, a.stock) * a.cost, 0);
  const lowCount = db.articles.filter(isArticleLow).length;

  return (
    <>
      <PageHead title="Articles et stock" sub={`${db.articles.length} articles · stock valorisé ${fcfa(value)} au coût de revient`} actions={<button type="button" className="btn primary" onClick={() => setCreating(true)}>Nouvel article</button>} />
      <div className="toolbar">
        <input type="search" className="grow" placeholder="Référence ou nom…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Rechercher un article" />
        <label className="check"><input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} /> Stock bas seulement ({lowCount})</label>
      </div>
      {families.map((f) => (
        <Panel key={f} title={familyLabel[f]} className="gap-b">
          <div className="scroll">
            <table>
              <thead><tr><th>Article</th><th className="num">Stock</th><th className="num">Minimum</th><th className="num">Prix</th><th className="num">Coût</th><th className="num">Marge</th></tr></thead>
              <tbody>
                {list.filter((a) => a.family === f).map((a) => (
                  <tr key={a.id}>
                    <td><Swatch color={a.swatch} /> <Link to={`/articles/${a.id}`}>{a.name}</Link> <span className="mono muted">{a.ref}</span>{!a.active && <> <Pill>Inactif</Pill></>}</td>
                    <td className="num">{isArticleLow(a) ? <Pill tone={a.stock <= 0 ? 'crit' : 'warn'}>{qty(a.stock)} {a.unit}</Pill> : `${qty(a.stock)} ${a.unit}`}</td>
                    <td className="num">{a.minStock ? `${qty(a.minStock)}` : '—'}</td>
                    <td className="num">{int(a.price)}</td>
                    <td className="num">{int(a.cost)}</td>
                    <td className="num">{a.price > 0 ? `${dec(((a.price - a.cost) / a.price) * 100, 0)} %` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ))}
      {!families.length && <Empty>Aucun article ne correspond.</Empty>}
      {creating && <ArticleModal onClose={() => setCreating(false)} />}
    </>
  );
}

function ArticleModal({ onClose }: { onClose: () => void }) {
  const { run } = useStore();
  const [ref, setRef] = useState('');
  const [name, setName] = useState('');
  const [family, setFamily] = useState<Family>('toles');
  const [saleMode, setSaleMode] = useState<Article['saleMode']>('cut');
  const [unit, setUnit] = useState('pièce');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [min, setMin] = useState('0');
  const [opening, setOpening] = useState('0');
  const [fabricated, setFabricated] = useState(true);
  const [swatch, setSwatch] = useState('#9aa5b0');
  const u = saleMode === 'cut' ? 'ml' : unit;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = run(
      (d, c) => cmd.createArticle(d, c, { ref, name, family, saleMode, unit: u, price: parseNumber(price), cost: parseNumber(cost) || 0, minStock: parseNumber(min) || 0, openingStock: parseNumber(opening) || 0, fabricated, swatch }),
      (a) => `Article ${a.ref} créé`,
    );
    if (r.ok) onClose();
  };
  return (
    <Modal title="Nouvel article" onClose={onClose} wide>
      <form onSubmit={submit} className="form grid2">
        <Field label="Référence" hint="Courte et unique, ex. BAC35-BL">{(id) => <input id={id} value={ref} onChange={(e) => setRef(e.target.value)} required />}</Field>
        <Field label="Famille">
          {(id) => (
            <select id={id} value={family} onChange={(e) => { const f = e.target.value as Family; setFamily(f); if (f !== 'toles') setSaleMode('unit'); if (f === 'negoce') setFabricated(false); }}>
              {(Object.keys(familyLabel) as Family[]).map((f) => <option key={f} value={f}>{familyLabel[f]}</option>)}
            </select>
          )}
        </Field>
        <Field label="Nom" wide>{(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} required placeholder="Bac acier 0,35 prélaqué vert" />}</Field>
        <Field label="Vente">
          {(id) => (
            <select id={id} value={saleMode} onChange={(e) => setSaleMode(e.target.value as Article['saleMode'])}>
              <option value="cut">À la coupe (feuilles × longueur, stock en ml)</option>
              <option value="unit">À l’unité</option>
            </select>
          )}
        </Field>
        {saleMode === 'unit' ? (
          <Field label="Unité" hint="pièce, kg, boîte, rouleau…">{(id) => <input id={id} value={unit} onChange={(e) => setUnit(e.target.value)} required />}</Field>
        ) : (
          <div className="field"><span className="label-like">Unité</span><span className="static">mètre linéaire (ml)</span></div>
        )}
        <Field label={`Prix de vente par ${u}`}>{(id) => <NumberInput id={id} value={price} onChange={(t) => setPrice(t)} suffix="FCFA" min={0} />}</Field>
        <Field label={`Coût par ${u}`} hint="Recalculé ensuite par la production ou les achats">{(id) => <NumberInput id={id} value={cost} onChange={(t) => setCost(t)} suffix="FCFA" min={0} />}</Field>
        <Field label="Stock d’ouverture">{(id) => <NumberInput id={id} value={opening} onChange={(t) => setOpening(t)} suffix={u} min={0} />}</Field>
        <Field label="Stock minimum (alerte)">{(id) => <NumberInput id={id} value={min} onChange={(t) => setMin(t)} suffix={u} min={0} />}</Field>
        <div className="field">
          <span className="label-like">Origine</span>
          <label className="check"><input type="checkbox" checked={fabricated} onChange={(e) => setFabricated(e.target.checked)} /> Fabriqué à l’usine</label>
        </div>
        <Field label="Couleur d’aperçu">{(id) => <input id={id} type="color" value={swatch} onChange={(e) => setSwatch(e.target.value)} />}</Field>
        <div className="form-actions wide">
          <button type="button" className="btn" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn primary">Créer l’article</button>
        </div>
      </form>
    </Modal>
  );
}

export function ArticlePage() {
  const { id } = useParams();
  const { db, today } = useStore();
  const [modal, setModal] = useState<'edit' | 'count' | 'buy' | null>(null);
  const a = db.articles.find((x) => x.id === id);
  if (!a) return <><PageHead title="Article introuvable" back={{ to: '/articles', label: 'Articles' }} /><Empty>Cet article n’existe pas.</Empty></>;
  const moves = db.stockMoves.filter((m) => m.articleId === a.id).slice(-150).reverse();
  const usage = dailyUsage(db, a.id, today);

  return (
    <>
      <PageHead
        back={{ to: '/articles', label: 'Articles' }}
        title={<><Swatch color={a.swatch} /> {a.name}</>}
        sub={<><span className="mono">{a.ref}</span> · {familyLabel[a.family]} · {a.fabricated ? 'fabriqué à l’usine' : 'acheté pour revente'}</>}
        actions={
          <>
            <button type="button" className="btn" onClick={() => setModal('edit')}>Modifier</button>
            <button type="button" className="btn" onClick={() => setModal('count')}>Inventaire</button>
            <button type="button" className="btn primary" onClick={() => setModal('buy')}>Entrée d’achat</button>
          </>
        }
      />
      <div className="kpis">
        <div className="panel"><Stat label="En stock" value={qty(a.stock)} unit={a.unit} tone={isArticleLow(a) ? 'down' : undefined} detail={a.minStock ? `Minimum ${qty(a.minStock)} ${a.unit}` : 'Pas de minimum'} /></div>
        <div className="panel"><Stat label="Valeur du stock" value={int((Math.max(0, a.stock) * a.cost) / 1000)} unit="k FCFA" detail={`Coût ${fcfa(a.cost)} / ${a.unit}`} /></div>
        <div className="panel"><Stat label="Prix de vente" value={int(a.price)} unit={`F/${a.unit}`} detail={a.price > 0 ? `Marge ${dec(((a.price - a.cost) / a.price) * 100, 1)} %` : ''} /></div>
        <div className="panel"><Stat label="Sorties moyennes" value={usage > 0 ? qty(Math.round(usage * 10) / 10) : '—'} unit={usage > 0 ? `${a.unit}/jour` : undefined} detail={usage > 0 ? `≈ ${Math.floor(a.stock / usage)} jours de stock` : 'Pas de vente sur 30 jours'} /></div>
      </div>
      <Panel title="Mouvements de stock">
        {moves.length ? (
          <div className="scroll">
            <table>
              <thead><tr><th>Date</th><th>Motif</th><th>Référence</th><th className="num">Mouvement</th><th className="num">Stock après</th></tr></thead>
              <tbody>
                {moves.map((m) => (
                  <tr key={m.id}>
                    <td>{frDate(m.date)}</td>
                    <td>{reasonLabel[m.reason]}</td>
                    <td className="mono">{m.ref}</td>
                    <td className={`num ${m.delta < 0 ? 'down' : 'up'}`}>{m.delta > 0 ? '+' : ''}{qty(m.delta)}</td>
                    <td className="num">{qty(m.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Aucun mouvement.</Empty>
        )}
      </Panel>
      {modal === 'edit' && <EditArticleModal article={a} onClose={() => setModal(null)} />}
      {modal === 'count' && <CountModal article={a} onClose={() => setModal(null)} />}
      {modal === 'buy' && <PurchaseModal article={a} onClose={() => setModal(null)} />}
    </>
  );
}

function EditArticleModal({ article, onClose }: { article: Article; onClose: () => void }) {
  const { run } = useStore();
  const [name, setName] = useState(article.name);
  const [price, setPrice] = useState(String(article.price));
  const [min, setMin] = useState(String(article.minStock));
  const [swatch, setSwatch] = useState(article.swatch);
  const [active, setActive] = useState(article.active);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = run((d, c) => cmd.updateArticle(d, c, article.id, { name, price: parseNumber(price), minStock: parseNumber(min) || 0, swatch, active }), 'Article enregistré');
    if (r.ok) onClose();
  };
  return (
    <Modal title={`Modifier ${article.ref}`} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <Field label="Nom">{(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} required />}</Field>
        <Field label={`Prix de vente par ${article.unit}`} hint="Les documents déjà émis gardent leur prix">{(id) => <NumberInput id={id} value={price} onChange={(t) => setPrice(t)} suffix="FCFA" min={0} />}</Field>
        <Field label="Stock minimum (alerte)">{(id) => <NumberInput id={id} value={min} onChange={(t) => setMin(t)} suffix={article.unit} min={0} />}</Field>
        <Field label="Couleur d’aperçu">{(id) => <input id={id} type="color" value={swatch} onChange={(e) => setSwatch(e.target.value)} />}</Field>
        <label className="check"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Article actif (visible en caisse)</label>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn primary">Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
}

function CountModal({ article, onClose }: { article: Article; onClose: () => void }) {
  const { run } = useStore();
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const n = parseNumber(counted);
  const diff = Number.isNaN(n) ? 0 : n - article.stock;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = run((d, c) => cmd.countStock(d, c, article.id, n, note), 'Inventaire enregistré');
    if (r.ok) onClose();
  };
  return (
    <Modal title={`Inventaire : ${article.name}`} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <p className="small muted">Stock théorique : <b>{qty(article.stock)} {article.unit}</b>. Saisissez ce que vous avez compté ; l’écart sera tracé.</p>
        <Field label="Quantité comptée">{(id) => <NumberInput id={id} value={counted} onChange={(t) => setCounted(t)} suffix={article.unit} min={0} />}</Field>
        {counted !== '' && !Number.isNaN(n) && <p className={diff < 0 ? 'down' : 'up'}>Écart : {diff > 0 ? '+' : ''}{qty(Math.round(diff * 1000) / 1000)} {article.unit}</p>}
        <Field label="Commentaire">{(id) => <input id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Inventaire mensuel, casse…" />}</Field>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn primary" disabled={Number.isNaN(n) || n < 0}>Valider l’inventaire</button>
        </div>
      </form>
    </Modal>
  );
}

function PurchaseModal({ article, onClose }: { article: Article; onClose: () => void }) {
  const { run } = useStore();
  const [q, setQ] = useState('');
  const [cost, setCost] = useState(String(Math.round(article.cost)));
  const [supplier, setSupplier] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = run((d, c) => cmd.purchaseArticle(d, c, article.id, parseNumber(q), parseNumber(cost), supplier), 'Entrée en stock enregistrée');
    if (r.ok) onClose();
  };
  return (
    <Modal title={`Entrée d’achat : ${article.name}`} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <Field label="Quantité reçue">{(id) => <NumberInput id={id} value={q} onChange={(t) => setQ(t)} suffix={article.unit} min={0} />}</Field>
        <Field label={`Coût d’achat par ${article.unit}`} hint="Le coût moyen de l’article sera recalculé">{(id) => <NumberInput id={id} value={cost} onChange={(t) => setCost(t)} suffix="FCFA" min={0} />}</Field>
        <Field label="Fournisseur ou référence">{(id) => <input id={id} value={supplier} onChange={(e) => setSupplier(e.target.value)} />}</Field>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn primary" disabled={!(parseNumber(q) > 0)}>Enregistrer l’entrée</button>
        </div>
      </form>
    </Modal>
  );
}
