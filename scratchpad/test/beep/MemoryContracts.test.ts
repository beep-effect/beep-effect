import { createHash } from "node:crypto";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  CheckedDurableMemoryPatch,
  CheckedL2SearchPlan,
  ConfidenceBand,
  DURABLE_MEMORY_PATCH_FACT_SOURCE,
  DurableMemoryPatch,
  DurablePatchDecision,
  EvidenceRef,
  L1MemoryArchiveClass,
  L1MemoryArchiveItem,
  L1MemoryArchiveItemWire,
  L2DropReason,
  L2MemoryRoute,
  L2MemoryRouteDiscard,
  L2MemoryRouteDurable,
  L2MemoryRouteHidden,
  L2MemoryRouteReview,
  L2SearchPlan,
  L2SearchRequest,
  L2SearchResult,
  LedgerWriteReason,
  LifecycleState,
  MAX_LEDGER_CONTENT_CHARACTERS,
  MAX_LEDGER_PLAYBOOK_BODY_CHARACTERS,
  MAX_LEDGER_SLOT_CHARACTERS,
  MAX_LEDGER_TRIGGER_CONDITION_CHARACTERS,
  MAX_LEDGER_TRIGGER_CONDITION_KEYS,
  MemoryContractError,
  MemoryExtractionError,
  MemoryKind,
  MemorySubjectScope,
  MemoryTier,
  SourceBackedMemoryCandidate,
  TargetVisibility,
  WorkingMemoryObservation,
  WorkingObservation,
  WorkingObservationArchiveItem,
  WorkingObservationExtractionError,
  canonicalJson,
  decodeL1MemoryArchiveItem,
  deriveAllowedUse,
  deriveArchivePolicy,
  deriveReadPolicy,
  deterministicContractId,
  durablePatchIssue,
  filterL1ArchiveForNormalSearch,
  l2SearchPlanIssue,
  memoryExtractionError,
  normalizeSourceBackedCandidate,
  workingObservationExtractionError,
} from "../../beep/MemoryContracts.ts";

const isMemoryExtractionError = S.is(MemoryExtractionError);
const isWorkingObservationExtractionError = S.is(WorkingObservationExtractionError);
const encodeEvidenceRef = S.encodeEffect(EvidenceRef);
const encodeL1MemoryArchiveItemWire = S.encodeEffect(L1MemoryArchiveItemWire);
const encodeWorkingMemoryObservation = S.encodeEffect(WorkingMemoryObservation);
const encodeL2SearchResult = S.encodeEffect(L2SearchResult);
const isL2MemoryRouteDurable = S.is(L2MemoryRouteDurable);
const isL2MemoryRouteReview = S.is(L2MemoryRouteReview);
const isL2MemoryRouteDiscard = S.is(L2MemoryRouteDiscard);
const isL2MemoryRouteHidden = S.is(L2MemoryRouteHidden);
const encodeL2MemoryRoute = S.encodeEffect(L2MemoryRoute);
const encodeDurableMemoryPatch = S.encodeEffect(DurableMemoryPatch);

const decode = <Sch extends S.Codec<unknown, unknown, never, unknown>>(schema: Sch, input: unknown): Sch["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const failMessage = <A>(effect: Effect.Effect<A, MemoryContractError>): string => {
  const exit = effect.pipe(Effect.flip, Effect.runSyncExit);
  return exit._tag === "Success" ? exit.value.message : "did not fail";
};

const iso = "2026-01-02T03:04:05.000Z";
const later = "2026-01-03T03:04:05.000Z";
const at = decode(S.DateTimeUtcFromString, iso);
const atLater = decode(S.DateTimeUtcFromString, later);

describe("constants and literals", () => {
  it("expose the ledger limits and fact source", () => {
    assert.strictEqual(DURABLE_MEMORY_PATCH_FACT_SOURCE, "durable_memory_patch");
    assert.strictEqual(MAX_LEDGER_CONTENT_CHARACTERS, 4000);
    assert.strictEqual(MAX_LEDGER_PLAYBOOK_BODY_CHARACTERS, 24000);
    assert.strictEqual(MAX_LEDGER_SLOT_CHARACTERS, 64);
    assert.strictEqual(MAX_LEDGER_TRIGGER_CONDITION_KEYS, 13);
    assert.strictEqual(MAX_LEDGER_TRIGGER_CONDITION_CHARACTERS, 8000);
  });

  it("closed unions accept every member and reject strangers", () => {
    const table: ReadonlyArray<readonly [S.Codec<string, unknown, never, unknown>, ReadonlyArray<string>]> = [
      [MemoryTier, ["short_term", "long_term", "archive"]],
      [MemoryKind, ["fact", "document", "trigger"]],
      [MemorySubjectScope, ["primary_user", "user_owned_project", "user_relationship", "third_party"]],
      [
        LedgerWriteReason,
        [
          "direct_user_statement",
          "explicit_remember",
          "agent_reusable_conclusion",
          "recurring_workflow",
          "standing_trigger",
          "onboarding",
          "daily_reconciliation",
          "legacy_migration",
        ],
      ],
      [LifecycleState, ["working", "active", "context_only", "review", "superseded", "rejected", "hidden"]],
      [
        DurablePatchDecision,
        ["add", "update", "merge", "add_evidence", "keep_both", "skip_duplicate", "context_only", "reject", "review"],
      ],
      [ConfidenceBand, ["high", "medium", "low"]],
      [L1MemoryArchiveClass, ["general", "sensitive"]],
      [
        L2DropReason,
        [
          "ephemeral_chatter",
          "third_party_or_unknown_speaker",
          "ui_or_ocr_context",
          "unsupported_or_too_noisy",
          "secret_or_security_sensitive",
          "duplicate",
          "not_future_useful",
          "missing_user_tie",
        ],
      ],
      [TargetVisibility, ["private", "public", "shared"]],
    ];
    for (const [schema, members] of table) {
      for (const member of members) assert.strictEqual(decode(schema, member), member);
      assert.strictEqual(decodeFails(schema, "not-a-member"), true);
    }
  });
});

