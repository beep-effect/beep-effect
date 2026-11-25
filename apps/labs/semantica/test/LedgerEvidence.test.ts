// @vitest-environment node

import { Confidence, ReportedConfidence } from "@beep/epistemics/Confidence";
import { ExtractorConfidence } from "@beep/epistemics/EvidencePosition.schema";
import { ActivityPin } from "@beep/jsonc/ActivityStart";
import * as Pglite from "@beep/pglite";
import { it } from "@beep/test-runner";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import * as BunServices from "@effect/platform-bun/BunServices";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import { canonicalJson } from "@/corpus/Canonical";
import { LedgerLive, LedgerLiveOptions } from "@/layers/LedgerLive";
import { sha256TextSync } from "@/schema/Digest";
import { EvidenceBatch, EvidenceClaim, ExtractOutcome, makeBatchId } from "@/schema/Evidence";
import { ChunkId, DocumentId, RunId } from "@/schema/Ids";
import {
  LedgerBatchPayload,
  LedgerClaimPayload,
  LedgerEvidenceV1Outcome,
  LegacyConfidenceImport,
  readStoredBatch,
  readStoredClaim,
  StoredBatch,
  StoredClaim,
  StoredEvidenceRow,
} from "@/schema/LedgerEvidence";
import { EventBody, makeProvenanceEventId, ProvenanceEvent } from "@/schema/Provenance";
import { Ledger } from "@/services/Ledger";

const runId = RunId.make(Str.repeat(64)("e"));
const documentId = DocumentId.make(Str.repeat(64)("1"));
const ingestedBody = EventBody.cases.Ingested.make({ document: documentId, kind: "Ingested" });
const ingested = ProvenanceEvent.make({
  body: ingestedBody,
  id: Result.getOrThrow(makeProvenanceEventId({ body: ingestedBody, prev: O.none() })),
  prev: O.none(),
});

const RawRow = S.Struct({ table: S.String, id: S.String, digest: S.String, payload: S.String });
type RawRow = typeof RawRow.Type;
const RawRowsJson = S.fromJsonString(S.Array(RawRow), { space: 2 });
const FixtureJson = S.Unknown.pipe(S.Array, S.fromJsonString);
const V1OutcomesJson = LedgerEvidenceV1Outcome.pipe(S.Array, S.fromJsonString);

const rowOf = (payloadValue: unknown) => {
  const payload = canonicalJson(payloadValue);
  return StoredEvidenceRow.make({ digest: sha256TextSync(payload), payload });
};

const notAssessed = ExtractorConfidence.cases.Absent.make({ reason: "not-assessed" });
const reported = (value: number) =>
  ExtractorConfidence.cases.Present.make({
    value: ReportedConfidence.make({
      value: Confidence.make(value),
      method: "hosted-langextract",
      producer: ActivityPin.cases.Model.makeOption({
        model: "stub-extractor-20260826",
        version: "stub-extractor-20260826",
      }),
    }),
  });

const withClaims = (
  outcome: ExtractOutcome,
  claimAt: (claim: EvidenceClaim, index: number) => EvidenceClaim
): ExtractOutcome =>
  outcome.outcome === "Extracted"
    ? ExtractOutcome.cases.Extracted.make({
        outcome: "Extracted",
        batch: EvidenceBatch.make({
          ...outcome.batch,
          claims: A.map(outcome.batch.claims, claimAt),
        }),
      })
    : outcome;

const withConfidence = (outcome: ExtractOutcome, confidenceAt: (index: number) => ExtractorConfidence) =>
  withClaims(outcome, (claim, index) => EvidenceClaim.make({ ...claim, confidence: confidenceAt(index) }));

const uncachedWithConfidence = (outcome: ExtractOutcome, confidenceAt: (index: number) => ExtractorConfidence) =>
  withClaims(outcome, (claim, index) =>
    EvidenceClaim.make({ ...claim, cacheKey: O.none(), confidence: confidenceAt(index) })
  );

const claimsOf = (outcome: ExtractOutcome): ReadonlyArray<EvidenceClaim> =>
  outcome.outcome === "Extracted" ? outcome.batch.claims : [];

