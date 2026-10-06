import {
  AttachmentSkipReason,
  CategoryAddCount,
  ContentSha256,
  combineTaggingRunReports,
  decisionCategories,
  defaultMailTaxonomy,
  emptyTaggingRunReport,
  FilingDestination,
  isMailCategoryName,
  MailConversationId,
  MailEnvelope,
  MailMessageId,
  MailTaxonomy,
  MatterCategoryName,
  MatterEvidence,
  MatterEvidenceKind,
  MatterEvidenceToken,
  MatterIndex,
  MatterIndexEntry,
  MatterKey,
  MatterMatched,
  MatterUnmatched,
  masterCategories,
  matterCategoryName,
  matterCategoryPreset,
  matterEvidenceConfidence,
  matterEvidenceWeight,
  matterKeyFromCategoryName,
  OutlookCategoryPreset,
  PracticeCategory,
  practiceCategoryPreset,
  summarizeDecision,
  TaggingPolicy,
  TaggingRunId,
  TaggingRunReport,
  TaggingUndoReport,
  TagLedgerEntry,
  TagLedgerRecord,
  TagLedgerRecordJsonLine,
  TagUndoEntry,
} from "@beep/law-practice-domain/values/MailTagging";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const acme = MatterKey.make("acme.10001");
const globex = MatterKey.make("globex.20002");
const runId = TaggingRunId.make("run-0001");
const messageId = MailMessageId.make("msg-0001");
const recordedAt = DateTime.makeUnsafe("2026-07-01T12:00:00.000Z");
const emptyDigest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const defaultPolicy = { confidenceThreshold: 0.8, ambiguityMargin: 0.15, maxAttachmentBytes: 52_428_800 };

const patentEvidence = MatterEvidence.make({
  kind: "patent-number",
  matched: MatterEvidenceToken.make("10000001"),
});

describe("MailTagging taxonomy", () => {
  it("accepts client-keyed matter keys and rejects everything else", () => {
    const isMatterKey = S.is(MatterKey);

    expect(A.every(["acme.10001", "globex.20002-CON", "a.b"], isMatterKey)).toBe(true);
    expect(
      A.some(["10001", "acme.", ".10001", "acme.10001.US", "acme. 10001", "acme .10001", "", "acme\t.1"], isMatterKey)
    ).toBe(false);
  });

  it("round-trips a matter key through its category name", () => {
    const name = matterCategoryName(acme);

    expect(name).toBe("M: acme.10001");
    expect(S.is(MatterCategoryName)(name)).toBe(true);
    assertSome(matterKeyFromCategoryName(name), acme);
    assertSome(matterKeyFromCategoryName("M: globex.20002"), globex);
  });

  it("recovers no matter key from practice, foreign, or malformed category names", () => {
    A.forEach(
      ["P: USPTO", "Docket - unverified", "M: 10001", "M:acme.10001", "m: acme.10001", "M: acme.10001 ", ""],
      (name) => assertNone(matterKeyFromCategoryName(name))
    );
  });

  it("owns matter and practice categories and nothing else", () => {
    expect(A.every(["M: acme.10001", ...PracticeCategory.literals], isMailCategoryName)).toBe(true);
    expect(
      A.some(
        ["Docket - unverified", "Red category", "P: Newsletter", "M: 10001", "p: uspto", "", 7, null],
        isMailCategoryName
      )
    ).toBe(false);
  });

  it("derives a deterministic preset per matter key", () => {
    const isPreset = S.is(OutlookCategoryPreset);
    const keys = A.makeBy(60, (index) => MatterKey.make(`acme.${10001 + index}`));
    const presets = A.map(keys, matterCategoryPreset);

    expect(presets).toStrictEqual(A.map(keys, matterCategoryPreset));
    expect(A.every(presets, isPreset)).toBe(true);
    expect(A.length(A.dedupe(presets))).toBeGreaterThan(10);
    // Pinned against an independent FNV-1a 32 computation: a changed hash would
    // recolor every matter category already in a mailbox.
    expect(matterCategoryPreset(acme)).toBe("preset10");
    expect(matterCategoryPreset(globex)).toBe("preset11");
  });

  it("fixes a distinct preset for every practice category", () => {
    const presets = A.map(PracticeCategory.literals, practiceCategoryPreset);

    expect(A.length(A.dedupe(presets))).toBe(A.length(PracticeCategory.literals));
    expect(practiceCategoryPreset("P: USPTO")).toBe("preset7");
  });

  it("de-duplicates master categories, practice first", () => {
    const taxonomy = MailTaxonomy.make({
      practiceCategories: ["P: USPTO", "P: Client", "P: USPTO"],
      matterKeys: [acme, globex, acme],
    });
    const intents = masterCategories(taxonomy);

    expect(A.map(intents, (intent) => intent.displayName)).toStrictEqual([
      "P: USPTO",
      "P: Client",
      "M: acme.10001",
      "M: globex.20002",
    ]);
    expect(A.map(intents, (intent) => intent.color)).toStrictEqual([
      "preset7",
      "preset4",
      matterCategoryPreset(acme),
      matterCategoryPreset(globex),
    ]);
  });

  it("builds the default taxonomy with every practice category and the USPTO rule", () => {
    const taxonomy = defaultMailTaxonomy([acme]);

    expect(taxonomy.practiceCategories).toStrictEqual(PracticeCategory.literals);
    expect(taxonomy.matterKeys).toStrictEqual([acme]);
    expect(A.map(taxonomy.ruleIntents, (rule) => ({ ...rule }))).toStrictEqual([
      { _tag: "SenderDomainRule", domain: "uspto.gov", category: "P: USPTO" },
    ]);
    expect(A.length(masterCategories(taxonomy))).toBe(7);
  });
});

