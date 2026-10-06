/**
 * Paralegal and secretary agent proofs over a scripted language model.
 *
 * Every fixture is synthetic: invented ids, `*.invalid` hosts and placeholder
 * text. No real mail, sender, matter or client appears here.
 */

import { DocketResponsePeriod } from "@beep/law-practice-domain/values/DocketDeadline";
import { DocketAgentsOptions, makeDocketAgentsLayer } from "@beep/law-practice-server/DocketIntake";
import {
  DocketMessage,
  DocketParalegal,
  DocketSecretary,
  DocketSourceDocument,
  ExtractorFieldResponse,
  ParalegalDocketEntry,
  ParalegalNotDocketItem,
  ReviewDispute,
  ReviewFinding,
} from "@beep/law-practice-use-cases/DocketIntake";
import { LocalDate } from "@beep/schema/LocalDate";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { Cause, Context, Duration, Effect, Exit, Layer, pipe, Ref, Stream } from "effect";
import * as A from "effect/Array";
import * as AiError from "effect/ai/AiError";
import * as LanguageModel from "effect/ai/LanguageModel";
import * as Response from "effect/ai/Response";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { DocketIntakeError } from "@beep/law-practice-use-cases/DocketIntake";
import type * as Prompt from "effect/ai/Prompt";

type ScriptedResponse = Effect.Effect<string, AiError.AiError>;

type ScriptedModelShape = {
  readonly prompts: Effect.Effect<ReadonlyArray<Prompt.Prompt>>;
  /** Answer the next calls with these responses in turn; the last one repeats. */
  readonly respondInTurn: (responses: A.NonEmptyReadonlyArray<ScriptedResponse>) => Effect.Effect<void>;
  readonly respondWith: (response: ScriptedResponse) => Effect.Effect<void>;
  readonly responsesRef: Ref.Ref<A.NonEmptyReadonlyArray<ScriptedResponse>>;
  /** Property names of the answer schema each call handed to the provider. */
  readonly answerFields: Ref.Ref<ReadonlyArray<ReadonlyArray<string>>>;
  /** How many shared definitions (`$defs`) each answer schema needed. */
  readonly answerDefinitions: Ref.Ref<ReadonlyArray<number>>;
  readonly seen: Ref.Ref<ReadonlyArray<Prompt.Prompt>>;
};

class ScriptedModel extends Context.Service<ScriptedModel, ScriptedModelShape>()(
  "@beep/law-practice-server/test/DocketIntake.agents.test/ScriptedModel"
) {}

const TestUsage = Response.Usage.make({
  inputTokens: { cacheRead: undefined, cacheWrite: undefined, total: 0, uncached: 0 },
  outputTokens: { reasoning: undefined, text: 0, total: 0 },
});

const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
const json = (value: unknown): Effect.Effect<string> => Effect.orDie(encodeJson(value));

const JsonObjectSchema = S.Struct({ schema: S.Struct({ properties: S.Record(S.String, S.Unknown) }) });
// How many shared definitions the JSON schema of a structured call carries. Provider
// structured-output modes reject them, so every wire schema has to come out flat.
const answerDefinitionsOf = (format: LanguageModel.ProviderOptions["responseFormat"]): number =>
  format.type === "json" ? A.length(R.keys(S.toJsonSchemaDocument(format.schema).definitions)) : -1;

// The property names of the JSON schema a structured call asks the provider to answer in.
const answerFieldsOf = (format: LanguageModel.ProviderOptions["responseFormat"]): ReadonlyArray<string> =>
  format.type === "json"
    ? pipe(
        S.toJsonSchemaDocument(format.schema),
        S.decodeUnknownOption(JsonObjectSchema),
        O.map((document) => R.keys(document.schema.properties)),
        O.getOrElse(A.empty<string>)
      )
    : [];

const ScriptedModelLayer = Layer.effect(
  ScriptedModel,
  Effect.gen(function* () {
    const responsesRef = yield* Ref.make<A.NonEmptyReadonlyArray<ScriptedResponse>>([Effect.succeed("{}")]);
    const seen = yield* Ref.make<ReadonlyArray<Prompt.Prompt>>([]);
    return ScriptedModel.of({
      answerDefinitions: yield* Ref.make<ReadonlyArray<number>>([]),
      answerFields: yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]),
      prompts: Ref.get(seen),
      respondInTurn: Effect.fn("ScriptedModel.respondInTurn")(function* (responses) {
        yield* Ref.set(responsesRef, responses);
      }),
      respondWith: Effect.fn("ScriptedModel.respondWith")(function* (response) {
        yield* Ref.set(responsesRef, [response]);
      }),
      responsesRef,
      seen,
    });
  })
);

