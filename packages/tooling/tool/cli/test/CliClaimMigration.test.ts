import { ValidTime } from "@beep/epistemics/Claim";
import { ClaimReference, claimReferenceKey } from "@beep/epistemics/ClaimImport.schema";
import { ActivityStart } from "@beep/jsonc/ActivityStart";
import {
  HoldAgentRef,
  HoldClaim,
  HoldClaimEvent,
  HoldId,
  HoldPrincipalId,
  HoldProposition,
  holdClaimKey,
  holdProposition,
  ProbeRunId,
} from "@beep/repo-cli/commands/Holds";
import {
  decodeHoldClaimLine,
  decodeProbeRunLine,
  HoldClaimsV1Row,
  joinHoldClaims,
  makeHoldRenewal,
  planHoldAppend,
} from "@beep/repo-cli/commands/Holds/internal/HoldStore";
import { KbClaim, KbClaimEvent, KbEvidenceSignals, KbReviewState, kbClaimKey } from "@beep/repo-cli/commands/Kb";
import {
  decodeKbAssertionLine,
  decodeKbClaimLine,
  joinKbClaims,
  planKbAppend,
} from "@beep/repo-cli/commands/Kb/internal/KbStore";
import { fcRuns } from "@beep/test-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import { describe, expect, it, layer } from "@effect/vitest";
import { assertNone, assertSome, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const decodeJson = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));
const decodeRecord = S.decodeUnknownEffect(S.fromJsonString(S.Record(S.String, S.Unknown)));
const decodeHoldRow = S.decodeUnknownEffect(HoldClaimsV1Row);
const encodeHoldRow = S.encodeEffect(S.fromJsonString(HoldClaimsV1Row));
const encodeKbViews = S.encodeEffect(S.fromJsonString(S.Array(KbClaim)));
const encodeHoldViews = S.encodeEffect(S.fromJsonString(S.Array(HoldClaim)));
const decodeActivity = S.decodeUnknownEffect(ActivityStart);
const decodeValid = S.decodeUnknownEffect(ValidTime);
const envelopeKeys = ["id", "claimId", "supersedes", "logicalKey", "holdVersionId"] as const;

const fixtureLines = Effect.fnUntraced(function* (name: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* fs.realPath(`test/fixtures/${name}`);
  const text = yield* fs.readFileString(path);
  return A.filter(Str.split(text, "\n"), Str.isNonEmpty);
});

const lineSha = Effect.fnUntraced(function* (line: string) {
  const digest = yield* Digest.Digest;
  const hex = yield* digest.digestHex(Digest.sha256, new TextEncoder().encode(line));
  return `sha256:${hex}`;
});

const readKb = Effect.fnUntraced(function* (lines: ReadonlyArray<string>) {
  const decoded = yield* Effect.forEach(
    lines,
    Effect.fnUntraced(function* (line) {
      const json = yield* decodeJson(line);
      return yield* decodeKbClaimLine(line, json);
    }),
    { concurrency: 1 }
  );
  return { decoded, claims: yield* joinKbClaims(decoded) };
});

const readHolds = Effect.fnUntraced(function* (lines: ReadonlyArray<string>) {
  const decoded = yield* Effect.forEach(lines, decodeHoldClaimLine, { concurrency: 1 });
  return { decoded, claims: yield* joinHoldClaims(decoded) };
});

const renewalActivity = decodeActivity({
  operation: "https://example.org/ops/hold-renew",
  pin: { _tag: "Engine", engine: "beep", edition: "0.0.0" },
  used: [],
  started: 6,
});

const expectNoEnvelope = Effect.fnUntraced(function* (line: string, version: string) {
  const record = yield* decodeRecord(line);
  expect(record.version).toBe(version);
  for (const key of envelopeKeys) expect(record).not.toHaveProperty(key);
});

