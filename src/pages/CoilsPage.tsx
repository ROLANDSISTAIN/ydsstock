import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { kgPerMeter, lengthFromWeight, STEEL_KG_PER_M2_PER_MM, type CoilMaterial } from '../domain/steel';
import * as cmd from '../data/commands';
import { coilLengthLeft, isCoilLow } from '../data/queries';
import type { Coil } from '../data/schema';
import { useStore } from '../data/store';
import { ConfirmButton, Empty, Field, Meter, Modal, NumberInput, PageHead, Panel, Pill, Stat } from '../ui/components';
import { coilStatusLabel, dec, fcfa, frDate, int, materialLabel, parseNumber } from '../ui/format';

export function CoilStatusPill({ coil }: { coil: Coil }) {
  if (isCoilLow(coil)) return <Pill tone="warn">Presque finie</Pill>;
  const tone = { en_stock: 'good', en_cours: 'info', terminee: 'mute', rebutee: 'crit' }[coil.status];
  return <Pill tone={tone}>{coilStatusLabel[coil.status]}</Pill>;
}

export function coilLabel(c: Coil): string {
  return `${c.ref} · ${materialLabel[c.material]} ${dec(c.thicknessMm, 2)} × ${int(c.widthM * 1000)}${c.color !== 'Brut' ? ` ${c.color.toLowerCase()}` : ''}`;
}

export function CoilsPage() {
  const { db } = useStore();
  const [all, setAll] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const list = db.coils.filter((c) => all || c.status === 'en_stock' || c.status === 'en_cours').sort((a, b) => b.receivedOn.localeCompare(a.receivedOn));
  const available = db.coils.filter((c) => c.status === 'en_stock' || c.status === 'en_cours');
  const kg = available.reduce((s, c) => s + c.remainingKg, 0);
  const value = available.reduce((s, c) => s + c.remainingKg * c.pricePerKg, 0);

  return (
    <>
      <PageHead title="Bobines" sub={`${available.length} bobines disponibles · ${int(kg)} kg · ${fcfa(value)} de matière`} actions={<button type="button" className="btn primary" onClick={() => setReceiving(true)}>Réceptionner une bobine</button>} />
      <div className="toolbar"><label className="check"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Afficher aussi les bobines terminées</label></div>
      <Panel>
        {list.length ? (
          <div className="scroll">
            <table>
              <thead><tr><th>N° bobine</th><th>Matière</th><th>Restant</th><th>Reçue le</th><th>Statut</th></tr></thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <td><Link className="mono" to={`/bobines/${c.id}`}>{c.ref}</Link><br /><span className="muted small">{c.location}</span></td>
                    <td>{materialLabel[c.material]} {dec(c.thicknessMm, 2)} × {int(c.widthM * 1000)} mm<br /><span className="muted small">{c.color}{c.ral ? ` · ${c.ral}` : ''}</span></td>
                    <td className="meter-cell">
                      <Meter pct={(c.remainingKg / c.initialKg) * 100} tone={isCoilLow(c) ? 'low' : ''} />
                      <span className="small">{int(c.remainingKg)} kg · ≈ {int(coilLengthLeft(c))} m</span>
                    </td>
                    <td>{frDate(c.receivedOn)}<br /><span className="muted small">{c.supplier}</span></td>
                    <td><CoilStatusPill coil={c} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Aucune bobine disponible. Cliquez sur « Réceptionner une bobine ».</Empty>
        )}
      </Panel>
      {receiving && <ReceiveModal onClose={() => setReceiving(false)} />}
    </>
  );
}

