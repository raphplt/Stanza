import type { ReactionKind } from "@/db/schema";

export const REACTIONS: { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: "love", emoji: "❤️", label: "J'aime" },
  { kind: "moved", emoji: "🥹", label: "Ému" },
  { kind: "fire", emoji: "🔥", label: "Puissant" },
  { kind: "wow", emoji: "😮", label: "Surprenant" },
  { kind: "think", emoji: "🤔", label: "Fait réfléchir" },
  { kind: "clap", emoji: "👏", label: "Bravo" },
];

export const REACTION_KINDS = REACTIONS.map((r) => r.kind) as [ReactionKind, ...ReactionKind[]];

export const VISITOR_COOKIE = "stanza_visitor";

export type ReactionState = { counts: Record<ReactionKind, number>; mine: ReactionKind[] };

export function emptyCounts(): Record<ReactionKind, number> {
  return Object.fromEntries(REACTION_KINDS.map((k) => [k, 0])) as Record<ReactionKind, number>;
}

export function applyToggle(state: ReactionState, kind: ReactionKind): ReactionState {
  const has = state.mine.includes(kind);
  return {
    counts: { ...state.counts, [kind]: Math.max(0, state.counts[kind] + (has ? -1 : 1)) },
    mine: has ? state.mine.filter((k) => k !== kind) : [...state.mine, kind],
  };
}