describe("canonicalJson and deterministicContractId", () => {
  it("sorts keys, escapes strings, and drops non-finite numbers", () => {
    assert.strictEqual(canonicalJson({ b: 1, a: [true, null, "x"] }), '{"a":[true,null,"x"],"b":1}');
    assert.strictEqual(canonicalJson("quote\" back\\ nl\n tab\t é 😀"), '"quote\\" back\\\\ nl\\n tab\\t \\u00e9 \\ud83d\\ude00"');
    assert.strictEqual(canonicalJson(Number.POSITIVE_INFINITY), "null");
    assert.strictEqual(canonicalJson(null), "null");
    assert.strictEqual(canonicalJson(false), "false");
    assert.strictEqual(canonicalJson({}), "{}");
  });

  it("hashes namespace|canonical json with sha256", () => {
    const expected = createHash("sha256").update('ns|{"a":1}', "utf8").digest("hex");
    assert.strictEqual(deterministicContractId("ns", { a: 1 }), expected);
    assert.strictEqual(deterministicContractId("ns", { a: 1 }), deterministicContractId("ns", { a: 1 }));
    assert.notStrictEqual(deterministicContractId("other", { a: 1 }), expected);
  });
});

describe("errors", () => {
  it("build tagged errors with the Python messages", () => {
    const defaulted = memoryExtractionError("extractor_x");
    assert.strictEqual(isMemoryExtractionError(defaulted), true);
    assert.strictEqual(defaulted.message, "extractor_x failed before producing a valid extraction result");
    assert.strictEqual(memoryExtractionError("extractor_x", { message: "custom" }).message, "custom");
    const piped = pipe("extractor_x", memoryExtractionError());
    assert.deepStrictEqual(piped, defaulted);
    assert.strictEqual(piped.extractor, defaulted.extractor);
    const custom = memoryExtractionError("extractor_x", { message: "custom" });
    const pipedCustom = pipe("extractor_x", memoryExtractionError({ message: "custom" }));
    assert.deepStrictEqual(pipedCustom, custom);
    assert.strictEqual(pipedCustom.extractor, custom.extractor);
    const staged = workingObservationExtractionError("parse");
    assert.strictEqual(isWorkingObservationExtractionError(staged), true);
    assert.strictEqual(staged.extractor, "working_observation_extractor");
    assert.strictEqual(staged.message, "working observation extraction failed during parse");
  });
});

describe("deriveAllowedUse", () => {
  it("maps each lifecycle status and hides secrets", () => {
    const use = (status: string, flags: ReadonlyArray<string> = []) => Effect.runSync(deriveAllowedUse(status, flags));
    assert.strictEqual(use("working"), "read_with_status");
    assert.strictEqual(use("active"), "stable_profile_fact");
    assert.strictEqual(use("context_only"), "context_only");
    assert.strictEqual(use("review"), "review_only");
    assert.strictEqual(use("superseded"), "history_only");
    assert.strictEqual(use("rejected"), "audit_only");
    assert.strictEqual(use("hidden"), "hidden");
    assert.strictEqual(use("active", ["Secret"]), "hidden");
    assert.strictEqual(use("active", ["pii_secret"]), "hidden");
    assert.strictEqual(use("active", ["pii"]), "stable_profile_fact");
    assert.strictEqual(failMessage(deriveAllowedUse("archived")), "unknown lifecycle status: archived");
  });
});

describe("EvidenceRef", () => {
  it("decodes present, null, and missing values", () => {
    const full = decode(EvidenceRef, {
      evidenceId: "ev-1",
      sourceId: "conv-1",
      sourceType: "conversation",
      quote: "hi",
      artifactRef: { uri: "gs://x" },
    });
    assert.strictEqual(O.getOrNull(full.quote), "hi");
    const nulled = decode(EvidenceRef, { evidenceId: "ev-1", sourceId: null, sourceType: null, quote: null, artifactRef: {} });
    assert.strictEqual(O.isNone(nulled.sourceId), true);
    const missing = decode(EvidenceRef, { evidenceId: "ev-1", artifactRef: {} });
    assert.strictEqual(O.isNone(missing.sourceType), true);
    assert.strictEqual(O.isNone(missing.quote), true);
    const encoded = Effect.runSync(encodeEvidenceRef(missing));
    assert.strictEqual(encoded.sourceId, null);
    assert.strictEqual(encoded.quote, null);
    assert.deepStrictEqual(EvidenceRef.make({ evidenceId: "ev-2" }).artifactRef, {});
  });
});

const archiveWire = {
  schemaVersion: "l1_memory_archive_item.v1",
  archiveId: "",
  userId: "user-1",
  sourceId: "conv-1",
  sourceType: "conversation",
  text: "  Ada mentioned a trip to Tokyo  ",
  class: "general",
  sourceRefs: [{ id: "conv-1" }],
  evidenceQuotes: ["trip to Tokyo"],
  speakerLabel: "SPEAKER_0",
  speakerScope: "session-local",
  about: "",
  subjectScope: null,
  beliefClass: null,
  halfLifeDays: 30,
  validTo: iso,
  confidence: "medium",
  riskFlags: [],
  allowedUse: null,
  normalSearchAllowed: true,
  isStableProfileFact: false,
  searchResultLabel: "archived_evidence_not_stable_memory",
  extractorVersion: "short_term_archive_llm_v1",
};

