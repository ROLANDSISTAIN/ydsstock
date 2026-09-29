interface Props {
  title: string;
  phase: string;
  items: string[];
}

/** Écran pas encore construit : dit ce qui arrive et dans quelle phase. */
export function UpcomingPage({ title, phase, items }: Props) {
  return (
    <>
      <div className="head">
        <div>
          <h1>{title}</h1>
          <p className="sub">Prévu en {phase}. Aperçu visible dans les maquettes du projet.</p>
        </div>
        <span className="pill mute">À venir</span>
      </div>
      <section className="panel upcoming">
        <h2>Ce que cet écran fera</h2>
        <ul>
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