describe("MailTagging matching", () => {
  it.effect(
    "defaults index lists to empty and normalizes contact addresses",
    Effect.fnUntraced(function* () {
      const entry = yield* S.decodeEffect(MatterIndexEntry)({
        matterKey: "acme.10001",
        clientKey: "acme",
        applicationNumbers: ["16000001"],
        contactAddresses: [" Paralegal@Example.Test "],
      });

      expect(entry.docketNumbers).toStrictEqual([]);
      expect(entry.patentNumbers).toStrictEqual([]);
      expect(entry.contactDomains).toStrictEqual([]);
      expect(entry.applicationNumbers).toStrictEqual(["16000001"]);
      expect(entry.contactAddresses).toStrictEqual(["paralegal@example.test"]);
    })
  );

  it.effect(
    "round-trips an envelope's foreign categories untouched and in order",
    Effect.fnUntraced(function* () {
      const categories = ["Docket - unverified", "Red category", "M: acme.10001", "  spaced  "];
      const envelope = yield* S.decodeEffect(MailEnvelope)({
        messageId: "msg-0001",
        subject: "",
        senderAddress: "paralegal@example.test",
        receivedAt: "2026-07-01T12:00:00.000Z",
        categories,
        hasAttachments: true,
      });
      const encoded = yield* S.encodeEffect(MailEnvelope)(envelope);

      expect(envelope.categories).toStrictEqual(categories);
      expect(encoded.categories).toStrictEqual(categories);
      assertNone(envelope.conversationId);
      expect(encoded.bodyPreview).toBeNull();
      expect(encoded.receivedAt).toBe("2026-07-01T12:00:00.000Z");
    })
  );

  it("weighs every evidence kind", () => {
    expect(A.map(MatterEvidenceKind.literals, matterEvidenceWeight)).toStrictEqual([0.95, 0.95, 0.9, 0.85, 0.6, 0.35]);
  });

  it("combines distinct evidence kinds and ignores repeats", () => {
    const address = MatterEvidence.make({
      kind: "contact-address",
      matched: MatterEvidenceToken.make("paralegal@example.test"),
    });
    const domain = MatterEvidence.make({ kind: "contact-domain", matched: MatterEvidenceToken.make("example.test") });

    expect(matterEvidenceConfidence([])).toBe(0);
    expect(matterEvidenceConfidence([patentEvidence, patentEvidence])).toBeCloseTo(0.95, 10);
    expect(matterEvidenceConfidence([address, domain])).toBeCloseTo(0.74, 10);
  });

  it.effect(
    "applies the policy defaults",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(TaggingPolicy)({});

      expect({ ...decoded }).toStrictEqual(defaultPolicy);
      expect({ ...TaggingPolicy.make({}) }).toStrictEqual(defaultPolicy);
    })
  );

  it("adds the matter category then practice categories for a match", () => {
    const decision = MatterMatched.make({
      matterKey: acme,
      confidence: UnitInterval.make(0.95),
      evidence: [patentEvidence],
      practiceCategories: ["P: USPTO", "P: Unmatched - review", "P: USPTO"],
    });

    expect(decisionCategories(decision)).toStrictEqual(["M: acme.10001", "P: USPTO"]);
  });

  it("adds the review category for an ambiguous outcome", () => {
    const decision = MatterUnmatched.make({ reason: "ambiguous", practiceCategories: ["P: Client"] });

    expect(decisionCategories(decision)).toStrictEqual(["P: Client", "P: Unmatched - review"]);
  });

  it("adds the review category for a below-threshold outcome", () => {
    expect(decisionCategories(MatterUnmatched.make({ reason: "below-threshold" }))).toStrictEqual([
      "P: Unmatched - review",
    ]);
  });

  it("adds only practice categories, possibly none, when there is no signal", () => {
    expect(decisionCategories(MatterUnmatched.make({ reason: "no-signal" }))).toStrictEqual([]);
    expect(
      decisionCategories(MatterUnmatched.make({ reason: "no-signal", practiceCategories: ["P: USPTO"] }))
    ).toStrictEqual(["P: USPTO"]);
  });
});