describe("L1MemoryArchiveItem", () => {
  it("decodes the wire form with class renamed and strips text", () => {
    const item = decode(L1MemoryArchiveItemWire, archiveWire);
    assert.strictEqual(item.archiveClass, "general");
    assert.strictEqual(item.text, "Ada mentioned a trip to Tokyo");
    assert.strictEqual(O.getOrNull(item.speakerLabel), "SPEAKER_0");
    assert.strictEqual(O.getOrNull(item.halfLifeDays), 30);
    assert.strictEqual(O.isNone(item.subjectScope), true);
    assert.strictEqual(O.isNone(item.allowedUse), true);
    assert.strictEqual(DateTime.formatIso(item.validTo.pipe(O.getOrThrow)), iso);
    const encoded = Effect.runSync(encodeL1MemoryArchiveItemWire(item));
    assert.strictEqual(encoded.class, "general");
    assert.strictEqual(encoded.subjectScope, null);
    assert.strictEqual(encoded.allowedUse, null);
    assert.strictEqual(decodeFails(L1MemoryArchiveItemWire, { ...archiveWire, text: "   " }), true);
    assert.strictEqual(decodeFails(L1MemoryArchiveItemWire, { ...archiveWire, class: "secret" }), true);
  });

  it("constructor defaults match the Python defaults", () => {
    const made = L1MemoryArchiveItem.make({ text: "hello" });
    assert.strictEqual(made.schemaVersion, "l1_memory_archive_item.v1");
    assert.strictEqual(made.archiveId, "");
    assert.strictEqual(made.archiveClass, "general");
    assert.strictEqual(made.speakerScope, "session-local");
    assert.strictEqual(made.about, "");
    assert.strictEqual(made.confidence, "medium");
    assert.strictEqual(made.normalSearchAllowed, true);
    assert.strictEqual(made.isStableProfileFact, false);
    assert.strictEqual(made.searchResultLabel, "archived_evidence_not_stable_memory");
    assert.strictEqual(made.extractorVersion, "short_term_archive_llm_v1");
    assert.strictEqual(O.isNone(made.validTo), true);
    assert.strictEqual(WorkingObservationArchiveItem, L1MemoryArchiveItem);
  });

  it("deriveArchivePolicy mints an id and splits general from sensitive", () => {
    const general = deriveArchivePolicy(decode(L1MemoryArchiveItemWire, archiveWire));
    assert.strictEqual(Str.startsWith("l1_")(general.archiveId), true);
    assert.strictEqual(general.archiveId.length, 23);
    assert.strictEqual(general.archiveClass, "general");
    assert.strictEqual(general.normalSearchAllowed, true);
    assert.strictEqual(O.getOrNull(general.allowedUse), "archive_search");
    assert.strictEqual(general.isStableProfileFact, false);
    assert.strictEqual(deriveArchivePolicy(decode(L1MemoryArchiveItemWire, archiveWire)).archiveId, general.archiveId);

    const keepsId = deriveArchivePolicy(decode(L1MemoryArchiveItemWire, { ...archiveWire, archiveId: "l1_fixed" }));
    assert.strictEqual(keepsId.archiveId, "l1_fixed");

    const byFlag = deriveArchivePolicy(decode(L1MemoryArchiveItemWire, { ...archiveWire, riskFlags: ["CREDENTIAL"] }));
    assert.strictEqual(byFlag.archiveClass, "sensitive");
    assert.strictEqual(byFlag.normalSearchAllowed, false);
    assert.strictEqual(O.getOrNull(byFlag.allowedUse), "restricted_archive_only");

    const byClass = deriveArchivePolicy(
      decode(L1MemoryArchiveItemWire, { ...archiveWire, class: "sensitive", isStableProfileFact: true }),
    );
    assert.strictEqual(byClass.archiveClass, "sensitive");
    assert.strictEqual(byClass.isStableProfileFact, false);
  });

  it("decodeL1MemoryArchiveItem accepts class or archive_class and derives policy", () => {
    const fromClass = Effect.runSync(decodeL1MemoryArchiveItem(archiveWire));
    assert.strictEqual(O.getOrNull(fromClass.allowedUse), "archive_search");
    const { class: _dropped, ...rest } = archiveWire;
    const fromSnake = Effect.runSync(decodeL1MemoryArchiveItem({ ...rest, archive_class: "sensitive" }));
    assert.strictEqual(fromSnake.archiveClass, "sensitive");
    assert.strictEqual(O.getOrNull(fromSnake.allowedUse), "restricted_archive_only");
    assert.strictEqual(Effect.runSyncExit(decodeL1MemoryArchiveItem({ ...rest }))._tag, "Failure");
    assert.strictEqual(Effect.runSyncExit(decodeL1MemoryArchiveItem("nope"))._tag, "Failure");
  });

  it("filterL1ArchiveForNormalSearch keeps general searchable items and ranks by term hits", () => {
    const build = (patch: Record<string, unknown>) =>
      deriveArchivePolicy(decode(L1MemoryArchiveItemWire, { ...archiveWire, ...patch }));
    const tokyo = build({ archiveId: "b", text: "Trip to Tokyo", evidenceQuotes: ["tokyo hotel"] });
    const kyoto = build({ archiveId: "a", text: "Trip to Kyoto", evidenceQuotes: [] });
    const secret = build({ archiveId: "c", text: "Trip to Tokyo", riskFlags: ["secret"] });
    const blocked = L1MemoryArchiveItem.make({ ...build({ archiveId: "d", text: "Trip to Tokyo" }), normalSearchAllowed: false });
    const all = [kyoto, tokyo, secret, blocked];
    assert.deepStrictEqual(
      filterL1ArchiveForNormalSearch(all).map((item) => item.archiveId),
      ["a", "b"],
    );
    assert.deepStrictEqual(
      filterL1ArchiveForNormalSearch(all, "  ").map((item) => item.archiveId),
      ["a", "b"],
    );
    assert.deepStrictEqual(
      filterL1ArchiveForNormalSearch(all, "trip tokyo").map((item) => item.archiveId),
      ["b", "a"],
    );
    assert.deepStrictEqual(
      filterL1ArchiveForNormalSearch(all, "trip").map((item) => item.archiveId),
      ["b", "a"],
    );
    assert.deepStrictEqual(filterL1ArchiveForNormalSearch(all, "mars"), []);
    assert.deepStrictEqual(pipe(all, filterL1ArchiveForNormalSearch()), filterL1ArchiveForNormalSearch(all));
    assert.deepStrictEqual(
      pipe(all, filterL1ArchiveForNormalSearch("trip tokyo")),
      filterL1ArchiveForNormalSearch(all, "trip tokyo"),
    );
  });
});