layer(Layer.mergeAll(NodeFileSystem.layer, Digest.layerWebCrypto), { timeout: "30 seconds" })(
  "CliClaimMigration",
  (it) => {
    it.effect("reads the kb v1 log to LegacyClaimImported and links assertions by old id", () =>
      Effect.gen(function* () {
        const lines = yield* fixtureLines("kb-claims-v1.jsonl");
        const { claims } = yield* readKb(lines);
        expect(claims).toHaveLength(1);
        const [claim] = claims;
        const line = lines[0];
        if (claim === undefined || line === undefined) return yield* Effect.die("empty kb fixture");
        const source = claim.source;
        if (source.version !== "legacy-claim-import/v1") return yield* Effect.die("expected an imported row");
        expect(source.ledger).toBe("kb");
        expect(source.oldId).toBe("claim/1");
        const lineDigest = yield* lineSha(line);
        expect(source.payloadDigest).toBe(lineDigest);
        expect(source.logicalKey).toBe("Published|8:entity/1|8:entity/2|26:Synthetic guide published.");
        expect(source.proposition.text).toBe("Synthetic guide published.");
        expect(source.supportRefs).toEqual(["assertion/1"]);
        expect(source.challengeRefs).toEqual([]);
        assertNone(source.predecessor);
        assertNone(source.originalKnowledge.expiredAt);
        expect(source.review._tag).toBe("Accepted");
        expect(claim.review._tag).toBe("Accepted");
        expect(HashSet.size(source.missingFacts)).toBeGreaterThan(0);
        expect(source.signals.sourceTrust).toMatchObject({ _tag: "Present", value: "high" });
        expect(source.signals.sourceAssertedConfidence._tag).toBe("Present");
        expect(source.signals.extractorConfidence._tag).toBe("Present");
        expect(source.signals.validator._tag).toBe("Present");
        expect(source.signals.reviewer._tag).toBe("Present");
        claim.signals.pipe(O.isSome, assertTrue);
        expect(claim.reference).toEqual(ClaimReference.cases.Imported.make({ ledger: "kb", oldId: "claim/1" }));
        const assertionLines = yield* fixtureLines("kb-assertions-v1.jsonl");
        const assertions = yield* Effect.forEach(
          assertionLines,
          Effect.fnUntraced(function* (text) {
            const json = yield* decodeJson(text);
            return yield* decodeKbAssertionLine(json);
          }),
          { concurrency: 1 }
        );
        expect(A.map(assertions, (a) => claimReferenceKey(a.claim))).toEqual([kbClaimKey(claim)]);
        expect(kbClaimKey(claim)).toBe("imported:kb:claim/1");
      })
    );

    it.effect("reads the hold v1 log with time bounds, predecessors and probe-run links", () =>
      Effect.gen(function* () {
        const lines = yield* fixtureLines("hold-claims-v1.jsonl");
        const { claims } = yield* readHolds(lines);
        expect(A.map(claims, holdClaimKey)).toEqual([
          "imported:holds:synthetic-hold@1",
          "imported:holds:synthetic-hold@2",
        ]);
        const [first, second] = claims;
        if (first === undefined || second === undefined) return yield* Effect.die("short hold fixture");
        assertSome(O.map(first.knowledge.end, DateTime.toEpochMillis), 5);
        expect(DateTime.toEpochMillis(first.knowledge.start)).toBe(1);
        expect(first.valid).toMatchObject({ _tag: "Interval" });
        expect(second.predecessor).toEqual(
          ClaimReference.cases.Imported.makeOption({ ledger: "holds", oldId: "synthetic-hold@1" })
        );
        expect(first.logicalKey).toBe(second.logicalKey);
        expect(first.review._tag).toBe("Proposed");
        const source = first.source;
        if (source.version !== "legacy-claim-import/v1") return yield* Effect.die("expected an imported row");
        const firstDigest = yield* lineSha(lines[0] ?? "");
        expect(source.payloadDigest).toBe(firstDigest);
        expect(source.supportRefs).toEqual(["run-1"]);
        expect(HashSet.size(source.missingFacts)).toBeGreaterThan(0);
        expect(source.signals.sourceTrust._tag).toBe("Absent");
        expect(source.signals.reviewer._tag).toBe("Absent");
        const runLines = yield* fixtureLines("hold-probe-run-v1.jsonl");
        const runs = yield* Effect.forEach(runLines, decodeProbeRunLine, { concurrency: 1 });
        expect(A.map(runs, (run) => claimReferenceKey(run.claim))).toEqual(A.map(claims, holdClaimKey));
        expect(A.map(runs, (run) => run.schemaVersion)).toEqual(["hold-probe-run/v2", "hold-probe-run/v2"]);
      })
    );

    it.effect("refuses an orphan or cyclic old predecessor with a typed refusal", () =>
      Effect.gen(function* () {
        const lines = yield* fixtureLines("hold-claims-v1.jsonl");
        const orphan = yield* Effect.flip(readHolds(A.drop(lines, 1)));
        expect(orphan).toMatchObject({ _tag: "ClaimHistoryRefused", reason: "missing-predecessor" });
        const firstJson = yield* decodeJson(lines[0] ?? "");
        const first = yield* decodeHoldRow(firstJson);
        const cyclic = yield* encodeHoldRow({ ...first, supersedes: O.some("synthetic-hold@2") });
        const refused = yield* Effect.flip(readHolds([cyclic, ...A.drop(lines, 1)]));
        expect(refused).toMatchObject({ _tag: "ClaimHistoryRefused", reason: "cyclic-predecessor" });
      })
    );

    it.effect("appends v2 hold renewal events that never imitate the old envelope and re-reads mixed logs", () =>
      Effect.gen(function* () {
        const lines = yield* fixtureLines("hold-claims-v1.jsonl");
        const before = yield* readHolds(lines);
        const predecessor = before.claims[1];
        if (predecessor === undefined) return yield* Effect.die("short hold fixture");
        const activity = yield* renewalActivity;
        const lease = yield* decodeValid({ _tag: "Interval", validFrom: 7, validTo: 30 });
        const renewal = yield* makeHoldRenewal({
          predecessor,
          proposition: holdProposition(predecessor),
          lease,
          activity,
          assertedBy: HoldAgentRef.cases.Person.make({ principal: HoldPrincipalId.make("maintainer") }),
          scope: "repo",
          generatedAt: DateTime.makeUnsafe(7),
          knowledgeStart: DateTime.makeUnsafe(7),
          supportedBy: [],
        });
        const appended = yield* planHoldAppend(before.decoded, renewal.events);
        expect(appended).toHaveLength(2);
        yield* Effect.forEach(appended, (line) => expectNoEnvelope(line, "hold-claim-record/v2"), {
          concurrency: 1,
          discard: true,
        });
        const mixed = A.appendAll(lines, appended);
        const after = yield* readHolds(mixed);
        expect(after.claims).toHaveLength(3);
        const native = after.claims[2];
        if (native === undefined) return yield* Effect.die("missing renewal");
        expect(native.reference).toEqual(ClaimReference.cases.Native.make({ claim: renewal.claim }));
        assertSome(native.predecessor, predecessor.reference);
        expect(native.logicalKey).toBe(predecessor.logicalKey);
        expect(native.review._tag).toBe("Proposed");
        assertSome(O.map(after.claims[1]?.knowledge.end ?? O.none(), DateTime.toEpochMillis), 7);
        const again = yield* readHolds(mixed);
        const firstRead = yield* encodeHoldViews(after.claims);
        const secondRead = yield* encodeHoldViews(again.claims);
        expect(secondRead).toBe(firstRead);
        const duplicate = yield* Effect.flip(planHoldAppend(after.decoded, renewal.events));
        expect(duplicate).toMatchObject({ _tag: "ClaimHistoryRefused" });
      })
    );

    it.effect("appends a separate kb review event, keeps the imported review and re-reads deterministically", () =>
      Effect.gen(function* () {
        const lines = yield* fixtureLines("kb-claims-v1.jsonl");
        const before = yield* readKb(lines);
        const claim = before.claims[0];
        if (claim === undefined) return yield* Effect.die("empty kb fixture");
        const at = DateTime.makeUnsafe(9);
        const review = KbClaimEvent.cases.Review.make({
          claim: claim.reference,
          review: KbReviewState.cases.Retracted.make({ reason: "Synthetic correction", at }),
          at,
        });
        const appended = yield* planKbAppend(before.decoded, [review]);
        yield* Effect.forEach(appended, (line) => expectNoEnvelope(line, "kb-claim-record/v2"), {
          concurrency: 1,
          discard: true,
        });
        const mixed = A.appendAll(lines, appended);
        const after = yield* readKb(mixed);
        expect(A.map(after.claims, kbClaimKey)).toEqual([kbClaimKey(claim)]);
        expect(after.claims[0]?.review._tag).toBe("Retracted");
        expect(after.claims[0]?.source).toEqual(claim.source);
        const again = yield* readKb(mixed);
        const firstRead = yield* encodeKbViews(after.claims);
        const secondRead = yield* encodeKbViews(again.claims);
        expect(secondRead).toBe(firstRead);
        const unknown = KbClaimEvent.cases.Review.make({
          claim: ClaimReference.cases.Imported.make({ ledger: "kb", oldId: "claim/missing" }),
          review: KbReviewState.cases.Proposed.make({}),
          at,
        });
        const refused = yield* Effect.flip(planKbAppend(before.decoded, [unknown]));
        expect(refused).toMatchObject({ _tag: "ClaimHistoryRefused", reason: "unknown-target" });
      })
    );
  }
);