const LanguageModelLayer = Layer.effect(
  LanguageModel.LanguageModel,
  Effect.gen(function* () {
    const scripted = yield* ScriptedModel;
    return yield* LanguageModel.make({
      generateText: Effect.fnUntraced(function* (options) {
        yield* Ref.update(scripted.seen, A.append(options.prompt));
        yield* Ref.update(scripted.answerFields, A.append(answerFieldsOf(options.responseFormat)));
        yield* Ref.update(scripted.answerDefinitions, A.append(answerDefinitionsOf(options.responseFormat)));
        const text = yield* yield* Ref.modify(scripted.responsesRef, (responses) => [
          A.headNonEmpty(responses),
          A.match(A.tailNonEmpty(responses), { onEmpty: () => responses, onNonEmpty: (rest) => rest }),
        ]);
        return [
          Response.makePart("text", { text }),
          Response.makePart("finish", { reason: "stop", response: undefined, usage: TestUsage }),
        ];
      }),
      streamText: () => Stream.empty,
    });
  })
);

const aiFailure = (reason: AiError.AiErrorReason): ScriptedResponse =>
  Effect.fail(AiError.make({ method: "generateText", module: "ScriptedModel", reason }));

const rateLimited = aiFailure(AiError.RateLimitError.make({}));
const rejected = aiFailure(AiError.InvalidRequestError.make({}));

const makeAgentsLayer = (options: DocketAgentsOptions) =>
  makeDocketAgentsLayer(options).pipe(Layer.provide(LanguageModelLayer), Layer.provideMerge(ScriptedModelLayer));

const agentsLayer = makeAgentsLayer(DocketAgentsOptions.make({}));
const fastRetryLayer = makeAgentsLayer(DocketAgentsOptions.make({ retryBaseDelay: Duration.millis(1) }));

const failureOf = <A>(effect: Effect.Effect<A, DocketIntakeError>): Effect.Effect<O.Option<DocketIntakeError>> =>
  Effect.exit(effect).pipe(Effect.map(Exit.match({ onFailure: Cause.findErrorOption, onSuccess: O.none })));

const message = DocketMessage.make({
  bodyText: "Synthetic fixture body mentioning FIX-0001.",
  messageId: "m1",
  receivedAt: "2030-01-09T10:00:00.000Z",
  receivedDate: LocalDate.make({ year: 2030, month: 1, day: 9 }),
  sender: O.some("sender@fixture.invalid"),
  subject: O.some("Fixture subject"),
});

const pdf = DocketSourceDocument.make({ bytes: new Uint8Array([1, 2, 3]), contentType: "application/pdf" });

const paralegalWire = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  citedText: "Mailed January 8, 2030. A response is due within three months",
  isDocketItem: true,
  mailDate: "2030-01-08",
  matterReferences: ["FIX-0001"],
  rationale: "States a response period.",
  responsePeriod: { amount: 3, unit: "months" },
  statedDueDate: null,
  title: "Fixture response due",
  ...overrides,
});

const secretaryWire = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  citedText: "Mailed January 8, 2030. A response is due within three months",
  isDocketItem: true,
  mailDate: "2030-01-08",
  matterReferences: ["FIX-0001"],
  notes: "Read the attached fixture action. The period is on its first page.",
  readFromSourceDocument: true,
  responsePeriod: { amount: 3, unit: "months" },
  statedDueDate: null,
  ...overrides,
});

const SECRETARY_FIELDS = [
  "citedText",
  "isDocketItem",
  "mailDate",
  "matterReferences",
  "notes",
  "readFromSourceDocument",
  "responsePeriod",
  "statedDueDate",
];

const paralegalEntry = ParalegalDocketEntry.make({
  matterReferences: ["FIX-0001"],
  rationale: "States a due date.",
  statedDueDate: O.some(LocalDate.make({ year: 2031, month: 7, day: 19 })),
  title: "Fixture response due",
});

const bareMessage = DocketMessage.make({
  bodyText: "Synthetic fixture newsletter body.",
  messageId: "m2",
  receivedAt: "2030-01-09T11:00:00.000Z",
  receivedDate: LocalDate.make({ year: 2030, month: 1, day: 9 }),
});

const dismissedEntry = ParalegalNotDocketItem.make({ rationale: "Fixture newsletter." });

const revisionWire = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  ...paralegalWire({ responsePeriod: { amount: 2, unit: "months" } }),
  confidence: 0.8,
  responses: [
    { action: "revised", citedText: "A response is due within two months", field: "response-period" },
    { action: "defended", citedText: " ", field: "mail-date" },
  ],
  ...overrides,
});

const disputes = [
  ReviewDispute.make({ field: "response-period", reasons: ["The two readings differ.", "The period is misread."] }),
  ReviewDispute.make({ field: "mail-date", reasons: ["The two readings differ."] }),
];

