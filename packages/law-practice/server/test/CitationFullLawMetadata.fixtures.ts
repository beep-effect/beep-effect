import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEditionRef } from "@beep/law-practice-domain/values";
import {
  CitationFrozenEditionFailure,
  CitationFrozenEditions,
  makeCitationFrozenEditions,
} from "@beep/law-practice-server/internal/Citation/FrozenEditions";
import {
  CitationFullLawMetadataInput,
  makeCitationFullLawMetadata,
} from "@beep/law-practice-server/internal/Citation/LawMetadata";
import { Sha256HexFromBytes } from "@beep/schema";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import { loadCitationFrozenEditionFixtures } from "./CitationFrozenEditions.fixtures.ts";
import { loadCitationLawMetadataFixtures } from "./CitationLawMetadata.fixtures.ts";
import {
  assertCitationWorkerCompositionReleased,
  makeCitationMetadataTestContext,
  setupCitationRegexRuntime,
} from "./CitationRegexWorker.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const $I = $LawPracticeServerId.create("test/CitationFullLawMetadata");
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-full-law-metadata/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    currentYear: S.tag(2026),
    producerSha256: S.tag("4f30a3e06b0c513671628b115a0b0342ee89dc39840bccae351e79975a743d27"),
    lawCorpusSha256: S.tag("098ed3007ff63ca34b63310f822b037fea3ee5fb3c1874351bbeb67c373b6dea"),
    cases: S.Array(
      S.Struct({
        lawCase: S.Natural,
        control: S.Natural,
        exact: CitationFullLawMetadataInput.fields.exact,
        variation: CitationFullLawMetadataInput.fields.variation,
        prior: CitationFullLawMetadataInput.fields.prior,
        guess: S.NullOr(CitationEditionRef),
        checks: S.Array(CitationEditionRef),
      })
    ).check(S.isBetweenLength(768, 768)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Actual full-law method observations with source helper state authenticated separately.",
  })
);
const load = Effect.fn("FullLawMetadataTest.load")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/full-law-metadata.json", import.meta.url))
  );
  const hash = yield* S.decodeEffect(Sha256HexFromBytes)(bytes);
  expect(hash).toBe("e899dae1c175c26a70fc15baa916596b7f63ed5967ef79a028a62083f64d9784");
  return yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
});
const install = Effect.fn("FullLawMetadataTest.install")(function* (
  kind: CitationNativeRuntimeKind,
  candidateLimit?: number,
  failLookup = false
) {
  const setup = yield* setupCitationRegexRuntime(kind);
  const law = yield* loadCitationLawMetadataFixtures();
  const { bundle } = yield* loadCitationFrozenEditionFixtures();
  const owner = yield* makeCitationFrozenEditions(bundle);
  const reads = A.empty<CitationEditionRef>();
  const observedOwner = CitationFrozenEditions.of({
    ...owner,
    source: Effect.fn("FullLawMetadataTest.source")(function* (ref: CitationEditionRef) {
      reads.push(ref);
      if (failLookup === true) return yield* CitationFrozenEditionFailure.make({ reason: "missing-edition" });
      return yield* owner.source(ref);
    }),
  });
  const limits = { ...setup.limits, candidates: candidateLimit ?? setup.limits.candidates };
  const { operation, context: base } = yield* makeCitationMetadataTestContext(setup.context, limits);
  const context = Context.add(base, CitationFrozenEditions, observedOwner);
  const metadata = yield* makeCitationFullLawMetadata(limits, setup.runtime, law.configuration).pipe(
    Effect.provideContext(context),
    DateTime.withCurrentZoneOffset(0)
  );
  return { ...setup, metadata, law, reads, operation };
});
/** Compare original full method output and ordered payload reads through both actual runtimes. */
export const replayCitationFullLawMetadata = Effect.fn("FullLawMetadataTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const corpus = yield* load();
  const setup = yield* install(kind);
  const rows = full
    ? corpus.cases
    : A.filter(
        corpus.cases,
        (row) =>
          A.getUnsafe(setup.law.cases, row.lawCase).smoke &&
          (row.control === ((row.lawCase - 3) / 4) % 6 || (row.lawCase === 3 && row.control === 5))
      );
  let calls = 0;
  for (const row of rows) {
    const law = A.getUnsafe(setup.law.cases, row.lawCase);
    setup.reads.length = 0;
    const actual = yield* setup.metadata.apply({
      ...law.request,
      exact: row.exact,
      variation: row.variation,
      prior: row.prior,
    });
    const patch = yield* Effect.fromOption(actual.patch);
    expect(patch).toEqual(law.patch);
    expect(actual.editionGuess).toBe(row.guess);
    expect(setup.reads).toEqual(patch.year !== null && patch.year <= 2026 ? row.checks : []);
    calls += law.calls.length;
  }
  expect(rows).toHaveLength(full ? 768 : 11);
  yield* assertCitationWorkerCompositionReleased(setup.operation, setup.admission, setup.observed.snapshot, calls);
});
/** Refuse candidates before workers and publish no helper patch after a late owner failure. */
export const assertCitationFullLawMetadataFailure = Effect.fn("FullLawMetadataTest.failure")(function* () {
  const corpus = yield* load();
  const choice = yield* Effect.fromOption(A.findFirst(corpus.cases, (row) => row.lawCase === 11 && row.control === 2));
  const bounded = yield* install("bun", 1);
  const law = A.getUnsafe(bounded.law.cases, 11);
  const raw = { ...law.request, exact: choice.exact, variation: choice.variation, prior: choice.prior };
  const refusal = yield* bounded.metadata.apply(raw).pipe(Effect.flip);
  expect(refusal).toMatchObject({ limit: "candidates" });
  const none = yield* bounded.observed.snapshot;
  expect(none).toEqual({ spawned: 0, confirmed: 0 });
  const late = yield* install("bun", undefined, true);
  const failed = yield* late.metadata.apply(raw).pipe(Effect.flip);
  expect(failed).toMatchObject({ reason: "missing-edition" });
  yield* assertCitationWorkerCompositionReleased(late.operation, late.admission, late.observed.snapshot, 1);
});
