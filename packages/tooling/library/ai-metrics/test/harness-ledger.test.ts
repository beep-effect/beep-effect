import {
  AiMetricsConfigSnapshotDiff,
  AiMetricsConfigSnapshotResult,
  annealedEditBudget,
  BehavioralClaim,
  ConfigSnapshot,
  ContextSurfaceKind,
  contextSurfaceId,
  contextSurfaceKey,
  deriveHarnessFingerprintId,
  deriveHarnessHash,
  HarnessEditRef,
  HarnessFingerprint,
  HarnessFingerprintInput,
  HarnessFingerprintParts,
  HarnessHash,
  HarnessLedgerDelta,
  HarnessLedgerRow,
  HarnessLedgerRowId,
  harnessFingerprintFromParts,
  harnessFingerprintUnknown,
  hashPublicTextSha256,
  isHarnessEdit,
  isStale,
  isWarmRestart,
  makeHarnessFingerprint,
  makeHarnessLedgerRowId,
  requiresBudget,
} from "@beep/repo-ai-metrics";
import { Sha256Hex } from "@beep/schema";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Random from "effect/Random";
import * as S from "effect/Schema";

const hashA = "a".repeat(64);
const hashB = "b".repeat(64);
const hashC = "c".repeat(64);

const snapshotResult = (sessionHash: string, baselineHash: string) =>
  AiMetricsConfigSnapshotResult.make({
    baselineHash,
    diff: AiMetricsConfigSnapshotDiff.make({ addedPaths: [], modifiedPaths: [], removedPaths: [], unchangedPaths: [] }),
    excludedDirectoryNames: [],
    fileCount: 0,
    files: [],
    sessionHash,
    snapshot: ConfigSnapshot.make({
      changedPaths: [],
      configHash: "config-hash",
      label: "repo-local-agent-config",
      snapshotId: "config-1",
    }),
  });

const fingerprintFor = (modelId: string, sessionHash: string, reasoningEffort = "medium") =>
  makeHarnessFingerprint(
    HarnessFingerprintInput.make({
      modelId: O.some(modelId),
      reasoningEffort: O.some(reasoningEffort),
      snapshot: snapshotResult(sessionHash, hashB),
    })
  );

const encodeRowJson = HarnessLedgerRow.encodeJsonEffect;
const parseJson = UnknownFromJsonString.decodeUnknownEffect;
const stringifyJson = UnknownFromJsonString.encodeUnknownEffect;
const asRecord = S.decodeUnknownEffect(S.Record(S.String, S.Unknown));
const decodeRowJson = HarnessLedgerRow.decodeJsonEffect;
const encodeFingerprintParts = S.encodeEffect(HarnessFingerprintParts);
const decodeFingerprintParts = S.decodeEffect(HarnessFingerprintParts);
const encodeFingerprint = S.encodeEffect(HarnessFingerprint);
const decodeFingerprint = S.decodeEffect(HarnessFingerprint);
const decodeUnknownEditRef = S.decodeUnknownEffect(HarnessEditRef);
const encodeEditRef = S.encodeEffect(HarnessEditRef);
const decodeEditRef = S.decodeEffect(HarnessEditRef);
const isHarnessEditRef = S.is(HarnessEditRef);
const encodeClaim = S.encodeEffect(BehavioralClaim);
const decodeClaim = S.decodeEffect(BehavioralClaim);
const encodeDelta = S.encodeEffect(HarnessLedgerDelta);
const decodeDelta = S.decodeEffect(HarnessLedgerDelta);
const isHarnessLedgerRowId = S.is(HarnessLedgerRowId);
const isHarnessHash = S.is(HarnessHash);

