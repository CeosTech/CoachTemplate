# Déploiement front & back via GitHub (sans Docker)

Ce guide explique comment livrer les deux applications du monorepo grâce à GitHub Actions et des artefacts prêts à être poussés sur vos hébergeurs (Pages, S3, VPS…).

## 1. Principe général

1. Chaque push sur `main` (ou lancement manuel) déclenche `.github/workflows/deploy.yml`.
2. Le workflow installe Node 20 + PNPM, installe les dépendances et build les deux apps.
3. Deux artefacts sont générés :
   - `web-dist` → contenu de `apps/web/dist` (bundle Vite).
   - `api-dist` → contenu de `apps/api/dist` (JavaScript compilé par TypeScript).
4. Libre à vous de rapatrier ces artefacts via GitHub Actions (`actions/download-artifact`) ou un job additionnel (SCP, rsync, Pages…).

## 2. Configuration GitHub

1. **Secrets globaux** (`Settings > Secrets and variables > Actions > Repository secrets`) :
   - `NODE_ENV=production`
   - `DATABASE_URL`
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
   - `SENDGRID_API_KEY`, `WELCOME_EMAIL_FROM`
   - `VITE_API_BASE_URL`, `VITE_STRIPE_PK`…
2. **Optionnel** : créez des environnements (`staging`, `production`) pour isoler les valeurs.
3. **Permissions** : laissez les droits par défaut (lecture `contents` + écriture `actions`).

## 3. Workflow livré

```yaml
name: Deploy monorepo
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    env:
      NODE_ENV: production
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
      JWT_ACCESS_SECRET: ${{ secrets.JWT_ACCESS_SECRET }}
      JWT_REFRESH_SECRET: ${{ secrets.JWT_REFRESH_SECRET }}
      STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
      STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_WEBHOOK_SECRET }}
      SENDGRID_API_KEY: ${{ secrets.SENDGRID_API_KEY }}
      WELCOME_EMAIL_FROM: ${{ secrets.WELCOME_EMAIL_FROM }}
      VITE_API_BASE_URL: ${{ secrets.VITE_API_BASE_URL }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter web build
      - run: pnpm --filter @coach/api build
      - uses: actions/upload-artifact@v4
        with:
          name: web-dist
          path: apps/web/dist
      - uses: actions/upload-artifact@v4
        with:
          name: api-dist
          path: apps/api/dist
```

Vous pouvez copier/coller le fichier généré dans `.github/workflows/deploy.yml` si vous devez le modifier.

## 4. Ajouter une étape de mise en production

Selon votre cible :

- **Front statique (Vercel, Pages, S3)** :
  1. Ajoutez un job `deploy_web`.
  2. Téléchargez l'artefact `web-dist`.
  3. Utilisez l'action officielle (`actions/deploy-pages`, `aws s3 sync`, `planetscale/vercel-action`, etc.).
- **API sur VPS ou Platform-as-a-Service** :
  1. Ajoutez un job `deploy_api`.
  2. Téléchargez `api-dist`.
  3. Synchronisez les fichiers via `rsync`/`scp` ou poussez l'artefact vers Fly.io, Railway… (toujours sans Docker si vous déployez du Node nu).
  4. Installez les dépendances de prod (`pnpm install --prod`) côté serveur puis lancez `node dist/server.js`.

## 5. Checklist avant mise en ligne

- [ ] Secrets configurés pour l'environnement ciblé.
- [ ] Base de données alignée avec le schéma (`pnpm --filter @coach/api exec -- prisma db push` pour SQLite de dev, ou `prisma migrate deploy` sur un environnement baselined).
- [ ] `CORS_ORIGIN` et `VITE_API_BASE_URL` cohérents (https partout).
- [ ] Stripe : webhooks mis à jour dans le dashboard (les paiements cash sont validés directement dans le back-office).
- [ ] Notifications : seules les notifications in-app + emails SendGrid sont actives (pas de Twilio/SMS tant qu'on reste en mode gratuit).
- [ ] Tests manuels effectués sur une branche `staging` (via `workflow_dispatch`).

## 6. Dépannage

- **Build front échoue** : s'assurer que `VITE_API_BASE_URL` est défini (même une valeur dummy) car Vite refuse les `undefined`.
- **Prisma réclame une base SQLite** : GitHub Actions ne crée pas de fichier `dev.db` si `DATABASE_URL` pointe vers `file:./dev.db`. Utilisez plutôt `file:./tmp/dev.db` (le workflow peut créer le dossier avant build) ou une URL PostgreSQL.
- **Artefacts vides** : vérifier que `pnpm --filter web build` / `pnpm --filter @coach/api build` génèrent bien `dist/`. Sinon, consultez la sortie du job.
- **Uploads vidéo** : le workflow n'embarque pas `apps/api/uploads`. Prévoyez un stockage persistant (S3, disque monté…) pour les vidéos envoyées dans la vidéothèque membre.

Mettez à jour ce document dès que vous ajoutez une cible de déploiement ou une intégration CI supplémentaire.
