import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  InvalidLedgerKinds,
  LEDGER_INDEX_VERSION,
  LEDGER_SEARCH_KINDS,
  LedgerRowIndexState,
  LedgerSearchSurface,
  buildLedgerIndexMetadata,
  isLedgerRowAdmissible,
  ledgerKindValue,
  ledgerRowHasRestrictedSensitivity,
  ledgerRowIndexState,
  ledgerRowIsLocked,
  ledgerRowIsRejected,
  ledgerRowSourceIsReadable,
  ledgerSchemaIsCurrent,
  validateLedgerKinds,
} from "../../beep/KnowledgeLedgerSearch.ts";

const decode = <A>(schema: S.ConstraintDecoder<A>, input: unknown): A =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const failure = <A, E>(effect: Effect.Effect<A, E>): E => effect.pipe(Effect.flip, Effect.runSync);

const openFact = (patch: Record<string, unknown> = {}): object => ({
  uid: "user-1",
  ledgerSchemaVersion: "knowledge_ledger.v1",
  kind: "fact",
  content: "Lives in Seattle",
  status: "active",
  processingState: "processed",
  sourceState: "active",
  evidence: [{ sourceState: "active" }],
  intentBacked: true,
  subjectScope: "primary_user",
  sensitivityLabels: [],
  slot: "home_city",
  ...patch,
});

const current = (row: object, patch: { readonly uid?: string | null; readonly kinds?: HashSet.HashSet<string> } = {}) =>
  isLedgerRowAdmissible({ row, uid: patch.uid === undefined ? "user-1" : patch.uid, surface: "current", ...patch });

const history = (row: object, includeRejected?: boolean) =>
  isLedgerRowAdmissible({
    row,
    uid: "user-1",
    surface: "history",
    ...(includeRejected === undefined ? {} : { includeRejected }),
  });

