import { loadLocalEnv } from "./load-env";

loadLocalEnv();

export const DEFAULT_LEGAL_NOTICE = `Édition du site
Stanza est une plateforme d'écriture personnelle et artistique, éditée à titre non commercial.

Hébergement
Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.
Base de données hébergée par Neon Inc.

Données personnelles et cookies
Ce site n'utilise aucun outil de suivi publicitaire ou analytique tiers.
Seuls deux cookies strictement fonctionnels peuvent être déposés :
— un cookie de session pour les auteurs connectés ;
— un identifiant anonyme aléatoire (dont seul le condensat SHA-256 est conservé) permettant d'éviter les réactions multiples sur un même texte.

Chaque auteur dispose à tout moment d'une fonction d'export complet de ses textes (formats Markdown et JSON) et de suppression de son compte depuis son espace Compte.`;

export async function runSeed() {
  const { hashPassword } = await import("better-auth/crypto");
  const { eq } = await import("drizzle-orm");
  const { uuidv7 } = await import("@/lib/id");
  const { isValidUsername } = await import("@/lib/slug");
  const { db } = await import("./client");
  const { account, siteSettings, user } = await import("./schema");

  await db
    .insert(siteSettings)
    .values({
      id: 1,
      siteName: "Stanza",
      tagline: "Des textes, rien que des textes.",
      landingText:
        "Un espace calme où quelques auteurs invités rédigent, publient et partagent leurs textes.",
      accessRequestsOpen: true,
      showLatestPostsOnLanding: false,
      readOnlyMode: false,
      legalNotice: DEFAULT_LEGAL_NOTICE,
    })
    .onConflictDoNothing();

  const email = (process.env.SUPERADMIN_EMAIL ?? "admin@stanza.local").trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD ?? "SuperAdminPassword2026!";

  const existingSuperAdmin = await db.query.user.findFirst({
    where: eq(user.role, "superadmin"),
  });

  if (existingSuperAdmin) {
    if (!isValidUsername(existingSuperAdmin.username)) {
      const [fixed] = await db
        .update(user)
        .set({ username: "raphael", updatedAt: new Date() })
        .where(eq(user.id, existingSuperAdmin.id))
        .returning();
      console.log(`Super admin déjà présent (${fixed.email}, @${fixed.username}).`);
      return fixed;
    }
    console.log(`Super admin déjà présent (${existingSuperAdmin.email}, @${existingSuperAdmin.username}).`);
    return existingSuperAdmin;
  }

  const existingByEmail = await db.query.user.findFirst({
    where: eq(user.email, email),
  });

  if (existingByEmail) {
    const [updated] = await db
      .update(user)
      .set({ role: "superadmin", status: "active", banned: false, updatedAt: new Date() })
      .where(eq(user.id, existingByEmail.id))
      .returning();
    console.log(`Compte existant promu super admin (${email}).`);
    return updated;
  }

  const baseUsername = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 24);
  const username = isValidUsername(baseUsername) ? baseUsername : "raphael";
  const userId = uuidv7();
  const hashedPassword = await hashPassword(password);

  const [created] = await db
    .insert(user)
    .values({
      id: userId,
      email,
      emailVerified: true,
      name: "Raphaël",
      username,
      role: "superadmin",
      status: "active",
      bio: "Éditeur et auteur sur Stanza.",
      links: [],
    })
    .returning();

  await db.insert(account).values({
    id: uuidv7(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: hashedPassword,
  });

  console.log(`Super admin créé : ${email} (@${username})`);
  return created;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSeed().catch((err) => {
    console.error("Erreur lors du seed :", err);
    process.exit(1);
  });
}