describe("harness-ledger", () => {
  describe("context surfaces", () => {
    it("keys surfaces as kind:name with no trailing newline", () => {
      expect(contextSurfaceKey("skill", "yeet")).toBe("skill:yeet");
      expect(contextSurfaceKey("mcp-server", "graft")).toBe("mcp-server:graft");
      expect(ContextSurfaceKind.Options).toContain("jsdoc");
    });

    it.effect("hashes the key exactly as `printf '%s' key | sha256sum` does", () =>
      Effect.gen(function* () {
        const id = yield* contextSurfaceId("skill", "yeet");
        expect(id).toBe("fb41c887b6326c198e3cde526da62f31a6399d9c8f73c7021ad22592e71b0193");
      })
    );
  });

  describe("fingerprint", () => {
    it.effect("composes the snapshot hashes and defaults unobserved dimensions to unknown", () =>
      Effect.gen(function* () {
        const fingerprint = yield* makeHarnessFingerprint(
          HarnessFingerprintInput.make({ snapshot: snapshotResult(hashA, hashB) })
        );
        expect(fingerprint.modelId).toBe(harnessFingerprintUnknown);
        expect(fingerprint.reasoningEffort).toBe(harnessFingerprintUnknown);
        expect(fingerprint.harnessSessionHash).toBe(hashA);
        expect(fingerprint.harnessBaselineHash).toBe(hashB);
        expect(fingerprint.fingerprintId).toBe(yield* deriveHarnessFingerprintId(fingerprint));
      })
    );

    it.effect("changes the id with any part and keeps it stable otherwise", () =>
      Effect.gen(function* () {
        const base = yield* fingerprintFor("gpt-6-astra", hashA);
        const same = yield* fingerprintFor("gpt-6-astra", hashA);
        const otherEffort = yield* fingerprintFor("gpt-6-astra", hashA, "xhigh");
        const otherHarness = yield* fingerprintFor("gpt-6-astra", hashC);
        const otherModel = yield* fingerprintFor("gpt-5.6-sol", hashA);
        const otherBaseline = yield* makeHarnessFingerprint(
          HarnessFingerprintInput.make({
            modelId: O.some("gpt-6-astra"),
            reasoningEffort: O.some("medium"),
            snapshot: snapshotResult(hashA, hashC),
          })
        );
        expect(same.fingerprintId).toBe(base.fingerprintId);
        expect(otherEffort.fingerprintId).not.toBe(base.fingerprintId);
        expect(otherHarness.fingerprintId).not.toBe(base.fingerprintId);
        expect(otherModel.fingerprintId).not.toBe(base.fingerprintId);
        expect(otherBaseline.fingerprintId).not.toBe(base.fingerprintId);
      })
    );

    it.effect("rejects an empty snapshot hash", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          makeHarnessFingerprint(HarnessFingerprintInput.make({ snapshot: snapshotResult("", hashB) }))
        );
        expect(error._tag).toBe("HarnessLedgerError");
      })
    );

    it.effect("roundtrips parts and fingerprints through their schemas", () =>
      Effect.gen(function* () {
        const parts = HarnessFingerprintParts.make({
          modelId: "gpt-6-astra",
          harnessSessionHash: Sha256Hex.make(hashA),
          harnessBaselineHash: Sha256Hex.make(hashB),
        });
        const fingerprint = yield* harnessFingerprintFromParts(parts);
        const encodedParts = yield* encodeFingerprintParts(parts);
        const encodedFingerprint = yield* encodeFingerprint(fingerprint);
        expect(yield* decodeFingerprintParts(encodedParts)).toStrictEqual(parts);
        expect(yield* decodeFingerprint(encodedFingerprint)).toStrictEqual(fingerprint);
        const { reasoningEffort: _dropped, ...withoutEffort } = encodedParts;
        expect((yield* decodeFingerprintParts(withoutEffort)).reasoningEffort).toBe(harnessFingerprintUnknown);
      })
    );
  });

  describe("harness hash", () => {
    it.effect("hashes the versioned preimage the hook-pulse writer rebuilds in shell", () =>
      Effect.gen(function* () {
        const source = {
          harnessSessionHash: Sha256Hex.make(hashA),
          harnessBaselineHash: Sha256Hex.make(hashB),
        };
        const hash = yield* deriveHarnessHash(source);
        // `printf 'harness-hash-v1\n%s\n%s' "$session" "$baseline" | sha256sum`
        expect(hash).toBe("f770e97d322c8b3e4cd0aabdd5d768ddf44465b676ef12faa7fe081d73755f0c");
        expect(hash).toBe(yield* hashPublicTextSha256(`harness-hash-v1\n${hashA}\n${hashB}`));
        pipe(isHarnessHash(hash), assertTrue);
      })
    );

    it.effect("ignores the model dimensions and orders the two scope hashes", () =>
      Effect.gen(function* () {
        const astra = yield* fingerprintFor("gpt-6-astra", hashA);
        const sol = yield* fingerprintFor("gpt-5.6-sol", hashA, "xhigh");
        const swapped = yield* deriveHarnessHash({
          harnessSessionHash: Sha256Hex.make(hashB),
          harnessBaselineHash: Sha256Hex.make(hashA),
        });
        const edited = yield* deriveHarnessHash(yield* fingerprintFor("gpt-6-astra", hashC));
        expect(astra.fingerprintId).not.toBe(sol.fingerprintId);
        expect(yield* deriveHarnessHash(astra)).toBe(yield* deriveHarnessHash(sol));
        expect(swapped).not.toBe(yield* deriveHarnessHash(astra));
        expect(edited).not.toBe(yield* deriveHarnessHash(astra));
      })
    );
  });

  describe("schema-derived property coverage", () => {
    const fingerprintEquivalent = S.toEquivalence(HarnessFingerprint);
    const editRefEquivalent = S.toEquivalence(HarnessEditRef);
    const claimEquivalent = S.toEquivalence(BehavioralClaim);

    it.effect.prop(
      "roundtrips arbitrary fingerprints, edit refs, and claims",
      [Arbitrary.schema(HarnessFingerprint), Arbitrary.schema(HarnessEditRef), Arbitrary.schema(BehavioralClaim)],
      Effect.fnUntraced(function* ([fingerprint, edit, claim]) {
        const fingerprintRoundtrip = yield* decodeFingerprint(yield* encodeFingerprint(fingerprint));

        const editRoundtrip = yield* decodeEditRef(yield* encodeEditRef(edit));

        const claimRoundtrip = yield* decodeClaim(yield* encodeClaim(claim));

        pipe(fingerprintEquivalent(fingerprintRoundtrip, fingerprint), assertTrue);

        pipe(editRefEquivalent(editRoundtrip, edit), assertTrue);

        pipe(claimEquivalent(claimRoundtrip, claim), assertTrue);
      }),
      { arbitrary: fcRuns(25) }
    );
  });

  describe("edit refs and claims", () => {
    it.effect("roundtrips every edit ref variant and rejects a bad diff digest", () =>
      Effect.gen(function* () {
        for (const encoded of [
          { kind: "commit", ref: "489ea7c488" },
          { kind: "diff-digest", ref: hashA },
          { kind: "pending" },
        ]) {
          const decoded = yield* decodeUnknownEditRef(encoded);
          expect(yield* encodeEditRef(decoded)).toStrictEqual(encoded);
        }
        pipe(isHarnessEditRef({ kind: "diff-digest", ref: "not-a-digest" }), assertFalse);
      })
    );

    it.effect("roundtrips claims and deltas", () =>
      Effect.gen(function* () {
        const claim = BehavioralClaim.make({
          claim: "Agents stop hand-rolling literal unions",
          expectedSurface: "skill",
          expectedMetric: "schema-first findings per task",
        });
        const delta = HarnessLedgerDelta.make({ score: 0.05, cost: -120 });
        expect(yield* decodeClaim(yield* encodeClaim(claim))).toStrictEqual(claim);
        expect(yield* decodeDelta(yield* encodeDelta(delta))).toStrictEqual(delta);
      })
    );
  });

  describe("ledger row", () => {
    const makeRow = Effect.fn(function* (overrides: Partial<Parameters<typeof HarnessLedgerRow.make>[0]> = {}) {
      const fingerprint = yield* fingerprintFor("gpt-6-astra", hashA);
      const touched = yield* contextSurfaceId("skill", "yeet");
      return HarnessLedgerRow.make({
        rowId: "hl-20260925-0a1b2c3d",
        createdAt: DateTime.makeUnsafe("2026-09-25T12:00:00.000Z"),
        edit: { kind: "commit", ref: "489ea7c488" },
        hypothesis: O.some(
          BehavioralClaim.make({ claim: "c", expectedSurface: "skill", expectedMetric: "schema-first findings" })
        ),
        mechanismClass: "skill",
        touched: HashSet.make(touched),
        fingerprint,
        repoRevision: O.some("489ea7c488"),
        delta: O.some(HarnessLedgerDelta.make({ score: 0.1, cost: 3 })),
        disposition: "accepted",
        dispositionEvidence: O.some("PR #1"),
        ...overrides,
      });
    });

    it.effect("roundtrips through the JSON codec with touched encoded as an array", () =>
      Effect.gen(function* () {
        const row = yield* makeRow();
        const json = yield* encodeRowJson(row);
        const parsed = yield* asRecord(yield* parseJson(json));
        pipe(A.isArray(parsed.touched), assertTrue);
        const decoded = yield* decodeRowJson(json);
        expect(decoded.rowId).toBe(row.rowId);
        expect(HashSet.size(decoded.touched)).toBe(1);
        expect(decoded.fingerprint.fingerprintId).toBe(row.fingerprint.fingerprintId);
        expect(yield* encodeRowJson(decoded)).toBe(json);
      })
    );

    it.effect("defaults absent optional keys on decode", () =>
      Effect.gen(function* () {
        const row = yield* makeRow();
        const decoded = yield* decodeRowJson(
          yield* stringifyJson({
            rowId: row.rowId,
            createdAt: "2026-09-25T12:00:00.000Z",
            edit: { kind: "pending" },
            mechanismClass: "config",
            fingerprint: yield* encodeFingerprint(row.fingerprint),
            disposition: "proposed",
          })
        );
        pipe(HashSet.isEmpty(decoded.touched), assertTrue);
        assertNone(decoded.hypothesis);
        assertNone(decoded.repoRevision);
      })
    );

    it.effect("rejects a malformed row id and resurrectWhen outside tombstoned rows", () =>
      Effect.gen(function* () {
        const row = yield* makeRow();
        const encoded = yield* asRecord(yield* parseJson(yield* encodeRowJson(row)));
        const badId = yield* Effect.flip(decodeRowJson(yield* stringifyJson({ ...encoded, rowId: "hl-2026-09-25" })));
        const badResurrect = yield* Effect.flip(
          decodeRowJson(yield* stringifyJson({ ...encoded, resurrectWhen: "model changes" }))
        );
        const tombstone = yield* decodeRowJson(
          yield* stringifyJson({ ...encoded, disposition: "tombstoned", resurrectWhen: "model changes" })
        );
        expect(badId._tag).toBe("SchemaError");
        expect(badResurrect._tag).toBe("SchemaError");
        assertSome(tombstone.resurrectWhen, "model changes");
      })
    );

    it.effect("roundtrips chain, target-surface, and window fields and rejects a bad previousRowId", () =>
      Effect.gen(function* () {
        const target = yield* contextSurfaceId("hook", "law-pulse.sh");
        const row = yield* makeRow({
          disposition: "proposed",
          previousRowId: O.some("hl-20260924-deadbeef"),
          targetSurface: O.some(target),
          windowSessions: O.some(30),
        });
        const json = yield* encodeRowJson(row);
        const decoded = yield* decodeRowJson(json);
        assertSome(decoded.previousRowId, "hl-20260924-deadbeef");
        assertSome(decoded.targetSurface, target);
        assertSome(decoded.windowSessions, 30);
        const encoded = yield* asRecord(yield* parseJson(json));
        const badPrevious = yield* Effect.flip(
          decodeRowJson(yield* stringifyJson({ ...encoded, previousRowId: "row-1" }))
        );
        const badWindow = yield* Effect.flip(decodeRowJson(yield* stringifyJson({ ...encoded, windowSessions: 0 })));
        expect(badPrevious._tag).toBe("SchemaError");
        expect(badWindow._tag).toBe("SchemaError");
        const defaulted = yield* makeRow();
        assertNone(defaulted.previousRowId);
        assertNone(defaulted.targetSurface);
        assertNone(defaulted.windowSessions);
      })
    );

    it.effect("mints row ids from the UTC date and the Random service", () =>
      Effect.gen(function* () {
        const createdAt = DateTime.makeUnsafe("2026-09-25T23:59:59.000Z");
        const first = yield* makeHarnessLedgerRowId(createdAt).pipe(Random.withSeed("ledger"));
        const again = yield* makeHarnessLedgerRowId(createdAt).pipe(Random.withSeed("ledger"));
        expect(first).toMatch(/^hl-20260925-[0-9a-f]{8}$/);
        expect(again).toBe(first);
        pipe(isHarnessLedgerRowId(first), assertTrue);
      })
    );

    it.effect("derives harness-ness and budget from touched and hypothesis", () =>
      Effect.gen(function* () {
        const harness = yield* makeRow();
        const product = yield* makeRow({ touched: HashSet.empty(), hypothesis: O.none() });
        expect([isHarnessEdit(harness), requiresBudget(harness)]).toStrictEqual([true, true]);
        expect([isHarnessEdit(product), requiresBudget(product)]).toStrictEqual([false, false]);
        const declaredOnly = yield* makeRow({ touched: HashSet.empty() });
        expect([isHarnessEdit(declaredOnly), requiresBudget(declaredOnly)]).toStrictEqual([false, true]);
      })
    );
  });

  describe("staleness and warm restarts", () => {
    it.effect("expires evidence on any fingerprint change but warm-restarts only on a model change", () =>
      Effect.gen(function* () {
        const base = yield* fingerprintFor("gpt-6-astra", hashA);
        const harnessEdit = yield* fingerprintFor("gpt-6-astra", hashC);
        const effortEdit = yield* fingerprintFor("gpt-6-astra", hashA, "xhigh");
        const release = yield* fingerprintFor("gpt-7", hashA);
        const row = { fingerprint: base };

        pipe(isStale(row, base), assertFalse);
        pipe(isStale(row, harnessEdit), assertTrue);
        pipe(isStale(row, effortEdit), assertTrue);
        pipe(isStale(row, release), assertTrue);

        pipe(isWarmRestart(base, base), assertFalse);
        pipe(isWarmRestart(base, harnessEdit), assertFalse);
        pipe(isWarmRestart(base, effortEdit), assertFalse);
        pipe(isWarmRestart(base, release), assertTrue);
      })
    );
  });

  describe("annealedEditBudget", () => {
    it("corrects cosine noise at an integral boundary without rounding genuine fractions", () => {
      expect(annealedEditBudget({ round: 1, totalRounds: 3, bMax: 4, bMin: 0 })).toBe(3);
      expect(annealedEditBudget({ round: 1, totalRounds: 3, bMax: 4.000000000533333, bMin: 0 })).toBe(4);
      expect(annealedEditBudget({ round: 1, totalRounds: 2, bMax: 1e-20, bMin: 0 })).toBe(1);
    });

    it("preserves endpoint and constant ceilings even one epsilon above an integer", () => {
      expect(annealedEditBudget({ round: 0, totalRounds: 3, bMax: 1 + Number.EPSILON, bMin: 0 })).toBe(2);
      expect(annealedEditBudget({ round: 3, totalRounds: 3, bMax: 4, bMin: 1 + Number.EPSILON })).toBe(2);
      expect(annealedEditBudget({ round: 999999999, totalRounds: 1000000000, bMax: 4, bMin: 1 + Number.EPSILON })).toBe(
        2
      );
      expect(annealedEditBudget({ round: 1, totalRounds: 3, bMax: 1 + Number.EPSILON, bMin: 1 + Number.EPSILON })).toBe(
        2
      );
    });

    it("keeps large finite bounds finite without decimal scaling", () => {
      expect(annealedEditBudget({ round: 1, totalRounds: 2, bMax: 1e308, bMin: 0 })).toBe(5e307);
      expect(annealedEditBudget({ round: 1e308, totalRounds: 1.1e308, bMax: 4, bMin: 0 })).toBe(1);
      expect(annealedEditBudget({ round: 0, totalRounds: 3, bMax: Number.MAX_VALUE, bMin: 0 })).toBe(Number.MAX_VALUE);
    });

    it("starts at bMax, ends at bMin, and never increases", () => {
      for (const [bMax, bMin, totalRounds] of [
        [4, 1, 3],
        [4, 1, 10],
        [8, 2, 7],
        [3, 3, 5],
      ] as const) {
        const budgets = A.makeBy(totalRounds + 1, (round) => annealedEditBudget({ round, totalRounds, bMax, bMin }));
        expect(budgets[0]).toBe(bMax);
        expect(budgets[totalRounds]).toBe(bMin);
        for (let round = 1; round <= totalRounds; round++) {
          expect(budgets[round]).toBeLessThanOrEqual(budgets[round - 1] ?? Number.POSITIVE_INFINITY);
        }
      }
    });

    it("matches Eq. 4 at the midpoint and clamps rounds past the schedule", () => {
      expect(annealedEditBudget({ round: 1, totalRounds: 2, bMax: 4, bMin: 1 })).toBe(Math.ceil(1 + 3 * 0.5));
      expect(annealedEditBudget({ round: 9, totalRounds: 3, bMax: 4, bMin: 1 })).toBe(1);
    });
  });
});