const batchIdOf = (outcome: ExtractOutcome): string =>
  outcome.outcome === "Extracted" ? outcome.batch.id : rowOf(degradedV1).digest;

const loadFixture = Effect.fn("LedgerEvidenceTest.loadFixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const fixture = yield* fs.realPath("test/fixtures/ledger-evidence-v1.json");
  const text = yield* fs.readFileString(fixture);
  const json = yield* S.decodeEffect(FixtureJson)(text);
  const decoded = yield* S.decodeEffect(V1OutcomesJson)(text);
  const projected = yield* Effect.forEach(json, (value) => readStoredBatch(rowOf(value)), { concurrency: 1 });
  return { json, decoded, projected: A.map(projected, (stored) => stored.outcome) };
});

const degradedV1 = {
  outcome: "Degraded",
  document: documentId,
  lane: "pattern",
  kind: "extraction-failed",
  detail: "Wink extraction failed on the synthetic fixture.",
};

const v1Rows = (json: ReadonlyArray<unknown>, decoded: ReadonlyArray<typeof LedgerEvidenceV1Outcome.Type>) => {
  const batchRows = A.flatMap([0, 1], (index) => {
    const outcome = A.getUnsafe(decoded, index);
    const row = rowOf(A.getUnsafe(json, index));
    return outcome.outcome === "Extracted"
      ? [{ table: "batches", id: outcome.batch.id, digest: row.digest, payload: row.payload }]
      : [];
  });
  const claimRows = A.flatMap([0, 1], (index) => {
    const outcome = A.getUnsafe(decoded, index);
    const raw = A.getUnsafe(json, index) as { readonly batch: { readonly claims: ReadonlyArray<unknown> } };
    return outcome.outcome === "Extracted"
      ? A.map(outcome.batch.claims, (claim, claimIndex) => {
          const row = rowOf(A.getUnsafe(raw.batch.claims, claimIndex));
          return { table: "claims", id: claim.id, digest: row.digest, payload: row.payload };
        })
      : [];
  });
  const degradedRow = rowOf(degradedV1);
  return A.appendAll(A.append(batchRows, { table: "batches", id: degradedRow.digest, ...degradedRow }), claimRows);
};

const createTables = Effect.fn("LedgerEvidenceTest.createTables")(function* () {
  const ledger = yield* Ledger;
  yield* ledger.read(runId);
});

const seedRows = Effect.fn("LedgerEvidenceTest.seedRows")(function* (rows: ReadonlyArray<RawRow>) {
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();
  yield* Effect.forEach(
    rows,
    (row) =>
      Str.Equivalence(row.table, "batches")
        ? sql`INSERT INTO batches (id, document, lane, digest, payload)
            VALUES (${row.id}, ${documentId}, ${"hosted"}, ${row.digest}, ${row.payload})`
        : sql`INSERT INTO claims (id, batch, document, lane, digest, payload)
            VALUES (${row.id}, ${"v1"}, ${documentId}, ${"hosted"}, ${row.digest}, ${row.payload})`,
    { concurrency: 1, discard: true }
  );
});

const rawRows = Effect.fn("LedgerEvidenceTest.rawRows")(function* () {
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();
  const batches = yield* sql<{
    id: string;
    digest: string;
    payload: string;
  }>`SELECT id, digest, payload FROM batches ORDER BY id`;
  const claims = yield* sql<{
    id: string;
    digest: string;
    payload: string;
  }>`SELECT id, digest, payload FROM claims ORDER BY id`;
  return A.appendAll(
    A.map(batches, (row) => ({ table: "batches", ...row })),
    A.map(claims, (row) => ({ table: "claims", ...row }))
  );
});

