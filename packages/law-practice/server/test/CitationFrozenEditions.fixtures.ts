/**
 * Shared digest-bound frozen-edition fixtures; not a runtime artifact loader.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { fileURLToPath } from "node:url";
import { CitationEditionRef } from "@beep/law-practice-domain/values";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const SourceType = S.fromJsonString(S.Struct({ pythonType: S.String }));
const Corpus = S.fromJsonString(
  S.Struct({ artifacts: S.Record(Sha256Hex, S.Struct({ kind: S.String, payload: S.String })) })
);
const Expected = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-frozen-editions/v1"),
    manifestSha256: S.tag("b6d3fdd9b6fb4e006c3ede86639c46e7579ff03d39091bdd74ca60919dfe648e"),
    editions: S.Array(
      S.Struct({
        edition: CitationEditionRef,
        family: S.Literals(["case", "law", "journal"]),
        shortName: S.String,
        runtimePayloadSha256: Sha256Hex,
      })
    ),
  })
);
/**
 * Load the reviewed immutable-artifact corpus for private server composition tests.
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const loadCitationFrozenEditionFixtures = Effect.fn("FrozenEditionTest.fixtures")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const raw = yield* fs.readFileString(
    fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/operation-cases.json", import.meta.url))
  );
  expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw))).toBe(
    "ae441000ddc90537864e3fdd4a9dfc4aa81af37a65818b48ce9bf37d95d1eeb1"
  );
  const corpus = yield* S.decodeEffect(Corpus)(raw);
  let reporters = A.empty<{ ref: Sha256Hex; payload: string }>();
  let editions = A.empty<{ ref: Sha256Hex; payload: string }>();
  for (const [ref, row] of R.toEntries(corpus.artifacts)) {
    if (row.kind !== "model-value") continue;
    const tag = yield* S.decodeEffect(SourceType)(row.payload);
    if (tag.pythonType === "eyecite.models.Reporter") reporters = A.append(reporters, { ref, payload: row.payload });
    if (tag.pythonType === "eyecite.models.Edition") editions = A.append(editions, { ref, payload: row.payload });
  }
  const expectedRaw = yield* fs.readFileString(
    fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/frozen-editions.json", import.meta.url))
  );
  expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(expectedRaw))).toBe(
    "0c23ff189ec5c381303af14c79f630a4d7910a11374308f9c7400ca3f79faf0d"
  );
  return { bundle: { reporters, editions }, expected: yield* S.decodeEffect(Expected)(expectedRaw) };
});
