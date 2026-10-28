import { describe, expect, it } from "vitest";
import { applyFrenchTypographyToText } from "@/lib/typo-fr";

const NBSP = "\u00A0";

describe("applyFrenchTypographyToText", () => {
  it("inserts a non-breaking space before high punctuation", () => {
    expect(applyFrenchTypographyToText("Quoi? Oui! Non; voici:")).toBe(
      `Quoi${NBSP}? Oui${NBSP}! Non${NBSP}; voici${NBSP}:`,
    );
  });

  it("replaces an existing space instead of adding one", () => {
    expect(applyFrenchTypographyToText("Vraiment ?")).toBe(`Vraiment${NBSP}?`);
  });

  it("converts straight quotes to guillemets with inner spaces", () => {
    expect(applyFrenchTypographyToText('Il dit "bonjour" puis part')).toBe(
      `Il dit «${NBSP}bonjour${NBSP}» puis part`,
    );
  });

  it("normalizes spaces inside existing guillemets", () => {
    expect(applyFrenchTypographyToText("«bonjour »")).toBe(`«${NBSP}bonjour${NBSP}»`);
  });

  it("uses the typographic apostrophe", () => {
    expect(applyFrenchTypographyToText("l'ami d'enfance")).toBe("l\u2019ami d\u2019enfance");
  });

  it("leaves URLs and times untouched", () => {
    expect(applyFrenchTypographyToText("Voir https://exemple.fr/a?b=1 à 12:30")).toBe(
      "Voir https://exemple.fr/a?b=1 à 12:30",
    );
  });

  it("keeps stacked punctuation together", () => {
    expect(applyFrenchTypographyToText("Quoi?!")).toBe(`Quoi${NBSP}?!`);
  });
});