function ReceiveModal({ onClose }: { onClose: () => void }) {
  const { run } = useStore();
  const navigate = useNavigate();
  const [f, setF] = useState({ ref: '', material: 'galvanise' as CoilMaterial, thickness: '0,35', width: '1,22', color: '', ral: '', supplier: '', weighed: '', invoiced: '', price: '', location: '' });
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const w = parseNumber(f.weighed), inv = parseNumber(f.invoiced), th = parseNumber(f.thickness), wd = parseNumber(f.width);
  let preview = '';
  try {
    if (w > 0 && th > 0 && wd > 0 && th < 3 && wd < 3) preview = `≈ ${int(lengthFromWeight(w, { widthM: wd, thicknessMm: th }))} m de tôle`;
  } catch { /* aperçu seulement */ }
  const gap = w > 0 && inv > 0 ? w - inv : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = run(
      (d, c) => cmd.receiveCoil(d, c, { ref: f.ref, material: f.material, thicknessMm: th, widthM: wd, color: f.color, ral: f.ral, supplier: f.supplier, weighedKg: w, invoicedKg: inv || 0, pricePerKg: parseNumber(f.price), location: f.location }),
      (coil) => `Bobine ${coil.ref} réceptionnée`,
    );
    if (r.ok) navigate(`/bobines/${r.result.id}`);
  };
  return (
    <Modal title="Réceptionner une bobine" onClose={onClose} wide>
      <form onSubmit={submit} className="form grid2">
        <Field label="N° de bobine" hint="Celui de l’étiquette fournisseur">{(id) => <input id={id} value={f.ref} onChange={(e) => set('ref')(e.target.value)} required placeholder="B-2410-003" />}</Field>
        <Field label="Fournisseur">{(id) => <input id={id} value={f.supplier} onChange={(e) => set('supplier')(e.target.value)} required />}</Field>
        <Field label="Matière">
          {(id) => (
            <select id={id} value={f.material} onChange={(e) => set('material')(e.target.value)}>
              {(Object.keys(materialLabel) as CoilMaterial[]).map((m) => <option key={m} value={m}>{materialLabel[m]}</option>)}
            </select>
          )}
        </Field>
        <Field label="Couleur" hint="Laisser vide pour brut">{(id) => <input id={id} value={f.color} onChange={(e) => set('color')(e.target.value)} placeholder="Bleu" />}</Field>
        <Field label="Épaisseur">{(id) => <NumberInput id={id} value={f.thickness} onChange={set('thickness')} suffix="mm" />}</Field>
        <Field label="Largeur">{(id) => <NumberInput id={id} value={f.width} onChange={set('width')} suffix="m" />}</Field>
        <Field label="Poids pesé à la réception" hint={preview}>{(id) => <NumberInput id={id} value={f.weighed} onChange={set('weighed')} suffix="kg" />}</Field>
        <Field label="Poids facturé" hint={gap ? <span className={gap < 0 ? 'down' : 'up'}>Écart : {gap > 0 ? '+' : ''}{int(gap)} kg ({dec((gap / inv) * 100, 1)} %)</span> : 'Pour contrôler le fournisseur'}>{(id) => <NumberInput id={id} value={f.invoiced} onChange={set('invoiced')} suffix="kg" />}</Field>
        <Field label="Prix d’achat">{(id) => <NumberInput id={id} value={f.price} onChange={set('price')} suffix="FCFA/kg" />}</Field>
        <Field label="Code RAL (facultatif)">{(id) => <input id={id} value={f.ral} onChange={(e) => set('ral')(e.target.value)} placeholder="RAL 5010" />}</Field>
        <Field label="Emplacement" wide>{(id) => <input id={id} value={f.location} onChange={(e) => set('location')(e.target.value)} placeholder="Allée A · rack 3" />}</Field>
        <div className="form-actions wide">
          <button type="button" className="btn" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn primary">Enregistrer la réception</button>
        </div>
      </form>
    </Modal>
  );
}