const observationWire = {
  schemaVersion: "working_memory_observation.v1",
  observationId: "obs-1",
  packetId: "packet-1",
  content: "Ada likes tea",
  evidenceIds: ["ev-1"],
  sourceRefs: [],
  subjectEntityId: null,
  subjectScope: "primary_user",
  literalObservation: "I like tea",
  speakerAttribution: "user",
  sourceMode: "voice",
  relationshipToUser: "primary_user",
  subject: "user",
  interpretationLevel: "light",
  whyCaptured: null,
  status: "working",
  confidence: "high",
  riskFlags: [],
  routeHint: null,
  allowedUse: null,
  predicate: "likes",
  arguments: { object: "tea" },
  qualifiers: {},
  extractorVersion: "short_term_llm_observation_extractor_v1",
};

describe("WorkingMemoryObservation", () => {
  it("decodes present values and normalizes the aliased fields", () => {
    const observation = decode(WorkingMemoryObservation, observationWire);
    assert.strictEqual(observation.speakerAttribution, "primary_user");
    assert.strictEqual(observation.sourceMode, "conversation");
    assert.strictEqual(observation.relationshipToUser, "self");
    assert.strictEqual(observation.subject, "self");
    assert.strictEqual(observation.interpretationLevel, "light_inference");
    assert.strictEqual(O.getOrNull(observation.packetId), "packet-1");
    assert.strictEqual(O.getOrNull(observation.literalObservation), "I like tea");
    assert.strictEqual(O.isNone(observation.subjectEntityId), true);
    assert.strictEqual(O.isNone(observation.whyCaptured), true);
    assert.strictEqual(WorkingObservation, WorkingMemoryObservation);
  });

  it("falls back on unknown aliases and blanks", () => {
    const observation = decode(WorkingMemoryObservation, {
      ...observationWire,
      speakerAttribution: "Robot",
      sourceMode: "",
      relationshipToUser: "cousin",
      subject: "  ",
      interpretationLevel: "wild",
    });
    assert.strictEqual(observation.speakerAttribution, "unknown");
    assert.strictEqual(observation.sourceMode, "unclear");
    assert.strictEqual(observation.relationshipToUser, "unclear");
    assert.strictEqual(observation.subject, "unclear");
    assert.strictEqual(observation.interpretationLevel, "literal");
    const passthrough = decode(WorkingMemoryObservation, { ...observationWire, subject: "Marathon training" });
    assert.strictEqual(passthrough.subject, "Marathon training");
    assert.strictEqual(decode(WorkingMemoryObservation, { ...observationWire, subject: "project" }).subject, "owned_project");
    assert.strictEqual(decode(WorkingMemoryObservation, { ...observationWire, sourceMode: "OCR" }).sourceMode, "ui_or_ocr");
  });

  it("missing Option fields decode to None, defaults apply, and None encodes as null", () => {
    const observation = decode(WorkingMemoryObservation, {
      schemaVersion: "working_memory_observation.v1",
      observationId: "",
      content: "text",
      evidenceIds: [],
      sourceRefs: [],
      subjectScope: "primary_user",
      speakerAttribution: "unknown",
      sourceMode: "unclear",
      relationshipToUser: "unclear",
      subject: "unclear",
      interpretationLevel: "literal",
      status: "active",
      confidence: "low",
      riskFlags: [],
      arguments: {},
      qualifiers: {},
      extractorVersion: "x",
    });
    assert.strictEqual(O.isNone(observation.packetId), true);
    assert.strictEqual(O.isNone(observation.routeHint), true);
    assert.strictEqual(O.isNone(observation.predicate), true);
    const encoded = Effect.runSync(encodeWorkingMemoryObservation(observation));
    assert.strictEqual(encoded.packetId, null);
    assert.strictEqual(encoded.allowedUse, null);
    const made = WorkingMemoryObservation.make({ content: "text" });
    assert.strictEqual(made.status, "working");
    assert.strictEqual(made.speakerAttribution, "unknown");
    assert.strictEqual(made.sourceMode, "unclear");
    assert.strictEqual(made.relationshipToUser, "unclear");
    assert.strictEqual(made.subject, "unclear");
    assert.strictEqual(made.interpretationLevel, "literal");
    assert.strictEqual(made.confidence, "medium");
    assert.strictEqual(made.subjectScope, "primary_user");
    assert.strictEqual(decodeFails(WorkingMemoryObservation, { ...observationWire, status: "archived" }), true);
    assert.strictEqual(decodeFails(WorkingMemoryObservation, { ...observationWire, confidence: "sure" }), true);
  });

  it("deriveReadPolicy stamps allowedUse from status and risk flags", () => {
    const active = Effect.runSync(deriveReadPolicy(WorkingMemoryObservation.make({ content: "x", status: "active" })));
    assert.strictEqual(O.getOrNull(active.allowedUse), "stable_profile_fact");
    const secret = Effect.runSync(
      deriveReadPolicy(WorkingMemoryObservation.make({ content: "x", status: "active", riskFlags: ["secret"] })),
    );
    assert.strictEqual(O.getOrNull(secret.allowedUse), "hidden");
    const working = Effect.runSync(deriveReadPolicy(WorkingMemoryObservation.make({ content: "x" })));
    assert.strictEqual(O.getOrNull(working.allowedUse), "read_with_status");
  });
});

