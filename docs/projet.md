# Documentation projet

## Vue d'ensemble

- **Monorepo PNPM** : la racine contient `pnpm-workspace.yaml` qui référence `apps/*` et `packages/*`.
- **Applications** :
  - `apps/api` → API Node/Express + Prisma + Zod (TypeScript pur) exposant paiements Stripe/cash et l'upload vidéo des coachs.
  - `apps/web` → Front React 19, Vite 7, Zustand pour l'état local.
- **Packages partagés** : dossier `packages/` prêt pour des libs communes (types, UI, hooks…). Laisser vide si inutile pour l'instant.

## Arborescence utile

```
.
├── apps
│   ├── api
│   │   ├── src
│   │   │   ├── app.ts            # Création de l'instance Express + middlewares
│   │   │   ├── modules           # Modules métier (onboarding, programmes, paiements…)
│   │   │   ├── services          # Services transverses (ex: emails, PDF)
│   │   │   └── config/env.ts     # Lecture + validation des variables d'environnement
│   │   ├── prisma
│   │   │   ├── schema.prisma     # Modèle SQLite / PostgreSQL
│   │   │   └── seed.ts           # Données de démo
│   │   └── tsconfig*.json
│   └── web
│       ├── src
│       │   ├── api               # Clients fetch/axios qui consomment l'API
│       │   ├── pages             # Routage React Router v7
│       │   ├── components        # UI réutilisable
│       │   ├── store             # Stores Zustand
│       │   └── main.tsx          # Entrée Vite/React
│       └── vite.config.ts
├── docs                          # Documentation fonctionnelle & process
├── pnpm-workspace.yaml           # Inclusion des workspaces
└── package.json                  # Scripts racine
```

## API (`apps/api`)

- **Stack** : Express + Prisma + Zod + TSX (ts-node-like) pour lancer les scripts.
- **Sécurité** : Helmet, CORS, JWT Access + Refresh (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`).
- **Modules métier existants** (incomplet) :
  - `modules/site` : contenu du site marketing.
  - `modules/onboarding` : templates d'onboarding avec taches automatiques.
  - `modules/payment` : intégration Stripe (cartes) + validation manuelle des paiements cash (voir [`docs/paiements.md`](paiements.md) pour le flux détaillé).
  - `modules/exercise-videos` : upload et diffusion des vidéos d'exercice (stockées dans `apps/api/uploads/`).
- **Base de données** :
  - `dev` utilise SQLite (`DATABASE_URL=file:./dev.db`).
  - Pour la prod, passer sur PostgreSQL/MySQL en changeant simplement `DATABASE_URL`.
- **Commandes clés** :
  - `pnpm --filter @coach/api dev` → serveur Express avec reload via `tsx watch`.
  - `pnpm --filter @coach/api build` → `tsc -p tsconfig.json`.
  - `pnpm --filter @coach/api seed` → alimente la base avec un coach/membre de test.
  - `pnpm --filter @coach/api prisma:migrate` → migration interactive pour dev.

## Front (`apps/web`)

- **Stack** : React 19 + Vite 7 + TypeScript. React Query (`@tanstack/react-query`) pour le cache serveur.
- **Routing** : `react-router-dom@7` (nouvelle API). Routes principales dans `src/main.tsx`.
- **State** : plusieurs stores Zustand (`src/store/`) pour éviter Redux.
- **Accès API** : les clients dans `src/api/` utilisent `import.meta.env.VITE_API_BASE_URL` ou `http://localhost:4000` par défaut.
- **Commandes clés** :
  - `pnpm --filter web dev -- --open` → Vite + auto-open browser.
  - `pnpm --filter web build` → `tsc -b` puis `vite build` → output `apps/web/dist`.
  - `pnpm --filter web preview` → tester un build localement.
- **Vidéothèque** : les coachs uploadent depuis `CoachArea` (`/coach/videos`) et les membres consomment les vidéos dans `/member/videos`.

## Qualité & tooling

- ESLint 9 partagé, config locale dans `apps/web/eslint.config.js`. Lancer `pnpm -r lint`.
- Pas de tests automatisés pour le moment → prévoir `vitest` côté front + `jest/uvu` côté API selon les futurs besoins.
- Formatage : s'aligner sur Prettier si vous l'ajoutez (actuellement non configuré).

## Points d'attention

1. **Secrets** : `.env` racine est chargé très tôt par `dotenv` → ne jamais le commiter (voir [`docs/variables-env.md`](variables-env.md)).
2. **Builds** : `pnpm -r build` est utilisé par le workflow GitHub. Assurez-vous qu'il reste idempotent (pas de scripts interactifs).
3. **Packages partagés** : si vous ajoutez du code dans `packages/`, pensez à activer les références TypeScript (`tsconfig.json`).
4. **Base SQLite** : lors d'un seed, Prisma crée `apps/api/prisma/dev.db`. Ajoutez-le à `.gitignore`.
5. **Uploads vidéo** : les fichiers envoyés par les coachs vivent dans `apps/api/uploads/videos`. Sur un serveur distant, prévoyez un volume persistant ou externalisez vers un stockage objet.

Mettez à jour ce document dès qu'une nouvelle application ou un package partagé apparaît dans le monorepo.
