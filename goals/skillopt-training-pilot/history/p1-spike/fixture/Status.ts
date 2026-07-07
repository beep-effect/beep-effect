import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

// Training fixture: the smoke task asks the target skill to replace this
// placeholder with a repo-law LiteralKit domain annotated through $I.annote.
export const Status = LiteralKit(["draft", "ready", "blocked", "archived"]).pipe(
  S.annotations({
    title: "Status",
    description: "Four-state training fixture status domain.",
  })
);

export type Status = typeof Status.Type;
