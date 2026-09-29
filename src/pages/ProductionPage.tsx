import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { analyseProduction, isAbnormalLoss } from '../domain/production';
import * as cmd from '../data/commands';
import { coilLengthLeft } from '../data/queries';
import type { ProductionLine, ProductionOrder } from '../data/schema';
import { useStore } from '../data/store';
import { ConfirmButton, Empty, Field, NumberInput, PageHead, Panel, Pill, Stat } from '../ui/components';
import { dec, fcfa, frDate, int, parseNumber, qty } from '../ui/format';
import { coilLabel } from './CoilsPage';

const MACHINES = ['Profileuse 1', 'Profileuse 2'];

function OrderStatus({ o }: { o: ProductionOrder }) {
  if (o.status === 'en_cours') return <Pill tone="info">En cours</Pill>;
  if (o.status === 'annule') return <Pill>Annulé</Pill>;
  return o.result && isAbnormalLoss(o.result.yieldPct) ? <Pill tone="warn">Clôturé · perte anormale</Pill> : <Pill tone="good">Clôturé</Pill>;
}

interface LineDraft {
  key: number;
  articleId: string;
  sheets: string;
  lengthM: string;
}
let k = 1;

function LinesEditor({ lines, setLines }: { lines: LineDraft[]; setLines: (l: LineDraft[]) => void }) {
  const { db } = useStore();
  const cut = db.articles.filter((a) => a.saleMode === 'cut' && a.fabricated && a.active);
  const upd = (key: number, patch: Partial<LineDraft>) => setLines(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  return (
    <div className="prod-lines">
      {lines.map((l) => (
        <div className="prod-line" key={l.key}>
          <select value={l.articleId} onChange={(e) => upd(l.key, { articleId: e.target.value })} aria-label="Tôle produite">
            {cut.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <NumberInput value={l.sheets} onChange={(t) => upd(l.key, { sheets: t })} suffix="feuilles" />
          <NumberInput value={l.lengthM} onChange={(t) => upd(l.key, { lengthM: t })} suffix="m" />
          <button type="button" className="x" aria-label="Retirer la ligne" onClick={() => setLines(lines.filter((x) => x.key !== l.key))}>×</button>
        </div>
      ))}
      <button type="button" className="btn small-btn" onClick={() => setLines([...lines, { key: k++, articleId: cut[0]?.id ?? '', sheets: '', lengthM: '3' }])}>+ Ajouter une ligne</button>
    </div>
  );
}

const toLines = (lines: LineDraft[]): ProductionLine[] => lines.map((l) => ({ articleId: l.articleId, sheets: parseNumber(l.sheets), lengthM: parseNumber(l.lengthM) }));
const plannedMeters = (lines: LineDraft[]) => lines.reduce((s, l) => s + (parseNumber(l.sheets) || 0) * (parseNumber(l.lengthM) || 0), 0);

export function ProductionPage() {
  const { db } = useStore();
  const [params] = useSearchParams();
  const [creating, setCreating] = useState(Boolean(params.get('bobine')));
  const orders = [...db.productionOrders].sort((a, b) => (a.status === 'en_cours' ? -1 : 0) - (b.status === 'en_cours' ? -1 : 0) || b.number.localeCompare(a.number));
  return (
    <>
      <PageHead title="Production" sub="Ordres de fabrication : bobine → tôles, avec pesée, chutes et coût de revient" actions={!creating && <button type="button" className="btn primary" onClick={() => setCreating(true)}>Nouvel ordre</button>} />
      {creating && <NewOrder initialCoil={params.get('bobine') ?? ''} onCancel={() => setCreating(false)} />}
      <Panel>
        {orders.length ? (
          <div className="scroll">
            <table>
              <thead><tr><th>Ordre</th><th>Date</th><th>Bobine</th><th>Machine</th><th className="num">Produit</th><th className="num">Rendement</th><th>État</th></tr></thead>
              <tbody>
                {orders.map((o) => {
                  const coil = db.coils.find((c) => c.id === o.coilId);
                  return (
                    <tr key={o.id}>
                      <td><Link className="mono" to={`/production/${o.id}`}>{o.number}</Link></td>
                      <td>{frDate(o.createdOn)}</td>
                      <td className="mono">{coil?.ref}</td>
                      <td>{o.machine}</td>
                      <td className="num">{o.result ? `${int(o.result.producedM)} m` : '—'}</td>
                      <td className="num">{o.result ? `${dec(o.result.yieldPct, 1)} %` : '—'}</td>
                      <td><OrderStatus o={o} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Aucun ordre de fabrication. Lancez le premier avec « Nouvel ordre ».</Empty>
        )}
      </Panel>
    </>
  );
}

function NewOrder({ initialCoil, onCancel }: { initialCoil: string; onCancel: () => void }) {
  const { db, run } = useStore();
  const navigate = useNavigate();
  const busy = new Set(db.productionOrders.filter((o) => o.status === 'en_cours').map((o) => o.coilId));
  const coils = db.coils.filter((c) => (c.status === 'en_stock' || c.status === 'en_cours') && !busy.has(c.id));
  const cut = db.articles.filter((a) => a.saleMode === 'cut' && a.fabricated && a.active);
  const [coilId, setCoilId] = useState(coils.some((c) => c.id === initialCoil) ? initialCoil : coils[0]?.id ?? '');
  const [machine, setMachine] = useState(MACHINES[0]!);
  const [clientId, setClientId] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([{ key: k++, articleId: cut[0]?.id ?? '', sheets: '', lengthM: '3' }]);
  const coil = db.coils.find((c) => c.id === coilId);
  const planned = plannedMeters(lines);
  const available = coil ? coilLengthLeft(coil) : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = run((d, c) => cmd.createProductionOrder(d, c, { coilId, machine, lines: toLines(lines), clientId: clientId || undefined, note }), (o) => `Ordre ${o.number} lancé`);
    if (r.ok) navigate(`/production/${r.result.id}`);
  };

  if (!coils.length) return <Panel title="Nouvel ordre" className="gap-b"><Empty>Aucune bobine libre. Réceptionnez une bobine ou clôturez l’ordre en cours.</Empty><button type="button" className="btn" onClick={onCancel}>Fermer</button></Panel>;

  return (
    <Panel title="Nouvel ordre de fabrication" className="gap-b">
      <form onSubmit={submit} className="form grid2">
        <Field label="Bobine" hint={coil ? `${int(coil.remainingKg)} kg · ≈ ${int(available)} m disponibles` : ''}>
          {(id) => <select id={id} value={coilId} onChange={(e) => setCoilId(e.target.value)}>{coils.map((c) => <option key={c.id} value={c.id}>{coilLabel(c)}</option>)}</select>}
        </Field>
        <Field label="Machine">{(id) => <select id={id} value={machine} onChange={(e) => setMachine(e.target.value)}>{MACHINES.map((m) => <option key={m}>{m}</option>)}</select>}</Field>
        <div className="field wide">
          <span className="label-like">À produire</span>
          <LinesEditor lines={lines} setLines={setLines} />
          <span className={`hint${planned > available ? ' down' : ''}`}>Prévu : {qty(Math.round(planned * 100) / 100)} m{planned > available ? ' : plus que ce qui reste sur la bobine' : ''}</span>
        </div>
        <Field label="Pour un client (sur-mesure)">
          {(id) => (
            <select id={id} value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Non, pour le stock</option>
              {db.clients.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Note">{(id) => <input id={id} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
        <div className="form-actions wide">
          <button type="button" className="btn" onClick={onCancel}>Annuler</button>
          <button type="submit" className="btn primary">Lancer l’ordre</button>
        </div>
      </form>
    </Panel>
  );
}

export function ProductionOrderPage() {
  const { id } = useParams();
  const { db } = useStore();
  const o = db.productionOrders.find((x) => x.id === id);
  if (!o) return <><PageHead title="Ordre introuvable" back={{ to: '/production', label: 'Production' }} /><Empty>Cet ordre n’existe pas.</Empty></>;
  const coil = db.coils.find((c) => c.id === o.coilId)!;
  const client = o.clientId ? db.clients.find((c) => c.id === o.clientId) : undefined;
  const name = (aid: string) => db.articles.find((a) => a.id === aid)?.name ?? '';

  return (
    <>
      <PageHead
        back={{ to: '/production', label: 'Production' }}
        title={<>Ordre <span className="mono title-num">{o.number}</span></>}
        sub={<>{o.machine} · lancé le {frDate(o.createdOn)} · bobine <Link className="mono" to={`/bobines/${coil.id}`}>{coil.ref}</Link>{client && <> · pour {client.name}</>}</>}
        actions={<OrderStatus o={o} />}
      />
      {o.note && <p className="doc-links">Note : {o.note}</p>}
      {o.status === 'en_cours' ? (
        <CloseOrder order={o} />
      ) : o.result ? (
        <>
          <div className="kpis">
            <div className="panel"><Stat label="Produit" value={dec(o.result.producedM, 1)} unit="m" detail={`${o.lines.reduce((s, l) => s + l.sheets, 0)} feuilles`} /></div>
            <div className="panel"><Stat label="Rendement" value={dec(o.result.yieldPct, 1)} unit="%" tone={isAbnormalLoss(o.result.yieldPct) ? 'down' : undefined} detail={`${dec(o.result.theoreticalM, 1)} m théoriques pour ${int(o.result.consumedKg)} kg`} /></div>
            <div className="panel"><Stat label="Chutes" value={dec(o.result.scrapKg, 1)} unit="kg" detail={`${dec(o.result.scrapM, 1)} m, versées en sous-produits`} /></div>
            <div className="panel"><Stat label="Coût de revient" value={int(o.result.costPerMeter)} unit="F/m" detail={`Total ${fcfa(o.result.totalCost)}`} /></div>
          </div>
          <div className="cols">
            <Panel title="Lignes produites">
              <table>
                <thead><tr><th>Tôle</th><th className="num">Feuilles</th><th className="num">Longueur</th><th className="num">Total</th></tr></thead>
                <tbody>{o.lines.map((l, i) => <tr key={i}><td>{name(l.articleId)}</td><td className="num">{l.sheets}</td><td className="num">{dec(l.lengthM, 2)} m</td><td className="num">{dec(l.sheets * l.lengthM, 1)} m</td></tr>)}</tbody>
              </table>
            </Panel>
            <Panel title="Détail du coût">
              <table>
                <tbody>
                  <tr><td>Matière ({int(o.result.consumedKg)} kg × {int(coil.pricePerKg)})</td><td className="num">{fcfa(o.result.materialCost)}</td></tr>
                  <tr><td>Consommables</td><td className="num">{fcfa(o.consumables)}</td></tr>
                  <tr><td>Machine et main-d’œuvre</td><td className="num">{fcfa(o.machineCost)}</td></tr>
                  <tr><td><b>Pesée</b></td><td className="num">{int(o.weightBeforeKg)} → {int(o.weightAfterKg ?? 0)} kg</td></tr>
                </tbody>
              </table>
            </Panel>
          </div>
        </>
      ) : (
        <Empty>Ordre annulé : aucun mouvement de stock.</Empty>
      )}
    </>
  );
}

function CloseOrder({ order }: { order: ProductionOrder }) {
  const { db, run } = useStore();
  const coil = db.coils.find((c) => c.id === order.coilId)!;
  const scrap = db.articles.find((a) => a.family === 'sous_produits');
  const [after, setAfter] = useState('');
  const [consumables, setConsumables] = useState('0');
  const [machineCost, setMachineCost] = useState('0');
  const [cancelReason, setCancelReason] = useState('');
  const [lines, setLines] = useState<LineDraft[]>(order.lines.map((l) => ({ key: k++, articleId: l.articleId, sheets: String(l.sheets), lengthM: String(l.lengthM).replace('.', ',') })));
  const w = parseNumber(after);

  let preview: { text: string; tone: string } | undefined;
  if (w >= 0 && w < order.weightBeforeKg) {
    try {
      const a = analyseProduction({ format: { widthM: coil.widthM, thicknessMm: coil.thicknessMm }, consumedKg: order.weightBeforeKg - w, lines: toLines(lines) });
      preview = { text: `Rendement ${dec(a.yieldPct, 1)} % · chutes ${dec(a.scrapKg, 1)} kg`, tone: isAbnormalLoss(a.yieldPct) ? 'down' : 'up' };
    } catch (e) {
      preview = { text: (e as Error).message, tone: 'down' };
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run((d, c) => cmd.closeProductionOrder(d, c, order.id, { weightAfterKg: w, consumables: parseNumber(consumables) || 0, machineCost: parseNumber(machineCost) || 0, lines: toLines(lines), scrapArticleId: scrap?.id }), (o) => `Ordre ${o.number} clôturé · ${dec(o.result!.producedM, 1)} m en stock`);
  };

  return (
    <div className="cols">
      <Panel title="Clôturer avec la pesée">
        <form onSubmit={submit} className="form grid2">
          <div className="field"><span className="label-like">Poids avant production</span><span className="static">{int(order.weightBeforeKg)} kg</span></div>
          <Field label="Poids de la bobine après" hint={preview ? <span className={preview.tone}>{preview.text}</span> : 'Pesez la bobine en fin de production'}>{(id) => <NumberInput id={id} value={after} onChange={(t) => setAfter(t)} suffix="kg" min={0} />}</Field>
          <div className="field wide">
            <span className="label-like">Réellement produit</span>
            <LinesEditor lines={lines} setLines={setLines} />
          </div>
          <Field label="Consommables" hint="Film, feuillard, palettes">{(id) => <NumberInput id={id} value={consumables} onChange={(t) => setConsumables(t)} suffix="FCFA" min={0} />}</Field>
          <Field label="Machine et main-d’œuvre">{(id) => <NumberInput id={id} value={machineCost} onChange={(t) => setMachineCost(t)} suffix="FCFA" min={0} />}</Field>
          <div className="form-actions wide">
            <button type="submit" className="btn primary" disabled={!(w >= 0) || after === ''}>Clôturer et entrer en stock</button>
          </div>
        </form>
      </Panel>
      <Panel title="Annuler l’ordre">
        <p className="small muted">Si la production n’a pas eu lieu. Rien n’entre en stock et la bobine redevient libre.</p>
        <div className="form">
          <Field label="Motif">{(id) => <input id={id} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />}</Field>
          <ConfirmButton confirmLabel="Confirmer l’annulation" disabled={!cancelReason.trim()} onConfirm={() => run((d, c) => cmd.cancelProductionOrder(d, c, order.id, cancelReason), 'Ordre annulé')}>Annuler l’ordre</ConfirmButton>
        </div>
      </Panel>
    </div>
  );
}
