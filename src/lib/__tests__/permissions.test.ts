import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));
vi.mock("@/lib/auth", () => ({ auth: {} }));

const { assertOwner, isAccountAllowedToAuthenticate, isAccountPubliclyVisible, PermissionError } =
  await import("@/lib/permissions");

describe("permissions", () => {
  it("lets an author act on their own resources only", () => {
    expect(() => assertOwner("author-a", "author-a")).not.toThrow();
    expect(() => assertOwner("author-a", "author-b")).toThrow(PermissionError);
    expect(() => assertOwner("", "")).toThrow(PermissionError);
  });

  it("hides deactivated, suspended and deleted accounts", () => {
    const active = { banned: false, status: "active" as const, deletedAt: null };
    expect(isAccountPubliclyVisible(active)).toBe(true);
    expect(isAccountPubliclyVisible({ ...active, status: "deactivated" })).toBe(false);
    expect(isAccountPubliclyVisible({ ...active, banned: true })).toBe(false);
    expect(isAccountPubliclyVisible({ ...active, deletedAt: new Date() })).toBe(false);
  });

  it("lets deactivated authors sign back in but not suspended or deleted ones", () => {
    const base = { banned: false, deletedAt: null };
    expect(isAccountAllowedToAuthenticate({ ...base, status: "deactivated" })).toBe(true);
    expect(isAccountAllowedToAuthenticate({ ...base, status: "active", banned: true })).toBe(false);
    expect(isAccountAllowedToAuthenticate({ ...base, status: "deleted" })).toBe(false);
  });
});
