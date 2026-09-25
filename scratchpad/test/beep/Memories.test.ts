import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  Evidence,
  LedgerWriteReason,
  Memory,
  MemoryCaptureContext,
  MemoryCategory,
  MemoryDB,
  MemoryItemStatus,
  MemoryKind,
  MemorySubjectScope,
  MemoryTier,
  ShortTermMemory,
  SubjectAttribution,
  UncertaintyReason,
  calculateScore,
  captureConfidenceForSourceSignal,
  computeVeracity,
  confidenceBand,
  confidenceFieldsForEvidence,
  decideInitialMemoryTier,
  decodeMemoryDb,
  documentIdFromSeed,
  evidenceFromSource,
  getMemoriesAsStr,
  isActive,
  mapLegacyCategories,
  memoryDbFromMemory,
  memoryLayer,
  mergeEvidenceSets,
  propositionize,
  renderMemory,
  shortTermFromMemory,
  structurallyConflicts,
  uncertaintyReasonsFor,
} from "../../beep/Memories.ts";

const encodeMemory = S.encodeEffect(Memory);
const encodeMemoryDB = S.encodeEffect(MemoryDB);
const encodeShortTermMemory = S.encodeEffect(ShortTermMemory);

const decode = <A>(schema: S.ConstraintDecoder<A>, input: unknown): A =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const now = DateTime.makeUnsafe("2026-09-22T10:00:00Z");
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const memoryWire = {
  content: "Lives in Seattle",
  category: "core",
  tags: ["home"],
  arguments: {},
  subjectAttribution: "unknown",
  objectEntityIds: [],
  qualifiers: {},
  uncertaintyReasons: [],
};

const memoryDbWire = {
  ...memoryWire,
  id: "mem-1",
  uid: "user-1",
  createdAt: "2026-09-22T10:00:00Z",
  updatedAt: "2026-09-22T10:00:00Z",
  manuallyAdded: false,
  reviewed: false,
  evidence: [],
  curationWeight: 0,
};

const evidenceWire = {
  evidenceId: "ev-1",
  sourceType: "conversation",
  sourceSignal: "transcription",
  extractorId: "memory_extractor",
  extractorVersion: "v1",
  artifactRef: {},
  captureConfidence: 0.65,
  independenceGroup: "conv-1",
  quoteRefs: [],
  capturedAt: "2026-09-22T10:00:00Z",
  redactionStatus: "active",
};

const evidence = (patch: Record<string, unknown>) => ({
  evidenceId: "e",
  independenceGroup: "g",
  captureConfidence: 0.6,
  redactionStatus: "active",
  ...patch,
});

describe("Memories literals", () => {
  it("decodes every literal domain and derives arbitraries", () => {
    for (const schema of [
      MemoryCategory,
      SubjectAttribution,
      UncertaintyReason,
      MemoryTier,
      MemoryKind,
      MemorySubjectScope,
      MemoryItemStatus,
      LedgerWriteReason,
      MemoryCaptureContext,
      Memory,
      Evidence,
      MemoryDB,
      ShortTermMemory,
    ]) {
      assert.notStrictEqual(schema.pipe(Arbitrary.schema), undefined);
    }
    assert.strictEqual(decode(MemoryTier, "archive"), "archive");
    assert.strictEqual(decodeFails(MemoryTier, "context_only"), true);
    assert.strictEqual(decode(MemoryItemStatus, "hidden"), "hidden");
    assert.strictEqual(decode(MemoryKind, "trigger"), "trigger");
    assert.strictEqual(decode(LedgerWriteReason, "legacy_migration"), "legacy_migration");
    assert.strictEqual(decode(MemorySubjectScope, "user_owned_project"), "user_owned_project");
    assert.strictEqual(decode(UncertaintyReason, "stale"), "stale");
  });

  it("maps legacy categories to the primary set", () => {
    assert.strictEqual(mapLegacyCategories("manual"), "manual");
    assert.strictEqual(mapLegacyCategories("hobbies"), "system");
    assert.strictEqual(mapLegacyCategories("auto"), "system");
    assert.strictEqual(mapLegacyCategories("weird"), "interesting");
    assert.strictEqual(mapLegacyCategories(3), "interesting");
    const decoded = decode(Memory, { ...memoryWire, category: "learnings" });
    assert.strictEqual(decoded.category, "system");
    const encoded = Effect.runSync(encodeMemory(decoded));
    assert.strictEqual(encoded.category, "system");
  });
});

