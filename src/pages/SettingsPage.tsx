import { useRef, useState } from 'react';
import * as cmd from '../data/commands';
import { parseBackup } from '../data/persistence';
import { emptyDatabase } from '../data/schema';
import { buildDemoDatabase } from '../data/seed';
import { useStore } from '../data/store';
import { ConfirmButton, Field, NumberInput, PageHead, Panel } from '../ui/components';
import { frDateTime, parseNumber } from '../ui/format';

export function SettingsPage() {
  const { db, run, replaceDatabase, notify, today } = useStore();
  const [co, setCo] = useState(db.company);
  const [vat, setVat] = useState(String(db.company.vatPct));
  const [importError, setImportError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof co) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setCo((c) => ({ ...c, [k]: e.target.value }));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    run((d, c) => cmd.updateCompany(d, c, { ...co, vatPct: parseNumber(vat) || 0 }), 'Paramètres enregistrés');
  };

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(db)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ydsstock-sauvegarde-${today}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Sauvegarde téléchargée');
  };

  const importBackup = async (file: File) => {
    setImportError('');
    try {
      const restored = parseBackup(await file.text());
      replaceDatabase(restored, `Sauvegarde restaurée (${restored.documents.length} documents)`);
    } catch (e) {
      setImportError((e as Error).message);
    }
  };

  return (
    <>
      <PageHead title="Paramètres" sub="Entreprise, documents, sauvegardes et journal" />
      <div className="cols">
        <div className="stack">
          <Panel title="Entreprise (en-tête des documents)">
            <form onSubmit={save} className="form grid2">
              <Field label="Raison sociale" wide>{(id) => <input id={id} value={co.name} onChange={set('name')} required />}</Field>
              <Field label="Adresse" wide>{(id) => <input id={id} value={co.address} onChange={set('address')} />}</Field>
              <Field label="Téléphone">{(id) => <input id={id} value={co.phone} onChange={set('phone')} />}</Field>
              <Field label="E-mail">{(id) => <input id={id} value={co.email} onChange={set('email')} />}</Field>
              <Field label="NIF">{(id) => <input id={id} value={co.taxId} onChange={set('taxId')} />}</Field>
              <Field label="RCCM">{(id) => <input id={id} value={co.rccm} onChange={set('rccm')} />}</Field>
              <Field label="TVA sur les ventes" hint="0 tant que la TVA n’est pas appliquée. Ne change pas les documents déjà émis.">{(id) => <NumberInput id={id} value={vat} onChange={(t) => setVat(t)} suffix="%" min={0} />}</Field>
              <Field label="Pied de page des documents" wide>{(id) => <textarea id={id} rows={2} value={co.invoiceFooter} onChange={set('invoiceFooter')} />}</Field>
              <div className="form-actions wide"><button type="submit" className="btn primary">Enregistrer</button></div>
            </form>
          </Panel>
          <Panel title="Journal des opérations" aside={<span className="label">{db.audit.length} entrées</span>}>
            <p className="small muted">Tout ce qui a été fait dans YDSstock, dans l’ordre. Ce journal ne peut pas être modifié.</p>
            <div className="scroll journal">
              <table>
                <thead><tr><th>Quand</th><th>Opération</th><th>Détail</th></tr></thead>
                <tbody>
                  {db.audit.slice(-200).reverse().map((a, i) => (
                    <tr key={i}><td className="nowrap">{frDateTime(a.at)}</td><td>{a.action}</td><td className="small">{a.detail}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Sauvegarde">
            <p className="small muted">Les données sont enregistrées dans ce navigateur, sur cet appareil. Téléchargez une sauvegarde régulièrement et gardez-la sur une clé USB : c’est elle qui vous protège si l’appareil tombe en panne.</p>
            <div className="btn-row">
              <button type="button" className="btn primary" onClick={exportBackup}>Télécharger une sauvegarde</button>
              <button type="button" className="btn" onClick={() => fileRef.current?.click()}>Restaurer une sauvegarde</button>
            </div>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importBackup(f); e.target.value = ''; }} />
            {importError && <p className="line-err">{importError}</p>}
          </Panel>
          <Panel title="Démarrer pour de vrai">
            <p className="small muted">La base contient les données d’exemple d’Aciéra Tôles. Quand vous êtes prêt, repartez d’une base vide : seules les informations de l’entreprise sont gardées. Faites une sauvegarde avant.</p>
            <div className="btn-row">
              <ConfirmButton confirmLabel="Oui, tout effacer" onConfirm={() => replaceDatabase(emptyDatabase(db.company), 'Base vide créée')}>Repartir d’une base vide</ConfirmButton>
              <ConfirmButton confirmLabel="Oui, recharger la démo" onConfirm={() => replaceDatabase(buildDemoDatabase(), 'Données d’exemple rechargées')}>Recharger la démo</ConfirmButton>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
