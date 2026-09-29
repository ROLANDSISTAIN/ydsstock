import { useEffect, useMemo, useState } from 'react';
import { createDemoCoilRepository } from '../data/repository';
import type { Coil, CoilConsumption } from '../data/types';
import { formatFcfa } from '../domain/money';
import { STEEL_KG_PER_M2_PER_MM, kgPerMeter, lengthFromWeight } from '../domain/steel';
import { dec, frDate, int, materialLabel, statusLabel } from '../ui/format';

const repo = createDemoCoilRepository();
/** Sous 15 % du poids initial, une bobine entamée est signalée « presque finie ». */
const LOW_STOCK_RATIO = 0.15;

const formatOf = (c: Coil) => ({ widthM: c.widthM, thicknessMm: c.thicknessMm });
const isLow = (c: Coil) => c.remainingKg > 0 && c.remainingKg / c.initialKg < LOW_STOCK_RATIO;

function StatusPill({ coil }: { coil: Coil }) {
  if (isLow(coil)) return <span className="pill warn">Presque finie</span>;
  const tone = coil.status === 'en_cours' ? 'info' : coil.status === 'en_stock' ? 'good' : 'mute';
  return <span className={`pill ${tone}`}>{statusLabel[coil.status]}</span>;
}

export function CoilsPage() {
  const [coils, setCoils] = useState<Coil[]>([]);
  const [selectedId, setSelectedId] = useState('B-2409-017');
  const [uses, setUses] = useState<CoilConsumption[]>([]);

  useEffect(() => {
    repo.list().then(setCoils);
  }, []);
  useEffect(() => {
    repo.consumptions(selectedId).then(setUses);
  }, [selectedId]);

  const coil = useMemo(() => coils.find((c) => c.id === selectedId), [coils, selectedId]);

  return (
    <>
      <div className="head">
        <div>
          <h1>Bobines</h1>
          <p className="sub">Stock de matière première, suivi bobine par bobine</p>
        </div>
      </div>
      <div className="coils">
        <section className="panel">
          <div className="scroll">
            <table>
              <thead>
                <tr><th>N° bobine</th><th>Matière</th><th className="num">Restant</th><th>Statut</th></tr>
              </thead>
              <tbody>
                {coils.map((c) => (
                  <tr
                    key={c.id}
                    className={`click${c.id === selectedId ? ' sel' : ''}`}
                    tabIndex={0}
                    aria-selected={c.id === selectedId}
                    onClick={() => setSelectedId(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedId(c.id);
                      }
                    }}
                  >
                    <td className="mono">{c.id}</td>
                    <td>
                      {materialLabel[c.material]} {dec(c.thicknessMm, 2)} mm
                      <br />
                      <span className="muted small">{c.color}{c.ral ? ` · ${c.ral}` : ''}</span>
                    </td>
                    <td className="num">
                      {int(c.remainingKg)} kg
                      <br />
                      <span className="muted small">≈ {int(lengthFromWeight(c.remainingKg, formatOf(c)))} m</span>
                    </td>
                    <td><StatusPill coil={c} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {coil && <CoilSheet coil={coil} uses={uses} />}
      </div>
    </>
  );
}

function CoilSheet({ coil, uses }: { coil: Coil; uses: CoilConsumption[] }) {
  const format = formatOf(coil);
  const lengthLeft = lengthFromWeight(coil.remainingKg, format);
  const lengthNew = lengthFromWeight(coil.initialKg, format);
  const usedPct = (1 - coil.remainingKg / coil.initialKg) * 100;
  const costPerMeter = coil.pricePerKg * kgPerMeter(format);
  const usedKg = uses.reduce((s, u) => s + u.consumedKg, 0);
  const producedM = uses.reduce((s, u) => s + u.producedM, 0);
  const realYield = usedKg > 0 ? (producedM / lengthFromWeight(usedKg, format)) * 100 : undefined;

  return (
    <section className="panel" aria-label={`Fiche de la bobine ${coil.id}`}>
      <div className="panel-h">
        <div>
          <div className="label">Fiche bobine</div>
          <h2 className="mono coil-id">{coil.id}</h2>
        </div>
        <StatusPill coil={coil} />
      </div>
      <dl className="dl">
        <div><dt>Matière</dt><dd>{materialLabel[coil.material]}{coil.color !== 'Brut' ? ` · ${coil.color}` : ''}{coil.ral ? ` (${coil.ral})` : ''}</dd></div>
        <div><dt>Format</dt><dd>{dec(coil.thicknessMm, 2)} mm × {int(coil.widthM * 1000)} mm</dd></div>
        <div><dt>Fournisseur</dt><dd>{coil.supplier}</dd></div>
        <div><dt>Réception</dt><dd>{frDate(coil.receivedOn)}</dd></div>
        <div><dt>Prix d’achat</dt><dd>{int(coil.pricePerKg)} FCFA/kg · {formatFcfa(coil.pricePerKg * coil.initialKg)}</dd></div>
        <div><dt>Emplacement</dt><dd>{coil.location}</dd></div>
      </dl>

      <div className="gauge">
        <div className="label">Consommation</div>
        <div className="track" role="img" aria-label={`${dec(usedPct, 0)} % consommé`}>
          <span className="used" style={{ width: `${usedPct}%` }} />
          <span className="left" style={{ width: `${100 - usedPct}%` }} />
        </div>
        <div className="legend">
          <span>Utilisé : {int(coil.initialKg - coil.remainingKg)} kg</span>
          <b>Restant : {int(coil.remainingKg)} kg ≈ {int(lengthLeft)} m</b>
        </div>
      </div>

      <div className="formula">
        L = {int(coil.remainingKg)} kg ÷ ({dec(STEEL_KG_PER_M2_PER_MM, 2)} × {dec(coil.widthM, 2)} m × {dec(coil.thicknessMm, 2)} mm) = {dec(lengthLeft, 1)} m · neuve : {dec(lengthNew, 1)} m
      </div>

      <div className="split">
        <div className="stat"><div className="label">Rendement réel</div><div className="v">{realYield ? `${dec(realYield, 1)} %` : '—'}</div><div className="d">Objectif 97 %</div></div>
        <div className="stat"><div className="label">Coût matière</div><div className="v">{int(costPerMeter)}</div><div className="d">FCFA par mètre</div></div>
        <div className="stat"><div className="label">Produit</div><div className="v">{int(producedM)} m</div><div className="d">sur {uses.length} ordre{uses.length > 1 ? 's' : ''}</div></div>
      </div>

      <div className="label">Historique des consommations</div>
      {uses.length ? (
        <div className="scroll">
          <table>
            <thead><tr><th>Date</th><th>Ordre</th><th className="num">Poids</th><th className="num">Produit</th></tr></thead>
            <tbody>
              {uses.map((u) => (
                <tr key={u.orderRef}>
                  <td>{frDate(u.date)}</td>
                  <td className="mono">{u.orderRef}</td>
                  <td className="num">{int(u.consumedKg)} kg</td>
                  <td className="num">{int(u.producedM)} m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">Aucune consommation enregistrée pour cette bobine.</p>
      )}
    </section>
  );
}