describe("Memory models", () => {
  it("decodes a memory with defaults for missing visibility and None for null", () => {
    const missing = decode(Memory, memoryWire);
    assert.strictEqual(O.getOrNull(missing.visibility), "private");
    assert.strictEqual(O.isNone(missing.headline), true);
    assert.strictEqual(O.isNone(missing.captureContext), true);
    assert.strictEqual(O.isNone(missing.validTo), true);
    const nulled = decode(Memory, {
      ...memoryWire,
      visibility: null,
      headline: null,
      captureConfidence: null,
      subjectScope: null,
      captureContext: null,
    });
    assert.strictEqual(O.isNone(nulled.visibility), true);
    assert.strictEqual(O.isNone(nulled.captureConfidence), true);
    const present = decode(Memory, {
      ...memoryWire,
      visibility: "public",
      headline: "Home",
      captureConfidence: 0.9,
      subjectScope: "third_party",
      validTo: "2027-01-01T00:00:00Z",
    });
    assert.strictEqual(O.getOrNull(present.visibility), "public");
    assert.strictEqual(O.getOrNull(present.subjectScope), "third_party");
    assert.strictEqual(O.isSome(present.validTo), true);
    const encoded = Effect.runSync(encodeMemory(nulled));
    assert.strictEqual(encoded.visibility, null);
    assert.strictEqual(encoded.headline, null);
    assert.strictEqual(encoded.captureContext, null);
    const made = Memory.make({ content: "x" });
    assert.strictEqual(made.category, "interesting");
    assert.strictEqual(made.subjectAttribution, "unknown");
    assert.deepStrictEqual(made.tags, []);
    assert.strictEqual(O.getOrNull(made.visibility), "private");
  });

  it("decodes a nested capture context from the wire", () => {
    const present = decode(Memory, {
      ...memoryWire,
      captureContext: { sourceType: "conversation", quoteRefs: [], attribution: "user_spoken" },
    });
    assert.strictEqual(O.map(present.captureContext, (c) => O.getOrNull(c.attribution)).pipe(O.getOrNull), "user_spoken");
  });

  it("bounds the capture context", () => {
    assert.strictEqual(
      decodeFails(MemoryCaptureContext, { sourceType: "x".repeat(65), quoteRefs: [] }),
      true,
    );
    assert.strictEqual(
      decodeFails(MemoryCaptureContext, { sourceType: "conversation", quoteRefs: [{}, {}, {}, {}, {}, {}] }),
      true,
    );
    assert.strictEqual(
      decodeFails(MemoryCaptureContext, { sourceType: "conversation", quoteRefs: [], attribution: "robot" }),
      true,
    );
    const ok = decode(MemoryCaptureContext, { sourceType: "conversation", quoteRefs: [], sourceId: null });
    assert.strictEqual(O.isNone(ok.sourceId), true);
  });

  it("decodes stored memories with public visibility default and aligns memoryId", () => {
    const decoded = decode(MemoryDB, memoryDbWire);
    assert.strictEqual(O.getOrNull(decoded.visibility), "public");
    assert.strictEqual(O.isNone(decoded.memoryId), true);
    assert.strictEqual(O.isNone(decoded.memoryTier), true);
    assert.strictEqual(O.isNone(decoded.userReview), true);
    const aligned = Effect.runSync(decodeMemoryDb({ ...memoryDbWire, memoryTier: "short_term", userReview: null }));
    assert.strictEqual(O.getOrNull(aligned.memoryId), "mem-1");
    assert.strictEqual(O.getOrNull(aligned.memoryTier), "short_term");
    assert.strictEqual(O.isNone(aligned.userReview), true);
    assert.strictEqual(O.getOrNull(memoryLayer(aligned)), "short_term");
    assert.strictEqual(isActive(aligned), true);
    const closed = decode(MemoryDB, { ...memoryDbWire, invalidAt: "2026-09-23T00:00:00Z" });
    assert.strictEqual(isActive(closed), false);
    assert.strictEqual(decodeFails(MemoryDB, { ...memoryDbWire, memoryTier: "context_only" }), true);
    assert.strictEqual(Effect.runSyncExit(decodeMemoryDb({ id: "x" }))._tag, "Failure");
    const encoded = Effect.runSync(encodeMemoryDB(decoded));
    assert.strictEqual(encoded.memoryId, null);
    assert.strictEqual(encoded.memoryTier, null);
    assert.strictEqual(encoded.createdAt, "2026-09-22T10:00:00.000Z");
  });

  it("decodes evidence and short-term rows", () => {
    const ev = decode(Evidence, { ...evidenceWire, sourceId: null, clientDeviceId: "dev-1" });
    assert.strictEqual(O.isNone(ev.sourceId), true);
    assert.strictEqual(O.getOrNull(ev.clientDeviceId), "dev-1");
    const madeEvidence = Evidence.make({
      evidenceId: "e",
      sourceType: "conversation",
      sourceSignal: "typed",
      extractorId: "x",
      extractorVersion: "v1",
      independenceGroup: "g",
      capturedAt: now,
    });
    assert.strictEqual(madeEvidence.captureConfidence, 0.5);
    assert.strictEqual(madeEvidence.redactionStatus, "active");
    assert.deepStrictEqual(madeEvidence.artifactRef, {});
    const short = ShortTermMemory.make({ id: "s", uid: "u", content: "c" });
    assert.strictEqual(short.sourceType, "conversation");
    assert.strictEqual(short.scope, "global");
    assert.strictEqual(short.extractorId, "memory_extractor");
    assert.strictEqual(short.status, "pending_consolidation");
    assert.strictEqual(O.getOrNull(short.visibility), "private");
    assert.strictEqual(O.isNone(short.consolidatedAt), true);
    const encoded = Effect.runSync(encodeShortTermMemory(short));
    assert.strictEqual(encoded.consolidatedMemoryId, null);
    assert.strictEqual(encoded.status, "pending_consolidation");
  });
});

