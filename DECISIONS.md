# Décisions d'architecture et d'implémentation

Ce fichier consigne les choix simples retenus lorsque `SPEC.md` laissait une marge d'interprétation.

1. **Identifiants UUID v7 sans dépendance externe** : génération via un helper interne utilisant `crypto.getRandomValues` conforme à la RFC 9562 (horodatage 48 bits + aléatoire).
2. **Développement local avec `@neondatabase/serverless`** : en développement local (`db.localtest.me` ou `localhost`), `neonConfig.fetchEndpoint` cible le proxy HTTP Neon local (`http://localhost:4444/sql`) tandis que `drizzle-kit` utilise `DATABASE_DIRECT_URL` (ou `DATABASE_URL` en production).
3. **Stockage local de repli pour Vercel Blob** : si `BLOB_READ_WRITE_TOKEN` est vide en développement local, les uploads d'images et les sauvegardes écrivent dans `.local-blobs/` et les images sont servies via `/api/upload/local/[...path]`, afin que tous les flux (éditeur, avatar, sauvegarde/restauration) fonctionnent hors-ligne et en test sans compte Vercel. En production avec `BLOB_READ_WRITE_TOKEN`, `@vercel/blob` est utilisé directement.
4. **Compression ZIP sans dépendance lourde** : utilisation de `fflate` (`zipSync` / `gzipSync` / `gunzipSync`) pour l'export ZIP des textes d'un auteur et des sauvegardes.