const candidateWire = {
  schemaVersion: "source_backed_memory_candidate.v1",
  candidateId: " cand-1 ",
  userId: "user-1",
  sourceId: "conv-1",
  sourceType: "conversation",
  sourceVersion: "v1",
  text: "Ada likes tea",
  evidenceIds: ["ev-1"],
  sourceRefs: [],
  capturedAt: iso,
  expiresAt: later,
  initialTier: "long_term",
  archiveId: "l1_x",
  defaultAccessCandidate: true,
  riskFlags: [],
  extractorVersion: "source_backed_candidate_v1",
};

describe("SourceBackedMemoryCandidate", () => {
  it("decodes and strips, and defaults at construction", () => {
    const candidate = decode(SourceBackedMemoryCandidate, candidateWire);
    assert.strictEqual(candidate.candidateId, "cand-1");
    assert.strictEqual(candidate.initialTier, "long_term");
    assert.strictEqual(O.getOrNull(candidate.archiveId), "l1_x");
    const made = SourceBackedMemoryCandidate.make({
      candidateId: "c",
      userId: "u",
      sourceId: "s",
      sourceType: "t",
      sourceVersion: "v",
      text: "x",
      capturedAt: at,
      expiresAt: atLater,
    });
    assert.strictEqual(made.initialTier, "short_term");
    assert.strictEqual(made.defaultAccessCandidate, true);
    assert.strictEqual(O.isNone(made.archiveId), true);
    assert.strictEqual(decodeFails(SourceBackedMemoryCandidate, { ...candidateWire, text: " " }), true);
    assert.strictEqual(decodeFails(SourceBackedMemoryCandidate, { ...candidateWire, archiveId: null }), false);
  });

  it("normalizeSourceBackedCandidate rewrites non-archive tiers and keeps archive", () => {
    const rewritten = Effect.runSync(normalizeSourceBackedCandidate(decode(SourceBackedMemoryCandidate, candidateWire)));
    assert.strictEqual(rewritten.initialTier, "short_term");
    assert.strictEqual(O.isNone(rewritten.archiveId), true);
    assert.strictEqual(rewritten.defaultAccessCandidate, true);
    const secret = Effect.runSync(
      normalizeSourceBackedCandidate(decode(SourceBackedMemoryCandidate, { ...candidateWire, riskFlags: ["security_sensitive"] })),
    );
    assert.strictEqual(secret.defaultAccessCandidate, false);
    const archive = Effect.runSync(
      normalizeSourceBackedCandidate(decode(SourceBackedMemoryCandidate, { ...candidateWire, initialTier: "archive" })),
    );
    assert.strictEqual(archive.initialTier, "archive");
    assert.strictEqual(O.getOrNull(archive.archiveId), "l1_x");
    assert.strictEqual(archive.defaultAccessCandidate, false);
    assert.strictEqual(
      failMessage(
        normalizeSourceBackedCandidate(decode(SourceBackedMemoryCandidate, { ...candidateWire, expiresAt: iso })),
      ),
      "expires_at must be after captured_at",
    );
  });
});