describe("semantica ledger evidence formats", () => {
  it.layer(BunServices.layer, { timeout: "60 seconds", excludeTestServices: true })((it) => {
    it.effect("reads v1 rows after verifying raw digests, appends v2, replays and refuses conflicts", (context) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const ledgerRoot = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-ledger-evidence-" });
        const dataDir = path.join(ledgerRoot, runId, "replay");
        const ledgerLayer = LedgerLive(LedgerLiveOptions.make({ ledgerRoot, mode: "replay", runId }));
        const pgliteLayer = Pglite.makeLayer({ dataDir });
        const { json, decoded, projected } = yield* loadFixture();
        const seeded = v1Rows(json, decoded);

        yield* createTables().pipe(provideScopedLayer(ledgerLayer));
        yield* seedRows(seeded).pipe(provideScopedLayer(pgliteLayer));

        const outcome0 = A.getUnsafe(projected, 0);
        const outcome2 = A.getUnsafe(projected, 2);
        const outcome3 = A.getUnsafe(projected, 3);
        expect(batchIdOf(outcome2)).toBe(batchIdOf(A.getUnsafe(projected, 1)));
        const fresh3 = uncachedWithConfidence(outcome3, (index) => (index === 0 ? reported(0) : notAssessed));
        const degraded = yield* S.decodeUnknownEffect(ExtractOutcome.cases.Degraded)(degradedV1);
        const sharedClaim = withConfidence(fresh3, () => reported(1));
        const sharedBatch = sharedClaim.outcome === "Extracted" ? sharedClaim.batch : yield* Effect.die("unreachable");
        const extraInputs = A.append(sharedBatch.inputs, ChunkId.make(Str.repeat(64)("9")));
        const otherBatch = ExtractOutcome.cases.Extracted.make({
          outcome: "Extracted",
          batch: EvidenceBatch.make({
            ...sharedBatch,
            claims: A.take(sharedBatch.claims, 1),
            id: Result.getOrThrow(makeBatchId({ ...sharedBatch, inputs: extraInputs })),
            inputs: extraInputs,
          }),
        });

        const firstRead = yield* Effect.gen(function* () {
          const ledger = yield* Ledger;
          const snapshot = yield* ledger.read(runId);

          expect(A.map(snapshot.batches, batchIdOf)).toEqual(
            A.sort(A.map([outcome0, A.getUnsafe(projected, 1), degraded], batchIdOf), Str.Order)
          );
          const legacyClaims = A.flatMap(snapshot.batches, claimsOf);
          expect(A.length(legacyClaims)).toBe(4);
          expect(
            A.every(
              legacyClaims,
              (claim) => claim.confidence._tag === "Absent" && claim.confidence.reason === "legacy-unknown"
            )
          ).toBe(true);
          expect(A.map(snapshot.legacyConfidence, (legacy) => [legacy.claim, legacy.rawConfidence])).toEqual(
            A.map(legacyClaims, (claim) => [claim.id, 1])
          );

          const conflicts = yield* Effect.forEach(
            [withConfidence(outcome0, () => reported(1)), withConfidence(outcome0, () => notAssessed), outcome2],
            (outcome) => ledger.appendBatch(outcome, [ingested]).pipe(Effect.flip),
            { concurrency: 1 }
          );
          expect(A.map(conflicts, (error) => error.reason)).toEqual([
            "immutable-payload-conflict",
            "immutable-payload-conflict",
            "immutable-payload-conflict",
          ]);

          yield* ledger.appendBatch(outcome0, [ingested]);
          yield* ledger.appendBatch(degraded, [ingested]);
          yield* ledger.appendBatch(fresh3, [ingested]);
          yield* ledger.appendBatch(fresh3, [ingested]);
          const changed = yield* Effect.forEach(
            [sharedClaim, otherBatch],
            (outcome) => ledger.appendBatch(outcome, [ingested]).pipe(Effect.flip),
            { concurrency: 1 }
          );
          expect(A.map(changed, (error) => error.reason)).toEqual([
            "immutable-payload-conflict",
            "immutable-payload-conflict",
          ]);
          return snapshot;
        }).pipe(provideScopedLayer(ledgerLayer));

        const afterAppend = yield* rawRows().pipe(provideScopedLayer(pgliteLayer));
        const byKey = (rows: ReadonlyArray<RawRow>) =>
          A.map(rows, (row) => `${row.table}:${row.id}:${row.digest}:${row.payload}`);
        expect(A.every(byKey(seeded), (key) => A.contains(byKey(afterAppend), key))).toBe(true);
        const written = A.filter(
          afterAppend,
          (row) => !A.contains(byKey(seeded), `${row.table}:${row.id}:${row.digest}:${row.payload}`)
        );
        expect(A.length(written)).toBe(1 + A.length(claimsOf(fresh3)));
        expect(A.every(written, (row) => Str.Equivalence(sha256TextSync(row.payload), row.digest))).toBe(true);
        const writtenJson = yield* S.encodeEffect(RawRowsJson)(written);
        yield* Effect.promise(() =>
          context.expect(`${writtenJson}\n`).toMatchFileSnapshot("./fixtures/ledger-evidence-v2.json")
        );

        const reopened = yield* Effect.gen(function* () {
          const ledger = yield* Ledger;
          return yield* ledger.read(runId);
        }).pipe(provideScopedLayer(ledgerLayer));
        const sameOutcome = S.toEquivalence(ExtractOutcome);
        const stored2 = A.findFirst(reopened.batches, (outcome) =>
          Str.Equivalence(batchIdOf(outcome), batchIdOf(fresh3))
        );
        expect(O.exists(stored2, (outcome) => sameOutcome(outcome, fresh3))).toBe(true);
        expect(reopened.legacyConfidence).toEqual(firstRead.legacyConfidence);
      })
    );

    it.effect("refuses a v1 batch row whose bytes no longer hash to the stored digest", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const ledgerRoot = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-ledger-tamper-" });
        const ledgerLayer = LedgerLive(LedgerLiveOptions.make({ ledgerRoot, mode: "replay", runId }));
        const pgliteLayer = Pglite.makeLayer({ dataDir: path.join(ledgerRoot, runId, "replay") });
        const { json, decoded } = yield* loadFixture();
        const original = rowOf(A.getUnsafe(json, 0));
        const outcome = A.getUnsafe(decoded, 0);
        const id = outcome.outcome === "Extracted" ? outcome.batch.id : "";

        yield* createTables().pipe(provideScopedLayer(ledgerLayer));
        yield* seedRows([
          {
            table: "batches",
            id,
            digest: original.digest,
            payload: Str.replace('"confidence":1', '"confidence":0')(original.payload),
          },
        ]).pipe(provideScopedLayer(pgliteLayer));
        const error = yield* Effect.gen(function* () {
          const ledger = yield* Ledger;
          return yield* ledger.read(runId).pipe(Effect.flip);
        }).pipe(provideScopedLayer(ledgerLayer));

        expect(error.reason).toBe("digest-mismatch");
        const kept = yield* rawRows().pipe(provideScopedLayer(pgliteLayer));
        expect(A.map(kept, (row) => `${row.table}:${row.digest}`)).toEqual([`batches:${original.digest}`]);
      })
    );

    it.effect("reads the frozen v2 fixture rows under their recorded digests", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const text = yield* fs.readFileString("test/fixtures/ledger-evidence-v2.json");
        expect(sha256TextSync(text)).toBe("993d45a561490d3e249edad8eca244eedfc1fe14edc624d95cdf5802941b906f");
        const rows = yield* S.decodeEffect(RawRowsJson)(text);
        expect(`${yield* S.encodeEffect(RawRowsJson)(rows)}\n`).toBe(text);
        const batches = yield* Effect.forEach(
          A.filter(rows, (row) => Str.Equivalence(row.table, "batches")),
          (row) => readStoredBatch(StoredEvidenceRow.make({ digest: row.digest, payload: row.payload })),
          { concurrency: 1 }
        );
        const claims = yield* Effect.forEach(
          A.filter(rows, (row) => Str.Equivalence(row.table, "claims")),
          (row) => readStoredClaim(StoredEvidenceRow.make({ digest: row.digest, payload: row.payload })),
          { concurrency: 1 }
        );
        expect(A.length(batches)).toBe(1);
        expect(A.length(claims)).toBe(2);
        expect(A.every(A.appendAll(batches, claims), (stored) => A.isReadonlyArrayEmpty(stored.legacy))).toBe(true);
        expect(A.map(claims, (stored) => stored.claim.confidence._tag)).toContain("Present");
        expect(A.map(claims, (stored) => stored.claim.confidence._tag)).toContain("Absent");
      })
    );
  });
});

