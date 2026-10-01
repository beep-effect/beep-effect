// Measures the marginal type-level cost of LiteralKit's keyed value API (Enum, is, $match) over six string literals.
// Follows the effect/typeperf/suites/schema fixture rules: one behavior, the suite warmup, exported views.
import { LiteralKit } from "@beep/schema/LiteralKit";

LiteralKit;

const kit = LiteralKit(["draft", "review", "approved", "published", "archived", "rejected"]);

export const approved = kit.Enum.approved;
export const isDraft = kit.is.draft;
export const rank = kit.$match(kit.Enum.review, {
  draft: () => 0,
  review: () => 1,
  approved: () => 2,
  published: () => 3,
  archived: () => 4,
  rejected: () => 5,
});

export type Type = typeof kit.Type;
export type Encoded = typeof kit.Encoded;
export type Enum = typeof kit.Enum;
export type Is = typeof kit.is;