describe("L2 search contracts", () => {
  it("L2SearchRequest bounds maxResults 1..5 and defaults", () => {
    const request = decode(L2SearchRequest, { query: " tea ", reason: "why", searchType: "semantic", maxResults: 3 });
    assert.strictEqual(request.query, "tea");
    assert.strictEqual(request.maxResults, 3);
    assert.strictEqual(decodeFails(L2SearchRequest, { query: "q", reason: "r", searchType: "semantic", maxResults: 0 }), true);
    assert.strictEqual(decodeFails(L2SearchRequest, { query: "q", reason: "r", searchType: "semantic", maxResults: 6 }), true);
    assert.strictEqual(decodeFails(L2SearchRequest, { query: " ", reason: "r", searchType: "semantic", maxResults: 1 }), true);
    const made = L2SearchRequest.make({ query: "q", reason: "r" });
    assert.strictEqual(made.searchType, "semantic");
    assert.strictEqual(made.maxResults, 5);
  });

  it("L2SearchResult decodes present, null, and missing values", () => {
    const hit = decode(L2SearchResult, {
      resultId: "r1",
      contentHash: "h",
      status: "active",
      source: "vector",
      score: 0.5,
      content: "text",
      metadata: { k: 1 },
    });
    assert.strictEqual(O.getOrNull(hit.score), 0.5);
    const bare = decode(L2SearchResult, { resultId: "r1", contentHash: "h", status: "review", source: "vector", metadata: {} });
    assert.strictEqual(O.isNone(bare.score), true);
    assert.strictEqual(O.isNone(bare.content), true);
    const encoded = Effect.runSync(encodeL2SearchResult(bare));
    assert.strictEqual(encoded.score, null);
    assert.strictEqual(encoded.content, null);
    assert.strictEqual(decodeFails(L2SearchResult, { ...bare, score: null, content: null }), false);
  });

  it("L2SearchPlan bounds the budget and the checked plan enforces its rules", () => {
    const search = { query: "q", reason: "r", searchType: "semantic", maxResults: 1 };
    const wire = {
      schemaVersion: "l2_custom_search_plan.v1",
      packetId: "packet-1",
      searchBudget: 1,
      searches: [search],
      sameUserOnly: true,
      readOnly: true,
    };
    const plan = decode(L2SearchPlan, wire);
    assert.strictEqual(l2SearchPlanIssue(plan), undefined);
    const single = decode(L2SearchRequest, search);
    assert.strictEqual(l2SearchPlanIssue(L2SearchPlan.make({ ...plan, searches: [single, single] })), "searches exceed search_budget");
    assert.strictEqual(l2SearchPlanIssue(L2SearchPlan.make({ ...plan, sameUserOnly: false })), "same_user_only must be true");
    assert.strictEqual(l2SearchPlanIssue(L2SearchPlan.make({ ...plan, readOnly: false })), "read_only must be true");
    assert.strictEqual(decodeFails(L2SearchPlan, { ...wire, searchBudget: 4 }), true);
    assert.strictEqual(decodeFails(L2SearchPlan, { ...wire, packetId: " " }), true);
    assert.strictEqual(decodeFails(CheckedL2SearchPlan, wire), false);
    assert.strictEqual(decodeFails(CheckedL2SearchPlan, { ...wire, searches: [search, search] }), true);
    assert.strictEqual(decodeFails(CheckedL2SearchPlan, { ...wire, readOnly: false }), true);
    assert.strictEqual(decodeFails(L2SearchPlan, { ...wire, readOnly: false }), false);
    const made = L2SearchPlan.make({ packetId: "p" });
    assert.strictEqual(made.searchBudget, 3);
    assert.deepStrictEqual(made.searches, []);
    assert.strictEqual(made.sameUserOnly, true);
    assert.strictEqual(made.readOnly, true);
  });
});

describe("L2MemoryRoute tagged union", () => {
  const routeBase = { schemaVersion: "l2_memory_route.v1", confidence: "medium", reason: "because" };

  it("decodes every member on route", () => {
    const durable = decode(L2MemoryRoute, { ...routeBase, route: "durable", memoryText: " text ", evidenceQuotes: ["q"] });
    assert.strictEqual(durable.route, "durable");
    assert.strictEqual(isL2MemoryRouteDurable(durable), true);
    assert.strictEqual(durable.memoryText, "text");

    const review = decode(L2MemoryRoute, { ...routeBase, route: "review", memoryText: "text", evidenceQuotes: ["q"] });
    assert.strictEqual(isL2MemoryRouteReview(review), true);

    const discard = decode(L2MemoryRoute, {
      ...routeBase,
      route: "discard",
      memoryText: null,
      evidenceQuotes: [],
      dropReason: "duplicate",
    });
    assert.strictEqual(isL2MemoryRouteDiscard(discard), true);
    assert.strictEqual(discard.route === "discard" && O.isNone(discard.memoryText), true);
    assert.strictEqual(discard.route === "discard" && discard.dropReason === "duplicate", true);

    const hidden = decode(L2MemoryRoute, {
      ...routeBase,
      route: "hidden",
      evidenceQuotes: [],
      dropReason: "secret_or_security_sensitive",
    });
    assert.strictEqual(isL2MemoryRouteHidden(hidden), true);
    assert.strictEqual(hidden.route === "hidden" && O.isNone(hidden.memoryText), true);
    const encodedHidden = Effect.runSync(encodeL2MemoryRoute(hidden));
    assert.strictEqual(encodedHidden.route, "hidden");
    assert.strictEqual(encodedHidden.route === "hidden" && encodedHidden.memoryText === null, true);
  });

  it("rejects an unknown route and shape violations per member", () => {
    assert.strictEqual(decodeFails(L2MemoryRoute, { ...routeBase, route: "keep", memoryText: "t", evidenceQuotes: ["q"] }), true);
    assert.strictEqual(decodeFails(L2MemoryRoute, { ...routeBase, route: "durable", memoryText: "t", evidenceQuotes: [] }), true);
    assert.strictEqual(decodeFails(L2MemoryRoute, { ...routeBase, route: "review", memoryText: " ", evidenceQuotes: ["q"] }), true);
    assert.strictEqual(decodeFails(L2MemoryRoute, { ...routeBase, route: "discard", evidenceQuotes: [], dropReason: "nope" }), true);
    assert.strictEqual(
      decodeFails(L2MemoryRoute, { ...routeBase, route: "hidden", evidenceQuotes: [], dropReason: "duplicate" }),
      true,
    );
    const madeHidden = L2MemoryRouteHidden.make({ reason: "r" });
    assert.strictEqual(madeHidden.dropReason, "secret_or_security_sensitive");
    assert.strictEqual(madeHidden.schemaVersion, "l2_memory_route.v1");
    assert.strictEqual(madeHidden.confidence, "medium");
  });
});

