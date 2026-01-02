# Processus de récupération des variables d'environnement

Ce document décrit comment obtenir, vérifier et distribuer les secrets nécessaires aux différentes applications du monorepo.

## 1. Source de vérité

1. **Coffre partagé** : tous les fichiers `.env` sont stockés dans un coffre chiffré (1Password, Bitwarden, Vault, etc.) nommé `Coach Template Secrets`. L'accès se demande sur le canal `#infra` en mentionnant le Tech Lead.
2. **Dépôt GitHub** : seules les valeurs non sensibles (ex: `VITE_APP_ENV=staging`) peuvent vivre dans des variables GitHub (`Settings > Secrets and variables`). Les clés privées restent dans le coffre.
3. **Pas de partage par e-mail/DM** : utilisez uniquement le coffre ou un partage éphémère type `1password.com/share/...`.

## 2. Structure des fichiers

| Fichier                     | Utilisation principale                         | Format                                                                     |
|-----------------------------|-----------------------------------------------|----------------------------------------------------------------------------|
| `.env` (racine)            | API, Prisma, scripts `seed` et `dev:full`      | Variables Node classiques (`PORT`, `DATABASE_URL`, `JWT_*`, Stripe) |
| `apps/web/.env`            | Front Vite                                    | Clés préfixées `VITE_` visibles côté navigateur                            |
| `.env.local` / `.env.prod` | Variantes locales selon l'environnement       | Même structure que `.env`, jamais commité                                  |

Astuce : créez un `.env.example` (non sensible) si vous avez besoin de documenter les clés côté code. Gardez les vraies valeurs dans le coffre.

## 3. Étapes pour un nouvel arrivant

1. **Demande d'accès** : ouvrez une demande sur `#infra` ou Notion en précisant « accès secrets Coach Template ».
2. **Téléchargement** :
   - Dans le coffre, récupérer `coach-template.dev.env` (copier-coller dans le fichier `.env` à la racine).
   - Récupérer `coach-template.web.env` et le placer dans `apps/web/.env`.
3. **Vérification** :
   - Lancer `pnpm dev:full`. Si Prisma remonte « Missing env var », consultez `apps/api/src/config/env.ts` pour savoir quelle clé manque.
   - Côté front, vérifier dans la console que `import.meta.env.VITE_API_BASE_URL` pointe bien vers votre API.
4. **Rotation** : si vous modifiez une valeur sensible (ex: `JWT_ACCESS_SECRET`), mettez à jour **le coffre + GitHub Secrets** immédiatement puis informez l'équipe.

## 4. Variables minimales

### API (`.env`)

- **Serveur** : `PORT`, `NODE_ENV`, `API_BASE_URL` (utilisé pour générer les URLs des vidéos uploadées), `CORS_ORIGIN`.
- **Base de données** : `DATABASE_URL` (SQLite en dev, PostgreSQL/MySQL en prod).
- **Auth** : `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`.
- **Paiements** : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. Ce sont les seules intégrations actives avec le mode cash manuel.
- **Emails** : `SENDGRID_API_KEY`, `WELCOME_EMAIL_FROM` (les emails transactionnels partent via SendGrid).
- **Notifications** : in-app uniquement, aucune clé Twilio/SMS n'est requise tant que nous restons sur ce mode gratuit.

### Front (`apps/web/.env`)

| Clé                 | Description                                   | Exemple                                     |
|---------------------|-----------------------------------------------|---------------------------------------------|
| `VITE_API_BASE_URL` | URL publique de l'API (staging / production)  | `https://api.moncoach.com`                  |
| `VITE_STRIPE_PK`    | Clé publique Stripe (si paiement côté front)  | `pk_live_...` (optionnel tant que le front ne déclenche pas Stripe) |

Ajoutez les clés front dans un fichier `.env` dédié puis redémarrez `pnpm --filter web dev`.

## 5. Synchronisation avec GitHub

1. **Créez deux environnements** (`Settings > Environments`) : `staging` et `production`.
2. **Ajoutez les secrets nécessaires** :
   - `VITE_API_BASE_URL`, `VITE_STRIPE_PK`, etc. → utilisés dans le build front.
   - `DATABASE_URL`, `JWT_ACCESS_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SENDGRID_API_KEY`, etc. → utilisés lors du build API.
3. **Référencer les secrets** dans `.github/workflows/deploy.yml` (voir [`docs/deploiement.md`](deploiement.md)).

## 6. Bonnes pratiques

- **Synchronisation schéma avant seed** : `pnpm dev:full` lance désormais `pnpm --filter @coach/api exec -- prisma db push` avant le seed. Gardez ce réflexe après chaque pull pour éviter les erreurs « column PromoBar inexistante ».
- **Commit hook** : activez `git update-index --skip-worktree .env` si vous devez garder le fichier mais éviter des commits accidentels.
- **Fichiers chiffrés** : pour partager un bundle complet, utilisez `age` ou `sops` plutôt qu'une archive zip simple.
- **Logs** : ne copiez jamais un token/API key dans une issue GitHub. Remplacez par `***`.
- **Uploads vidéo** : le dossier `apps/api/uploads/` contient les vidéos envoyées par les coachs. Il est ignoré par Git et doit être sauvegardé côté serveur si vous hébergez la feature.
- **Notifications** : SMS/Twilio ont été coupés → seules les notifications in-app et les emails SendGrid sont actifs, ce qui évite tout coût additionnel.

En cas de doute, mentionnez `@infra` avant toute diffusion de secrets.
