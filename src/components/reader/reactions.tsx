import { Suspense } from "react";
import { getReactionState, getVisitorHash } from "@/lib/reactions-server";
import { ReactionBar, ReactionBarSkeleton } from "./reaction-bar";

async function LoadedReactions({ postId }: { postId: string }) {
  const state = await getReactionState(postId, await getVisitorHash());
  return <ReactionBar postId={postId} initial={state} />;
}

export function Reactions({ postId }: { postId: string }) {
  return (
    <Suspense fallback={<ReactionBarSkeleton />}>
      <LoadedReactions postId={postId} />
    </Suspense>
  );
}
