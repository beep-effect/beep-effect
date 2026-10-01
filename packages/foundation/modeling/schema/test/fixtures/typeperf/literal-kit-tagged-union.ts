// Measures the marginal type-level cost of LiteralKit.toTaggedUnion with several tagged struct cases.
// Mirrors effect/typeperf/suites/schema/fixtures/tagged-union.ts (the same four cases) under a custom `kind` tag;
// `count` uses S.FiniteFromString because the Effect language service rejects S.NumberFromString here.
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";

LiteralKit;

const schema = LiteralKit(["Created", "Updated", "Counted", "Flagged"]).toTaggedUnion("kind")({
  Created: { id: S.String, name: S.String },
  Updated: { id: S.String, before: S.String, after: S.String },
  Counted: { id: S.String, count: S.FiniteFromString },
  Flagged: { id: S.String, enabled: S.Boolean },
});

export type Type = typeof schema.Type;
export type Encoded = typeof schema.Encoded;
export type Iso = typeof schema.Iso;
export type Cases = typeof schema.cases;
