/** Admission reserves a terminal disposition slot under the same journal transaction. */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

const $I = $RepoAiMetricsId.create("internal/disposition-capacity");
const DispositionBound = S.Struct({
  version: S.Literal("payload-retention/v1"),
  maxDispositions: S.Int.check(S.isBetween({ minimum: 1, maximum: 262144 })),
}).pipe(
  $I.annoteSchema("DispositionBound", { description: "Admission projection of the immutable retention policy." })
);
/** Standalone journals without an installed retention policy have no such reservation contract yet. */
export const requireDispositionCapacity = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const exists =
    yield* sql`SELECT name FROM sqlite_master WHERE type='table' AND name='observation_reclamation_config'`.pipe(
      Effect.flatMap(S.decodeUnknownEffect(S.Array(S.Struct({ name: S.String }))))
    );
  if (exists.length === 0) return;
  const rows =
    yield* sql`SELECT substr(payload,1,4097) AS payload FROM observation_reclamation_config WHERE singleton=1`.pipe(
      Effect.flatMap(S.decodeUnknownEffect(S.Tuple([S.Struct({ payload: S.String })])))
    );
  const policy = yield* S.decodeEffect(S.fromJsonString(DispositionBound))(rows[0].payload);
  const [used] =
    yield* sql`SELECT ((SELECT COUNT(*) FROM observation_intake_pages)+(SELECT COUNT(*) FROM observation_page_dispositions)) AS n`.pipe(
      Effect.flatMap(S.decodeUnknownEffect(S.Tuple([S.Struct({ n: S.Natural })])))
    );
  if (used.n >= policy.maxDispositions) return yield* Effect.fail("disposition-capacity");
});
