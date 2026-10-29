import { describe, expect, it } from "vitest";
import { applyToggle, emptyCounts, REACTION_KINDS, REACTIONS } from "@/lib/reactions";

describe("reactions", () => {
  it("defines the six fixed reactions", () => {
    expect(REACTION_KINDS).toEqual(["love", "moved", "fire", "wow", "think", "clap"]);
    expect(REACTIONS.every((r) => r.label && r.emoji)).toBe(true);
  });

  it("adds then removes a reaction for the visitor", () => {
    const start = { counts: { ...emptyCounts(), love: 2 }, mine: [] };
    const added = applyToggle(start, "love");
    expect(added.counts.love).toBe(3);
    expect(added.mine).toEqual(["love"]);
    const removed = applyToggle(added, "love");
    expect(removed.counts.love).toBe(2);
    expect(removed.mine).toEqual([]);
  });

  it("never goes below zero", () => {
    const state = applyToggle({ counts: emptyCounts(), mine: ["wow"] }, "wow");
    expect(state.counts.wow).toBe(0);
  });
});
