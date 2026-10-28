import { describe, expect, it } from "vitest";
import { foldForSearch, isValidUsername, slugify } from "@/lib/slug";

describe("slugify", () => {
  it("removes accents, apostrophes and punctuation", () => {
    expect(slugify("L'Été à Noël : « vraiment » !")).toBe("l-ete-a-noel-vraiment");
  });

  it("falls back for empty titles", () => {
    expect(slugify("  ?! ")).toBe("sans-titre");
  });

  it("is idempotent", () => {
    const slug = slugify("Un titre très long ".repeat(10));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slugify(slug)).toBe(slug);
  });
});

describe("usernames", () => {
  it("rejects reserved and malformed usernames", () => {
    expect(isValidUsername("studio")).toBe(false);
    expect(isValidUsername("Admin")).toBe(false);
    expect(isValidUsername("ab")).toBe(false);
    expect(isValidUsername("jean.dupont")).toBe(false);
    expect(isValidUsername("jean_dupont-2")).toBe(true);
  });
});

describe("foldForSearch", () => {
  it("folds accents and case", () => {
    expect(foldForSearch("Éphémère")).toBe("ephemere");
  });
});
