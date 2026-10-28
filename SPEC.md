# Stanza · Cahier des charges V1

Oct 28, 2026 · @Raphaël Plassart

## 1. Vision et périmètre

Stanza est une plateforme d'écriture minimaliste où quelques auteurs invités rédigent, publient et partagent leurs textes. Le site démarre en bêta fermée : aucune inscription libre, accès uniquement par invitation ou demande validée par le super admin. Projet personnel et artistique, sans objectif commercial.

Principes non négociables :

- **Minimalisme** : chaque écran a une action principale, aucune fonctionnalité sans usage réel.
- **Lecture d'abord** : pages publiques statiques, quasi sans JavaScript, indexées par Google.
- **Zéro perte de données** : autosave, copie locale de secours, corbeille, révisions, sauvegardes quotidiennes.
- **Multi-auteurs natif** : toutes les données sont rattachées à un auteur, rien n'est codé pour un compte unique.
- **Français uniquement** : pas d'i18n en V1, dates en fr-FR, fuseau Europe/Paris.

Hors périmètre V1 : commentaires, comptes lecteurs, emails transactionnels, newsletter, statistiques, domaine personnalisé, monétisation (voir section 16).

## 2. Stack et architecture

Next.js 16 en monolithe sur Vercel, Postgres Neon via Drizzle, Better Auth, Tiptap 3 et Vercel Blob : tout se provisionne depuis le dashboard Vercel, sans service à gérer ailleurs.

| Couche          | Choix                                                                                                  | Raison                                             |
| --------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Framework       | Next.js 16 (dernière stable, 16.4.x au 28/10/2026), App Router, Turbopack, React 19, TypeScript strict | Cache Components, Server Actions, React Compiler   |
| Base de données | Postgres Neon (intégration Vercel) + Drizzle ORM, driver serverless                                    | Persistant, gratuit à ce volume, Postgres maîtrisé |
| Auth            | Better Auth : email + mot de passe, inscription publique désactivée, plugin admin                      | Sessions en base, rôles, bannissement, rate limit  |
| Éditeur         | Tiptap 3 (ProseMirror) + `@tiptap/markdown`                                                            | WYSIWYG headless, raccourcis Markdown, export .md  |
| Rendu public    | `@tiptap/static-renderer` (JSON vers HTML côté serveur)                                                | Zéro éditeur chargé côté lecteur                   |
| Fichiers        | Vercel Blob (images, avatars, sauvegardes)                                                             | Natif Vercel                                       |
| UI              | Tailwind CSS v4, primitives shadcn/ui (Radix) au strict nécessaire, sonner pour les toasts             | Léger, accessible                                  |
| Validation      | Zod sur toutes les entrées                                                                             |                                                    |
| Qualité         | Biome (lint + format), Vitest                                                                          |                                                    |
| Hébergement     | Vercel Hobby, sous-domaine `*.vercel.app`                                                              |                                                    |

**Pourquoi pas SQLite en fichier** : le système de fichiers des fonctions Vercel est éphémère et non partagé, un fichier `.db` serait perdu au déploiement suivant. Les deux options persistantes sont Neon (retenu) et Turso (SQLite hébergé). Si tu préfères rester sur SQLite, Turso + Drizzle (dialecte libSQL) change très peu de code.

**Sauvegardes, trois niveaux :**