describe("Memories helpers", () => {
  it("decides the initial tier", () => {
    assert.strictEqual(decideInitialMemoryTier({ manuallyAdded: true, durability: O.none() }), "long_term");
    assert.strictEqual(decideInitialMemoryTier({ manuallyAdded: false, durability: O.some("LONG_TERM") }), "long_term");
    assert.strictEqual(decideInitialMemoryTier({ manuallyAdded: false, durability: O.some("short") }), "short_term");
    assert.strictEqual(decideInitialMemoryTier({ manuallyAdded: false, durability: O.none() }), "short_term");
  });

  it("derives deterministic uuid-shaped document ids", () => {
    const id = documentIdFromSeed("evidence|a|b");
    assert.strictEqual(uuidPattern.test(id), true);
    assert.strictEqual(documentIdFromSeed("evidence|a|b"), id);
    assert.notStrictEqual(documentIdFromSeed("evidence|a|c"), id);
  });

  it("maps capture priors and confidence bands", () => {
    assert.strictEqual(captureConfidenceForSourceSignal("typed"), 0.95);
    assert.strictEqual(captureConfidenceForSourceSignal("manual"), 0.95);
    assert.strictEqual(captureConfidenceForSourceSignal("push_to_talk"), 0.9);
    assert.strictEqual(captureConfidenceForSourceSignal("integration"), 0.8);
    assert.strictEqual(captureConfidenceForSourceSignal("transcription"), 0.65);
    assert.strictEqual(captureConfidenceForSourceSignal("background_transcription"), 0.55);
    assert.strictEqual(captureConfidenceForSourceSignal("ocr"), 0.45);
    assert.strictEqual(captureConfidenceForSourceSignal("legacy"), 0.6);
    assert.strictEqual(captureConfidenceForSourceSignal("unknown"), 0.5);
    assert.strictEqual(confidenceBand(0.9), "certain");
    assert.strictEqual(confidenceBand(0.75), "high");
    assert.strictEqual(confidenceBand(0.5), "medium");
    assert.strictEqual(confidenceBand(0.49), "low");
  });

  it("builds evidence from a source with fallbacks", () => {
    const base = {
      sourceId: O.some("conv-1"),
      sourceType: "conversation",
      sourceSignal: "ocr",
      extractorId: "memory_extractor",
      extractorVersion: "v1",
      artifactRef: O.none(),
      captureConfidence: O.none(),
      independenceGroup: O.none(),
      createdAt: now,
      clientDeviceId: O.some("dev-1"),
    };
    const ev = evidenceFromSource(base);
    assert.strictEqual(uuidPattern.test(ev.evidenceId), true);
    assert.strictEqual(ev.captureConfidence, 0.45);
    assert.strictEqual(ev.independenceGroup, "conv-1");
    assert.strictEqual(O.getOrNull(ev.clientDeviceId), "dev-1");
    assert.strictEqual(evidenceFromSource(base).evidenceId, ev.evidenceId);
    assert.strictEqual(evidenceFromSource({ ...base, clientDeviceId: O.none() }).evidenceId, ev.evidenceId);
    const noSource = evidenceFromSource({
      ...base,
      sourceId: O.none(),
      captureConfidence: O.some(0.7),
      artifactRef: O.some({ nested: { b: 1, a: [true, null] } }),
    });
    assert.strictEqual(noSource.independenceGroup, "conversation:unknown");
    assert.strictEqual(noSource.captureConfidence, 0.7);
    assert.notStrictEqual(noSource.evidenceId, ev.evidenceId);
    const explicitGroup = evidenceFromSource({ ...base, independenceGroup: O.some("lineage-1") });
    assert.strictEqual(explicitGroup.independenceGroup, "lineage-1");
  });

  it("computes veracity and uncertainty reasons from active evidence", () => {
    assert.strictEqual(computeVeracity({ evidence: [], subjectAttribution: "user" }), 0.35);
    assert.strictEqual(
      computeVeracity({ evidence: [evidence({ redactionStatus: "tombstoned" })], subjectAttribution: "user" }),
      0.35,
    );
    assert.strictEqual(computeVeracity({ evidence: [evidence({})], subjectAttribution: "user" }), 0.45);
    assert.strictEqual(
      computeVeracity({ evidence: [evidence({ captureConfidence: 0.9 })], subjectAttribution: "user" }),
      0.53,
    );
    assert.strictEqual(
      Number(computeVeracity({ evidence: [evidence({ captureConfidence: 0.4 })], subjectAttribution: "user" }).toFixed(2)),
      0.33,
    );
    assert.strictEqual(
      Number(computeVeracity({ evidence: [evidence({})], subjectAttribution: "third_party" }).toFixed(2)),
      0.37,
    );
    const two = computeVeracity({
      evidence: [evidence({ evidenceId: "a", independenceGroup: "g1" }), evidence({ evidenceId: "b", independenceGroup: "g2" })],
      subjectAttribution: "user",
    });
    assert.strictEqual(Number(two.toFixed(2)), 0.67);
    const many = computeVeracity({
      evidence: ["a", "b", "c", "d"].map((group) => evidence({ evidenceId: group, independenceGroup: group })),
      subjectAttribution: "user",
    });
    assert.strictEqual(many, 0.98);
    const bySource = computeVeracity({
      evidence: [{ sourceId: "s-1", captureConfidence: "nope" }],
      subjectAttribution: "user",
    });
    assert.strictEqual(bySource, 0.45);
    assert.deepStrictEqual(uncertaintyReasonsFor({ evidence: [], subjectAttribution: "user" }), ["single_source"]);
    assert.deepStrictEqual(
      uncertaintyReasonsFor({ evidence: [evidence({ captureConfidence: 0.3 })], subjectAttribution: "third_party" }),
      ["single_source", "low_capture_signal", "third_party_subject"],
    );
    assert.deepStrictEqual(
      uncertaintyReasonsFor({
        evidence: [evidence({ independenceGroup: "g1" }), evidence({ independenceGroup: "g2" })],
        subjectAttribution: "user",
      }),
      [],
    );
  });

  it("derives confidence fields from existing values or the first evidence", () => {
    const fromExisting = confidenceFieldsForEvidence({
      evidence: [evidence({ captureConfidence: 0.9 })],
      subjectAttribution: "user",
      existingCaptureConfidence: O.some(0.2),
    });
    assert.strictEqual(fromExisting.captureConfidence, 0.2);
    assert.strictEqual(fromExisting.veracity, 0.53);
    assert.deepStrictEqual(fromExisting.uncertaintyReasons, ["single_source"]);
    const fromEvidence = confidenceFieldsForEvidence({
      evidence: [evidence({ captureConfidence: 0.9 })],
      subjectAttribution: "user",
      existingCaptureConfidence: O.none(),
    });
    assert.strictEqual(fromEvidence.captureConfidence, 0.9);
    const fallback = confidenceFieldsForEvidence({ evidence: [], subjectAttribution: "user", existingCaptureConfidence: O.none() });
    assert.strictEqual(fallback.captureConfidence, 0.5);
    const typed = confidenceFieldsForEvidence({
      evidence: [Evidence.make({ ...evidenceWire, capturedAt: now, captureConfidence: 0.8 })],
      subjectAttribution: "user",
      existingCaptureConfidence: O.none(),
    });
    assert.strictEqual(typed.captureConfidence, 0.8);
  });

  it("merges evidence sets by id and revives tombstoned duplicates", () => {
    const merged = mergeEvidenceSets({
      existing: [evidence({ evidenceId: "a", redactionStatus: "tombstoned" }), evidence({ evidenceId: "b" })],
      incoming: [evidence({ evidenceId: "a" }), evidence({ evidenceId: "b", captureConfidence: 0.1 }), { note: "no id" }],
    });
    assert.strictEqual(merged.length, 3);
    assert.strictEqual(merged[0]?.redactionStatus, "active");
    assert.strictEqual(merged[1]?.captureConfidence, 0.6);
    assert.deepStrictEqual(merged[2], { note: "no id" });
    const typed = mergeEvidenceSets({
      existing: [Evidence.make({ ...evidenceWire, capturedAt: now })],
      incoming: [],
    });
    assert.strictEqual(typed[0]?.evidenceId, "ev-1");
    assert.strictEqual(typed[0]?.sourceId, null);
  });

  it("propositionizes content into predicates", () => {
    const lives = propositionize({ content: "The user lives in Seattle.", category: O.some("system") });
    assert.strictEqual(O.getOrNull(lives.predicate), "resides_in");
    assert.deepStrictEqual(lives.arguments, { location: "Seattle" });
    assert.strictEqual(O.getOrNull(lives.subjectEntityId), "user");
    assert.strictEqual(O.getOrNull(propositionize({ content: "I moved to Austin", category: O.none() }).predicate), "resides_in");
    const works = propositionize({ content: "She works at Acme Corp", category: O.some("interesting") });
    assert.strictEqual(O.getOrNull(works.predicate), "works_at");
    assert.deepStrictEqual(works.arguments, { organization: "Acme Corp" });
    assert.strictEqual(O.isNone(works.subjectEntityId), true);
    assert.deepStrictEqual(propositionize({ content: "They love jazz", category: O.none() }).arguments, { thing: "jazz" });
    assert.deepStrictEqual(propositionize({ content: "He owns a boat", category: O.none() }).arguments, { object: "a boat" });
    const age = propositionize({ content: "I am 42 years old", category: O.some("manual") });
    assert.strictEqual(O.getOrNull(age.predicate), "age_years");
    assert.deepStrictEqual(age.arguments, { years: 42 });
    const none = propositionize({ content: "Quiet mornings on the porch", category: O.some("workflow") });
    assert.strictEqual(O.isNone(none.predicate), true);
    assert.deepStrictEqual(none.arguments, {});
    assert.strictEqual(O.getOrNull(none.subjectEntityId), "user");
  });

  it("renders memories from predicates or content", () => {
    assert.strictEqual(renderMemory({ content: "The user lives in Seattle" }), "Lives in Seattle");
    assert.strictEqual(renderMemory({ content: "x", predicate: "works_at", arguments: { organization: "Acme" } }), "Works at Acme");
    assert.strictEqual(
      renderMemory({ content: "x", predicate: O.some("works_at"), arguments: { organization: "Acme", role: "CTO" } }),
      "Works at Acme as CTO",
    );
    assert.strictEqual(renderMemory({ content: "x", predicate: "prefers", arguments: { thing: "tea" } }), "Prefers tea");
    assert.strictEqual(renderMemory({ content: "x", predicate: "has", arguments: { object: "a dog" } }), "Has a dog");
    assert.strictEqual(renderMemory({ content: "x", predicate: "age_years", arguments: { years: 42 } }), "Is 42 years old");
    assert.strictEqual(renderMemory({ content: "x", predicate: "custom", arguments: {} }), "x");
    assert.strictEqual(renderMemory({ content: "x", predicate: "has", arguments: { thing: "no object" } }), "x");
    assert.strictEqual(renderMemory({ content: "Quiet mornings" }), "Quiet mornings");
    assert.strictEqual(renderMemory({}), "");
  });

  it("detects structural conflicts", () => {
    assert.strictEqual(
      structurallyConflicts({ left: { content: "I live in Seattle" }, right: { content: "I live in Austin" } }),
      true,
    );
    assert.strictEqual(
      structurallyConflicts({ left: { content: "I live in Seattle" }, right: { content: "I live in Seattle" } }),
      false,
    );
    assert.strictEqual(
      structurallyConflicts({ left: { content: "I live in Seattle" }, right: { content: "I work at Acme" } }),
      false,
    );
    assert.strictEqual(structurallyConflicts({ left: { content: "random" }, right: { content: "I live in Austin" } }), false);
    assert.strictEqual(
      structurallyConflicts({
        left: { content: "I am 40 years old", category: "system" },
        right: { content: "I am 41 years old", category: "manual" },
      }),
      true,
    );
  });

  it("calculates the legacy score string", () => {
    assert.strictEqual(calculateScore({ category: "core", manuallyAdded: true, createdAt: now }), "01_998_1790071200");
    assert.strictEqual(calculateScore({ category: "system", manuallyAdded: false, createdAt: now }), "00_999_1790071200");
    assert.strictEqual(calculateScore({ category: "mystery", manuallyAdded: false, createdAt: now }), "00_00_1790071200");
  });

  it("builds stored and short-term rows from a memory", () => {
    const memory = Memory.make({ content: "I work at Acme", category: "system", captureContext: O.none() });
    const stored = memoryDbFromMemory({
      memory,
      manuallyAdded: true,
      uid: "user-1",
      now,
      sourceId: O.none(),
      sourceType: O.none(),
      sourceSignal: O.none(),
      conversationId: O.none(),
      subjectEntityId: O.none(),
      subjectAttribution: O.none(),
      sourceCapturedAt: O.none(),
      clientDeviceId: O.none(),
    });
    assert.strictEqual(stored.id, documentIdFromSeed("I work at Acme"));
    assert.strictEqual(O.getOrNull(stored.memoryId), stored.id);
    assert.strictEqual(O.getOrNull(stored.memoryTier), "long_term");
    assert.strictEqual(O.getOrNull(stored.userReview), true);
    assert.strictEqual(stored.reviewed, true);
    assert.strictEqual(O.getOrNull(stored.subjectEntityId), "user");
    assert.strictEqual(stored.subjectAttribution, "user");
    assert.strictEqual(stored.evidence.length, 1);
    assert.strictEqual(stored.evidence[0]?.sourceType, "developer_api");
    assert.strictEqual(stored.evidence[0]?.sourceSignal, "manual");
    assert.strictEqual(O.getOrNull(stored.evidence[0]?.sourceId ?? O.none()), `external:${stored.id}`);
    assert.strictEqual(O.getOrNull(stored.captureConfidence), 0.95);
    assert.strictEqual(O.getOrNull(stored.scoring), "01_999_1790071200");
    assert.deepStrictEqual(stored.uncertaintyReasons, ["single_source"]);

    const withContext = memoryDbFromMemory({
      memory: Memory.make({
        content: "I live in Seattle",
        captureContext: O.some(
          MemoryCaptureContext.make({
            sourceType: "email",
            sourceId: O.some("mail-1"),
            sourceSignal: O.some("integration"),
            lineageId: O.some("thread-1"),
            capturedAt: O.some(DateTime.makeUnsafe("2026-09-20T00:00:00Z")),
          }),
        ),
      }),
      manuallyAdded: false,
      uid: "user-1",
      now,
      sourceId: O.none(),
      sourceType: O.none(),
      sourceSignal: O.none(),
      conversationId: O.some("conv-1"),
      subjectEntityId: O.some("ada"),
      subjectAttribution: O.some("third_party"),
      sourceCapturedAt: O.none(),
      clientDeviceId: O.some("dev-1"),
    });
    assert.strictEqual(O.getOrNull(withContext.memoryTier), "short_term");
    assert.strictEqual(O.isNone(withContext.userReview), true);
    assert.strictEqual(withContext.subjectAttribution, "third_party");
    assert.strictEqual(O.getOrNull(withContext.subjectEntityId), "ada");
    assert.strictEqual(withContext.evidence[0]?.sourceType, "conversation");
    assert.strictEqual(withContext.evidence[0]?.sourceSignal, "integration");
    assert.strictEqual(withContext.evidence[0]?.independenceGroup, "thread-1");
    assert.strictEqual(O.getOrNull(withContext.evidence[0]?.lineageId ?? O.none()), "thread-1");
    assert.strictEqual(
      DateTime.formatIso(withContext.evidence[0]?.capturedAt ?? now),
      "2026-09-20T00:00:00.000Z",
    );
    assert.deepStrictEqual(withContext.uncertaintyReasons, ["single_source", "third_party_subject"]);

    const short = shortTermFromMemory({
      memory,
      manuallyAdded: false,
      uid: "user-1",
      sourceId: O.some("conv-1"),
      now,
      sourceType: O.none(),
      sourceSignal: O.none(),
      scope: O.some("session"),
      importance: O.some(0.8),
      subjectEntityId: O.none(),
      subjectAttribution: O.none(),
      clientDeviceId: O.none(),
    });
    assert.strictEqual(short.id, documentIdFromSeed("short-term|user-1|conv-1|I work at Acme"));
    assert.strictEqual(short.scope, "session");
    assert.strictEqual(O.getOrNull(short.sourceSignal), "transcription");
    assert.strictEqual(short.qualifiers.importance, 0.8);
    assert.strictEqual(short.qualifiers.valid_from, "2026-09-22T10:00:00.000Z");
    assert.strictEqual(short.status, "pending_consolidation");
    const shortNoSource = shortTermFromMemory({
      memory: Memory.make({ content: "x", qualifiers: { valid_from: "kept" } }),
      manuallyAdded: true,
      uid: "user-1",
      sourceId: O.none(),
      now,
      sourceType: O.none(),
      sourceSignal: O.none(),
      scope: O.none(),
      importance: O.none(),
      subjectEntityId: O.none(),
      subjectAttribution: O.none(),
      clientDeviceId: O.none(),
    });
    assert.strictEqual(shortNoSource.id, documentIdFromSeed("short-term|user-1|None|x"));
    assert.strictEqual(shortNoSource.scope, "global");
    assert.strictEqual(O.getOrNull(shortNoSource.sourceSignal), "manual");
    assert.strictEqual(shortNoSource.qualifiers.valid_from, "kept");
    assert.strictEqual("importance" in shortNoSource.qualifiers, false);
  });

  it("renders memories as a bullet string", () => {
    const rendered = getMemoriesAsStr([
      { content: "A", asOf: now },
      { content: "B", createdAt: DateTime.makeUnsafe("2026-01-02T03:04:05Z") },
      { content: "C" },
      { asOf: "not a datetime" },
    ]);
    assert.strictEqual(rendered, "- A (2026-09-22 10:00:00 UTC)\n- B (2026-01-02 03:04:05 UTC)\n- C\n- \n");
  });
});
