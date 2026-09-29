# Consignes pour travailler sur YDSstock

## Contexte

- Le porteur du projet n'est pas développeur : les explications vers lui sont en français simple, sans jargon.
- Tout le texte visible dans l'application est en français.
- Le cahier des charges complet vit dans Claude Docs (« YDSstock — Cahier des charges ») ; le README en résume les décisions.

## Règles métier à ne jamais casser

- Montants en FCFA entiers ; arrondi à l'unité sur chaque ligne (`roundFcfa`).
- Longueur de bobine : L (m) = P (kg) ÷ (7,85 × largeur (m) × épaisseur (mm)), via `src/domain/steel.ts`. Aucun calcul de ce type ailleurs.
- Une facture validée n'est jamais modifiée ni supprimée : correction par avoir. Numérotation continue sans trou.
- Le stock négatif est interdit par défaut.
- Une opération (vente, réception, ordre de fabrication) s'enregistre en entier ou pas du tout.

## Façon de travailler

- Le cœur métier (`src/domain/`) reste pur : pas de React, pas d'accès aux données. Toute règle ou tout calcul nouveau y arrive avec ses tests.
- Les écrans lisent la base via `useStore()` et les calculs de `src/data/queries.ts`, et ne la modifient qu'avec `run(commande)` : une commande de `src/data/commands.ts`, exécutée en tout ou rien (`transaction.ts`), avec son entrée au journal.
- Toute nouvelle commande arrive avec un test dans `src/data/commands.test.ts`. Les données de démo (`seed.ts`) sont créées en rejouant les commandes, jamais écrites à la main.
- Le stockage (`persistence.ts`, IndexedDB aujourd'hui) est le seul fichier à changer pour passer à SQLite et à la synchronisation.
- Avant chaque commit : `npm test`, `npm run typecheck` et `npm run build` doivent passer.
- Build en chemins relatifs (`base: './'`) et `HashRouter` : le même build doit marcher sur un site, dans Tauri et dans Capacitor.