describe("MailTagging ledgers", () => {
  const applied = TagLedgerEntry.make({
    runId,
    messageId,
    conversationId: O.some(MailConversationId.make("conv-0001")),
    addedCategories: [matterCategoryName(acme), "P: USPTO"],
    decision: summarizeDecision(
      MatterMatched.make({ matterKey: acme, confidence: UnitInterval.make(0.95), evidence: [patentEvidence] })
    ),
    recordedAt,
  });
  const undone = TagUndoEntry.make({
    runId: TaggingRunId.make("undo-0001"),
    originalRunId: runId,
    messageId,
    removedCategories: ["P: USPTO"],
    recordedAt,
  });

  it.effect(
    "round-trips applied and undone records through one JSONL line",
    Effect.fnUntraced(function* () {
      const encode = S.encodeEffect(TagLedgerRecordJsonLine);
      const decode = S.decodeUnknownEffect(TagLedgerRecordJsonLine);
      const appliedLine = yield* encode(applied);
      const undoneLine = yield* encode(undone);

      expect(Str.includes("\n")(appliedLine)).toBe(false);
      expect(yield* S.decodeEffect(S.fromJsonString(S.Unknown))(appliedLine)).toStrictEqual({
        _tag: "TagApplied",
        runId: "run-0001",
        messageId: "msg-0001",
        internetMessageId: null,
        conversationId: "conv-0001",
        addedCategories: ["M: acme.10001", "P: USPTO"],
        decision: { outcome: "MatterMatched", matterKey: "acme.10001", confidence: 0.95, reason: null },
        recordedAt: "2026-07-01T12:00:00.000Z",
      });
      expect(yield* encode(yield* decode(appliedLine))).toBe(appliedLine);
      expect(yield* encode(yield* decode(undoneLine))).toBe(undoneLine);
      expect((yield* decode(undoneLine))._tag).toBe("TagUndone");
    })
  );

  it.effect.prop(
    "round-trips schema-derived ledger records through one JSONL line",
    { record: Arbitrary.schema(TagLedgerRecord) },
    ({ record }) =>
      Effect.gen(function* () {
        const equivalent = S.toEquivalence(TagLedgerRecord);
        const line = yield* S.encodeEffect(TagLedgerRecordJsonLine)(record);

        expect(Str.includes("\n")(line)).toBe(false);
        expect(equivalent(yield* S.decodeEffect(TagLedgerRecordJsonLine)(line), record)).toBe(true);
      }),
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "derives owned category names from any schema-derived matter key",
    { key: Arbitrary.schema(MatterKey) },
    ({ key }) => {
      const name = matterCategoryName(key);

      expect(isMailCategoryName(name)).toBe(true);
      assertSome(matterKeyFromCategoryName(name), key);
      expect(S.is(OutlookCategoryPreset)(matterCategoryPreset(key))).toBe(true);
    },
    { arbitrary: fcRuns(50) }
  );

  it("rejects ledger lines that are not ours", () => {
    const decode = S.decodeUnknownOption(TagLedgerRecordJsonLine);

    assertNone(decode("not json"));
    assertNone(decode('{"_tag":"TagMoved","runId":"run-0001"}'));
    assertNone(
      decode(
        '{"_tag":"TagUndone","runId":"undo-0001","originalRunId":"run-0001","messageId":"msg-0001","removedCategories":["Docket - unverified"],"recordedAt":"2026-07-01T12:00:00.000Z"}'
      )
    );
  });

  it.effect(
    "defaults a missing conversation id to none when decoding an older ledger line",
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(TagLedgerRecordJsonLine)(
        '{"_tag":"TagApplied","runId":"run-0001","messageId":"msg-0001","addedCategories":["P: USPTO"],"decision":{"outcome":"MatterUnmatched","reason":"no-signal"},"recordedAt":"2026-07-01T12:00:00.000Z"}'
      );

      assertTrue(TagLedgerRecord.guards.TagApplied(decoded));
      assertNone(decoded.conversationId);
    })
  );

  it("counts a matter without a folder as its own attachment skip reason", () => {
    expect(AttachmentSkipReason.literals).toStrictEqual([
      "inline",
      "not-a-file",
      "empty",
      "too-large",
      "no-folder",
      "sender-not-routable",
    ]);
    expect(emptyTaggingRunReport("apply", runId).attachmentsSkipped["no-folder"]).toBe(0);
  });

  it.effect(
    "round-trips an undo report",
    Effect.fnUntraced(function* () {
      const report = TaggingUndoReport.make({
        mode: "apply",
        runId: TaggingRunId.make("undo-0001"),
        originalRunId: runId,
        entries: 2,
        messagesRestored: 1,
        messagesMissing: 1,
        categoriesRemoved: 2,
        wrote: true,
      });
      const encoded = yield* S.encodeEffect(TaggingUndoReport)(report);

      expect(encoded.originalRunId).toBe("run-0001");
      expect(S.toEquivalence(TaggingUndoReport)(yield* S.decodeEffect(TaggingUndoReport)(encoded), report)).toBe(true);
    })
  );

  it.effect(
    "defaults the unattributed matters and the change key, and routes needs-attorney to review",
    Effect.fnUntraced(function* () {
      const index = yield* S.decodeEffect(MatterIndex)({ entries: [], builtAt: "2026-07-01T12:00:00.000Z" });
      const envelope = yield* S.decodeEffect(MailEnvelope)({
        messageId: "msg-0001",
        subject: "",
        receivedAt: "2026-07-01T12:00:00.000Z",
        hasAttachments: false,
      });

      expect(index.unattributed).toStrictEqual([]);
      assertNone(envelope.changeKey);
      expect(decisionCategories(MatterUnmatched.make({ reason: "needs-attorney" }))).toStrictEqual([
        "P: Unmatched - review",
      ]);
      expect(FilingDestination.literals).toStrictEqual(["uspto-incoming", "from-client"]);
      expect(emptyTaggingRunReport("apply", runId).repaired).toBe(0);
    })
  );

  it("summarizes an unmatched decision by reason only", () => {
    const summary = summarizeDecision(MatterUnmatched.make({ reason: "ambiguous" }));

    expect(summary.outcome).toBe("MatterUnmatched");
    assertSome(summary.reason, "ambiguous");
    assertNone(summary.matterKey);
    assertNone(summary.confidence);
  });

  it("accepts only 64 lowercase hex characters as a content hash", () => {
    const isContentSha256 = S.is(ContentSha256);

    expect(isContentSha256(emptyDigest)).toBe(true);
    expect(
      A.some(
        [
          Str.toUpperCase(emptyDigest),
          Str.slice(0, 63)(emptyDigest),
          `${emptyDigest}0`,
          `g${Str.slice(1)(emptyDigest)}`,
          "",
        ],
        isContentSha256
      )
    ).toBe(false);
  });
});