const holdHistory = Effect.fnUntraced(function* () {
  const lines = yield* fixtureLines("hold-claims-v1.jsonl");
  const before = yield* readHolds(lines);
  const activity = yield* renewalActivity;
  const lease = yield* decodeValid({ _tag: "Interval", validFrom: 7, validTo: 30 });
  const renew = (
    predecessor: HoldClaim,
    overrides: {
      readonly proposition?: HoldProposition;
      readonly generatedAt?: number;
      readonly supportedBy?: ReadonlyArray<ProbeRunId>;
      readonly knowledgeStart?: number;
    } = {}
  ) =>
    makeHoldRenewal({
      predecessor,
      proposition: overrides.proposition ?? holdProposition(predecessor),
      lease,
      activity,
      assertedBy: HoldAgentRef.cases.Person.make({ principal: HoldPrincipalId.make("maintainer") }),
      scope: "repo",
      generatedAt: DateTime.makeUnsafe(overrides.generatedAt ?? 7),
      knowledgeStart: DateTime.makeUnsafe(overrides.knowledgeStart ?? 7),
      supportedBy: overrides.supportedBy ?? [],
    });
  const head = before.claims[1];
  if (head === undefined) return yield* Effect.die("short hold fixture");
  return { lines, before, head, renew };
});

