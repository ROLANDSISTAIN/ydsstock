# YDSstock

Gestion commerciale et de production pour les fabricants de tôles : bobines, production, stock, ventes et encaissements. Conçu pour dépasser Sage Saari (Sage 100) sur la mobilité, la production intégrée et la simplicité.

Le prototype est développé comme un site web, puis sera emballé en logiciel PC et Mac (Tauri) et en application Android et iOS (Capacitor), à partir du même code.

## Démarrer

```bash
npm install
npm run dev        # site de développement sur http://localhost:5173
npm test           # tests des calculs métier
npm run typecheck  # vérification des types
npm run build      # build de production dans dist/
```

## Organisation du code

| Dossier | Rôle |
| --- | --- |
| `src/domain/` | Cœur métier pur, sans interface : FCFA, conversions acier, production, ventes, unités. Chaque fichier a ses tests. |
| `src/data/` | Types de données, accès aux données (`CoilRepository`) et données d'exemple d'Aciéra Tôles. |
| `src/pages/` | Écrans de l'application. |
| `src/ui/` | Formats d'affichage et libellés en français. |
| `docs/maquettes/` | Maquettes cliquables validées avant le développement. |

## Décisions de départ

- **Entreprise de référence** : Aciéra Tôles SARL, entreprise fictive (usine + boutique sur le même site).
- **Utilisateur v1** : le comptable, seul. Les rôles viendront ensuite.
- **Données** : serveur installé à l'usine, aucune donnée en ligne. Chaque appareil garde une base locale et fonctionne hors ligne.
- **Monnaie** : franc CFA (FCFA), montants entiers, arrondi à l'unité sur chaque ligne.
- **Comptabilité** : reportée à une phase ultérieure.

## Feuille de route

0. Fondations : maquettes, modèle de données, cœur métier testé, base locale, synchronisation, sauvegardes.
1. Stock et matières : articles, unités, tarifs, bobines, réceptions, inventaires.
2. Production : ordres de fabrication, chutes, rendement, coût de revient.
3. Ventes et clients : devis, factures, caisse, crédit, encaissements, PDF et WhatsApp.
4. Pilotage : tableau de bord, rapports, prévisions, calculateur de toiture.
5. Applications : PC, Android, puis Mac, iPhone et iPad.

**État actuel (v0.1)** : socle technique, cœur métier avec tests, écran Bobines branché sur les calculs.
