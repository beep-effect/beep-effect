/**
 * Paralegal and secretary agent proofs over a scripted language model.
 *
 * Every fixture is synthetic: invented ids, `*.invalid` hosts and placeholder
 * text. No real mail, sender, matter or client appears here.
 */
import { DocketAgentsOptions, makeDocketAgentsLayer } from "@beep/law-practice-server/DocketIntake";
import {
  DocketMessage,
  DocketParalegal,
  DocketSecretary,
  DocketSourceDocument,
  ParalegalDocketEntry,
  ParalegalNotDocketItem,
} from "@beep/law-practice-use-cases/DocketIntake";
import { LocalDate } from "@beep/schema/LocalDate";
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
  isDocketItem: true,
  mailDate: "2030-01-08",
  matterReferences: ["FIX-0001"],
  notes: "Read the attached fixture action. The period is on its first page.",
  readFromSourceDocument: true,
  responsePeriod: { amount: 3, unit: "months" },
  ...overrides,
});

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
        assertTrue(O.exists(A.head(prompts), mentions("FIX-0001")));
        expect(yield* Ref.get(scripted.answerFields)).toStrictEqual([
          ["isDocketItem", "mailDate", "matterReferences", "rationale", "responsePeriod", "statedDueDate", "title"],
        ]);
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
        // The schema the provider answers in has nowhere to put a due date.
        expect(yield* Ref.get(scripted.answerFields)).toStrictEqual([
          ["isDocketItem", "mailDate", "matterReferences", "notes", "readFromSourceDocument", "responsePeriod"],
        ]);
        expect(R.keys(review)).not.toContain("dueDate");
        expect(R.keys(review)).not.toContain("statedDueDate");
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
        yield* scripted.respondWith(json(secretaryWire({ mailDate: "", responsePeriod: null })));

        const review = yield* secretary.review({ documents: [], entry: paralegalEntry, message });
        const prompt = A.last(yield* scripted.prompts);

        expect(review.readFromSourceDocument).toBe(false);
        assertNone(review.mailDate);
        assertNone(review.responsePeriod);
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
        yield* scripted.respondWith(json(secretaryWire({ responsePeriod: { amount: -1, unit: "days" } })));
        const badPeriod = yield* failureOf(secretary.review({ documents: [pdf], entry: paralegalEntry, message }));

        for (const failure of [badDate, badPeriod]) {
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
});
