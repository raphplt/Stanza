# Stanza

Plateforme d'écriture minimaliste pour quelques auteurs invités. Next.js 16, Postgres (Neon) via Drizzle, Better Auth, Tiptap 3, Vercel Blob. Cahier des charges : [SPEC.md](SPEC.md), choix d'implémentation : [DECISIONS.md](DECISIONS.md).

## Installation locale

Prérequis : Node 22+, pnpm, Docker.

```bash
pnpm install
cp .env.example .env.local
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

`docker compose` lance Postgres et un proxy HTTP Neon local, pour utiliser le même driver qu'en production. Sans `BLOB_READ_WRITE_TOKEN`, les images et sauvegardes sont écrites dans `.local-blobs/`.

Le seed crée la ligne de réglages et le super admin (`SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD`). Il est idempotent.

## Variables d'environnement

| Variable                   | Rôle                                                             |
| -------------------------- | ---------------------------------------------------------------- |
| `DATABASE_URL`             | Connexion Postgres (Neon en production)                          |
| `DATABASE_DIRECT_URL`      | Connexion directe pour `drizzle-kit` en local (optionnelle)      |
| `BETTER_AUTH_SECRET`       | Secret de session, 32 caractères min. Sert aussi aux invitations |
| `BETTER_AUTH_URL`          | URL publique du site                                             |
| `NEXT_PUBLIC_SITE_URL`     | URL canonique (sitemap, Open Graph, RSS)                         |
| `BLOB_READ_WRITE_TOKEN`    | Vercel Blob (images publiques, sauvegardes privées)              |
| `CRON_SECRET`              | Protège `/api/cron/backup`                                       |
| `SUPERADMIN_EMAIL`         | Email du super admin (seed)                                      |
| `SUPERADMIN_PASSWORD`      | Mot de passe initial du super admin (seed uniquement)            |
| `GOOGLE_SITE_VERIFICATION` | Balise de vérification Search Console (optionnelle)              |

## Commandes

| Commande                    | Effet                                                   |
| --------------------------- | ------------------------------------------------------- |
| `pnpm dev`                  | Serveur de développement                                |
| `pnpm build`                | Build de production                                     |
| `pnpm test`                 | Tests Vitest                                            |
| `pnpm lint` / `format`      | Biome                                                   |
| `pnpm typecheck`            | TypeScript                                              |
| `pnpm db:generate`          | Génère une migration après un changement de `schema.ts` |
| `pnpm db:migrate`           | Applique les migrations                                 |
| `pnpm db:seed`              | Crée réglages et super admin                            |
| `pnpm db:restore <fichier>` | Restaure une sauvegarde `.json.gz`                      |

## Déploiement (Vercel)

1. Importer le dépôt dans Vercel.
2. Ajouter les intégrations Neon et Blob depuis le dashboard : elles fournissent `DATABASE_URL` et `BLOB_READ_WRITE_TOKEN`.
3. Renseigner les autres variables ci-dessus.
4. Déployer : le script `vercel-build` applique les migrations puis construit le site.
5. Lancer une fois `pnpm db:seed` avec les variables de production, puis se connecter sur `/connexion`.
6. Soumettre `/sitemap.xml` dans la Search Console.

Le cron défini dans `vercel.json` appelle `/api/cron/backup` chaque nuit à 3 h (UTC) avec `Authorization: Bearer $CRON_SECRET`.

## Sauvegardes et restauration

Chaque nuit, toute la base est exportée en JSON gzippé dans Vercel Blob (accès privé), conservée 30 jours. Le même passage purge les comptes supprimés et les textes en corbeille depuis plus de 30 jours. L'onglet Admin › Sauvegardes liste les exports, permet d'en lancer un et de les télécharger.

Pour restaurer :

1. Télécharger le fichier depuis Admin › Sauvegardes.
2. Créer une branche Neon (ou une base locale) et pointer `DATABASE_URL` dessus.
3. `pnpm db:migrate` si la base est vide, puis `pnpm db:restore chemin/vers/fichier.json.gz`.
4. Vérifier, puis basculer la production si besoin.

La restauration efface les tables avant de réinsérer les données : ne jamais la lancer sur la production sans avoir vérifié le fichier ailleurs.
