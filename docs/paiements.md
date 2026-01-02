# Paiements & modes d'encaissement

Ce guide résume les deux parcours retenus pour les paiements : Stripe (CB) et l'espèce/cash validé manuellement par le coach. Aucun autre PSP n'est embarqué (pas de PayPal, Google Pay ou Twilio/SMS).

## 1. Stripe Checkout

1. **Configuration** :
   - Ajoute tes clés dans `Espace coach > Paramètres > Clés & intégrations`.
   - Variables requises côté API (`.env`) :
     - `STRIPE_SECRET_KEY`
     - `STRIPE_WEBHOOK_SECRET`
     - `CORS_ORIGIN` (URL du front qui reçoit les redirections)
   - Variables côté front (`apps/web/.env`) :
     - `VITE_API_BASE_URL`
     - (Optionnel) `VITE_STRIPE_PK` si tu affiches la clé publique ailleurs.

2. **Création d'un pack/offre** :
   - Depuis `Espace coach > Produits`, renseigne `URL de checkout (Stripe)` avec l'URL générée par Stripe (Checkout Session ou Payment Link).
   - Cette URL est affichée dans:
     - `Espace adhérent > Offres` (bouton « Accéder au checkout »).
     - `Espace coach > Upsells & checkouts` pour partager le lien.

3. **Parcours membre** :
   - L'adhérent clique sur l'offre → ouverture du checkout Stripe dans un nouvel onglet.
   - Une fois payé, Stripe exécute le webhook (`/api/payments/coach/webhook`) qui marque automatiquement le paiement comme `PAID`.
   - Si un pack est associé, il est activé via `memberPackService.activateFromPayment`.

## 2. Paiement cash (espèces)

1. **Enregistrement** :
   - Dans `Espace coach > Paiements`, clique sur « + Paiement cash ».
   - Sélectionne l'adhérent, le montant (en centimes) et ajoute des notes (ex: référence du pack, détail de la transaction).
   - Le paiement est créé avec le statut `PENDING`.

2. **Validation** :
   - Dans `Paiements récents`, utilise le menu déroulant pour changer le statut (`PENDING` → `PAID` une fois l'espèce reçue).
   - La section « Cash tracking » affiche :
     - `À encaisser` : cash encore en attente.
     - `Cash validé` : paiements cash confirmés.
   - Lors du passage en `PAID`, le pack lié (s'il existe) est activé automatiquement.

3. **Vue adhérent** :
   - Dans `Espace adhérent > Paiements`, la ligne cash affiche « En attente de validation du coach » tant que le statut est `PENDING`.
   - Une fois validé, un bouton « Reçu PDF » apparaît comme pour Stripe.

## 3. Bonnes pratiques

- **Toujours** conserver des notes (`metadata.notes`) pour les paiements cash (nom du pack, date de remise).
- Pour Stripe, pense à activer les emails de confirmation ou à utiliser SendGrid pour compléter la notification.
- Les tests locaux se lancent avec `pnpm dev:full` qui pousse le schéma Prisma et démarre l'API + le front.
- Aucune intégration SMS (Twilio, etc.) n'est requise : reste sur les notifications in-app pour éviter les coûts.

Mets à jour ce document si tu ajoutes un nouveau PSP ou si le flux d'encaissement change.
