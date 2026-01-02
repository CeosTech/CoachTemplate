# Coach Template

Monorepo PNPM pour gérer **un back-end Express/Prisma** (`apps/api`) et **un front-end React 19 + Vite** (`apps/web`). Toute la documentation publiée ici est en français pour être partagée facilement avec les coaches et les contributeurs non techniques.

## Sommaire

1. [Architecture rapide](#architecture-rapide)
2. [Prérequis](#prérequis)
3. [Installation & scripts NPM](#installation--scripts-npm)
4. [Configuration des variables d'environnement](#configuration-des-variables-denvironnement)
5. [Déploiement front & back via GitHub](#déploiement-front--back-via-github)
6. [Aller plus loin](#aller-plus-loin)

## Architecture rapide

- Gestion des packages avec `pnpm` et un seul lockfile (`pnpm-lock.yaml`).
- `apps/api` : API Express, Prisma 5 (SQLite en dev par défaut) avec paiements Stripe + encaissements cash manuels.
- `apps/web` : application React + Vite, Query + Zustand, consomme l'API via `VITE_API_BASE_URL`.
- `packages/` est prêt pour mutualiser des libs mais vide pour l'instant.
- `apps/api/uploads/` sert les vidéos d'exercice que les coachs peuvent uploader pour leurs adhérents (via `/uploads/...`).

Plus de détails dans [`docs/projet.md`](docs/projet.md).

## Prérequis

- Node.js 20+ (LTS recommandé). Utilisez `nvm` ou `asdf` pour verrouiller la version.
- `pnpm` 9 (`corepack enable && corepack prepare pnpm@9.0.0 --activate`).
- Accès aux secrets `.env` (voir [processus documenté ici](docs/variables-env.md)).

## Installation & scripts NPM

```bash
pnpm install           # Installe toutes les dépendances du monorepo
pnpm dev               # Lance les dev servers de chaque app (pnpm -r dev)
pnpm dev:full          # Seed la base + lance API + front en parallèle
pnpm --filter web dev  # Front uniquement (Vite / http://localhost:5173)
pnpm --filter @coach/api dev  # Back uniquement (Express / http://localhost:4000)
pnpm -r build          # Build des deux apps, utilisé par le workflow GitHub
pnpm -r lint           # Lint global
pnpm smoke             # Tests de liaison front/back (API + front doivent être lancés)
```

Les seeds Prisma créent un coach et un membre de démonstration (`coach@demo.com` / `Password123!`).

> ℹ️ `pnpm dev:full` exécute un `prisma db push` avant le seed pour aligner automatiquement le schéma SQLite (utile si vous voyez une erreur `promoBar column does not exist`).

## Configuration des variables d'environnement

Le fichier `.env` à la racine alimente l'API et les scripts Prisma. Le front utilise ses propres clés dans `apps/web/.env` (préfixées par `VITE_`). Un guide complet décrit :

1. Comment récupérer les secrets via un coffre (1Password/Bitwarden/GitHub Secrets).
2. Comment vérifier les clés obligatoires vs optionnelles.
3. Les commandes à relancer après mise à jour.

➡️ Voir [`docs/variables-env.md`](docs/variables-env.md).

## Déploiement front & back via GitHub

Le dépôt inclut désormais un workflow [`deploy.yml`](.github/workflows/deploy.yml) qui :

1. S'exécute sur chaque push dans `main` ou manuellement (`workflow_dispatch`).
2. Installe PNPM, build le front puis l'API **sans Docker**.
3. Publie deux artefacts distincts (`web-dist`, `api-dist`) prêts à être envoyés vers votre hébergeur.

Le fichier [`docs/deploiement.md`](docs/deploiement.md) explique comment brancher ces artefacts à vos plateformes (Pages, S3, VPS…) et comment gérer les secrets GitHub (`VITE_API_BASE_URL`, `DATABASE_URL`, JWT, etc.).

> Stripe est le seul PSP configuré pour la prod. Les paiements cash restent en statut `En attente` tant que le coach ne clique pas sur « Marquer encaissé » dans le dashboard.

## Aller plus loin

- **Documentation complète** : [`docs/projet.md`](docs/projet.md)
- **Variables d'environnement** : [`docs/variables-env.md`](docs/variables-env.md)
- **Flux de paiements (Stripe + cash)** : [`docs/paiements.md`](docs/paiements.md)
- **Procédure de déploiement GitHub** : [`docs/deploiement.md`](docs/deploiement.md)
- **README front** : [`apps/web/README.md`](apps/web/README.md) (toujours valable pour les détails propres au Vite app)

N'hésitez pas à compléter ces documents dès que de nouvelles features ou environnements sont ajoutés.