const patchWire = {
  schemaVersion: "durable_memory_patch.v1",
  patchId: "patch-1",
  packetId: "packet-1",
  runId: "run-1",
  idempotencyKey: "idem-1",
  decision: "add",
  memoryText: "Ada likes tea",
  newMemoryId: null,
  targetMemoryId: null,
  evidenceIds: ["ev-1"],
  evidenceRefs: [],
  resultStatus: "active",
  confidence: "high",
  visibility: "private",
  userAsserted: false,
  initialTier: "short_term",
  supersedes: [],
  subjectEntityId: null,
  predicate: null,
  arguments: {},
  rationale: "user said so",
  relationshipToUser: "self",
  subjectLabel: null,
  aboutness: "primary_user",
  validFrom: iso,
  validTo: null,
  targetTier: null,
  targetVisibility: null,
  targetUserAsserted: null,
  clearGraphAssertion: false,
  mutationMetadata: null,
  observedHeadCommitId: null,
  halfLifeDays: null,
  beliefClass: null,
  curationWeight: 0,
  ledgerSchemaVersion: null,
  kind: "fact",
  subjectScope: "primary_user",
  slot: null,
  body: null,
  triggerCondition: {},
  writeReason: null,
  intentBacked: false,
};

const ledgerWire = {
  ...patchWire,
  initialTier: "long_term",
  ledgerSchemaVersion: "knowledge_ledger.v1",
  writeReason: "explicit_remember",
  intentBacked: true,
};

