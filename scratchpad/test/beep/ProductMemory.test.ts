import * as R from "effect/Record";
import * as Str from "effect/String";
// @effect-diagnostics nodeBuiltinImport:skip-file -- nodeBuiltinImport because Node's real createHash is the digest oracle the module is checked against. Owner: @beep/scratchpad. Exit: the beep lab graduates and its sources and tests move their digests to Effect Crypto.
import { createHash } from "node:crypto";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
import * as Cause from "effect/Cause";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  AccessDecision,
  DEFAULT_SHORT_TERM_TTL_DAYS,
  DEFAULT_SHORT_TERM_TTL_HOURS,
  LedgerWriteReason,
  MAX_LEDGER_CONTENT_CHARACTERS,
  MAX_LEDGER_PLAYBOOK_BODY_CHARACTERS,
  MAX_LEDGER_SLOT_CHARACTERS,
  MAX_LEDGER_TRIGGER_CONDITION_CHARACTERS,
  MAX_LEDGER_TRIGGER_CONDITION_KEYS,
  MemoryAccessPolicy,
  MemoryConsumer,
  MemoryEvidenceLink,
  MemoryItem,
  MemoryItemAlias,
  MemoryItemRejected,
  MemoryItemStatus,
  MemoryKind,
  MemoryLayer,
  MemorySubjectScope,
  MemoryTier,
  ProcessingState,
  SourceState,
  assertMemoryItemAlias,
  decodeMemoryItem,
  defaultShortTermExpiry,
  derivedDefaultAccessAllowed,
  effectiveShortTermExpiry,
  isArchiveAccessEligible,
  isDefaultAccessEligible,
  memoryAccessPolicyForOmiChat,
  memoryAccessPolicyForThirdParty,
  memoryItemHasLifecycleMetadata,
  newMemoryId,
  normalizeMemoryItem,
  normalizedMemoryContentKey,
  sourceIds,
} from "../../beep/ProductMemory.ts";

const isMemoryItemRejected = S.is(MemoryItemRejected);
const encodeMemoryEvidenceLink = S.encodeEffect(MemoryEvidenceLink);
const encodeMemoryItem = S.encodeEffect(MemoryItem);