describe("KnowledgeLedgerSearch", () => {
  it("decodes the literal domains and derives arbitraries", () => {
    assert.strictEqual(LEDGER_INDEX_VERSION, 1);
    assert.strictEqual(HashSet.size(LEDGER_SEARCH_KINDS), 3);
    assert.strictEqual(decode(LedgerSearchSurface, "current"), "current");
    assert.strictEqual(decode(LedgerSearchSurface, "history"), "history");
    assert.strictEqual(decodeFails(LedgerSearchSurface, "archive"), true);
    assert.strictEqual(decode(LedgerRowIndexState, "not_ledger"), "not_ledger");
    assert.strictEqual(decode(LedgerRowIndexState, "open"), "open");
    assert.strictEqual(decode(LedgerRowIndexState, "closed"), "closed");
    for (const schema of [LedgerSearchSurface, LedgerRowIndexState, InvalidLedgerKinds]) {
      assert.notStrictEqual(schema.pipe(Arbitrary.schema), undefined);
    }
  });

  it("reads kind, schema, lock, rejection, sensitivity, and source readability", () => {
    assert.strictEqual(ledgerKindValue({ kind: "fact" }), "fact");
    assert.strictEqual(ledgerKindValue({ kind: { value: "trigger" } }), "trigger");
    assert.strictEqual(ledgerKindValue({ kind: O.some("document") }), "document");
    assert.strictEqual(ledgerKindValue({ kind: O.none() }), "");
    assert.strictEqual(ledgerKindValue({ kind: 3 }), "3");
    assert.strictEqual(ledgerKindValue({ kind: { nested: true } }), "");
    assert.strictEqual(ledgerSchemaIsCurrent({ ledgerSchemaVersion: "knowledge_ledger.v1" }), true);
    assert.strictEqual(ledgerSchemaIsCurrent({}), false);
    assert.strictEqual(ledgerRowIsLocked({ isLocked: true }), true);
    assert.strictEqual(ledgerRowIsLocked({ promotion: { isLocked: true } }), true);
    assert.strictEqual(ledgerRowIsLocked({ promotion: O.some({ isLocked: true }) }), true);
    assert.strictEqual(ledgerRowIsLocked({ promotion: "nope" }), false);
    assert.strictEqual(ledgerRowIsRejected({ userReview: false }), true);
    assert.strictEqual(ledgerRowIsRejected({ promotion: { userReview: false } }), true);
    assert.strictEqual(ledgerRowIsRejected({ userReview: null }), false);
    assert.strictEqual(ledgerRowHasRestrictedSensitivity({ sensitivityLabels: ["travel", "health"] }), true);
    assert.strictEqual(ledgerRowHasRestrictedSensitivity({ sensitivityLabels: ["travel"] }), false);
    assert.strictEqual(ledgerRowHasRestrictedSensitivity({ sensitivityLabels: "health" }), false);
    assert.strictEqual(ledgerRowSourceIsReadable({ sourceState: "tombstoned" }), false);
    assert.strictEqual(ledgerRowSourceIsReadable({ sourceState: "purged" }), false);
    assert.strictEqual(
      ledgerRowSourceIsReadable({ sourceState: "active", evidence: [{ sourceState: "tombstoned" }] }),
      false,
    );
    assert.strictEqual(
      ledgerRowSourceIsReadable({ sourceState: "active", evidence: [{ sourceState: "tombstoned" }], userAsserted: true }),
      true,
    );
    assert.strictEqual(ledgerRowSourceIsReadable({ sourceState: "active", evidence: [{ sourceState: "active" }] }), true);
    assert.strictEqual(ledgerRowSourceIsReadable({ sourceState: "active" }), true);
    assert.strictEqual(ledgerRowSourceIsReadable({}), true);
  });

  it("admits an open row on the current surface and rejects each broken clause", () => {
    assert.strictEqual(current(openFact()), true);
    assert.strictEqual(current(openFact({ status: null, invalidAt: null, supersededBy: "" })), true);
    assert.strictEqual(current(openFact({ kind: "document" })), true);
    assert.strictEqual(current(openFact({ kind: "trigger", processingState: null })), true);
    assert.strictEqual(current(openFact(), { uid: null }), false);
    assert.strictEqual(current(openFact(), { uid: "" }), false);
    assert.strictEqual(current(openFact(), { uid: "user-2" }), false);
    assert.strictEqual(current(openFact(), { kinds: HashSet.make("document") }), false);
    const broken: ReadonlyArray<Record<string, unknown>> = [
      { ledgerSchemaVersion: "knowledge_ledger.v0" },
      { kind: "note" },
      { content: "   " },
      { content: null },
      { isLocked: true },
      { sensitivityLabels: ["credential"] },
      { sourceState: "purged" },
      { processingState: "pending" },
      { status: "hidden" },
      { status: "tombstoned" },
      { intentBacked: false },
      { status: "superseded" },
      { status: null, invalidAt: "2026-01-01" },
      { status: null, supersededBy: "other" },
      { validTo: "2026-01-01" },
      { invalidAt: "2026-01-01" },
      { supersededBy: "other" },
      { userReview: false },
      { kind: "document", subjectScope: "third_party" },
    ];
    for (const patch of broken) {
      assert.strictEqual(current(openFact(patch)), false);
    }
  });

  it("admits closed, rejected, and legacy facts on the history surface", () => {
    assert.strictEqual(history(openFact()), false);
    assert.strictEqual(history(openFact({ status: "superseded" })), true);
    assert.strictEqual(history(openFact({ validTo: "2026-01-01" })), true);
    assert.strictEqual(history(openFact({ invalidAt: "2026-01-01" })), true);
    assert.strictEqual(history(openFact({ supersededBy: "other" })), true);
    assert.strictEqual(history(openFact({ userReview: false })), false);
    assert.strictEqual(history(openFact({ userReview: false }), true), true);
    assert.strictEqual(history(openFact({ intentBacked: false, writeReason: "legacy_migration" })), true);
    assert.strictEqual(history(openFact({ intentBacked: false, writeReason: "onboarding" })), false);
    assert.strictEqual(history(openFact({ kind: "document", status: "superseded" })), false);
    assert.strictEqual(history(openFact({ kind: "trigger", status: "superseded" })), false);
  });

  it("projects the index state and metadata", () => {
    assert.strictEqual(ledgerRowIndexState(openFact()), "open");
    assert.strictEqual(ledgerRowIndexState(openFact({ status: "superseded" })), "closed");
    assert.strictEqual(ledgerRowIndexState(openFact({ uid: 7 })), "closed");
    assert.strictEqual(ledgerRowIndexState(openFact({ kind: "note" })), "not_ledger");
    assert.strictEqual(ledgerRowIndexState({}), "not_ledger");
    assert.deepStrictEqual(buildLedgerIndexMetadata({}), {});
    assert.deepStrictEqual(buildLedgerIndexMetadata(openFact({ kind: "note" })), {});
    assert.deepStrictEqual(buildLedgerIndexMetadata(openFact()), {
      ledgerIndexVersion: 1,
      ledgerSchemaVersion: "knowledge_ledger.v1",
      ledgerKind: "fact",
      ledgerRowState: "open",
      ledgerHasSlot: true,
      ledgerSubjectScope: "primary_user",
    });
    const closed = buildLedgerIndexMetadata(openFact({ status: "superseded", slot: "  ", subjectScope: null }));
    assert.strictEqual(Reflect.get(closed, "ledgerRowState"), "closed");
    assert.strictEqual(Reflect.get(closed, "ledgerHasSlot"), false);
    assert.strictEqual(Reflect.get(closed, "ledgerSubjectScope"), "");
  });

  it("validates ledger kinds", () => {
    const parsed = Effect.runSync(validateLedgerKinds([" Fact ", "trigger", "", "fact"]));
    assert.strictEqual(HashSet.size(parsed), 2);
    assert.strictEqual(HashSet.has(parsed, "fact"), true);
    assert.strictEqual(HashSet.has(parsed, "trigger"), true);
    const empty = failure(validateLedgerKinds([]));
    assert.strictEqual(S.is(InvalidLedgerKinds)(empty), true);
    const blank = failure(validateLedgerKinds(["  "]));
    assert.strictEqual(S.is(InvalidLedgerKinds)(blank), true);
    const unknown = failure(validateLedgerKinds(["fact", "note"]));
    assert.strictEqual(S.is(InvalidLedgerKinds)(unknown), true);
    assert.strictEqual(unknown.message, "kinds must contain only fact, document, or trigger");
  });
});