1. Restauration à un instant T fournie par Neon (fenêtre courte sur l'offre gratuite).
2. Cron Vercel quotidien `GET /api/cron/backup` (protégé par `CRON_SECRET`) : export de toutes les tables en JSON gzippé vers Vercel Blob (accès privé), rétention 30 jours, statut visible dans l'admin.
3. Exports manuels : dump complet pour le super admin, export Markdown + JSON de ses textes pour chaque auteur.

Restauration via `pnpm db:restore <fichier>`, documentée dans le README. Suppressions douces partout (`deletedAt`), purge uniquement explicite ou après 30 jours.

**Structure du repo :**

```
src/
  app/
    (public)/      landing, profil, texte, lien non listé
    (auth)/        connexion, invitation, réinitialisation, demande d'accès
    studio/        espace auteur
    admin/         super admin
    api/           auth, cron, upload
  db/              schema.ts, client.ts, seed.ts, restore.ts
  lib/             auth, permissions, cache-tags, render, typo-fr, slug
  components/      ui, editor, reader
drizzle/           migrations SQL versionnées
```

Mutations en Server Actions. Routes API uniquement pour l'auth, l'upload (client upload Blob), le cron et les flux RSS.

**Variables d'environnement** : `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` (seed uniquement), `GOOGLE_SITE_VERIFICATION` (optionnel).

## 3. Rôles et permissions

Trois rôles : visiteur (non connecté), auteur, super admin. Le super admin est unique, créé par le seed, et il est aussi un auteur avec son propre profil.

| Action                                          | Visiteur | Auteur | Super admin |
| ----------------------------------------------- | -------- | ------ | ----------- |
| Lire textes publiés et profils actifs           | oui      | oui    | oui         |
| Lire un texte non listé via son lien privé      | oui      | oui    | oui         |
| Réagir à un texte (si l'auteur l'a activé)      | oui      | oui    | oui         |
| Demander un accès                               | oui      | non    | non         |
| Écrire, publier, gérer ses propres textes       | non      | oui    | oui         |
| Gérer son profil, son compte, ses réglages      | non      | oui    | oui         |
| Modérer les réactions de ses textes             | non      | oui    | oui         |
| Dépublier ou masquer le texte d'un autre auteur | non      | non    | oui         |
| Comptes, invitations, demandes d'accès          | non      | non    | oui         |
| Réglages globaux, sauvegardes                   | non      | non    | oui         |

Règles :

- Chaque permission est vérifiée côté serveur, dans chaque Server Action, route et page protégée, via des helpers centraux (`requireUser`, `requireSuperAdmin`, `assertOwner`). L'UI ne sert jamais de barrière.
- Un auteur ne peut jamais lire ni modifier les brouillons, réglages ou données d'un autre auteur, super admin compris pour les brouillons (il peut seulement dépublier).
- **Désactivé** (choix de l'auteur) : profil et textes renvoient 404, l'auteur peut se reconnecter et réactiver.
- **Suspendu** (choix du super admin) : connexion impossible, sessions révoquées, contenu public en 404.
- **Supprimé** : suppression douce, purge définitive après 30 jours, restaurable par le super admin d'ici là.
- Le super admin ne peut pas se suspendre ni se supprimer lui-même.

## 4. Pages et routes

Trois zones : public (statique, indexé), studio (auteur connecté), admin (super admin). URLs en français côté utilisateur.

| Route                         | Accès                   | Contenu                                                                                   |
| ----------------------------- | ----------------------- | ----------------------------------------------------------------------------------------- |
| `/`                           | Public                  | Landing : nom, slogan, liens Se connecter et Demander un accès, derniers textes en option |
| `/connexion`                  | Public                  | Email + mot de passe                                                                      |
| `/demande-acces`              | Public                  | Nom, email, message court (désactivable par le super admin)                               |
| `/invitation/[token]`         | Lien d'invitation       | Création du compte : nom affiché, pseudo, email (pré-rempli si fourni), mot de passe      |
| `/reinitialiser/[token]`      | Lien généré par l'admin | Nouveau mot de passe                                                                      |
| `/[pseudo]`                   | Public                  | Profil + liste des textes                                                                 |
| `/[pseudo]/[slug]`            | Public                  | Texte publié                                                                              |
| `/s/[shareId]`                | Lien privé              | Texte non listé, `noindex`                                                                |
| `/[pseudo]/rss.xml`           | Public                  | Flux RSS de l'auteur                                                                      |
| `/mentions-legales`           | Public                  | Mentions et confidentialité                                                               |
| `/sitemap.xml`, `/robots.txt` | Public                  | Générés                                                                                   |
| `/studio`                     | Auteur                  | Mes textes : onglets Brouillons, Publiés, Non listés, Corbeille                           |
| `/studio/ecrire/[id]`         | Auteur propriétaire     | Éditeur, aperçu, publication, historique                                                  |
| `/studio/profil`              | Auteur                  | Photo, nom, pseudo, bio, liens                                                            |
| `/studio/compte`              | Auteur                  | Email, mot de passe, réglages, sessions, export, désactivation, suppression               |
| `/admin`                      | Super admin             | Vue d'ensemble                                                                            |
| `/admin/comptes`              | Super admin             | Gestion des comptes                                                                       |
| `/admin/textes`               | Super admin             | Modération globale des textes publics                                                     |
| `/admin/invitations`          | Super admin             | Créer, lister, révoquer                                                                   |
| `/admin/demandes`             | Super admin             | Demandes d'accès                                                                          |
| `/admin/reglages`             | Super admin             | Réglages du site                                                                          |
| `/admin/sauvegardes`          | Super admin             | Sauvegardes                                                                               |

**Pseudos** : 3 à 30 caractères, `a-z 0-9 - _`, uniques, insensibles à la casse. Liste de pseudos réservés couvrant tous les segments de premier niveau (`connexion`, `demande-acces`, `invitation`, `reinitialiser`, `studio`, `admin`, `s`, `api`, `mentions-legales`, `rss.xml`, `sitemap.xml`, `robots.txt`, etc.).

**Navigation** : en-tête minimal avec le logotype Stanza ; une fois connecté, un bouton Écrire et un menu avatar (Mon profil, Studio, Compte, Admin si super admin, Déconnexion). Sur une page de texte, l'en-tête s'efface au scroll vers le bas et revient au scroll vers le haut.

Un proxy (`proxy.ts`, ex-middleware) redirige `/studio` et `/admin` vers `/connexion` si aucune session, en complément des vérifications serveur.

## 5. Éditeur

Pas d'éditeur Markdown visible : un éditeur WYSIWYG (Tiptap 3) dont le rendu est identique à la page publique. Ce que l'auteur voit en écrivant est exactement ce qui sera publié. Les raccourcis Markdown fonctionnent en silence (`## `, `> `, `**gras**`, `- `) : rien à apprendre pour un non-dev, un gain de vitesse pour qui connaît.

**Formats autorisés (liste blanche stricte) :**

- Titre du texte : champ dédié au-dessus du corps (H1 unique).
- Intertitres sur 3 niveaux (H2, H3, H4).
- Gras, italique, barré.
- Citation (blockquote).
- Listes à puces et numérotées.
- Lien : ajout, modification, retrait depuis une bulle ; protocoles `http`, `https`, `mailto` uniquement.
- Image : bouton, glisser-déposer ou coller ; texte alternatif demandé à l'insertion, légende optionnelle ; largeur de la colonne.
- Séparateur de section, rendu comme un ornement centré (⁂) pour changer de strophe ou de scène.
- Retour à la ligne simple (Maj+Entrée), indispensable pour la poésie.
- Annuler / rétablir.

Exclus : couleurs, polices, tailles, tableaux, blocs de code, alignements. Le collage depuis Word, Google Docs ou Notes est nettoyé : seuls les formats autorisés survivent.

**Interactions :**

- Bulle flottante sur sélection : gras, italique, barré, lien, H2, H3, citation.
- Menu `/` sur une ligne vide : intertitres, citation, listes, image, séparateur.
- Mobile : barre d'outils fixée au-dessus du clavier (via `visualViewport`), car la bulle est peu pratique au tactile.
- Raccourcis clavier standards (Ctrl/Cmd + B, I, K, Z), aide affichée avec `?`.
- Placeholders : « Titre » et « Commence à écrire… ».
- Mode focus : masque tout sauf le texte, même largeur de colonne que la page publique.
- Compteur de mots et temps de lecture discrets en pied de page.
- Typographie française automatique appliquée au rendu (non destructive) : espaces insécables avant `; : ! ?` et dans les guillemets, apostrophe typographique, guillemets « ». Activée par défaut, désactivable dans le compte.

**Autosave et robustesse :**

- Sauvegarde 1 s après la dernière frappe (debounce), plus un flush au `visibilitychange` et avant navigation.
- Indicateur discret : « Enregistré », « Enregistrement… », « Hors ligne, modifications conservées ».
- Copie locale de secours (localStorage) tant que le serveur n'a pas confirmé ; si elle est plus récente au rechargement, proposition de restauration.
- Verrou optimiste : chaque sauvegarde envoie un numéro de `version` ; si un autre onglet a enregistré entre-temps, bannière « Ce texte a été modifié ailleurs » avec choix recharger ou écraser.
- L'action d'autosave ne déclenche ni `revalidatePath` ni `router.refresh` : aucun rechargement pendant l'écriture.
- Éditeur chargé en import dynamique uniquement sur `/studio/ecrire/[id]`, avec `immediatelyRender: false` (évite les erreurs d'hydratation de Tiptap avec le SSR).

**Stockage** : le JSON ProseMirror est la source de vérité (`jsonb`). Le HTML public est généré côté serveur à la publication depuis ce JSON (liste blanche de nœuds), puis stocké : aucune conversion au moment de la lecture.

## 6. Cycle de vie des textes

Trois statuts plus une corbeille, et une version de travail séparée de la version en ligne : l'autosave ne publie jamais une phrase à moitié écrite.

| Statut    | Visible par         | Profil | Indexé          | URL                          |
| --------- | ------------------- | ------ | --------------- | ---------------------------- |
| Brouillon | L'auteur seul       | non    | non             | aucune                       |
| Non listé | Quiconque a le lien | non    | non (`noindex`) | `/s/[shareId]`               |
| Publié    | Tout le monde       | oui    | oui             | `/[pseudo]/[slug]`           |
| Corbeille | L'auteur seul       | non    | non             | aucune, purge après 30 jours |

**Transitions :**

| Depuis             | Action                    | Vers                | Effet                                                                               |
| ------------------ | ------------------------- | ------------------- | ----------------------------------------------------------------------------------- |
| Brouillon          | Publier                   | Publié ou Non listé | Panneau de publication, `publishedAt` fixé à la première publication                |
| Publié / Non listé | Modifier                  | même statut         | Les changements restent en version de travail, badge « Modifications non publiées » |
| Publié / Non listé | Mettre à jour             | même statut         | La version de travail remplace la version en ligne                                  |
| Publié / Non listé | Annuler les modifications | même statut         | La version de travail revient à la version en ligne                                 |
| Publié / Non listé | Dépublier                 | Brouillon           | L'URL publique renvoie 404                                                          |
| Publié             | Rendre non listé          | Non listé           | Retiré du profil, du sitemap et du RSS                                              |
| Tout statut        | Supprimer                 | Corbeille           | Toast « Texte placé dans la corbeille · Annuler »                                   |
| Corbeille          | Restaurer                 | Brouillon           |                                                                                     |
| Corbeille          | Supprimer définitivement  | (purgé)             | Confirmation explicite                                                              |

**Panneau de publication** (un seul écran, un clic pour confirmer) : slug pré-rempli depuis le titre et modifiable, extrait pré-rempli (160 premiers caractères) et modifiable, image de partage (première image du texte par défaut), choix Public ou Non listé.

**Partage** : bouton Partager sur la page du texte et dans le studio. Web Share API sur mobile, sinon copie du lien avec toast « Lien copié ». Pour un texte non listé, le studio affiche le lien privé et permet de le régénérer (l'ancien cesse de fonctionner).

**Révisions** : un instantané à chaque publication et mise à jour, plus un instantané toutes les 10 minutes d'édition active. 50 instantanés conservés par texte. Panneau Historique dans l'éditeur : aperçu en lecture seule et restauration (qui crée elle-même un instantané).

**Divers** :

- Changer le slug d'un texte publié crée une redirection 301 depuis l'ancienne URL.
- Dupliquer un texte (copie en brouillon).
- Épingler jusqu'à 3 textes en haut du profil.
- Aperçu d'un brouillon dans le rendu public exact, depuis l'éditeur.
- Date affichée : date de première publication ; mention « modifié le » si mise à jour plus de 24 h après.

## 7. Profil public et page de texte

Le profil `/[pseudo]` présente l'auteur puis ses textes publiés en cartes, avec recherche, 4 tris et scroll infini, l'état étant conservé dans l'URL.

**En-tête du profil** : photo, nom affiché, @pseudo, bio (300 caractères, liens cliquables), jusqu'à 3 liens externes, nombre de textes. Puis les textes épinglés, puis la liste.

**Carte de texte** : titre, extrait sur 3 lignes, date, temps de lecture, miniature si le texte contient une image. Toute la carte est cliquable.

**Recherche et tris** :

- Recherche dans le titre et le contenu, insensible à la casse et aux accents (extension Postgres `unaccent`), debounce 250 ms.
- Tris : plus récents (défaut), plus anciens, titre A à Z, titre Z à A.
- État dans l'URL (`?q=…&tri=…`) : lien partageable, bouton retour fonctionnel, aucun rechargement complet (`useTransition` + navigation shallow).
- 20 textes rendus côté serveur, puis chargement des suivants au scroll (IntersectionObserver, pagination par curseur), avec squelettes de même hauteur pour éviter tout saut de mise en page.
- États soignés : profil sans texte, aucun résultat (avec bouton « Effacer la recherche »).

**Page de texte** `/[pseudo]/[slug]` :

- Titre, auteur (photo + nom vers le profil), date, temps de lecture.
- Contenu rendu en serif dans une colonne de lecture.
- Fine barre de progression de lecture en haut.
- Réactions (si activées), bouton Partager.
- Navigation texte précédent / suivant du même auteur, lien « Tous les textes de \[nom\] ».
- Profil ou texte d'un compte désactivé, suspendu ou supprimé : 404.

## 8. Réactions (V1) et commentaires (V2)

Les réactions sont un interrupteur global par auteur, activé par défaut, qui s'applique à tous ses textes. Pas de réglage texte par texte.

**Jeu fixe de 6 réactions**, défini dans le code :

| Clé     | Emoji | Libellé (aria-label) |
| ------- | ----- | -------------------- |
| `love`  | ❤️    | J'aime               |
| `moved` | 🥹    | Ému                  |
| `fire`  | 🔥    | Puissant             |
| `wow`   | 😮    | Surprenant           |
| `think` | 🤔    | Fait réfléchir       |
| `clap`  | 👏    | Bravo                |

**Fonctionnement :**

- Visiteurs anonymes : un clic ajoute, un second clic retire. Au plus une réaction de chaque type par visiteur et par texte.
- Identifiant visiteur : cookie `httpOnly` aléatoire (UUID) ; seul son hash SHA-256 est stocké. Rate limit par hash d'IP (30 réactions par minute).
- UI optimiste (`useOptimistic`), compteurs affichés à côté de chaque emoji, les réactions déjà données sont mises en évidence.
- Le composant de réactions est la seule île client de la page de texte ; ses compteurs sont chargés à part (Suspense), pour que la page reste en cache et ne soit jamais invalidée par une réaction.
- Côté studio : total des réactions par texte ; bouton « Réinitialiser les réactions » d'un texte (modération).
- Désactiver les réactions les masque partout sans supprimer les données.

**Commentaires (V2, hors V1)** : seule la colonne `commentsEnabled` existe dans les réglages auteur, non exposée dans l'UI. Aucune autre implémentation en V1 (voir section 16).

## 9. Profil et compte auteur

Deux écrans : `/studio/profil` pour ce que voient les lecteurs, `/studio/compte` pour tout le reste. Chaque champ s'enregistre individuellement, avec confirmation discrète.

**`/studio/profil`** :

- Photo : upload, recadrage carré côté client, 5 Mo max, servie via `next/image`.
- Nom affiché, pseudo (vérification de disponibilité en direct ; un changement crée une redirection 301 de l'ancien pseudo).
- Bio (300 caractères), jusqu'à 3 liens externes (libellé + URL).
- Aperçu direct du profil public.

**`/studio/compte`** :

- Email : modification avec confirmation par mot de passe (pas d'email de vérification en V1).
- Mot de passe : actuel + nouveau (12 caractères min).
- Préférences : réactions on/off, typographie française auto on/off, thème (auto, clair, sombre).
- Sessions actives : liste (appareil, dernière activité) et « Se déconnecter partout ailleurs ».
- Exporter mes textes : ZIP contenant un `.md` par texte (via `@tiptap/markdown`, avec frontmatter titre, statut, dates) et un `data.json` complet.
- Vider la corbeille.
- **Désactiver mon compte** : profil et textes passent en 404, réactivable en se reconnectant.
- **Supprimer mon compte** : confirmation par saisie du pseudo + mot de passe ; suppression douce, purge après 30 jours, annulable par le super admin.

**Premier login** : une mini checklist masquable dans le studio (ajouter une photo, écrire une bio, publier un premier texte).

## 10. Administration (super admin)

L'admin pilote l'accès au site sans aucun envoi d'email en V1 : chaque invitation ou réinitialisation produit un lien que tu copies et envoies toi-même.

**Bootstrap** : `pnpm db:seed` crée le super admin depuis `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` s'il n'existe pas (idempotent), ainsi que la ligne de réglages par défaut.

| Écran            | Contenu                                                                                                          | Actions                                                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Vue d'ensemble   | Nombre d'auteurs, textes publiés, demandes en attente, dernière sauvegarde (date, statut)                        | Liens rapides                                                                                                           |
| Comptes          | Table : photo, nom, pseudo, email, statut, nb de textes, dernière connexion, création                            | Voir le profil, suspendre / réactiver, générer un lien de réinitialisation, révoquer les sessions, supprimer, restaurer |
| Textes           | Tous les textes publiés et non listés, filtrables par auteur                                                     | Ouvrir, dépublier, masquer                                                                                              |
| Invitations      | Email (optionnel, mémo), note, expiration (7 jours par défaut), statut : en attente, utilisée, expirée, révoquée | Créer (lien copié dans le presse-papiers), recopier le lien, révoquer                                                   |
| Demandes d'accès | Nom, email, message, date, statut                                                                                | Accepter (crée une invitation pré-remplie et copie le lien), refuser, archiver                                          |
| Réglages         | Voir tableau ci-dessous                                                                                          | Enregistrer                                                                                                             |
| Sauvegardes      | Liste : date, taille, statut, erreur éventuelle                                                                  | Lancer maintenant, télécharger, procédure de restauration                                                               |

**Réglages globaux :**

| Réglage                          | Type        | Défaut             |
| -------------------------------- | ----------- | ------------------ |
| Nom du site                      | texte       | Stanza             |
| Slogan                           | texte       | (à définir)        |
| Texte de la landing              | texte court | (à définir)        |
| Demandes d'accès ouvertes        | booléen     | oui                |
| Derniers textes sur la landing   | booléen     | non                |
| Mode lecture seule (maintenance) | booléen     | non                |
| Mentions légales                 | texte       | gabarit pré-rempli |

Invitations et liens de réinitialisation : token aléatoire de 32 octets, stocké hashé, usage unique, expiration (7 jours pour une invitation, 24 h pour une réinitialisation).

## 11. Modèle de données

Une dizaine de tables Drizzle, en plus de celles de Better Auth. Identifiants UUID v7, dates en `timestamptz`, tous les tokens stockés hashés.

| Table                                             | Colonnes clés                                                                                                                                                                                                                                                                                                                                                               | Notes                                                                         |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `user` (Better Auth, étendue)                     | `id`, `email`, `name`, `role` (author, superadmin), `banned`, `username` (unique), `bio`, `image`, `links` jsonb, `status` (active, deactivated, deleted), `deletedAt`, `reactionsEnabled` (true), `commentsEnabled` (false), `frenchTypography` (true), `theme`                                                                                                            | Champs supplémentaires via `additionalFields`                                 |
| `session`, `account`, `verification`, `rateLimit` | Gérées par Better Auth                                                                                                                                                                                                                                                                                                                                                      | Rate limit stocké en base                                                     |
| `post`                                            | `id`, `authorId`, `slug`, `shareId` (nanoid 12, unique), `status` (draft, unlisted, published), `title`, `content` jsonb, `excerpt`, `publishedTitle`, `publishedContent` jsonb, `publishedHtml`, `publishedExcerpt`, `ogImageUrl`, `hasUnpublishedChanges`, `wordCount`, `readingMinutes`, `pinnedAt`, `version` int, `publishedAt`, `createdAt`, `updatedAt`, `deletedAt` | Unique (`authorId`, `slug`). Index (`authorId`, `status`, `publishedAt` desc) |
| `post_revision`                                   | `id`, `postId`, `title`, `content` jsonb, `reason` (publish, auto, restore), `createdAt`                                                                                                                                                                                                                                                                                    | 50 max par texte                                                              |
| `reaction`                                        | `postId`, `kind`, `visitorHash`, `createdAt`                                                                                                                                                                                                                                                                                                                                | Clé primaire (`postId`, `kind`, `visitorHash`)                                |
| `invitation`                                      | `id`, `tokenHash`, `email`, `note`, `createdBy`, `expiresAt`, `usedAt`, `usedBy`, `revokedAt`                                                                                                                                                                                                                                                                               |                                                                               |
| `access_request`                                  | `id`, `name`, `email`, `message`, `status` (pending, approved, rejected, archived), `createdAt`, `handledAt`                                                                                                                                                                                                                                                                |                                                                               |
| `password_reset`                                  | `id`, `userId`, `tokenHash`, `expiresAt`, `usedAt`                                                                                                                                                                                                                                                                                                                          | Liens générés par l'admin                                                     |
| `redirect`                                        | `fromPath` (unique), `toPath`, `createdAt`                                                                                                                                                                                                                                                                                                                                  | Slugs et pseudos modifiés                                                     |
| `media`                                           | `id`, `userId`, `url`, `size`, `createdAt`                                                                                                                                                                                                                                                                                                                                  | Permet de nettoyer les images orphelines                                      |
| `site_settings`                                   | Ligne unique (`id` = 1) : réglages de la section 10, `updatedAt`                                                                                                                                                                                                                                                                                                            | Lue avec cache, tag `settings`                                                |
| `backup`                                          | `id`, `blobPath`, `sizeBytes`, `status`, `error`, `createdAt`                                                                                                                                                                                                                                                                                                               |                                                                               |

La version de travail (`title`, `content`, `excerpt`) et la version en ligne (`published*`) cohabitent dans la même ligne : publier ou mettre à jour copie l'une vers l'autre et régénère `publishedHtml`. Migrations générées par `drizzle-kit`, extension `unaccent` activée dans la première migration.

## 12. SEO et partage

Chaque texte publié est une page statique avec métadonnées complètes, image de partage générée et données structurées ; tout le reste est exclu de l'index.

- `generateMetadata` sur landing, profil et texte : titre « Titre · Auteur · Stanza », description = extrait, URL canonique basée sur `NEXT_PUBLIC_SITE_URL`.
- Image Open Graph dynamique (`next/og`) par texte : titre en serif, nom de l'auteur, fond papier ; l'image du texte est utilisée à la place si elle existe. Idem pour chaque profil.
- JSON-LD : `Article` (headline, author `Person`, datePublished, dateModified, image) sur les textes, `ProfilePage` sur les profils.
- `sitemap.ts` dynamique : landing, profils actifs, textes publiés avec `lastModified`.
- `robots.ts` : interdit `/studio`, `/admin`, `/s/`, `/api`, pages d'auth. `noindex` sur les textes non listés et les pages d'auth.
- Flux RSS par auteur (`/[pseudo]/rss.xml`), lien `<link rel="alternate">` dans le profil.
- HTML sémantique (`article`, `header`, `time datetime`), `lang="fr"`.
- Vérification Google Search Console via `GOOGLE_SITE_VERIFICATION` (meta), soumission du sitemap à faire manuellement.
- Domaine : le sous-domaine `vercel.app` est indexable ; changer de domaine plus tard ne demande que la variable `NEXT_PUBLIC_SITE_URL`.

## 13. Design et UX/UI

Direction « papier et encre » : éditoriale, calme, typographique, sans décor. Références : iA Writer, Bear, le Medium des débuts, la lecture Substack.

**Typographie et mise en page :**

- Serif de lecture pour les textes et titres (Newsreader ou Literata), sans-serif pour l'interface (Inter ou Geist), chargées via `next/font`.
- Corps 20 px desktop, 18 px mobile, interligne 1,7, colonne de 66 caractères max (environ 680 px).
- Espacements généreux sur une échelle de 4 px, bordures fines, rayons modérés, pas d'ombres lourdes ni de dégradés.

**Couleurs** : fond papier légèrement chaud, encre quasi noire, une seule couleur d'accent discrète. Tokens CSS, mode sombre automatique (`prefers-color-scheme`) et bascule manuelle. Contraste AA minimum.

**Mouvement** : transitions 150 à 200 ms, View Transitions entre la carte et le texte si supporté ; tout est désactivé avec `prefers-reduced-motion`.

**Règles d'interaction :**

- Une action principale visible par écran.
- Jamais de modale de confirmation pour une action réversible : toast avec « Annuler ». Confirmation explicite seulement pour l'irréversible (purge, suppression de compte).
- Toasts uniquement pour les actions explicites, jamais pour l'autosave.
- Cibles tactiles de 44 px minimum ; écrire sur téléphone doit être aussi agréable que sur ordinateur.
- Navigation clavier complète, focus visibles, libellés sur tous les contrôles.
- États vides, chargement (squelettes), erreur et 404 dessinés avec le même soin que le reste.

**Écrans clés :**

- **Landing** : logotype, une phrase, Se connecter et Demander un accès, éventuellement les 5 derniers textes publiés. Rien d'autre.
- **Studio** : onglets Brouillons, Publiés, Non listés, Corbeille avec compteurs ; recherche et tri (modifié récemment par défaut) ; ligne = titre, extrait, date, statut, réactions ; actions au survol et menu « … » (ouvrir, aperçu, partager, dupliquer, épingler, dépublier, supprimer). Bouton principal « Nouveau texte » (raccourci N) qui crée le brouillon et ouvre l'éditeur instantanément.
- **Éditeur** : page blanche, titre en grand, barre supérieure réduite (retour, état d'enregistrement, Aperçu, Historique, Publier) qui s'estompe pendant la frappe.
- **Admin** : sobre et dense, tables lisibles, mêmes composants que le studio.

## 14. Performance, cache, sécurité, qualité

Objectif : Lighthouse mobile ≥ 95 sur les quatre catégories pour la landing, un profil et un texte, aucune erreur console ni avertissement d'hydratation.

**Performance et cache :**

- Server Components par défaut. Composants client uniquement pour l'éditeur, les réactions, la recherche du profil, les menus et formulaires interactifs.
- Cache Components activé (`cacheComponents: true`) : les lectures publiques passent par des fonctions `"use cache"` avec `cacheLife` long et `cacheTag` (`post:{id}`, `author:{id}`, `landing`, `settings`, `sitemap`).
- Chaque Server Action qui modifie une donnée publique invalide précisément ses tags (`updateTag` / `revalidateTag`). Une page déjà en cache ne touche jamais la base.
- Studio et admin dynamiques, mais mutations optimistes (`useOptimistic`, `useTransition`) sans `router.refresh` ni `revalidatePath` global.
- Dates formatées côté serveur (fr-FR, Europe/Paris) pour éviter les écarts d'hydratation.
- `next/image` pour toutes les images avec `sizes`, `next/font`, dimensions réservées : CLS nul.
- Éditeur et ses dépendances absents du bundle public.

**Sécurité :**

- Autorisations vérifiées côté serveur partout (section 3) ; le proxy ne sert qu'à rediriger.
- HTML public généré depuis le JSON avec une liste blanche de nœuds et de marques ; liens limités à `http`, `https`, `mailto`, avec `rel="noopener noreferrer"`.
- Uploads : jpeg, png, webp, avif, gif ; 8 Mo max ; type vérifié côté serveur ; noms aléatoires.
- Rate limiting : connexion (Better Auth), demande d'accès (3 par heure et par IP), réactions.
- Formulaire de demande d'accès : honeypot + délai minimal de soumission.
- Cookies `httpOnly`, `secure`, `sameSite=lax`. En-têtes de sécurité dans `next.config.ts` (CSP raisonnable, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors 'none'`).
- Mode lecture seule global : toutes les Server Actions d'écriture refusent, bannière discrète.
- RGPD : uniquement des cookies fonctionnels (session, visiteur anonyme), aucun tracking, donc pas de bandeau ; page mentions légales et confidentialité.

**Qualité du code :**

- TypeScript strict, aucun `any`, Zod sur chaque entrée de Server Action et de route.
- Code minimal et lisible, sans commentaires, sans abstraction prématurée.
- Biome pour le lint et le format, pnpm.
- Vitest sur les parties sensibles : permissions, slugs et pseudos réservés, rendu HTML assaini, typographie française, transitions de statut.
- Migrations Drizzle versionnées, appliquées par `pnpm db:migrate` au build Vercel.
- README court : installation locale, variables d'environnement, seed, déploiement, restauration d'une sauvegarde.

## 15. Features ajoutées à la demande initiale

14 ajouts, tous peu coûteux et intégrés au périmètre V1 ci-dessus. Les « Optionnel » peuvent sauter si la journée ne suffit pas.

| Feature                                               | Valeur                                                       | Priorité  |
| ----------------------------------------------------- | ------------------------------------------------------------ | --------- |
| Statut Non listé (lien privé)                         | Partager un texte à des proches sans le publier ni l'indexer | Must      |
| Version de travail séparée de la version en ligne     | L'autosave ne met jamais en ligne un texte à moitié modifié  | Must      |
| Corbeille 30 jours + suppressions douces partout      | Aucune perte par erreur                                      | Must      |
| Copie locale de secours + verrou optimiste            | Rien perdu en cas de coupure ou de double onglet             | Must      |
| Retour à la ligne simple + séparateur ornemental      | Indispensable pour la poésie et les textes en parties        | Must      |
| Image de partage générée (Open Graph)                 | Aperçus soignés sur WhatsApp, Instagram, iMessage            | Must      |
| Typographie française automatique                     | Espaces insécables et guillemets corrects sans effort        | Must      |
| Historique des révisions                              | Revenir à une version antérieure                             | Optionnel |
| Export Markdown de ses textes                         | L'auteur garde la propriété de son travail                   | Optionnel |
| Mode focus + compteur de mots                         | Confort d'écriture                                           | Optionnel |
| Textes épinglés sur le profil                         | Mettre en avant ses textes préférés                          | Optionnel |
| Redirections après changement de slug ou pseudo       | Aucun lien partagé cassé                                     | Optionnel |
| Flux RSS par auteur                                   | Suivre un auteur sans compte                                 | Optionnel |
| Barre de progression + navigation précédent / suivant | Lecture enchaînée                                            | Optionnel |

## 16. Backlog V2 et critères d'acceptation V1

**Backlog V2 (ne rien implémenter en V1) :**

- Commentaires activables par auteur : commentaires anonymes avec pseudo ou comptes lecteurs invités, file de modération, masquer, bloquer, anti-spam.
- Emails transactionnels (Resend) : invitations, réinitialisation, notification de demande d'accès.
- Abonnement email à un auteur.
- Collections ou recueils, tags.
- Publication programmée.
- Statistiques de lecture sans cookie.
- Domaine personnalisé.
- Import depuis Word / Google Docs.
- Alignement centré (poésie).

**Critères d'acceptation V1 :**

- [ ] Le seed crée le super admin, qui se connecte et a son propre profil d'auteur.
- [ ] Aucune page d'inscription publique ; l'ami crée son compte via un lien d'invitation généré dans l'admin.
- [ ] Une demande d'accès apparaît dans l'admin et s'accepte en un clic (lien d'invitation copié).
- [ ] L'éditeur gère tous les formats de la section 5, y compris collage depuis Google Docs et écriture sur mobile.
- [ ] Autosave sans aucun rechargement ; fermer l'onglet en pleine frappe ne perd rien.
- [ ] Modifier un texte publié ne change rien en ligne avant « Mettre à jour ».
- [ ] Publier, rendre non listé, dépublier, supprimer, restaurer : les pages publiques reflètent le changement immédiatement.
- [ ] Profil : recherche sans accents, 4 tris, scroll infini, état dans l'URL.
- [ ] Réactions activables par auteur, une réaction par type et par visiteur.
- [ ] Un auteur ne peut ni lire ni modifier les données d'un autre (testé).
- [ ] Désactivation, suspension et suppression de compte passent le contenu en 404.
- [ ] Sitemap, robots, métadonnées, Open Graph et JSON-LD valides ; non listés en `noindex`.
- [ ] Sauvegarde quotidienne présente dans Blob ; une restauration testée en local.
- [ ] Lighthouse mobile ≥ 95 et aucune erreur console ni d'hydratation.