const decode = <Sch extends S.Codec<unknown, unknown, never, unknown>>(schema: Sch, input: unknown): Sch["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const utc = (value: string): DateTime.Utc => DateTime.toUtc(DateTime.makeUnsafe(value));

const baseItem = {
  memoryId: "mem_1",
  uid: "u1",
  canonicalMemoryId: null,
  version: 1,
  tier: "short_term",
  status: "active",
  processingState: "pending",
  content: "Ada lives in Seattle",
  normalizedContentKey: null,
  evidence: [{ sourceId: "conv-1", conversationId: "conv-1", sourceState: "active" }],
  sourceState: "active",
  sensitivityLabels: [],
  visibility: "private",
  userAsserted: false,
  capturedAt: "2020-01-02T03:04:05Z",
  updatedAt: "2020-01-02T03:04:05Z",
  expiresAt: "2020-01-03T03:04:05Z",
  ledgerCommitId: null,
  ledgerSequence: null,
  itemRevision: 1,
  sourceCommitId: null,
  sourceCommitSequence: null,
  contentHash: null,
  accountGeneration: 0,
  promotion: null,
  captureDeviceIds: [],
  primaryCaptureDevice: null,
  corroborationCount: 0,
  lastCorroboratedAt: null,
  halfLifeDays: null,
  beliefClass: null,
  confidence: null,
  supersededBy: null,
  subjectEntityId: null,
  predicate: null,
  arguments: {},
  kgExtracted: false,
  graphReady: false,
  graphAssertionId: null,
  graphPlanHash: null,
  ledgerSchemaVersion: null,
  kind: "fact",
  subjectScope: "primary_user",
  slot: null,
  body: null,
  validFrom: null,
  validTo: null,
  curationWeight: 0,
  triggerCondition: {},
  intentBacked: false,
  writeReason: null,
};

const longTerm = {
  ...baseItem,
  tier: "long_term",
  processingState: "processed",
  expiresAt: null,
  ledgerCommitId: "commit-1",
  ledgerSequence: 7,
};

const ledgerV1 = {
  ...longTerm,
  ledgerSchemaVersion: "knowledge_ledger.v1",
  intentBacked: true,
  writeReason: "explicit_remember",
};

const item = (patch: Record<string, unknown> = {}): Effect.Effect<MemoryItem, MemoryItemRejected | S.SchemaError> =>
  decodeMemoryItem({ ...baseItem, ...patch });

const rejection = (patch: Record<string, unknown>): Effect.Effect<string> =>
  decodeMemoryItem({ ...baseItem, ...patch }).pipe(
    Effect.exit,
    Effect.map(
      Exit.match({
        onFailure: (cause) =>
          cause.pipe(
            Cause.findErrorOption,
            O.filter(isMemoryItemRejected),
            O.map((error) => error.reason),
            O.getOrElse(() => "other-failure"),
          ),
        onSuccess: () => "accepted",
      }),
    ),
  );

const sha = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");

const omiChat = memoryAccessPolicyForOmiChat();

describe("ProductMemory enums and constants", () => {
  it("exposes the Python constants and the MemoryTier alias", () => {
    assert.strictEqual(DEFAULT_SHORT_TERM_TTL_HOURS, 48);
    assert.strictEqual(DEFAULT_SHORT_TERM_TTL_DAYS, 2);
    assert.strictEqual(MAX_LEDGER_CONTENT_CHARACTERS, 4000);
    assert.strictEqual(MAX_LEDGER_PLAYBOOK_BODY_CHARACTERS, 24000);
    assert.strictEqual(MAX_LEDGER_SLOT_CHARACTERS, 64);
    assert.strictEqual(MAX_LEDGER_TRIGGER_CONDITION_KEYS, 13);
    assert.strictEqual(MAX_LEDGER_TRIGGER_CONDITION_CHARACTERS, 8000);
    assert.strictEqual(MemoryTier, MemoryLayer);
  });

  it("decodes every literal member", () => {
    for (const layer of ["short_term", "long_term", "archive"]) assert.strictEqual(decode(MemoryLayer, layer), layer);
    assert.strictEqual(decodeFails(MemoryLayer, "context_only"), true);
    for (const kind of ["fact", "document", "trigger"]) assert.strictEqual(decode(MemoryKind, kind), kind);
    for (const scope of ["primary_user", "user_owned_project", "user_relationship", "third_party"]) {
      assert.strictEqual(decode(MemorySubjectScope, scope), scope);
    }
    for (const reason of [
      "direct_user_statement",
      "explicit_remember",
      "agent_reusable_conclusion",
      "recurring_workflow",
      "standing_trigger",
      "onboarding",
      "daily_reconciliation",
      "legacy_migration",
    ]) {
      assert.strictEqual(decode(LedgerWriteReason, reason), reason);
    }
    for (const status of ["active", "superseded", "hidden", "tombstoned"])
      assert.strictEqual(decode(MemoryItemStatus, status), status);
    for (const state of ["pending", "processed", "blocked"]) assert.strictEqual(decode(ProcessingState, state), state);
    for (const consumer of [
      "omi_chat",
      "agent",
      "third_party",
      "developer_api",
      "mcp",
      "admin_debug",
      "eval",
      "unknown",
    ]) {
      assert.strictEqual(decode(MemoryConsumer, consumer), consumer);
    }
    for (const state of ["active", "missing", "tombstoned", "purged"])
      assert.strictEqual(decode(SourceState, state), state);
  });
});

describe("MemoryAccessPolicy and MemoryItemAlias", () => {
  it("builds the omi_chat and third_party policies", () => {
    assert.strictEqual(omiChat.consumer, "omi_chat");
    assert.strictEqual(omiChat.appHasDefaultMemoryGrant, true);
    assert.strictEqual(omiChat.archiveCapability, false);
    assert.strictEqual(memoryAccessPolicyForOmiChat(true).archiveCapability, true);
    const third = memoryAccessPolicyForThirdParty();
    assert.strictEqual(third.consumer, "third_party");
    assert.strictEqual(third.appHasDefaultMemoryGrant, false);
    assert.strictEqual(
      memoryAccessPolicyForThirdParty({ appHasDefaultMemoryGrant: true, archiveCapability: true }).archiveCapability,
      true,
    );
    const made = MemoryAccessPolicy.make({ consumer: "mcp" });
    assert.strictEqual(made.rawProvenanceCapability, false);
    const decoded = decode(MemoryAccessPolicy, {
      consumer: "agent",
      appHasDefaultMemoryGrant: true,
      archiveCapability: false,
      rawProvenanceCapability: true,
    });
    assert.strictEqual(decoded.rawProvenanceCapability, true);
    assert.deepStrictEqual(decode(AccessDecision, { allowed: false, reason: "not_active" }).reason, "not_active");
  });

  it("decodes MemoryEvidenceLink with present, null, and missing ids", () => {
    const present = decode(MemoryEvidenceLink, { sourceId: "s1", conversationId: "c1", sourceState: "missing" });
    assert.strictEqual(O.getOrNull(present.sourceId), "s1");
    const nulls = decode(MemoryEvidenceLink, { sourceId: null, conversationId: null, sourceState: "active" });
    assert.strictEqual(O.isNone(nulls.sourceId), true);
    const missing = decode(MemoryEvidenceLink, { sourceState: "active" });
    assert.strictEqual(O.isNone(missing.conversationId), true);
    const encoded = Effect.runSync(encodeMemoryEvidenceLink(missing));
    assert.strictEqual(encoded.sourceId, null);
    assert.strictEqual(encoded.conversationId, null);
    assert.strictEqual(MemoryEvidenceLink.make({}).sourceState, "active");
  });

  it("rejects an alias that points to itself and requires an aware timestamp", () => {
    const alias = decode(MemoryItemAlias, {
      oldMemoryId: "mem_1",
      canonicalMemoryId: "mem_2",
      uid: "u1",
      reason: "merge",
      createdAt: "2020-01-02T03:04:05+02:00",
    });
    assert.strictEqual(DateTime.formatIso(alias.createdAt), "2020-01-02T01:04:05.000Z");
    assert.strictEqual(Effect.runSync(assertMemoryItemAlias(alias)), alias);
    const self = MemoryItemAlias.make({ ...alias, canonicalMemoryId: "mem_1" });
    assert.strictEqual(Effect.runSyncExit(assertMemoryItemAlias(self))._tag, "Failure");
    assert.strictEqual(
      decodeFails(MemoryItemAlias, {
        oldMemoryId: "a",
        canonicalMemoryId: "b",
        uid: "u",
        reason: "r",
        createdAt: "2020-01-02T03:04:05",
      }),
      true,
    );
  });
});

describe("MemoryItem decoding", () => {
  it("decodes present values and requires the content key", () => {
    const decoded = decode(MemoryItem, {
      ...baseItem,
      canonicalMemoryId: "mem_0",
      ledgerSequence: 3,
      halfLifeDays: 1.5,
      promotion: { a: 1 },
    });
    assert.strictEqual(O.getOrNull(decoded.canonicalMemoryId), "mem_0");
    assert.strictEqual(O.getOrNull(decoded.ledgerSequence), 3);
    assert.strictEqual(O.getOrNull(decoded.halfLifeDays), 1.5);
    assert.deepStrictEqual(O.getOrNull(decoded.promotion), { a: 1 });
    assert.strictEqual(O.getOrNull(decoded.content), "Ada lives in Seattle");
    assert.strictEqual(decoded.expiresAt.pipe(O.getOrThrow, DateTime.formatIso), "2020-01-03T03:04:05.000Z");
    const { content: _content, ...noContent } = baseItem;
    assert.strictEqual(decodeFails(MemoryItem, noContent), true);
    assert.strictEqual(O.isNone(decode(MemoryItem, { ...baseItem, content: null, status: "hidden" }).content), true);
  });

  it("decodes null and missing Option fields and encodes None as null", () => {
    const nulls = decode(MemoryItem, baseItem);
    assert.strictEqual(O.isNone(nulls.canonicalMemoryId), true);
    assert.strictEqual(O.isNone(nulls.writeReason), true);
    assert.strictEqual(O.isNone(nulls.validTo), true);
    const {
      canonicalMemoryId: _a,
      ledgerCommitId: _b,
      writeReason: _c,
      validTo: _d,
      promotion: _e,
      ...missingKeys
    } = baseItem;
    const missing = decode(MemoryItem, missingKeys);
    assert.strictEqual(O.isNone(missing.ledgerCommitId), true);
    assert.strictEqual(O.isNone(missing.promotion), true);
    const encoded = Effect.runSync(encodeMemoryItem(missing));
    assert.strictEqual(encoded.canonicalMemoryId, null);
    assert.strictEqual(encoded.writeReason, null);
    assert.strictEqual(encoded.validTo, null);
    assert.strictEqual(encoded.promotion, null);
    assert.strictEqual(encoded.expiresAt, "2020-01-03T03:04:05.000Z");
  });

  it("enforces the field validators as schema checks", () => {
    assert.strictEqual(decodeFails(MemoryItem, { ...baseItem, memoryId: "  " }), true);
    assert.strictEqual(decodeFails(MemoryItem, { ...baseItem, uid: "" }), true);
    assert.strictEqual(decodeFails(MemoryItem, { ...baseItem, visibility: " " }), true);
    assert.strictEqual(decodeFails(MemoryItem, { ...baseItem, version: 0 }), true);
    assert.strictEqual(decodeFails(MemoryItem, { ...baseItem, capturedAt: "2020-01-02T03:04:05" }), true);
    assert.strictEqual(decodeFails(MemoryItem, { ...baseItem, curationWeight: 101 }), true);
    assert.strictEqual(decodeFails(MemoryItem, { ...baseItem, curationWeight: -101 }), true);
    assert.strictEqual(decodeFails(MemoryItem, { ...baseItem, tier: "context_only" }), true);
    const hugeCondition = { key: Str.repeat(MAX_LEDGER_TRIGGER_CONDITION_CHARACTERS)("x") };
    assert.strictEqual(decodeFails(MemoryItem, { ...baseItem, triggerCondition: hugeCondition }), true);
  });

  it("constructs with the Python defaults", () => {
    const made = MemoryItem.make({
      memoryId: "mem_2",
      uid: "u1",
      version: 1,
      tier: "long_term",
      status: "hidden",
      processingState: "processed",
      content: O.none(),
      sourceState: "missing",
      sensitivityLabels: [],
      visibility: "private",
      userAsserted: true,
      capturedAt: utc("2020-01-02T03:04:05Z"),
      updatedAt: utc("2020-01-02T03:04:05Z"),
    });
    assert.strictEqual(made.itemRevision, 1);
    assert.strictEqual(made.accountGeneration, 0);
    assert.strictEqual(made.kind, "fact");
    assert.strictEqual(made.subjectScope, "primary_user");
    assert.strictEqual(made.curationWeight, 0);
    assert.deepStrictEqual(made.evidence, []);
    assert.deepStrictEqual(made.arguments, {});
    assert.strictEqual(made.intentBacked, false);
  });
});

describe("MemoryItem normalization", () => {
  it.effect("derives the normalized content key and normalizes labels and slot", () =>
    Effect.gen(function* () {
      const normalized = yield* item({ sensitivityLabels: [" Public ", "public", "", "  "], slot: " My-Slot  Name " });
      assert.strictEqual(O.getOrNull(normalized.normalizedContentKey), sha("ada lives in seattle"));
      assert.deepStrictEqual(normalized.sensitivityLabels, ["public"]);
      assert.strictEqual(O.getOrNull(normalized.slot), "my_slot_name");
      const blankSlot = yield* item({ slot: "   " });
      assert.strictEqual(O.isNone(blankSlot.slot), true);
      const stale = yield* item({ normalizedContentKey: "stale" });
      assert.strictEqual(O.getOrNull(stale.normalizedContentKey), sha("ada lives in seattle"));
      const nfkc = yield* item({ content: "Ａda   LIVES\tin Seattle" });
      assert.strictEqual(O.getOrNull(nfkc.normalizedContentKey), sha("ada lives in seattle"));
    }),
  );

  it.effect("normalizedMemoryContentKey returns None for absent or blank content", () =>
    Effect.gen(function* () {
      const result1 = yield* normalizedMemoryContentKey(O.none());
      assert.strictEqual(O.isNone(result1), true);
      const result2 = yield* normalizedMemoryContentKey(O.some("   "));
      assert.strictEqual(O.isNone(result2), true);
      const result3 = yield* normalizedMemoryContentKey(O.some("A  b"));
      assert.strictEqual(O.getOrNull(result3), sha("a b"));
    }),
  );

  it.effect("rejects every lifecycle invariant with the Python message", () =>
    Effect.gen(function* () {
      const result4 = yield* rejection({ updatedAt: "2020-01-01T00:00:00Z" });
      assert.strictEqual(result4, "updated_at must be >= captured_at");
      const result5 = yield* rejection({ content: "   " });
      assert.strictEqual(result5, "active memory requires content");
      const result6 = yield* rejection({ content: null });
      assert.strictEqual(result6, "active memory requires content");
      const result7 = yield* rejection({ expiresAt: null });
      assert.strictEqual(result7, "short_term memory requires expires_at");
      const result8 = yield* rejection({ expiresAt: "2020-01-02T03:04:05Z" });
      assert.strictEqual(result8, "short_term expires_at must be after captured_at");
      const result9 = yield* rejection({ ...longTerm, ledgerCommitId: null });
      assert.strictEqual(result9, "active long_term memory requires ledger_commit_id");
      const result10 = yield* rejection({ ...longTerm, ledgerCommitId: "  " });
      assert.strictEqual(result10, "active long_term memory requires ledger_commit_id");
      const result11 = yield* rejection({ ...longTerm, ledgerSequence: null });
      assert.strictEqual(result11, "active long_term memory requires ledger_sequence");
      const result12 = yield* rejection({ ...longTerm, processingState: "pending" });
      assert.strictEqual(result12, "active long_term memory requires processing_state=processed");
      const result13 = yield* rejection({ ...longTerm, promotion: { admission_receipt: { ok: true } } });
      assert.strictEqual(result13, "admitted long_term memory requires an atomic graph assertion");
      const result14 = yield* rejection({
        ...longTerm,
        promotion: { admission_receipt: { ok: true } },
        graphReady: true,
        graphAssertionId: "g1",
        graphPlanHash: "h1",
      });
      assert.strictEqual(result14, "accepted");
      const result15 = yield* rejection({ ...longTerm, promotion: { admission_receipt: null } });
      assert.strictEqual(result15, "accepted");
      const result16 = yield* rejection({ evidence: [] });
      assert.strictEqual(result16, "active source memory requires at least one active evidence record");
      const result17 = yield* rejection({ evidence: [{ sourceState: "missing" }] });
      assert.strictEqual(result17, "active source memory requires at least one active evidence record");
      const result18 = yield* rejection({ evidence: [], userAsserted: true });
      assert.strictEqual(result18, "accepted");
      const result19 = yield* rejection({ validFrom: "2020-01-05T00:00:00Z", validTo: "2020-01-04T00:00:00Z" });
      assert.strictEqual(result19, "valid_to must be >= valid_from");
      const result20 = yield* rejection({ validTo: "2020-01-01T00:00:00Z" });
      assert.strictEqual(result20, "valid_to must be >= valid_from");
      const result21 = yield* rejection({ validTo: "2020-01-09T00:00:00Z" });
      assert.strictEqual(result21, "accepted");
      const result22 = yield* rejection({ kind: "document", slot: "s" });
      assert.strictEqual(result22, "only fact ledger rows may define a slot");
      const result23 = yield* rejection({ kind: "trigger" });
      assert.strictEqual(result23, "trigger ledger rows require trigger_condition");
      const result24 = yield* rejection({ triggerCondition: { when: "always" } });
      assert.strictEqual(result24, "trigger_condition is only valid for trigger ledger rows");
      const result25 = yield* rejection({ kind: "trigger", triggerCondition: { when: "always" } });
      assert.strictEqual(result25, "accepted");
    }),
  );

  it.effect("caps knowledge_ledger.v1 rows", () =>
    Effect.gen(function* () {
      const result26 = yield* rejection(ledgerV1);
      assert.strictEqual(result26, "accepted");
      const result27 = yield* rejection({ ...ledgerV1, content: Str.repeat(MAX_LEDGER_CONTENT_CHARACTERS + 1)("x") });
      assert.strictEqual(result27, "knowledge ledger content exceeds the ledger limit");
      const result28 = yield* rejection({ ...ledgerV1, slot: Str.repeat(MAX_LEDGER_SLOT_CHARACTERS + 1)("s") });
      assert.strictEqual(result28, "knowledge ledger slot exceeds the ledger limit");
      const result29 = yield* rejection({ ...ledgerV1, kind: "document" });
      assert.strictEqual(result29, "ledger documents require a non-empty body");
      const result30 = yield* rejection({ ...ledgerV1, kind: "document", body: "  " });
      assert.strictEqual(result30, "ledger documents require a non-empty body");
      const result31 = yield* rejection({
        ...ledgerV1,
        kind: "document",
        body: Str.repeat(MAX_LEDGER_PLAYBOOK_BODY_CHARACTERS + 1)("b"),
      });
      assert.strictEqual(result31, "ledger document body exceeds the ledger limit");
      const result32 = yield* rejection({ ...ledgerV1, kind: "document", body: "playbook" });
      assert.strictEqual(result32, "accepted");
      const result33 = yield* rejection({ ...ledgerV1, body: "stray" });
      assert.strictEqual(result33, "ledger body is only valid for document rows");
      const manyKeys = R.fromEntries(
        Array.from({ length: MAX_LEDGER_TRIGGER_CONDITION_KEYS + 1 }, (_, index) => [`k${index}`, index]),
      );
      const result34 = yield* rejection({ ...ledgerV1, kind: "trigger", triggerCondition: manyKeys });
      assert.strictEqual(result34, "ledger trigger condition exceeds the ledger key limit");
      const result35 = yield* rejection({ ...ledgerV1, writeReason: null });
      assert.strictEqual(result35, "knowledge ledger rows require an intent-backed write reason");
      const result36 = yield* rejection({ ...ledgerV1, intentBacked: false, writeReason: "onboarding" });
      assert.strictEqual(result36, "knowledge ledger rows require an intent-backed write reason");
      const result37 = yield* rejection({ ...ledgerV1, intentBacked: false, writeReason: "legacy_migration" });
      assert.strictEqual(result37, "accepted");
      const already = yield* item(ledgerV1);
      assert.strictEqual((yield* normalizeMemoryItem(already)).memoryId, "mem_1");
    }),
  );
});

describe("MemoryItem helpers", () => {
  it.effect("projects sorted unique source ids and lifecycle metadata", () =>
    Effect.gen(function* () {
      const projected = yield* item({
        evidence: [
          { sourceId: "b", conversationId: "a", sourceState: "active" },
          { sourceId: "b", conversationId: null, sourceState: "active" },
          { sourceId: "", conversationId: "c", sourceState: "missing" },
        ],
      });
      assert.deepStrictEqual(sourceIds(projected), ["a", "b", "c"]);
      assert.strictEqual(memoryItemHasLifecycleMetadata(projected), false);
      const result38 = yield* item({ promotion: {} });
      assert.strictEqual(memoryItemHasLifecycleMetadata(result38), true);
    }),
  );

  it("mints memory ids and computes short-term expiry", () => {
    assert.match(newMemoryId(), /^mem_[0-9a-f]{32}$/);
    assert.notStrictEqual(newMemoryId(), newMemoryId());
    const captured = utc("2020-01-02T03:04:05Z");
    assert.strictEqual(captured.pipe(defaultShortTermExpiry, DateTime.formatIso), "2020-01-04T03:04:05.000Z");
    assert.strictEqual(
      DateTime.formatIso(
        effectiveShortTermExpiry({ capturedAt: captured, expiresAt: O.some(utc("2020-01-03T00:00:00Z")) }),
      ),
      "2020-01-03T00:00:00.000Z",
    );
    assert.strictEqual(
      DateTime.formatIso(
        effectiveShortTermExpiry({ capturedAt: captured, expiresAt: O.some(utc("2020-02-01T00:00:00Z")) }),
      ),
      "2020-01-04T03:04:05.000Z",
    );
    assert.strictEqual(
      DateTime.formatIso(effectiveShortTermExpiry({ capturedAt: captured, expiresAt: O.none() })),
      "2020-01-04T03:04:05.000Z",
    );
  });
});

describe("MemoryItem access decisions", () => {
  const fresh = utc("2020-01-02T12:00:00Z");
  const later = utc("2020-02-01T00:00:00Z");

  it.effect("denies noncanonical sensitivity labels through the raw model decoder", () =>
    Effect.gen(function* () {
      const decode = S.decodeUnknownEffect(MemoryItem);
      const current = yield* decode({ ...baseItem, sensitivityLabels: [" HEALTH "] });
      const archived = yield* decode({ ...longTerm, tier: "archive", sensitivityLabels: [" HeAlTh "] });
      assert.strictEqual(isDefaultAccessEligible(current, omiChat, fresh).reason, "restricted_sensitivity");
      assert.strictEqual(
        isArchiveAccessEligible(archived, memoryAccessPolicyForOmiChat(true), fresh).reason,
        "restricted_sensitivity",
      );
    }),
  );

  it.effect("isDefaultAccessEligible walks every branch", () =>
    Effect.gen(function* () {
      const reason = (
        patch: Record<string, unknown>,
        policy: MemoryAccessPolicy = omiChat,
        now: DateTime.Utc = fresh,
      ) => item(patch).pipe(Effect.map((decoded) => isDefaultAccessEligible(decoded, policy, now).reason));
      const base = yield* item();
      const result39 = yield* reason({});
      assert.strictEqual(result39, "default_memory_allowed");
      assert.strictEqual(isDefaultAccessEligible(base, omiChat, fresh).allowed, true);
      const result40 = yield* reason({ status: "superseded" });
      assert.strictEqual(result40, "not_active");
      const result41 = yield* reason({ processingState: "blocked" });
      assert.strictEqual(result41, "processing_blocked");
      const result42 = yield* reason({ sourceState: "tombstoned", userAsserted: true });
      assert.strictEqual(result42, "source_not_active");
      const result43 = yield* reason({ sourceState: "purged", userAsserted: true });
      assert.strictEqual(result43, "source_not_active");
      const result44 = yield* reason({}, MemoryAccessPolicy.make({ consumer: "unknown" }));
      assert.strictEqual(result44, "unknown_consumer");
      const result45 = yield* reason({ sensitivityLabels: ["Health"] });
      assert.strictEqual(result45, "restricted_sensitivity");
      const result46 = yield* reason({ visibility: "friends" });
      assert.strictEqual(result46, "unknown_visibility");
      const result47 = yield* reason({ ...longTerm, tier: "archive" });
      assert.strictEqual(result47, "archive_requires_explicit_query");
      const result48 = yield* reason({}, memoryAccessPolicyForThirdParty());
      assert.strictEqual(result48, "missing_default_memory_grant");
      const result49 = yield* reason({}, MemoryAccessPolicy.make({ consumer: "developer_api" }));
      assert.strictEqual(result49, "missing_default_memory_grant");
      const result50 = yield* reason({}, MemoryAccessPolicy.make({ consumer: "mcp", appHasDefaultMemoryGrant: true }));
      assert.strictEqual(result50, "default_memory_allowed");
      const result51 = yield* reason({}, memoryAccessPolicyForThirdParty({ appHasDefaultMemoryGrant: true }));
      assert.strictEqual(result51, "default_memory_allowed");
      const result52 = yield* reason({}, omiChat, later);
      assert.strictEqual(result52, "short_term_expired_pending_adjudication");
      assert.strictEqual(isDefaultAccessEligible(base, omiChat, later).allowed, true);
      const result53 = yield* reason(longTerm);
      assert.strictEqual(result53, "default_memory_allowed");
      const result54 = yield* reason(longTerm, omiChat, later);
      assert.strictEqual(result54, "default_memory_allowed");
      const piped = pipe(base, isDefaultAccessEligible(omiChat, fresh));
      assert.strictEqual(piped.reason, "default_memory_allowed");
      assert.strictEqual(typeof isDefaultAccessEligible(base, omiChat).allowed, "boolean");
    }),
  );

  it.effect("isArchiveAccessEligible walks every branch", () =>
    Effect.gen(function* () {
      const archive = { ...longTerm, tier: "archive" };
      const archived = yield* item(archive);
      const capable = memoryAccessPolicyForOmiChat(true);
      assert.strictEqual(isArchiveAccessEligible(archived, omiChat).reason, "missing_archive_capability");
      assert.strictEqual(isArchiveAccessEligible(archived, capable).reason, "archive_explicit_allowed");
      assert.strictEqual(isArchiveAccessEligible(archived, capable).allowed, true);
      const result55 = yield* item();
      assert.strictEqual(isArchiveAccessEligible(result55, capable).reason, "not_archive");
      const result56 = yield* item({ ...archive, status: "hidden" });
      assert.strictEqual(isArchiveAccessEligible(result56, capable).reason, "not_active");
      const piped = pipe(archived, isArchiveAccessEligible(capable, fresh));
      assert.strictEqual(piped.reason, "archive_explicit_allowed");
    }),
  );

  it.effect("derivedDefaultAccessAllowed grants known consumers and denies unknown strings", () =>
    Effect.gen(function* () {
      const base = yield* item();
      assert.strictEqual(derivedDefaultAccessAllowed(base, "omi_chat"), true);
      assert.strictEqual(derivedDefaultAccessAllowed(base, "third_party"), true);
      assert.strictEqual(derivedDefaultAccessAllowed(base, "bogus"), false);
      assert.strictEqual(derivedDefaultAccessAllowed(base, "unknown"), false);
      assert.strictEqual(pipe(base, derivedDefaultAccessAllowed("agent")), true);
      const result57 = yield* item({ status: "tombstoned" });
      assert.strictEqual(derivedDefaultAccessAllowed(result57, "omi_chat"), false);
    }),
  );
});

describe("ProductMemory arbitraries", () => {
  it("derives arbitraries for every model", () => {
    for (const schema of [
      MemoryLayer,
      MemoryKind,
      MemorySubjectScope,
      LedgerWriteReason,
      MemoryItemStatus,
      ProcessingState,
      MemoryConsumer,
      SourceState,
      MemoryEvidenceLink,
      AccessDecision,
      MemoryAccessPolicy,
      MemoryItemAlias,
      MemoryItem,
    ]) {
      assert.notStrictEqual(schema.pipe(Arbitrary.schema), undefined);
    }
  });
});