const datedEntry = ParalegalDocketEntry.make({
  citedText: O.some("Mailed January 8, 2030. A response is due within three months"),
  mailDate: O.some(LocalDate.make({ year: 2030, month: 1, day: 8 })),
  matterReferences: ["FIX-0001"],
  rationale: "States a response period.",
  responsePeriod: O.some(DocketResponsePeriod.make({ amount: 3, unit: "months" })),
  title: "Fixture response due",
});

const extractorResponses = [
  ExtractorFieldResponse.make({
    action: "revised",
    citedText: O.some("A response is due within two months"),
    field: "response-period",
  }),
  ExtractorFieldResponse.make({ action: "defended", field: "mail-date" }),
];

const rereadInput = (
  documents: ReadonlyArray<DocketSourceDocument>,
  findings: ReadonlyArray<ReviewFinding> = [
    ReviewFinding.make({ field: "response-period", reason: "The period looks misread.", severity: "P1" }),
  ]
) => ({
  documents,
  extractorResponses,
  fields: ["mail-date", "response-period"] as const,
  findings,
  message,
});

const userParts = (prompt: Prompt.Prompt): ReadonlyArray<Prompt.UserMessagePart> =>
  A.flatMap(prompt.content, (entry) => (entry.role === "user" ? entry.content : []));

const userText = (prompt: Prompt.Prompt): string =>
  A.join(
    A.flatMap(userParts(prompt), (part) => (part.type === "text" ? [part.text] : [])),
    "\n"
  );

const fileParts = (prompt: Prompt.Prompt): ReadonlyArray<Prompt.FilePart> =>
  A.flatMap(userParts(prompt), (part) => (part.type === "file" ? [part] : []));

const mentions =
  (needle: string) =>
  (prompt: Prompt.Prompt): boolean =>
    pipe(userText(prompt), Str.includes(needle));

const asDocketEntry = O.liftPredicate(S.is(ParalegalDocketEntry));

const iso = O.map((date: LocalDate) => date.toISOString());

