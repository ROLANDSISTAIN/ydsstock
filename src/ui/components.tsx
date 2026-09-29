/** Petits éléments d'interface partagés. */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { parseNumber } from './format';

export function PageHead({ title, sub, actions, back }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <div className="head">
      <div className="head-text">
        {back && (
          <Link className="back" to={back.to}>
            ← {back.label}
          </Link>
        )}
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {actions && <div className="head-actions">{actions}</div>}
    </div>
  );
}

export function Pill({ tone = 'mute', children }: { tone?: string; children: ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function Panel({ title, aside, children, className = '', id }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`panel ${className}`}>
      {(title || aside) && (
        <div className="panel-h">
          {title && <h2>{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, unit, detail, tone }: { label: string; value: ReactNode; unit?: string; detail?: ReactNode; tone?: string }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className={`v${tone ? ` ${tone}` : ''}`}>
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {detail && <div className="d">{detail}</div>}
    </div>
  );
}

/** Champ de formulaire avec étiquette et aide. */
export function Field({ label, hint, children, wide }: { label: string; hint?: ReactNode; children: (id: string) => ReactNode; wide?: boolean }) {
  const id = useId();
  return (
    <div className={`field${wide ? ' wide' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

/**
 * Saisie numérique tolérante (virgule ou point, espaces).
 * Garde le texte tapé tel quel et renvoie le nombre lu (NaN si vide ou illisible).
 */
export function NumberInput({ id, value, onChange, placeholder, suffix, autoFocus, min }: { id?: string; value: string; onChange: (text: string, n: number) => void; placeholder?: string; suffix?: string; autoFocus?: boolean; min?: number }) {
  const n = parseNumber(value);
  const invalid = value !== '' && (Number.isNaN(n) || (min !== undefined && n < min));
  return (
    <div className={`num-input${invalid ? ' invalid' : ''}`}>
      <input id={id} inputMode="decimal" value={value} placeholder={placeholder} autoFocus={autoFocus} aria-invalid={invalid} onChange={(e) => onChange(e.target.value, parseNumber(e.target.value))} />
      {suffix && <span>{suffix}</span>}
    </div>
  );
}

/** Fenêtre modale simple ; Échap ou clic hors de la fenêtre la ferment. */
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const first = ref.current?.querySelector<HTMLElement>('input, select, textarea, button:not(.x)');
    first?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-h">
          <h2>{title}</h2>
          <button type="button" className="x" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Bouton à double confirmation, pour les actions qu'on ne peut pas défaire. */
export function ConfirmButton({ children, confirmLabel, onConfirm, className = 'btn', disabled }: { children: ReactNode; confirmLabel: string; onConfirm: () => void; className?: string; disabled?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={`${className}${armed ? ' danger' : ''}`}
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}

export function Swatch({ color }: { color: string }) {
  return <span className="swatch" style={{ background: color }} aria-hidden="true" />;
}

/** Barre de progression horizontale (poids restant d'une bobine, crédit utilisé…). */
export function Meter({ pct, tone }: { pct: number; tone?: string }) {
  return (
    <div className="bar" role="img" aria-label={`${Math.round(pct)} %`}>
      <i className={tone ?? ''} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}
