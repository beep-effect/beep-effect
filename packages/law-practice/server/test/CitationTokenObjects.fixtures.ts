/** Shared pinned token-object/capture observations; no test registration.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationTokenEditionBinding } from "@beep/law-practice-server/internal/Citation/TokenEditions";
import { LiteralKit } from "@beep/schema";
import { expect } from "@effect/vitest";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import { CitationTokenSeedHex } from "./CitationTokenSeed.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationTokenObjects");
const Native = S.Struct({ width: S.Literals([1, 2, 4]), bytes: S.Uint8ArrayFromHex });
/** @internal @category testing @since 0.0.0 */
export const CitationTokenCaptureObservation = S.Struct({
  source: Native,
  bindings: S.Struct({ groups: S.Natural, names: S.Record(S.String, S.Natural) }),
  captures: S.Tuple([S.Natural, S.Natural]).pipe(S.NullOr, S.Array),
});
const Recipe = S.Struct({ kind: CitationTokenSeedHex.fields.kind, extra: S.Unknown, offset: S.optionalKey(S.Int) });
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-token-objects/v2"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    producerSha256: S.tag("0e96c350228ac776d863d8300ba7c5c52a41f58670f5aa5273d03fa7a45909d8"),
    constructors: S.Array(
      S.Struct({
        ...CitationTokenCaptureObservation.fields,
        id: S.Natural,
        input: CitationTokenSeedHex,
        offset: S.Int,
        expected: CitationTokenSeedHex,
        groupOrder: S.Array(S.String),
      })
    ).check(S.isBetweenLength(378, 378)),
    errors: S.Array(
      S.Struct({
        ...CitationTokenCaptureObservation.fields,
        recipe: Recipe,
        sourceError: LiteralKit(["TypeError", "IndexError"]),
        reason: LiteralKit(["missing-capture", "invalid-extra"]),
      })
    ).check(S.isBetweenLength(54, 54)),
    extras: S.Array(
      S.Struct({ ...CitationTokenCaptureObservation.fields, recipe: Recipe, expected: CitationTokenSeedHex })
    ).check(S.isBetweenLength(15, 15)),
    editionBindings: S.Array(S.Struct({ ...CitationTokenEditionBinding.fields, hash: S.BigIntFromString })).check(
      S.isBetweenLength(14, 14)
    ),
    merges: S.Array(
      S.Struct({
        id: S.Natural,
        left: CitationTokenSeedHex,
        right: CitationTokenSeedHex,
        outcome: LiteralKit(["left", "none", "error"]),
        truth: S.NullOr(S.Boolean),
      })
    ).check(S.isBetweenLength(216, 216)),
  })
).pipe($I.annoteSchema("Corpus", { description: "Actual source constructor, merge and capture/extra observations." }));
/** @internal @category testing @since 0.0.0 */
export const loadCitationTokenObjectsControls = Effect.fn("TokenTest.loadObjects")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const digest = yield* Digest.Digest;
  const bytes = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/token-objects.json", import.meta.url))
  );
  const citationResult1 = yield* digest.digestHex(Digest.sha256, bytes);
  expect(citationResult1).toBe("220603353c0c1536be49c48d132abdcfa9b6bbd861b6acba08c2ac68640ddbd2");
  return yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
});