const replaceOnce = (line: string, search: string, replacement: string): string => {
  expect(line).toContain(search);
  return Str.replace(search, replacement)(line);
};

layer(Layer.mergeAll(NodeFileSystem.layer, Digest.layerWebCrypto), { timeout: "30 seconds" })(
  "CliClaimMigration refusals",
  (it) => {
    it.effect("refuses a duplicated old id", () =>
      Effect.gen(function* () {
        const { lines } = yield* holdHistory();
        const refused = yield* Effect.flip(readHolds([lines[0] ?? "", lines[0] ?? ""]));
        expect(refused).toMatchObject({ reason: "duplicate-claim", claim: "imported:holds:synthetic-hold@1" });
      })
    );

    it.effect("refuses a tampered native core, a malformed native assertion and a forged activity", () =>
      Effect.gen(function* () {
        const { lines, before, head, renew } = yield* holdHistory();
        const renewal = yield* renew(head);
        const [core, ...rest] = yield* planHoldAppend(before.decoded, renewal.events);
        if (core === undefined) return yield* Effect.die("missing core line");
        const read = (line: string) => Effect.flip(readHolds([...lines, line, ...rest]));
        const rescoped = yield* read(replaceOnce(core, '"scope":"repo"', '"scope":"repo-2"'));
        expect(rescoped).toMatchObject({ reason: "claim-key-mismatch" });
        const unmintable = yield* read(
          replaceOnce(core, '"assertion":"Synthetic dependency remains pinned."', '"assertion":"\\ud800"')
        );
        strictEqual(unmintable._tag, "SchemaError");
        const forged = yield* read(replaceOnce(core, '"started":6', '"started":5'));
        expect(forged).toMatchObject({ reason: "activity-mismatch" });
        const early = yield* renew(head, { generatedAt: 5 });
        const premature = yield* Effect.flip(planHoldAppend(before.decoded, early.events));
        expect(premature).toMatchObject({ reason: "activity-mismatch" });
      })
    );

    it.effect("keeps reading a v1 hold with a lone surrogate but refuses to renew it as a native core", () =>
      Effect.gen(function* () {
        const { lines, renew } = yield* holdHistory();
        const [first, ...rest] = lines;
        if (first === undefined) return yield* Effect.die("empty hold fixture");
        const malformed = replaceOnce(
          first,
          '"assertion":"Synthetic dependency remains pinned."',
          '"assertion":"\\ud800"'
        );
        const { claims } = yield* readHolds([malformed, ...rest]);
        const imported = claims[0];
        if (imported === undefined) return yield* Effect.die("short hold fixture");
        strictEqual(holdProposition(imported).assertion, "\uD800");
        const refused = yield* Effect.flip(renew(imported));
        strictEqual(refused._tag, "SchemaError");
      })
    );

    it.effect("chains native renewals and refuses a native chain with a missing core", () =>
      Effect.gen(function* () {
        const { lines, before, head, renew } = yield* holdHistory();
        const first = yield* renew(head, { supportedBy: [ProbeRunId.make("run-9")] });
        const firstLines = yield* planHoldAppend(before.decoded, first.events);
        expect(firstLines).toHaveLength(3);
        const middle = yield* readHolds([...lines, ...firstLines]);
        const nativeHead = middle.claims[2];
        if (nativeHead === undefined) return yield* Effect.die("missing renewal");
        expect(nativeHead.evidence.supportedBy).toEqual(["run-9"]);
        const second = yield* renew(nativeHead, { generatedAt: 8, knowledgeStart: 8 });
        const secondLines = yield* planHoldAppend(middle.decoded, second.events);
        expect(secondLines).toHaveLength(1);
        const full = yield* readHolds([...lines, ...firstLines, ...secondLines]);
        deepStrictEqual(
          A.map(full.claims, (claim) => O.map(claim.predecessor, claimReferenceKey)),
          [
            O.none(),
            O.some("imported:holds:synthetic-hold@1"),
            O.some("imported:holds:synthetic-hold@2"),
            O.some(holdClaimKey(nativeHead)),
          ]
        );
        const gap = yield* Effect.flip(readHolds([...lines, ...secondLines]));
        expect(gap).toMatchObject({ reason: "log-violation", claim: "native-log" });
        const refused = yield* Effect.flip(planHoldAppend(before.decoded, second.events));
        expect(refused).toMatchObject({ reason: "log-violation" });
        const relinked = HoldClaimEvent.cases.Succession.make({
          claim: first.claim,
          predecessor: ClaimReference.cases.Imported.make({ ledger: "holds", oldId: "synthetic-hold@1" }),
          at: DateTime.makeUnsafe(9),
        });
        const conflicting = yield* Effect.flip(planHoldAppend(full.decoded, [relinked]));
        expect(conflicting).toMatchObject({ reason: "conflicting-predecessor" });
      })
    );

    it.effect("refuses a succession to an unknown old id, a fork and a changed logical key", () =>
      Effect.gen(function* () {
        const { lines, before, head, renew } = yield* holdHistory();
        const orphan = yield* renew(head);
        const ghost = HoldClaimEvent.cases.Succession.make({
          claim: orphan.claim,
          predecessor: ClaimReference.cases.Imported.make({ ledger: "holds", oldId: "ghost@1" }),
          at: DateTime.makeUnsafe(7),
        });
        const [core] = orphan.events;
        if (core === undefined) return yield* Effect.die("missing core event");
        const missing = yield* Effect.flip(planHoldAppend(before.decoded, [core, ghost]));
        expect(missing).toMatchObject({ reason: "missing-predecessor", claim: "imported:holds:ghost@1" });
        const secondJson = yield* decodeJson(lines[1] ?? "");
        const second = yield* decodeHoldRow(secondJson);
        const rival = yield* encodeHoldRow({ ...second, id: "synthetic-hold@3" });
        const fork = yield* Effect.flip(readHolds([...lines, rival]));
        expect(fork).toMatchObject({ reason: "supersession-fork" });
        const renamed = yield* renew(head, {
          proposition: HoldProposition.make({ ...holdProposition(head), holdId: HoldId.make("other-hold") }),
        });
        const mismatch = yield* Effect.flip(planHoldAppend(before.decoded, renamed.events));
        expect(mismatch).toMatchObject({ reason: "predecessor-key-mismatch" });
      })
    );

    it.effect("replaces imported kb signals with a later signals record", () =>
      Effect.gen(function* () {
        const lines = yield* fixtureLines("kb-claims-v1.jsonl");
        const before = yield* readKb(lines);
        const claim = before.claims[0];
        if (claim === undefined) return yield* Effect.die("empty kb fixture");
        const signals = O.getOrUndefined(claim.signals);
        if (signals === undefined) return yield* Effect.die("imported signals missing");
        const replaced = { ...signals, sourceTrust: { _tag: "Present" as const, value: "low" as const } };
        const event = KbClaimEvent.cases.Signals.make({
          claim: claim.reference,
          signals: KbEvidenceSignals.make(replaced),
          at: DateTime.makeUnsafe(9),
        });
        const appended = yield* planKbAppend(before.decoded, [event]);
        const after = yield* readKb([...lines, ...appended]);
        assertSome(
          O.map(after.claims[0]?.signals ?? O.none(), (s) => s.sourceTrust),
          { _tag: "Present", value: "low" }
        );
      })
    );
  }
);

describe("claim-record/v2 event properties", () => {
  const json = S.fromJsonString(HoldClaimEvent);
  const equivalent = S.toEquivalence(HoldClaimEvent);
  it.effect.prop(
    "every generated hold claim event survives its JSON codec unchanged",
    [Arbitrary.schema(HoldClaimEvent)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(json)(value);
        const decoded = yield* S.decodeEffect(json)(encoded);
        assertTrue(equivalent(decoded, value));
      }),
    { arbitrary: fcRuns(30) }
  );
});