describe("semantica stored evidence readers", () => {
  it.layer(BunServices.layer, { timeout: "30 seconds", excludeTestServices: true })((it) => {
    it.effect("project v1 claims to legacy-unknown and keep the raw scalar", () =>
      Effect.gen(function* () {
        const { json } = yield* loadFixture();
        const raw = A.getUnsafe(json, 0) as { readonly batch: { readonly claims: ReadonlyArray<unknown> } };
        const row = rowOf(A.getUnsafe(raw.batch.claims, 0));
        const stored = yield* readStoredClaim(row);

        assertTrue(S.is(StoredClaim)(stored));

        expect(stored.claim.confidence).toEqual(ExtractorConfidence.cases.Absent.make({ reason: "legacy-unknown" }));
        expect(stored.legacy).toMatchObject([
          { format: "ledger-evidence/v1", rawConfidence: 1, storedDigest: row.digest },
        ]);
        const v2Payload = yield* S.encodeEffect(LedgerClaimPayload)(LedgerClaimPayload.make({ claim: stored.claim }));
        const v2 = rowOf(v2Payload);
        const replayed = yield* readStoredClaim(v2);
        expect(replayed.legacy).toEqual([]);
        expect(S.toEquivalence(EvidenceClaim)(replayed.claim, stored.claim)).toBe(true);
      })
    );

    it.effect("keep a v1 degraded outcome without legacy metadata and decode a v2 batch payload", () =>
      Effect.gen(function* () {
        const degraded = yield* readStoredBatch(rowOf(degradedV1));
        assertTrue(S.is(StoredBatch)(degraded));
        expect(degraded.outcome.outcome).toBe("Degraded");
        expect(degraded.legacy).toEqual([]);
        const v2Payload = yield* S.encodeEffect(LedgerBatchPayload)(
          LedgerBatchPayload.make({ outcome: degraded.outcome })
        );
        const v2 = yield* readStoredBatch(rowOf(v2Payload));
        expect(S.toEquivalence(ExtractOutcome)(v2.outcome, degraded.outcome)).toBe(true);
      })
    );

    it.effect("refuse changed bytes and payloads that decode under neither format", () =>
      Effect.gen(function* () {
        const valid = rowOf(degradedV1);
        const tampered = StoredEvidenceRow.make({ digest: valid.digest, payload: `${valid.payload} ` });
        const malformed = rowOf({ format: "ledger-evidence/v3" });
        const { json } = yield* loadFixture();
        const raw = A.getUnsafe(json, 0) as { readonly batch: { readonly claims: ReadonlyArray<object> } };
        const wrongId = rowOf({ ...A.getUnsafe(raw.batch.claims, 0), id: Str.repeat(64)("0") });

        const failures = yield* Effect.all(
          [
            readStoredBatch(tampered).pipe(Effect.flip),
            readStoredClaim(tampered).pipe(Effect.flip),
            readStoredBatch(malformed).pipe(Effect.flip),
            readStoredClaim(malformed).pipe(Effect.flip),
            readStoredClaim(wrongId).pipe(Effect.flip),
          ],
          { concurrency: 1 }
        );
        expect(A.map(failures, (error) => error.reason)).toEqual([
          "digest-mismatch",
          "digest-mismatch",
          "decode-failed",
          "decode-failed",
          "decode-failed",
        ]);
      })
    );
  });
});

describe("ledger-evidence legacy confidence properties", () => {
  const json = S.fromJsonString(LegacyConfidenceImport);
  const equivalent = S.toEquivalence(LegacyConfidenceImport);
  it.effect.prop(
    "every generated retained v1 scalar survives its JSON codec unchanged",
    [Arbitrary.schema(LegacyConfidenceImport)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(json)(value);
        const decoded = yield* S.decodeEffect(json)(encoded);
        assertTrue(equivalent(decoded, value));
      }),
    { arbitrary: fcRuns(50) }
  );
});