describe("MailTagging run report", () => {
  const empty = emptyTaggingRunReport("apply", runId);
  const report = (scanned: number, adds: ReadonlyArray<CategoryAddCount>, wrote: boolean): TaggingRunReport =>
    TaggingRunReport.make({
      ...empty,
      scanned,
      matched: scanned,
      unmatched: { "no-signal": scanned, "below-threshold": 1, ambiguous: 0, "needs-attorney": 0 },
      alreadyTagged: 1,
      repaired: 0,
      categoryAdds: adds,
      attachmentsFiled: scanned,
      attachmentsDeduped: 2,
      attachmentsSkipped: {
        inline: scanned,
        "not-a-file": 0,
        empty: 1,
        "too-large": 0,
        "no-folder": 0,
        "sender-not-routable": 0,
      },
      wrote,
    });
  const count = (category: CategoryAddCount["category"], value: number): CategoryAddCount =>
    CategoryAddCount.make({ category, count: value });
  const a = report(1, [count(matterCategoryName(acme), 1), count("P: USPTO", 1)], false);
  const b = report(2, [count("P: USPTO", 2)], true);
  const c = report(3, [count(matterCategoryName(globex), 3), count("P: Admin", 1)], false);

  it("starts every count at zero", () => {
    expect({ ...emptyTaggingRunReport("dry-run", runId) }).toStrictEqual({
      mode: "dry-run",
      runId,
      scanned: 0,
      matched: 0,
      unmatched: { "no-signal": 0, "below-threshold": 0, ambiguous: 0, "needs-attorney": 0 },
      alreadyTagged: 0,
      repaired: 0,
      categoryAdds: [],
      attachmentsFiled: 0,
      attachmentsDeduped: 0,
      attachmentsSkipped: {
        inline: 0,
        "not-a-file": 0,
        empty: 0,
        "too-large": 0,
        "no-folder": 0,
        "sender-not-routable": 0,
      },
      wrote: false,
    });
    expect(emptyTaggingRunReport(runId)("dry-run")).toStrictEqual(emptyTaggingRunReport("dry-run", runId));
  });

  it("sums counts and merges category adds in category order", () => {
    const total = combineTaggingRunReports(a, b);

    expect(total.scanned).toBe(3);
    expect(total.unmatched).toStrictEqual({ "no-signal": 3, "below-threshold": 2, ambiguous: 0, "needs-attorney": 0 });
    expect(total.attachmentsSkipped).toStrictEqual({
      inline: 3,
      "not-a-file": 0,
      empty: 2,
      "too-large": 0,
      "no-folder": 0,
      "sender-not-routable": 0,
    });
    expect(total.categoryAdds).toStrictEqual([count(matterCategoryName(acme), 1), count("P: USPTO", 3)]);
    expect(total.wrote).toBe(true);
    expect(total.mode).toBe("apply");
  });

  it("combines associatively", () => {
    expect(combineTaggingRunReports(combineTaggingRunReports(a, b), c)).toStrictEqual(
      combineTaggingRunReports(a, combineTaggingRunReports(b, c))
    );
    expect(pipe(a, combineTaggingRunReports(b), combineTaggingRunReports(c))).toStrictEqual(
      combineTaggingRunReports(a, combineTaggingRunReports(b, c))
    );
  });

  it("treats the empty report as the identity", () => {
    expect(combineTaggingRunReports(empty, a)).toStrictEqual(a);
    expect(combineTaggingRunReports(a, empty)).toStrictEqual(a);
    expect(combineTaggingRunReports(empty, c)).toStrictEqual(c);
  });
});