describe("DurableMemoryPatch", () => {
  it("decodes present values, null and missing Options, and encodes None as null", () => {
    const patch = decode(DurableMemoryPatch, patchWire);
    assert.strictEqual(patch.decision, "add");
    assert.strictEqual(O.getOrNull(patch.memoryText), "Ada likes tea");
    assert.strictEqual(O.getOrNull(patch.rationale), "user said so");
    assert.strictEqual(DateTime.formatIso(patch.validFrom.pipe(O.getOrThrow)), iso);
    assert.strictEqual(O.isNone(patch.validTo), true);
    assert.strictEqual(O.isNone(patch.observedHeadCommitId), true);
    assert.strictEqual(O.isNone(patch.targetTier), true);
    assert.strictEqual(O.isNone(patch.writeReason), true);
    const { validTo: _validTo, targetTier: _targetTier, slot: _slot, writeReason: _writeReason, ...rest } = patchWire;
    const missing = decode(DurableMemoryPatch, rest);
    assert.strictEqual(O.isNone(missing.validTo), true);
    assert.strictEqual(O.isNone(missing.targetTier), true);
    assert.strictEqual(O.isNone(missing.slot), true);
    assert.strictEqual(O.isNone(missing.writeReason), true);
    const encoded = Effect.runSync(encodeDurableMemoryPatch(missing));
    assert.strictEqual(encoded.validTo, null);
    assert.strictEqual(encoded.targetTier, null);
    assert.strictEqual(encoded.slot, null);
    assert.strictEqual(encoded.writeReason, null);
    assert.strictEqual(encoded.observedHeadCommitId, null);
    const { observedHeadCommitId: _head, ...noHead } = patchWire;
    assert.strictEqual(decodeFails(DurableMemoryPatch, noHead), true);
    assert.strictEqual(decodeFails(DurableMemoryPatch, { ...patchWire, decision: "drop" }), true);
    assert.strictEqual(decodeFails(DurableMemoryPatch, { ...patchWire, aboutness: "someone" }), true);
    assert.strictEqual(decodeFails(DurableMemoryPatch, { ...patchWire, targetVisibility: "team" }), true);
  });

  it("constructor defaults match the Python defaults", () => {
    const made = DurableMemoryPatch.make({
      patchId: "p",
      packetId: "k",
      runId: "r",
      idempotencyKey: "i",
      decision: "reject",
      resultStatus: "rejected",
      observedHeadCommitId: O.none(),
    });
    assert.strictEqual(made.schemaVersion, "durable_memory_patch.v1");
    assert.strictEqual(made.confidence, "medium");
    assert.strictEqual(made.visibility, "private");
    assert.strictEqual(made.userAsserted, false);
    assert.strictEqual(made.initialTier, "short_term");
    assert.strictEqual(made.relationshipToUser, "unclear");
    assert.strictEqual(made.aboutness, "unclear");
    assert.strictEqual(made.clearGraphAssertion, false);
    assert.strictEqual(made.curationWeight, 0);
    assert.strictEqual(made.kind, "fact");
    assert.strictEqual(made.subjectScope, "primary_user");
    assert.strictEqual(made.intentBacked, false);
    assert.deepStrictEqual(made.triggerCondition, {});
  });

  const issue = (patch: Record<string, unknown>): string | undefined =>
    durablePatchIssue(decode(DurableMemoryPatch, { ...patchWire, ...patch }));
  const ledgerIssue = (patch: Record<string, unknown>): string | undefined =>
    durablePatchIssue(decode(DurableMemoryPatch, { ...ledgerWire, ...patch }));

  it("enforces the non-ledger contract rules", () => {
    assert.strictEqual(issue({}), undefined);
    assert.strictEqual(
      issue({ initialTier: "long_term" }),
      "Long-term memory cannot be created directly; promote an existing Short-term item",
    );
    for (const decision of ["merge", "update", "add_evidence", "skip_duplicate"]) {
      assert.strictEqual(
        issue({ decision }),
        "target_memory_id is required for merge/update/add_evidence/skip_duplicate decisions",
      );
      assert.strictEqual(issue({ decision, targetMemoryId: "mem-1" }), undefined);
    }
    assert.strictEqual(issue({ memoryText: null }), "add decisions require memory_text or new_memory_id");
    assert.strictEqual(issue({ memoryText: null, newMemoryId: "mem-9" }), undefined);
    assert.strictEqual(issue({ evidenceIds: [] }), "active/review patches require exact supporting evidence ids or refs");
    assert.strictEqual(issue({ evidenceIds: [], resultStatus: "review" }), "active/review patches require exact supporting evidence ids or refs");
    assert.strictEqual(
      issue({ evidenceIds: [], evidenceRefs: [{ evidenceId: "ev-1", artifactRef: {} }] }),
      undefined,
    );
    assert.strictEqual(issue({ evidenceIds: [], resultStatus: "rejected", decision: "reject" }), undefined);
  });

  it("enforces the knowledge-ledger rules", () => {
    assert.strictEqual(ledgerIssue({}), undefined);
    assert.strictEqual(
      ledgerIssue({ initialTier: "short_term" }),
      "knowledge ledger rows use the long_term compatibility projection",
    );
    assert.strictEqual(
      ledgerIssue({ decision: "update", targetMemoryId: "mem-1", targetTier: "short_term" }),
      "knowledge ledger updates may not enter the short_term lifecycle",
    );
    assert.strictEqual(ledgerIssue({ decision: "update", targetMemoryId: "mem-1", targetTier: "long_term" }), undefined);
    assert.strictEqual(ledgerIssue({ writeReason: null }), "knowledge ledger rows require an intent-backed write reason");
    assert.strictEqual(
      ledgerIssue({ intentBacked: false }),
      "knowledge ledger rows require an intent-backed write reason",
    );
    assert.strictEqual(ledgerIssue({ intentBacked: false, writeReason: "legacy_migration" }), undefined);
    assert.strictEqual(
      ledgerIssue({ memoryText: "x".repeat(MAX_LEDGER_CONTENT_CHARACTERS + 1) }),
      "knowledge ledger content exceeds the ledger limit",
    );
    assert.strictEqual(
      ledgerIssue({ slot: "s".repeat(MAX_LEDGER_SLOT_CHARACTERS + 1) }),
      "knowledge ledger slot exceeds the ledger limit",
    );
    assert.strictEqual(ledgerIssue({ slot: "s".repeat(MAX_LEDGER_SLOT_CHARACTERS) }), undefined);
    assert.strictEqual(ledgerIssue({ kind: "document" }), "ledger documents require a non-empty body");
    assert.strictEqual(ledgerIssue({ kind: "document", body: "  " }), "ledger documents require a non-empty body");
    assert.strictEqual(
      ledgerIssue({ kind: "document", body: "b".repeat(MAX_LEDGER_PLAYBOOK_BODY_CHARACTERS + 1) }),
      "ledger document body exceeds the ledger limit",
    );
    assert.strictEqual(ledgerIssue({ kind: "document", body: "playbook" }), undefined);
    assert.strictEqual(ledgerIssue({ body: "stray" }), "ledger body is only valid for document rows");
    assert.strictEqual(ledgerIssue({ kind: "document", body: "b", slot: "s" }), "only fact ledger rows may define a slot");
    assert.strictEqual(ledgerIssue({ kind: "trigger" }), "trigger ledger rows require trigger_condition");
    assert.strictEqual(ledgerIssue({ kind: "trigger", triggerCondition: { when: "morning" } }), undefined);
    assert.strictEqual(
      ledgerIssue({ triggerCondition: { when: "morning" } }),
      "trigger_condition is only valid for trigger ledger rows",
    );
    const manyKeys = Object.fromEntries(
      Array.from({ length: MAX_LEDGER_TRIGGER_CONDITION_KEYS + 1 }, (_, index) => [`k${index}`, index]),
    );
    assert.strictEqual(
      ledgerIssue({ kind: "trigger", triggerCondition: manyKeys }),
      "ledger trigger condition exceeds the ledger key limit",
    );
    assert.strictEqual(
      ledgerIssue({ kind: "trigger", triggerCondition: { big: "x".repeat(MAX_LEDGER_TRIGGER_CONDITION_CHARACTERS) } }),
      "ledger trigger condition exceeds the serialized limit",
    );
  });

  it("CheckedDurableMemoryPatch enforces the same contract", () => {
    assert.strictEqual(decodeFails(CheckedDurableMemoryPatch, patchWire), false);
    assert.strictEqual(decodeFails(CheckedDurableMemoryPatch, ledgerWire), false);
    assert.strictEqual(decodeFails(CheckedDurableMemoryPatch, { ...patchWire, initialTier: "long_term" }), true);
    assert.strictEqual(decodeFails(CheckedDurableMemoryPatch, { ...patchWire, decision: "merge" }), true);
    assert.strictEqual(decodeFails(CheckedDurableMemoryPatch, { ...ledgerWire, kind: "trigger" }), true);
    assert.strictEqual(decodeFails(DurableMemoryPatch, { ...ledgerWire, kind: "trigger" }), false);
  });
});

describe("arbitraries", () => {
  it("derive for every exported schema", () => {
    for (const schema of [
      MemoryTier,
      MemoryKind,
      MemorySubjectScope,
      LedgerWriteReason,
      LifecycleState,
      DurablePatchDecision,
      ConfidenceBand,
      L1MemoryArchiveClass,
      L2DropReason,
      TargetVisibility,
      MemoryExtractionError,
      WorkingObservationExtractionError,
      MemoryContractError,
      EvidenceRef,
      L1MemoryArchiveItem,
      L1MemoryArchiveItemWire,
      WorkingMemoryObservation,
      SourceBackedMemoryCandidate,
      L2SearchRequest,
      L2MemoryRouteDurable,
      L2MemoryRouteReview,
      L2MemoryRouteDiscard,
      L2MemoryRouteHidden,
      L2MemoryRoute,
      L2SearchResult,
      L2SearchPlan,
      CheckedL2SearchPlan,
      DurableMemoryPatch,
      CheckedDurableMemoryPatch,
    ]) {
      assert.strictEqual(Arbitrary.isArbitrary(schema.pipe(Arbitrary.schema)), true);
    }
  });
});