export function CoilPage() {
  const { id } = useParams();
  const { db, run } = useStore();
  const [scrapping, setScrapping] = useState(false);
  const [reason, setReason] = useState('');
  const c = db.coils.find((x) => x.id === id);
  if (!c) return <><PageHead title="Bobine introuvable" back={{ to: '/bobines', label: 'Bobines' }} /><Empty>Cette bobine n’existe pas.</Empty></>;
  const format = { widthM: c.widthM, thicknessMm: c.thicknessMm };
  const left = coilLengthLeft(c);
  const fresh = lengthFromWeight(c.initialKg, format);
  const orders = db.productionOrders.filter((o) => o.coilId === c.id).sort((a, b) => b.createdOn.localeCompare(a.createdOn));
  const closed = orders.filter((o) => o.result);
  const consumed = closed.reduce((s, o) => s + o.result!.consumedKg, 0);
  const produced = closed.reduce((s, o) => s + o.result!.producedM, 0);
  const yieldPct = consumed > 0 ? (produced / lengthFromWeight(consumed, format)) * 100 : undefined;
  const open = orders.find((o) => o.status === 'en_cours');
  const gap = c.initialKg - c.invoicedKg;
  const usable = c.status === 'en_stock' || c.status === 'en_cours';

  return (
    <>
      <PageHead
        back={{ to: '/bobines', label: 'Bobines' }}
        title={<span className="mono title-num">{c.ref}</span>}
        sub={`${materialLabel[c.material]} ${dec(c.thicknessMm, 2)} mm × ${int(c.widthM * 1000)} mm${c.color !== 'Brut' ? ` · ${c.color}` : ''}${c.ral ? ` (${c.ral})` : ''}`}
        actions={
          <>
            <CoilStatusPill coil={c} />
            {open ? <Link className="btn primary" to={`/production/${open.id}`}>Ordre en cours : {open.number}</Link> : usable && <Link className="btn primary" to={`/production?bobine=${c.id}`}>Lancer une production</Link>}
          </>
        }
      />
      <div className="kpis">
        <div className="panel"><Stat label="Restant" value={int(c.remainingKg)} unit="kg" detail={`≈ ${int(left)} m sur ${int(fresh)} m`} /></div>
        <div className="panel"><Stat label="Rendement réel" value={yieldPct ? dec(yieldPct, 1) : '—'} unit={yieldPct ? '%' : undefined} detail={`${int(produced)} m produits sur ${closed.length} ordre${closed.length > 1 ? 's' : ''}`} /></div>
        <div className="panel"><Stat label="Coût matière" value={int(c.pricePerKg * kgPerMeter(format))} unit="F/m" detail={`${int(c.pricePerKg)} FCFA/kg`} /></div>
        <div className="panel"><Stat label="Écart de pesée" value={gap ? `${gap > 0 ? '+' : ''}${int(gap)}` : '0'} unit="kg" tone={gap < 0 ? 'down' : undefined} detail={`Facturé ${int(c.invoicedKg)} kg, pesé ${int(c.initialKg)} kg`} /></div>
      </div>
      <div className="cols">
        <div className="stack">
          <Panel title="Consommation">
            <div className="gauge">
              <div className="track"><span className="used" style={{ width: `${(1 - c.remainingKg / c.initialKg) * 100}%` }} /><span className="left" style={{ width: `${(c.remainingKg / c.initialKg) * 100}%` }} /></div>
              <div className="legend"><span>Utilisé : {int(c.initialKg - c.remainingKg)} kg</span><b>Restant : {int(c.remainingKg)} kg</b></div>
            </div>
            <div className="formula">L = {int(c.remainingKg)} kg ÷ ({dec(STEEL_KG_PER_M2_PER_MM, 2)} × {dec(c.widthM, 2)} m × {dec(c.thicknessMm, 2)} mm) = {dec(left, 1)} m</div>
          </Panel>
          <Panel title="Ordres de fabrication">
            {orders.length ? (
              <div className="scroll">
                <table>
                  <thead><tr><th>Ordre</th><th>Date</th><th className="num">Consommé</th><th className="num">Produit</th><th className="num">Rendement</th></tr></thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td><Link className="mono" to={`/production/${o.id}`}>{o.number}</Link></td>
                        <td>{frDate(o.createdOn)}</td>
                        <td className="num">{o.result ? `${int(o.result.consumedKg)} kg` : '—'}</td>
                        <td className="num">{o.result ? `${int(o.result.producedM)} m` : <Pill tone={o.status === 'annule' ? 'mute' : 'info'}>{o.status === 'annule' ? 'Annulé' : 'En cours'}</Pill>}</td>
                        <td className="num">{o.result ? `${dec(o.result.yieldPct, 1)} %` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>Pas encore utilisée.</Empty>
            )}
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Fiche">
            <dl className="dl">
              <div><dt>Fournisseur</dt><dd>{c.supplier}</dd></div>
              <div><dt>Réception</dt><dd>{frDate(c.receivedOn)}</dd></div>
              <div><dt>Valeur à l’achat</dt><dd>{fcfa(c.pricePerKg * c.initialKg)}</dd></div>
              <div><dt>Valeur restante</dt><dd>{fcfa(c.pricePerKg * c.remainingKg)}</dd></div>
              <div><dt>Emplacement</dt><dd>{c.location || '—'}</dd></div>
            </dl>
          </Panel>
          {usable && !open && (
            <Panel title="Bobine inutilisable ?">
              {scrapping ? (
                <div className="form">
                  <Field label="Motif">{(id) => <input id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Rouille, bobine abîmée au transport…" />}</Field>
                  <div className="form-actions">
                    <button type="button" className="btn" onClick={() => setScrapping(false)}>Annuler</button>
                    <ConfirmButton className="btn" confirmLabel="Confirmer la mise au rebut" disabled={!reason.trim()} onConfirm={() => run((d, x) => cmd.scrapCoil(d, x, c.id, reason), 'Bobine mise au rebut')}>Mettre au rebut</ConfirmButton>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn" onClick={() => setScrapping(true)}>Mettre au rebut</button>
              )}
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
