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

## Ce que fait YDSstock aujourd'hui (v0.2)

| Module | Fonctions |
| --- | --- |
| Tableau de bord | Ventes, marge et encaissements du jour, créances et retards, ventes des 14 derniers jours, résultat du mois, alertes, bobines, meilleures ventes |
| Caisse | Vente à la coupe (feuilles × longueur) et à l'unité, prix négociables, remise pro automatique, paiement comptant, acompte ou crédit avec contrôle du plafond, devis |
| Documents | Devis, factures, avoirs ; numérotation continue par année ; transformation devis → facture ; avoir avec remise en stock et remboursement ; impression A4 avec montant en lettres ; envoi WhatsApp |
| Clients | Fiches, remise, plafond de crédit, relevé de compte, factures à encaisser, règlements répartis sur les plus anciennes factures |
| Articles | Catalogue par famille, stock et minimum, coût moyen pondéré, marge, inventaire avec écart tracé, entrées d'achat, historique des mouvements |
| Bobines | Réception avec pesée et écart fournisseur, poids et mètres restants, rendement réel, coût matière au mètre, mise au rebut |
| Production | Ordres de fabrication, pesée avant/après, chutes versées en sous-produits, rendement, alerte perte anormale, coût de revient entré dans le stock |
| Dépenses | Charges par catégorie, pour le résultat du mois |
| Paramètres | En-tête des documents, TVA, sauvegarde et restauration, base vide ou démo, journal de toutes les opérations |

Les données sont enregistrées dans le navigateur de l'appareil (IndexedDB) : elles restent après fermeture. Une sauvegarde téléchargeable protège contre la perte de l'appareil.

## Organisation du code

| Dossier | Rôle |
| --- | --- |
| `src/domain/` | Règles métier pures et testées : FCFA, acier, production, ventes, stock, numérotation, comptes clients, montant en lettres. |
| `src/data/` | Schéma de la base, commandes (seule façon de modifier la base), lectures, exécution tout ou rien, enregistrement, données de démo. |
| `src/pages/` | Écrans. |
| `src/ui/` | Éléments d'interface et formats français. |
| `docs/maquettes/` | Maquettes validées avant le développement. |

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

**État actuel (v0.2)** : phases 1 à 4 utilisables dans le navigateur, sur un seul appareil. Restent : serveur de l'usine et synchronisation, applications PC et mobiles, comptabilité.