describe("@beep/law-practice-server DocketIntake agents", () => {
  it.layer(agentsLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "decodes a paralegal answer into a docket entry, treating blank and literal-null strings as unstated",
      Effect.fnUntraced(function* () {
        const scripted = yield* ScriptedModel;
        const paralegal = yield* DocketParalegal;
        yield* scripted.respondWith(json(paralegalWire({ statedDueDate: "null" })));

        const entry = yield* paralegal.enter(message);
        const prompts = yield* scripted.prompts;

        const docketEntry = asDocketEntry(entry);

        assertSome(
          O.map(docketEntry, (entered) => entered.matterReferences),
          ["FIX-0001"]
        );
        assertSome(iso(O.flatMap(docketEntry, (entered) => entered.mailDate)), "2030-01-08");
        assertNone(O.flatMap(docketEntry, (entered) => entered.statedDueDate));
        assertSome(
          O.map(
            O.flatMap(docketEntry, (entered) => entered.responsePeriod),
            (period) => [period.amount, period.unit]
          ),
          [3, "months"]
        );
        assertSome(
          O.flatMap(docketEntry, (entered) => entered.citedText),
          "Mailed January 8, 2030. A response is due within three months"
        );
        assertTrue(O.exists(A.head(prompts), mentions("FIX-0001")));
        expect(yield* Ref.get(scripted.answerFields)).toStrictEqual([
          [
            "citedText",
            "isDocketItem",
            "mailDate",
            "matterReferences",
            "rationale",
            "responsePeriod",
            "statedDueDate",
            "title",
          ],
        ]);
        expect(yield* Ref.get(scripted.answerDefinitions)).toStrictEqual([0]);
        expect(A.flatMap(prompts, fileParts)).toStrictEqual([]);
      })
    );
  });

  it.layer(agentsLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "decodes a paralegal answer that finds nothing to docket",
      Effect.fnUntraced(function* () {
        const scripted = yield* ScriptedModel;
        const paralegal = yield* DocketParalegal;
        yield* scripted.respondWith(
          json(
            paralegalWire({
              isDocketItem: false,
              mailDate: null,
              matterReferences: [],
              rationale: "Fixture newsletter.",
              responsePeriod: null,
              title: null,
            })
          )
        );

        const entry = yield* paralegal.enter(message);

        expect(entry).toMatchObject({ _tag: "ParalegalNotDocketItem", rationale: "Fixture newsletter." });
      })
    );
  });

  it.layer(agentsLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "fails the entry instead of guessing when a date is not an ISO date or a docket item has no title",
      Effect.fnUntraced(function* () {
        const scripted = yield* ScriptedModel;
        const paralegal = yield* DocketParalegal;

        yield* scripted.respondWith(json(paralegalWire({ statedDueDate: "the nineteenth of July" })));
        const badDate = yield* failureOf(paralegal.enter(message));
        yield* scripted.respondWith(json(paralegalWire({ title: null })));
        const noTitle = yield* failureOf(paralegal.enter(message));
        yield* scripted.respondWith(json(paralegalWire({ responsePeriod: { amount: 0, unit: "months" } })));
        const zeroPeriod = yield* failureOf(paralegal.enter(message));

        for (const failure of [badDate, noTitle, zeroPeriod]) {
          assertSome(
            O.map(failure, (error) => [error.stage, error.cause]),
            ["enter", "wire-decode"]
          );
        }
      })
    );
  });

  // Unusable output counts as retryable, so this block runs on the real clock with a tiny delay.
  it.layer(fastRetryLayer, { excludeTestServices: true, timeout: "10 seconds" })((it) => {
    it.effect(
      "maps provider failures and unusable output to the stage that called the model",
      Effect.fnUntraced(function* () {
        const scripted = yield* ScriptedModel;
        const paralegal = yield* DocketParalegal;
        const secretary = yield* DocketSecretary;

        yield* scripted.respondWith(Effect.succeed("this is not a structured answer"));
        const unusable = yield* failureOf(paralegal.enter(message));
        yield* scripted.respondWith(Effect.die("fixture provider unavailable"));
        const defect = yield* failureOf(secretary.review({ documents: [], entry: paralegalEntry, message }));

        assertSome(
          O.map(unusable, (error) => error.stage),
          "enter"
        );
        assertTrue(O.exists(unusable, (error) => Str.startsWith("model:")(error.cause)));
        assertSome(
          O.map(defect, (error) => [error.stage, error.cause]),
          ["review", "model-defect"]
        );
      })
    );
  });

  it("limits the paralegal to 60 seconds and the secretary to 120, and waits half a second before a retry, by default", () => {
    const defaults = DocketAgentsOptions.make({});

    expect([
      Duration.toSeconds(defaults.paralegalTimeout),
      Duration.toSeconds(defaults.secretaryTimeout),
      Duration.toMillis(defaults.retryBaseDelay),
    ]).toStrictEqual([60, 120, 500]);
  });

  // Real clock, tiny limits: the scripted model never answers, so each call can only end by timing out.
  it.layer(
    makeAgentsLayer(
      DocketAgentsOptions.make({ paralegalTimeout: Duration.millis(20), secretaryTimeout: Duration.millis(40) })
    ),
    { excludeTestServices: true, timeout: "10 seconds" }
  )((it) => {
    it.effect(
      "times a call out at its limit and reports the stage",
      Effect.fnUntraced(function* () {
        const scripted = yield* ScriptedModel;
        const paralegal = yield* DocketParalegal;
        const secretary = yield* DocketSecretary;
        yield* scripted.respondWith(Effect.never);

        const entered = yield* failureOf(paralegal.enter(message));
        const reviewed = yield* failureOf(secretary.review({ documents: [pdf], entry: paralegalEntry, message }));

        assertSome(
          O.map(entered, (error) => [error.stage, error.cause]),
          ["enter", "timeout"]
        );
        assertSome(
          O.map(reviewed, (error) => [error.stage, error.cause]),
          ["review", "timeout"]
        );
      })
    );
  });

  it.layer(agentsLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "sends source documents to the secretary as PDF file parts and withholds the paralegal's dates",
      Effect.fnUntraced(function* () {
        const scripted = yield* ScriptedModel;
        const secretary = yield* DocketSecretary;
        yield* scripted.respondWith(json({ ...secretaryWire(), dueDate: "2030-04-08", statedDueDate: "2030-04-08" }));

        const review = yield* secretary.review({ documents: [pdf], entry: paralegalEntry, message });
        const prompt = A.last(yield* scripted.prompts);
        const files = pipe(prompt, O.map(fileParts), O.getOrElse(A.empty<Prompt.FilePart>));

        expect(review.isDocketItem).toBe(true);
        expect(review.readFromSourceDocument).toBe(true);
        assertSome(iso(review.mailDate), "2030-01-08");
        assertSome(
          O.map(review.responsePeriod, (period) => [period.amount, period.unit]),
          [3, "months"]
        );
        // The schema the provider answers in takes a due date the source states and has nowhere to
        // put a computed one.
        expect(yield* Ref.get(scripted.answerFields)).toStrictEqual([SECRETARY_FIELDS]);
        expect(yield* Ref.get(scripted.answerDefinitions)).toStrictEqual([0]);
        expect(R.keys(review)).not.toContain("dueDate");
        assertSome(iso(review.statedDueDate), "2030-04-08");
        assertSome(review.citedText, "Mailed January 8, 2030. A response is due within three months");
        expect(A.map(files, (file) => [file.mediaType, file.data])).toStrictEqual([
          ["application/pdf", new Uint8Array([1, 2, 3])],
        ]);
        assertTrue(O.exists(prompt, mentions("Fixture response due")));
        assertTrue(!O.exists(prompt, mentions("2031-07-19")));
      })
    );
  });

  it.layer(agentsLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "never reports a source-document read when no document was attached",
      Effect.fnUntraced(function* () {
        const scripted = yield* ScriptedModel;
        const secretary = yield* DocketSecretary;
        yield* scripted.respondWith(json(secretaryWire({ citedText: " ", mailDate: "", responsePeriod: null })));

        const review = yield* secretary.review({ documents: [], entry: paralegalEntry, message });
        const prompt = A.last(yield* scripted.prompts);

        expect(review.readFromSourceDocument).toBe(false);
        assertNone(review.mailDate);
        assertNone(review.responsePeriod);
        // The fixture states no due date and the blank citation is no citation.
        assertNone(review.statedDueDate);
        assertNone(review.citedText);
        assertTrue(O.exists(prompt, mentions("No source document is attached.")));
      })
    );
  });

  it.layer(agentsLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "tells the secretary when the paralegal dismissed the message, and accepts a review that agrees",
      Effect.fnUntraced(function* () {
        const scripted = yield* ScriptedModel;
        const secretary = yield* DocketSecretary;
        yield* scripted.respondWith(
          json(
            secretaryWire({
              isDocketItem: false,
              mailDate: null,
              matterReferences: [],
              notes: "Read the whole message. It sets no date and asks for nothing.",
              readFromSourceDocument: false,
              responsePeriod: null,
            })
          )
        );

        const review = yield* secretary.review({ documents: [], entry: dismissedEntry, message: bareMessage });
        const prompt = A.last(yield* scripted.prompts);

        expect(review.isDocketItem).toBe(false);
        expect(review.matterReferences).toStrictEqual([]);
        assertNone(review.mailDate);
        assertTrue(O.exists(prompt, mentions("The paralegal found nothing to docket in this message.")));
        assertTrue(O.exists(prompt, mentions("Rationale: Fixture newsletter.")));
        assertTrue(!O.exists(prompt, mentions("Title:")));
        // A message with no sender or subject says so instead of leaving the line blank.
        assertTrue(O.exists(prompt, mentions("From: (not given)")));
        assertTrue(O.exists(prompt, mentions("Subject: (not given)")));
      })
    );
  });

  it.layer(agentsLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "fails the review instead of guessing when the secretary's date or period is unusable",
      Effect.fnUntraced(function* () {
        const scripted = yield* ScriptedModel;
        const secretary = yield* DocketSecretary;

        yield* scripted.respondWith(json(secretaryWire({ mailDate: "early January" })));
        const badDate = yield* failureOf(secretary.review({ documents: [pdf], entry: paralegalEntry, message }));
        yield* scripted.respondWith(json(secretaryWire({ statedDueDate: "mid April" })));
        const badStated = yield* failureOf(secretary.review({ documents: [pdf], entry: paralegalEntry, message }));
        yield* scripted.respondWith(json(secretaryWire({ responsePeriod: { amount: -1, unit: "days" } })));
        const badPeriod = yield* failureOf(secretary.review({ documents: [pdf], entry: paralegalEntry, message }));

        for (const failure of [badDate, badStated, badPeriod]) {
          assertSome(
            O.map(failure, (error) => [error.stage, error.cause]),
            ["review", "wire-decode"]
          );
        }
      })
    );
  });

  // Real clock and a one-millisecond base, so the retry delays elapse on their own.
  it.layer(fastRetryLayer, { excludeTestServices: true, timeout: "10 seconds" })((it) => {
    it.effect(
      "tries a retryable model failure again and returns the entry from the second call",
      Effect.fnUntraced(function* () {
        const scripted = yield* ScriptedModel;
        const paralegal = yield* DocketParalegal;
        yield* scripted.respondInTurn([rateLimited, json(paralegalWire())]);

        const entry = yield* paralegal.enter(message);

        assertSome(
          O.map(asDocketEntry(entry), (entered) => entered.title),
          "Fixture response due"
        );
        expect(yield* scripted.prompts).toHaveLength(2);
      })
    );
  });

  it.layer(fastRetryLayer, { excludeTestServices: true, timeout: "10 seconds" })((it) => {
    it.effect(
      "gives up after three retries of a failure that keeps coming back",
      Effect.fnUntraced(function* () {
        const scripted = yield* ScriptedModel;
        const paralegal = yield* DocketParalegal;
        yield* scripted.respondWith(rateLimited);

        const failure = yield* failureOf(paralegal.enter(message));

        assertSome(
          O.map(failure, (error) => [error.stage, error.cause]),
          ["enter", "model:RateLimitError"]
        );
        expect(yield* scripted.prompts).toHaveLength(4);
      })
    );
  });

  it.layer(fastRetryLayer, { excludeTestServices: true, timeout: "10 seconds" })((it) => {
    it.effect(
      "fails at once on a failure that is not retryable",
      Effect.fnUntraced(function* () {
        const scripted = yield* ScriptedModel;
        const secretary = yield* DocketSecretary;
        yield* scripted.respondInTurn([rejected, json(secretaryWire())]);

        const failure = yield* failureOf(secretary.review({ documents: [], entry: paralegalEntry, message }));

        assertSome(
          O.map(failure, (error) => [error.stage, error.cause]),
          ["review", "model:InvalidRequestError"]
        );
        expect(yield* scripted.prompts).toHaveLength(1);
      })
    );
  });

  it.layer(agentsLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "reviews once more without the documents when the provider refuses a review that has them attached",
      Effect.fnUntraced(function* () {
        const scripted = yield* ScriptedModel;
        const secretary = yield* DocketSecretary;
        yield* scripted.respondInTurn([rejected, json(secretaryWire())]);

        const review = yield* secretary.review({ documents: [pdf], entry: paralegalEntry, message });
        const prompts = yield* scripted.prompts;

        expect(review.isDocketItem).toBe(true);
        // The model still answers "read from the source document"; with nothing attached that cannot be so.
        expect(review.readFromSourceDocument).toBe(false);
        expect(A.map(A.map(prompts, fileParts), A.length)).toStrictEqual([1, 0]);
        assertTrue(O.exists(A.last(prompts), mentions("No source document is attached.")));
      })
    );
  });

  it.layer(agentsLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "fails the review when the provider also refuses it without the documents",
      Effect.fnUntraced(function* () {
        const scripted = yield* ScriptedModel;
        const secretary = yield* DocketSecretary;
        yield* scripted.respondWith(rejected);

        const failure = yield* failureOf(secretary.review({ documents: [pdf], entry: paralegalEntry, message }));

        assertSome(
          O.map(failure, (error) => [error.stage, error.cause]),
          ["review", "model:InvalidRequestError"]
        );
        expect(yield* scripted.prompts).toHaveLength(2);
      })
    );
  });
  it.layer(agentsLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "asks the paralegal to revise with the disputed fields and reasons, and decodes its responses and confidence",
      Effect.fnUntraced(function* () {
        const scripted = yield* ScriptedModel;
        const paralegal = yield* DocketParalegal;
        yield* scripted.respondWith(json(revisionWire()));

        const revision = yield* paralegal.revise({ disputes, message, previous: datedEntry });
        const prompt = A.last(yield* scripted.prompts);
        const revised = asDocketEntry(revision.entry);

        assertSome(
          O.map(
            O.flatMap(revised, (entry) => entry.responsePeriod),
            (period) => [period.amount, period.unit]
          ),
          [2, "months"]
        );
        expect(A.map(revision.responses, (response) => [response.field, response.action])).toStrictEqual([
          ["response-period", "revised"],
          ["mail-date", "defended"],
        ]);
        // A blank quotation is no quotation.
        expect(A.map(revision.responses, (response) => O.isSome(response.citedText))).toStrictEqual([true, false]);
        assertSome(revision.selfReportedConfidence, UnitInterval.make(0.8));
        for (const fragment of [
          "You entered this message as a docket item.",
          "Mail date: 2030-01-08",
          "Response period: 3 months",
          "Stated due date: (not given)",
          "Cited text: Mailed January 8, 2030. A response is due within three months",
          "Disputed fields:",
          "- response-period: The two readings differ. The period is misread.",
          "- mail-date: The two readings differ.",
        ]) {
          assertTrue(O.exists(prompt, mentions(fragment)));
        }
        expect(pipe(prompt, O.map(fileParts), O.getOrElse(A.empty<Prompt.FilePart>))).toStrictEqual([]);
        expect(yield* Ref.get(scripted.answerFields)).toStrictEqual([
          [
            "citedText",
            "isDocketItem",
            "mailDate",
            "matterReferences",
            "rationale",
            "responsePeriod",
            "statedDueDate",
            "title",
            "confidence",
            "responses",
          ],
        ]);
        expect(yield* Ref.get(scripted.answerDefinitions)).toStrictEqual([0]);
      })
    );
  });

  it.layer(agentsLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "lets the paralegal concede, drops a confidence that is no probability, and fails a revision it cannot decode",
      Effect.fnUntraced(function* () {
        const scripted = yield* ScriptedModel;
        const paralegal = yield* DocketParalegal;
        const conceded = {
          citedText: null,
          isDocketItem: false,
          mailDate: null,
          matterReferences: [],
          rationale: "On a second look, a newsletter.",
          responsePeriod: null,
          responses: [{ action: "revised", citedText: null, field: "classification" }],
          statedDueDate: null,
          title: null,
        };

        yield* scripted.respondWith(json({ ...conceded, confidence: 1.7 }));
        const outOfRange = yield* paralegal.revise({ disputes, message, previous: dismissedEntry });
        yield* scripted.respondWith(json({ ...conceded, confidence: null }));
        const unstated = yield* paralegal.revise({ disputes, message, previous: dismissedEntry });
        yield* scripted.respondWith(json(revisionWire({ mailDate: "early January" })));
        const badDate = yield* failureOf(paralegal.revise({ disputes, message, previous: paralegalEntry }));
        const prompts = yield* scripted.prompts;

        expect(outOfRange.entry).toMatchObject({
          _tag: "ParalegalNotDocketItem",
          rationale: "On a second look, a newsletter.",
        });
        assertNone(outOfRange.selfReportedConfidence);
        assertNone(unstated.selfReportedConfidence);
        assertSome(
          O.map(badDate, (error) => [error.stage, error.cause]),
          ["enter", "wire-decode"]
        );
        assertTrue(O.exists(A.head(prompts), mentions("You found nothing to docket in this message.")));
        assertTrue(O.exists(A.head(prompts), mentions("Rationale: Fixture newsletter.")));
        assertTrue(O.exists(A.last(prompts), mentions("Stated due date: 2031-07-19")));
        assertTrue(O.exists(A.last(prompts), mentions("Mail date: (not given)")));
      })
    );
  });

  it.layer(agentsLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "decodes the secretary's findings, shows it the entry without its dates, and sends the documents",
      Effect.fnUntraced(function* () {
        const scripted = yield* ScriptedModel;
        const secretary = yield* DocketSecretary;
        yield* scripted.respondWith(
          json({
            findings: [
              { field: "matter-references", reason: "Names a matter the message does not mention.", severity: "P1" },
              { field: "title", reason: "Names no date type.", severity: "P3" },
            ],
          })
        );

        const findings = yield* secretary.critique({ documents: [pdf], entry: paralegalEntry, message });
        const prompt = A.last(yield* scripted.prompts);

        expect(A.map(findings, (finding) => [finding.severity, finding.field, finding.reason])).toStrictEqual([
          ["P1", "matter-references", "Names a matter the message does not mention."],
          ["P3", "title", "Names no date type."],
        ]);
        assertTrue(O.exists(prompt, mentions("Title: Fixture response due")));
        assertTrue(O.exists(prompt, mentions("1 source document(s) are attached to this request.")));
        assertTrue(!O.exists(prompt, mentions("2031-07-19")));
        expect(A.length(pipe(prompt, O.map(fileParts), O.getOrElse(A.empty<Prompt.FilePart>)))).toBe(1);
        expect(yield* Ref.get(scripted.answerFields)).toStrictEqual([["findings"]]);
        expect(yield* Ref.get(scripted.answerDefinitions)).toStrictEqual([0]);
      })
    );
  });

  it.layer(agentsLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "accepts an empty list of findings, fails one without a reason, and asks once more without refused documents",
      Effect.fnUntraced(function* () {
        const scripted = yield* ScriptedModel;
        const secretary = yield* DocketSecretary;

        yield* scripted.respondWith(json({ findings: [] }));
        const none = yield* secretary.critique({ documents: [], entry: dismissedEntry, message: bareMessage });
        yield* scripted.respondWith(json({ findings: [{ field: "title", reason: "", severity: "P2" }] }));
        const unexplained = yield* failureOf(secretary.critique({ documents: [], entry: paralegalEntry, message }));
        const before = A.length(yield* scripted.prompts);
        yield* scripted.respondInTurn([rejected, json({ findings: [] })]);
        const retried = yield* secretary.critique({ documents: [pdf], entry: paralegalEntry, message });
        const prompts = A.drop(yield* scripted.prompts, before);

        expect(none).toStrictEqual([]);
        assertSome(
          O.map(unexplained, (error) => [error.stage, error.cause]),
          ["review", "wire-decode"]
        );
        expect(retried).toStrictEqual([]);
        expect(A.map(A.map(prompts, fileParts), A.length)).toStrictEqual([1, 0]);
        assertTrue(O.exists(A.last(prompts), mentions("No source document is attached.")));
      })
    );
  });

  it.layer(agentsLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "asks the secretary to read the disputed fields again against the text the paralegal relies on",
      Effect.fnUntraced(function* () {
        const scripted = yield* ScriptedModel;
        const secretary = yield* DocketSecretary;
        yield* scripted.respondWith(
          json(
            secretaryWire({
              matterReferences: [],
              responsePeriod: { amount: 2, unit: "months" },
              statedDueDate: "2030-04-15",
            })
          )
        );

        const reading = yield* secretary.reread(rereadInput([pdf]));
        const prompt = A.last(yield* scripted.prompts);

        expect(reading.readFromSourceDocument).toBe(true);
        assertSome(iso(reading.mailDate), "2030-01-08");
        assertSome(
          O.map(reading.responsePeriod, (period) => [period.amount, period.unit]),
          [2, "months"]
        );
        for (const fragment of [
          "Fields to read again: mail-date, response-period",
          "Your earlier findings on these fields:",
          "- response-period: The period looks misread.",
          "- response-period: revised",
          "- mail-date: defended",
          "1 source document(s) are attached to this request.",
        ]) {
          assertTrue(O.exists(prompt, mentions(fragment)));
        }
        // The paralegal's quoted text is checked in code and never shown to the critic.
        assertTrue(!O.exists(prompt, mentions("within two months")));
        assertTrue(!O.exists(prompt, mentions("relies on")));
        expect(A.length(pipe(prompt, O.map(fileParts), O.getOrElse(A.empty<Prompt.FilePart>)))).toBe(1);
        // The same answer shape as the first reading.
        expect(yield* Ref.get(scripted.answerFields)).toStrictEqual([SECRETARY_FIELDS]);
        assertSome(iso(reading.statedDueDate), "2030-04-15");
      })
    );
  });

  it.layer(agentsLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "re-reads once more without refused documents, and fails a re-reading whose date is unusable",
      Effect.fnUntraced(function* () {
        const scripted = yield* ScriptedModel;
        const secretary = yield* DocketSecretary;

        yield* scripted.respondInTurn([rejected, json(secretaryWire())]);
        const reading = yield* secretary.reread(rereadInput([pdf]));
        const prompts = yield* scripted.prompts;
        yield* scripted.respondWith(json(secretaryWire({ mailDate: "early January" })));
        const badDate = yield* failureOf(secretary.reread(rereadInput([], [])));
        const noFindings = A.last(yield* scripted.prompts);

        assertTrue(O.exists(noFindings, mentions("- none; the two readings differed or a check failed")));
        // With nothing attached, the reading cannot have come from a source document.
        expect(reading.readFromSourceDocument).toBe(false);
        expect(A.map(A.map(prompts, fileParts), A.length)).toStrictEqual([1, 0]);
        assertSome(
          O.map(badDate, (error) => [error.stage, error.cause]),
          ["review", "wire-decode"]
        );
      })
    );
  });

  // Real clock and a one-millisecond base, so the retry delays elapse on their own.
  it.layer(fastRetryLayer, { excludeTestServices: true, timeout: "10 seconds" })((it) => {
    it.effect(
      "retries a retryable failure of each loop call, and reports one that is not retryable at its stage",
      Effect.fnUntraced(function* () {
        const scripted = yield* ScriptedModel;
        const paralegal = yield* DocketParalegal;
        const secretary = yield* DocketSecretary;

        yield* scripted.respondInTurn([rateLimited, json(revisionWire())]);
        const revision = yield* paralegal.revise({ disputes, message, previous: datedEntry });
        yield* scripted.respondInTurn([rateLimited, json({ findings: [] })]);
        const findings = yield* secretary.critique({ documents: [], entry: paralegalEntry, message });
        yield* scripted.respondInTurn([rateLimited, json(secretaryWire())]);
        const reading = yield* secretary.reread(rereadInput([]));
        const asked = A.length(yield* scripted.prompts);
        yield* scripted.respondWith(rejected);
        const failures = [
          yield* failureOf(paralegal.revise({ disputes, message, previous: datedEntry })),
          yield* failureOf(secretary.critique({ documents: [], entry: paralegalEntry, message })),
          yield* failureOf(secretary.reread(rereadInput([]))),
        ];

        expect(A.length(revision.responses)).toBe(2);
        expect(findings).toStrictEqual([]);
        expect(reading.isDocketItem).toBe(true);
        expect(asked).toBe(6);
        expect(A.map(A.getSomes(failures), (error) => [error.stage, error.cause])).toStrictEqual([
          ["enter", "model:InvalidRequestError"],
          ["review", "model:InvalidRequestError"],
          ["review", "model:InvalidRequestError"],
        ]);
      })
    );
  });
});
