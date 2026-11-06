/** Sealed source observations shared by named and controlled cleaner replay.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { Sha256HexFromBytes } from "@beep/schema";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";

const $I = $LawPracticeServerId.create("test/CitationCleanerSource");
const CorpusJson = S.fromJsonString(
  S.Struct({
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    artifacts: S.Array(S.Struct({ sha256: S.String, value: S.String })),
    cases: S.Array(
      S.Struct({
        family: S.String,
        steps: S.Json,
        name: S.String,
        input: S.Json,
        runs: S.Array(S.Json),
        events: S.Array(S.Json),
        lookupAfter: S.Array(S.Json),
      })
    ),
  })
).pipe(
  $I.annoteSchema("CorpusJson", {
    description:
      "Hash-authenticated original cleaner observations, including outputs, traces and final registry snapshots.",
  })
);
/** Load the unmodified 1,155-case report from committed source evidence.
 * @internal @category testing @since 0.0.0
 */
export const loadCitationCleanerSource = Effect.fn("CleanerSourceTest.load")(function* () {
  const citationResult1 = yield* FileSystem.FileSystem;
  const raw = yield* citationResult1.readFileString(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/cleaner-pipeline.json", import.meta.url))
  );
  const citationResult2 = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw));
  expect(citationResult2).toBe("814406f61958dfe9d43b32cad562378372e07fa5f32f5e5a5437457e6ea5e3ff");
  const corpus = yield* S.decodeEffect(CorpusJson)(raw);
  expect(corpus.cases).toHaveLength(1155);
  return corpus;
});
