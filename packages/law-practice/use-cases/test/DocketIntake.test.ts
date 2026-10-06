/**
 * Docket intake pipeline proofs over in-memory ports.
 *
 * Every fixture is synthetic: invented ids, invented reference numbers and
 * placeholder text. No real mail, sender, matter or client appears here.
 */
import { DocketResponsePeriod } from "@beep/law-practice-domain/values/DocketDeadline";
import {
  DocketCalendar,
  DocketIntake,
  DocketIntakeConfig,
  DocketIntakeError,
  DocketIntakeState,
  DocketIntakeStore,
  DocketLedgerRecord,
  DocketMailbox,
  DocketMatterLookup,
  DocketMessage,
  DocketParalegal,
  DocketReviewConfig,
  DocketReviewProgress,
  DocketSecretary,
  DocketSourceDocument,
  DocketWrittenEntry,
  ExtractorFieldResponse,
  MatterAmbiguous,
  MatterNotFound,
  MatterUnique,
  makeDocketIntakeLayer,
  NotDocketItem,
  ParalegalDocketEntry,
  ParalegalNotDocketItem,
  ParalegalRevision,
  ReviewFinding,
  SecretaryReview,
} from "@beep/law-practice-use-cases/DocketIntake";
import { addDays, isAfter, LocalDate, equals as sameDate } from "@beep/schema/LocalDate";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { Context, Effect, Exit, HashMap, Layer, pipe, Ref } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type {
  DocketCalendarEntry,
  DocketIntakeOutcome,
  DocketParalegalShape,
  DocketSecretaryShape,
  DocketSourceFolder,
  MatterLookupResult,
  ParalegalEntry,
} from "@beep/law-practice-use-cases/DocketIntake";

const TODAY = LocalDate.make({ year: 2030, month: 1, day: 10 });
const RECEIVED = LocalDate.make({ year: 2030, month: 1, day: 9 });

const TestCrypto = Layer.succeed(
  Crypto.Crypto,
  Crypto.make({
    digest: (algorithm, data) =>
      Effect.tryPromise({
        catch: (cause) =>
          PlatformError.systemError({
            _tag: "Unknown",
            cause,
            description: "Could not compute digest",
            method: "digest",
            module: "Crypto",
          }),
        try: () =>
          globalThis.crypto.subtle.digest(algorithm, new Uint8Array(data)).then((buffer) => new Uint8Array(buffer)),
      }),
    randomBytes: (size) => globalThis.crypto.getRandomValues(new Uint8Array(size)),
  })
);

// The fixture notice states its dates and period in words the extractor can cite.
const CITED = "Mailed January 8, 2030. A response is due within three months";
const BODY = `Synthetic fixture body. ${CITED} of the mailing date. Also noted on January 9, 2030. Reference FIX-0001.`;

const message = (id: string, minute = 0): DocketMessage =>
  DocketMessage.make({
    bodyText: BODY,
    internetMessageId: O.some(`<${id}@fixture.invalid>`),
    messageId: id,
    receivedAt: `2030-01-09T10:${Str.padStart(2, "0")(`${minute}`)}:00Z`,
    receivedDate: RECEIVED,
    webLink: O.some(`https://outlook.fixture.invalid/mail/${id}`),
  });

const foundIn = (id: string, sourceFolder: DocketSourceFolder): DocketMessage =>
  DocketMessage.make({
    bodyText: BODY,
    messageId: id,
    receivedAt: "2030-01-09T10:00:00Z",
    receivedDate: RECEIVED,
    sourceFolder,
  });

const threeMonths = DocketResponsePeriod.make({ amount: 3, unit: "months" });
const mailDate = LocalDate.make({ year: 2030, month: 1, day: 8 });
const computedDue = LocalDate.make({ year: 2030, month: 4, day: 8 });

const docketEntry = (overrides: Partial<ConstructorParameters<typeof ParalegalDocketEntry>[0]> = {}) =>
  ParalegalDocketEntry.make({
    matterReferences: ["FIX-0001"],
    rationale: "States a response period.",
    title: "Fixture response due",
    ...overrides,
  });

const datedEntry = (overrides: Partial<ConstructorParameters<typeof ParalegalDocketEntry>[0]> = {}) =>
  docketEntry({
    citedText: O.some(CITED),
    mailDate: O.some(mailDate),
    responsePeriod: O.some(threeMonths),
    ...overrides,
  });

// An undated docket item both agents agree on.
const undatedReview = SecretaryReview.make({
  isDocketItem: true,
  matterReferences: ["FIX-0001"],
  notes: "No date anywhere.",
});

const twoMonths = DocketResponsePeriod.make({ amount: 2, unit: "months" });
const fortySevenDays = DocketResponsePeriod.make({ amount: 47, unit: "days" });

// A notice whose period is distinctive enough to tell whether it leaked into a dispute.
const DISTINCT_CITED = "Mailed January 8, 2030. A response is due within 47 days";
const distinctMessage = DocketMessage.make({
  bodyText: `Synthetic fixture body. ${DISTINCT_CITED} of the mailing date. Reference FIX-0001.`,
  messageId: "m-distinct",
  receivedAt: "2030-01-09T10:00:00Z",
  receivedDate: RECEIVED,
});

const distinctReview = SecretaryReview.make({
  isDocketItem: true,
  mailDate: O.some(mailDate),
  matterReferences: ["FIX-0001"],
  notes: "Read the attached fixture action.",
  readFromSourceDocument: true,
  responsePeriod: O.some(fortySevenDays),
});

// The common notice from a foreign associate: it states its due date and nothing else.
const STATED_CITED = "Your response is due April 15, 2030";
const statedDue = LocalDate.make({ year: 2030, month: 4, day: 15 });
const statedMessage = DocketMessage.make({
  bodyText: `Synthetic fixture body. ${STATED_CITED}. A later notice may say April 16, 2030. Reference FIX-0001.`,
  messageId: "m-stated",
  receivedAt: "2030-01-09T10:00:00Z",
  receivedDate: RECEIVED,
});
const statedEntry = () =>
  Effect.succeed(docketEntry({ citedText: O.some(STATED_CITED), statedDueDate: O.some(statedDue) }));
const statedReview = (overrides: Partial<ConstructorParameters<typeof SecretaryReview>[0]> = {}) =>
  SecretaryReview.make({
    citedText: O.some(STATED_CITED),
    isDocketItem: true,
    matterReferences: ["FIX-0001"],
    notes: "Read the due date in the attached fixture letter.",
    readFromSourceDocument: true,
    statedDueDate: O.some(statedDue),
    ...overrides,
  });
// The source states 15 April, while its own mail date and period give 8 April.
const inconsistentReview = statedReview({
  citedText: O.some(`${STATED_CITED}\n${CITED}`),
  mailDate: O.some(mailDate),
  responsePeriod: O.some(threeMonths),
});

const materialTitleFinding = ReviewFinding.make({
  field: "title",
  reason: "The title names a response that is not what is due.",
  severity: "P1",
});
const materialReferenceFinding = ReviewFinding.make({
  field: "matter-references",
  reason: "Names a matter the message does not mention.",
  severity: "P0",
});
const minorTitleFinding = ReviewFinding.make({ field: "title", reason: "Names no date type.", severity: "P3" });

const agreeingReview = SecretaryReview.make({
  isDocketItem: true,
  mailDate: O.some(mailDate),
  matterReferences: ["FIX-0001"],
  notes: "Read the attached fixture action.",
  readFromSourceDocument: true,
  responsePeriod: O.some(threeMonths),
});

type ReviseInput = Parameters<DocketParalegalShape["revise"]>[0];
type CritiqueInput = Parameters<DocketSecretaryShape["critique"]>[0];
type RereadInput = Parameters<DocketSecretaryShape["reread"]>[0];

type Script = {
  readonly ambiguousCreates: number;
  readonly ambiguousLost: boolean;
  readonly calendarDown: boolean;
  readonly entryLinks: boolean;
  readonly documents: boolean;
  readonly critique: (input: CritiqueInput) => Effect.Effect<ReadonlyArray<ReviewFinding>, DocketIntakeError>;
  readonly enter: (messageId: string) => Effect.Effect<ParalegalEntry, DocketIntakeError>;
  readonly matter: Effect.Effect<MatterLookupResult, DocketIntakeError>;
  readonly messages: ReadonlyArray<DocketMessage>;
  /** The second argument counts the re-readings asked so far, this one included. */
  readonly reread: (input: RereadInput, asked: number) => Effect.Effect<SecretaryReview, DocketIntakeError>;
  readonly review: (messageId: string) => Effect.Effect<SecretaryReview, DocketIntakeError>;
  readonly revise: (input: ReviseInput) => Effect.Effect<ParalegalRevision, DocketIntakeError>;
};

// The extractor defends everything: the same entry comes back.
const defend = (input: ReviseInput) => Effect.succeed(ParalegalRevision.make({ entry: input.previous }));

const defaultScript: Script = {
  ambiguousCreates: 0,
  ambiguousLost: false,
  calendarDown: false,
  entryLinks: true,
  documents: true,
  critique: () => Effect.succeed([]),
  enter: () => Effect.succeed(datedEntry()),
  matter: Effect.succeed(MatterUnique.make({ client: O.some("0000"), familyKey: "0000.0001", verified: true })),
  messages: [message("m1")],
  reread: () => Effect.succeed(agreeingReview),
  review: () => Effect.succeed(agreeingReview),
  revise: defend,
};

type HarnessShape = {
  readonly creates: Ref.Ref<number>;
  readonly critiques: Ref.Ref<number>;
  readonly enters: Ref.Ref<number>;
  readonly entries: Ref.Ref<HashMap.HashMap<string, DocketCalendarEntry>>;
  readonly marked: Ref.Ref<ReadonlyArray<string>>;
  readonly rereads: Ref.Ref<ReadonlyArray<RereadInput>>;
  readonly reviews: Ref.Ref<number>;
  readonly revises: Ref.Ref<ReadonlyArray<ReviseInput>>;
  readonly saves: Ref.Ref<ReadonlyArray<DocketIntakeState>>;
  readonly script: Ref.Ref<Script>;
  readonly sinceSeen: Ref.Ref<ReadonlyArray<O.Option<string>>>;
};

class Harness extends Context.Service<Harness, HarnessShape>()(
  "@beep/law-practice-use-cases/test/DocketIntake.test/Harness"
) {}

const written = (key: string, withLink = true): DocketWrittenEntry =>
  DocketWrittenEntry.make({
    eventId: S.NonEmptyString.make(`event:${key}`),
    webLink: withLink ? O.some(`https://outlook.fixture.invalid/calendar/${key}`) : O.none(),
  });

const harnessLayer = (script: Script) =>
  Layer.effect(
    Harness,
    Effect.gen(function* () {
      return Harness.of({
        creates: yield* Ref.make(0),
        critiques: yield* Ref.make(0),
        enters: yield* Ref.make(0),
        entries: yield* Ref.make(HashMap.empty<string, DocketCalendarEntry>()),
        marked: yield* Ref.make<ReadonlyArray<string>>([]),
        rereads: yield* Ref.make<ReadonlyArray<RereadInput>>([]),
        reviews: yield* Ref.make(0),
        revises: yield* Ref.make<ReadonlyArray<ReviseInput>>([]),
        saves: yield* Ref.make<ReadonlyArray<DocketIntakeState>>([]),
        script: yield* Ref.make(script),
        sinceSeen: yield* Ref.make<ReadonlyArray<O.Option<string>>>([]),
      });
    })
  );

const portsLayer = Layer.mergeAll(
  Layer.effect(
    DocketCalendar,
    Effect.gen(function* () {
      const harness = yield* Harness;
      return DocketCalendar.of({
        create: Effect.fn("FakeCalendar.create")(function* (entry) {
          const attempt = yield* Ref.updateAndGet(harness.creates, (count) => count + 1);
          const script = yield* Ref.get(harness.script);
          if (script.calendarDown) {
            return yield* DocketIntakeError.make({ cause: "unavailable", stage: "calendar" });
          }
          // The request never reached the calendar, and the caller cannot tell that either.
          if (script.ambiguousLost) {
            return yield* DocketIntakeError.make({ ambiguousWrite: true, cause: "transport", stage: "calendar" });
          }
          yield* Ref.update(harness.entries, HashMap.set(entry.key, entry));
          // The write lands, but its response is lost: the caller cannot tell.
          if (attempt <= script.ambiguousCreates) {
            return yield* DocketIntakeError.make({ ambiguousWrite: true, cause: "transport", stage: "calendar" });
          }
          return written(entry.key, script.entryLinks);
        }),
        findByKey: Effect.fn("FakeCalendar.findByKey")(function* (key) {
          const entries = yield* Ref.get(harness.entries);
          return O.map(HashMap.get(entries, key), () => written(key));
        }),
      });
    })
  ),
  Layer.effect(
    DocketIntakeStore,
    Effect.gen(function* () {
      const harness = yield* Harness;
      return DocketIntakeStore.of({
        load: Ref.get(harness.saves).pipe(
          Effect.map((saves) => O.getOrElse(A.last(saves), () => DocketIntakeState.make({})))
        ),
        save: Effect.fn("FakeStore.save")(function* (state) {
          yield* Ref.update(harness.saves, A.append(state));
        }),
      });
    })
  ),
  Layer.effect(
    DocketMailbox,
    Effect.gen(function* () {
      const harness = yield* Harness;
      return DocketMailbox.of({
        markEntered: Effect.fn("FakeMailbox.markEntered")(function* (entered) {
          yield* Ref.update(harness.marked, A.append(entered.messageId));
        }),
        receivedSince: Effect.fn("FakeMailbox.receivedSince")(function* (since) {
          yield* Ref.update(harness.sinceSeen, A.append(since));
          return (yield* Ref.get(harness.script)).messages;
        }),
        sourceDocuments: Effect.fn("FakeMailbox.sourceDocuments")(function* () {
          const script = yield* Ref.get(harness.script);
          return script.documents
            ? [DocketSourceDocument.make({ bytes: new Uint8Array([1, 2, 3]), contentType: "application/pdf" })]
            : [];
        }),
      });
    })
  ),
  Layer.effect(
    DocketParalegal,
    Effect.gen(function* () {
      const harness = yield* Harness;
      return DocketParalegal.of({
        enter: Effect.fn("FakeParalegal.enter")(function* (entered) {
          yield* Ref.update(harness.enters, (count) => count + 1);
          const script = yield* Ref.get(harness.script);
          return yield* script.enter(entered.messageId);
        }),
        revise: Effect.fn("FakeParalegal.revise")(function* (input) {
          yield* Ref.update(harness.revises, A.append(input));
          return yield* (yield* Ref.get(harness.script)).revise(input);
        }),
      });
    })
  ),
  Layer.effect(
    DocketSecretary,
    Effect.gen(function* () {
      const harness = yield* Harness;
      return DocketSecretary.of({
        critique: Effect.fn("FakeSecretary.critique")(function* (input) {
          yield* Ref.update(harness.critiques, (count) => count + 1);
          return yield* (yield* Ref.get(harness.script)).critique(input);
        }),
        reread: Effect.fn("FakeSecretary.reread")(function* (input) {
          const asked = yield* Ref.updateAndGet(harness.rereads, A.append(input));
          return yield* (yield* Ref.get(harness.script)).reread(input, A.length(asked));
        }),
        review: Effect.fn("FakeSecretary.review")(function* (input) {
          yield* Ref.update(harness.reviews, (count) => count + 1);
          const script = yield* Ref.get(harness.script);
          return yield* script.review(input.message.messageId);
        }),
      });
    })
  ),
  Layer.effect(
    DocketMatterLookup,
    Effect.gen(function* () {
      const harness = yield* Harness;
      return DocketMatterLookup.of({
        lookup: Effect.fn("FakeMatterLookup.lookup")(function* () {
          return yield* (yield* Ref.get(harness.script)).matter;
        }),
      });
    })
  )
);

const FailingCrypto = Layer.succeed(
  Crypto.Crypto,
  Crypto.make({
    digest: () =>
      Effect.fail(
        PlatformError.systemError({
          _tag: "Unknown",
          description: "digest unavailable",
          method: "digest",
          module: "Crypto",
        })
      ),
    randomBytes: (size) => new Uint8Array(size),
  })
);

const oldMessage = (id: string): DocketMessage =>
  DocketMessage.make({
    bodyText: "Synthetic fixture body. Due 2030-01-11.",
    messageId: id,
    receivedAt: "2029-12-20T09:00:00Z",
    receivedDate: LocalDate.make({ year: 2029, month: 12, day: 20 }),
  });

const messageAt = (id: string, receivedAt: string): DocketMessage =>
  DocketMessage.make({
    bodyText: BODY,
    messageId: id,
    receivedAt,
    receivedDate: RECEIVED,
  });

const testLayer = (
  script: Partial<Script> = {},
  config: Partial<ConstructorParameters<typeof DocketIntakeConfig>[0]> = {},
  crypto: Layer.Layer<Crypto.Crypto> = TestCrypto
) =>
  makeDocketIntakeLayer(DocketIntakeConfig.make({ mailbox: "fixture-mailbox", ...config })).pipe(
    Layer.provide(portsLayer),
    Layer.provide(crypto),
    Layer.provideMerge(harnessLayer({ ...defaultScript, ...script }))
  );

// A threshold any round without a material finding reaches: the outcome then depends on what the
// two agents read, as it did before the loop, and not on how far they agree.
const lenient = { review: DocketReviewConfig.make({ acceptThreshold: UnitInterval.make(0.5) }) };

const reviewOf = (outcome: DocketIntakeOutcome) =>
  outcome._tag === "DocketEntered" || outcome._tag === "DocketNeedsReview" ? outcome.review : O.none();

const reasonOf = (outcome: DocketIntakeOutcome): string =>
  outcome._tag === "DocketNeedsReview" ? outcome.reason : "unexpected";

const ledgerRecord = Effect.fnUntraced(function* (messageId: string) {
  const harness = yield* Harness;
  return O.flatMap(A.last(yield* Ref.get(harness.saves)), (state) => R.get(state.ledger, messageId));
});

const titled = (input: CritiqueInput, title: string): boolean =>
  input.entry._tag === "ParalegalDocketEntry" && input.entry.title === title;

const entriesOf = Effect.gen(function* () {
  const harness = yield* Harness;
  return A.fromIterable(HashMap.values(yield* Ref.get(harness.entries)));
});

const kinds = (entries: ReadonlyArray<DocketCalendarEntry>, kind: DocketCalendarEntry["kind"]) =>
  A.filter(entries, (entry) => entry.kind === kind);

const tagOf = (outcome: DocketIntakeOutcome): string => outcome._tag;

const DayOffset = S.Int.check(S.isBetween({ maximum: 900, minimum: 40 }));

describe("@beep/law-practice-use-cases DocketIntake", () => {
  it.layer(testLayer(), { timeout: "5 seconds" })((it) => {
    it.effect(
      "enters a dated item as one tentative entry with its full ladder",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;
        const harness = yield* Harness;

        const outcome = yield* intake.processMessage(message("m1"), TODAY);
        const entries = yield* entriesOf;
        const due = A.head(kinds(entries, "due"));

        expect(tagOf(outcome)).toBe("DocketEntered");
        expect(kinds(entries, "reminder")).toHaveLength(4);
        assertTrue(O.exists(due, (entry) => sameDate(entry.date, computedDue) && entry.tentative));
        assertSome(
          O.map(due, (entry) => entry.category),
          "Docket - unverified"
        );
        assertTrue(O.exists(due, (entry) => Str.startsWith("[UNVERIFIED] ")(entry.subject)));
        assertTrue(
          A.every(kinds(entries, "reminder"), (entry) => !entry.tentative && entry.category === "Docket - reminder")
        );
        expect(outcome._tag === "DocketEntered" ? outcome.flags : ["unexpected"]).toStrictEqual([]);
        expect(yield* Ref.get(harness.marked)).toStrictEqual(["m1"]);
        // Accepted in the first round: one reading, one critique, nothing to revise.
        assertSome(
          O.map(reviewOf(outcome), (review) => [review.status, review.rounds, review.finalScore, review.maxRounds]),
          ["accepted", 1, 1, 3]
        );
        expect(yield* Ref.get(harness.revises)).toHaveLength(0);

        // Processing the same message again finds every entry by key and creates nothing, and the
        // completed round is read back from the ledger instead of asking the agents again.
        const createsBefore = yield* Ref.get(harness.creates);
        const again = yield* intake.processMessage(message("m1"), TODAY);

        expect(tagOf(again)).toBe("DocketEntered");
        expect(yield* Ref.get(harness.creates)).toBe(createsBefore);
        expect(yield* entriesOf).toHaveLength(5);
        expect([
          yield* Ref.get(harness.enters),
          yield* Ref.get(harness.reviews),
          yield* Ref.get(harness.critiques),
        ]).toStrictEqual([1, 1, 1]);
      })
    );
  });

  it.layer(testLayer({ ambiguousCreates: 1 }), { timeout: "5 seconds" })((it) => {
    it.effect(
      "reconciles an ambiguous create by key instead of creating twice",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;
        const harness = yield* Harness;

        const outcome = yield* intake.processMessage(message("m1"), TODAY);

        expect(tagOf(outcome)).toBe("DocketEntered");
        expect(kinds(yield* entriesOf, "due")).toHaveLength(1);
        expect(yield* Ref.get(harness.creates)).toBe(5);
      })
    );
  });

  it.layer(testLayer({}, lenient), { timeout: "20 seconds" })((it) => {
    it.effect.prop(
      "puts the entry on the earlier date and flags the difference whenever the two dates differ",
      { periodDays: Arbitrary.schema(DayOffset), statedOffset: Arbitrary.schema(DayOffset) },
      Effect.fnUntraced(function* ({ periodDays, statedOffset }) {
        const intake = yield* DocketIntake;
        const harness = yield* Harness;
        const stated = addDays(TODAY, statedOffset);
        const computed = addDays(mailDate, periodDays);
        const id = `prop-${statedOffset}-${periodDays}`;
        yield* Ref.set(harness.script, {
          ...defaultScript,
          enter: () =>
            Effect.succeed(
              docketEntry({ citedText: O.some(`Due ${stated.toISOString()}`), statedDueDate: O.some(stated) })
            ),
          review: () =>
            Effect.succeed(
              SecretaryReview.make({
                isDocketItem: true,
                mailDate: O.some(mailDate),
                notes: "Fixture review.",
                readFromSourceDocument: true,
                responsePeriod: O.some(DocketResponsePeriod.make({ amount: periodDays, unit: "days" })),
              })
            ),
        });

        const outcome = yield* intake.processMessage(
          DocketMessage.make({
            bodyText: `Synthetic fixture body. Due ${stated.toISOString()}.`,
            messageId: id,
            receivedAt: "2030-01-09T10:00:00Z",
            receivedDate: RECEIVED,
            webLink: O.some(`https://outlook.fixture.invalid/mail/${id}`),
          }),
          TODAY
        );
        const due = A.findFirst(kinds(yield* entriesOf, "due"), (entry) =>
          Str.includes(`/mail/${id}\n`)(entry.bodyText)
        );

        assertTrue(O.exists(due, (entry) => !isAfter(entry.date, stated) && !isAfter(entry.date, computed)));
        assertTrue(O.exists(due, (entry) => sameDate(entry.date, stated) || sameDate(entry.date, computed)));
        assertTrue(
          O.exists(
            due,
            (entry) =>
              Str.includes(stated.toISOString())(entry.bodyText) && Str.includes(computed.toISOString())(entry.bodyText)
          )
        );
        expect(outcome._tag === "DocketEntered" && A.contains(outcome.flags, "dates-differ")).toBe(
          !sameDate(stated, computed)
        );
      }),
      { arbitrary: fcRuns(40) }
    );
  });

  it.layer(
    testLayer({
      documents: false,
      enter: () => Effect.succeed(docketEntry()),
      matter: Effect.succeed(MatterAmbiguous.make({ familyKeys: ["0000.0001", "0001.0001"] })),
      review: () => Effect.succeed(undatedReview),
    }),
    { timeout: "5 seconds" }
  )((it) => {
    it.effect(
      "never guesses a date: an undated item gets one needs-review entry and no ladder",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;

        const outcome = yield* intake.processMessage(message("m1"), TODAY);
        const entries = yield* entriesOf;

        expect(tagOf(outcome)).toBe("DocketNeedsReview");
        expect(reasonOf(outcome)).toBe("no-usable-date");
        assertSome(
          O.map(reviewOf(outcome), (review) => review.status),
          "accepted"
        );
        assertTrue(A.every(entries, (entry) => Str.startsWith("[NEEDS REVIEW] ")(entry.subject)));
        expect(outcome._tag === "DocketNeedsReview" ? outcome.flags : []).toStrictEqual([
          "matter-ambiguous",
          "source-document-missing",
        ]);
        expect(entries).toHaveLength(1);
        assertTrue(
          A.every(
            entries,
            (entry) =>
              entry.kind === "needs-review" &&
              entry.category === "Docket - needs review" &&
              sameDate(entry.date, addDays(RECEIVED, 1))
          )
        );
      })
    );
  });

  it.layer(
    testLayer({ enter: () => Effect.succeed(ParalegalNotDocketItem.make({ rationale: "Fixture newsletter." })) }),
    { timeout: "5 seconds" }
  )((it) => {
    it.effect(
      "flags a docket item the paralegal dismissed when the disagreement survives every round",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;
        const harness = yield* Harness;

        const outcome = yield* intake.processMessage(message("m1"), TODAY);
        const entries = yield* entriesOf;
        const flagged = A.head(kinds(entries, "needs-review"));

        expect(reasonOf(outcome)).toBe("flagged-max-rounds");
        assertSome(
          O.map(reviewOf(outcome), (review) => [review.status, review.rounds, review.finalScore]),
          ["flagged-max-rounds", 3, 0.5]
        );
        // One entry on the earliest date either agent read, and nothing that looks accepted.
        expect(entries).toHaveLength(1);
        assertSome(
          O.map(flagged, (entry) => entry.subject),
          "[REVIEW LIMIT REACHED] Possible docket item"
        );
        assertTrue(O.exists(flagged, (entry) => sameDate(entry.date, computedDue)));
        for (const fragment of [
          "Reason: flagged-max-rounds",
          "Review score: 0.5; needed 0.85. Rounds used: 3 of 3.",
          "- the two readings differ on: classification",
          "Date from the email (paralegal entry): none found",
          "Date recomputed by the reviewer: 2030-04-08 (mail date 2030-01-08 + 3 months)",
        ]) {
          assertTrue(O.exists(flagged, (entry) => Str.includes(fragment)(entry.bodyText)));
        }
        // The same entry came back each round, so the critic was asked for findings only once.
        expect([
          A.length(yield* Ref.get(harness.revises)),
          A.length(yield* Ref.get(harness.rereads)),
          yield* Ref.get(harness.critiques),
        ]).toStrictEqual([2, 2, 1]);
      })
    );
  });

  it.layer(
    testLayer(
      { enter: () => Effect.succeed(ParalegalNotDocketItem.make({ rationale: "Fixture newsletter." })) },
      lenient
    ),
    { timeout: "5 seconds" }
  )((it) => {
    it.effect(
      "leaves the decision to the attorney when a round is accepted although the agents disagree on the classification",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;

        const outcome = yield* intake.processMessage(message("m1"), TODAY);
        const entry = A.head(kinds(yield* entriesOf, "needs-review"));

        expect(reasonOf(outcome)).toBe("agents-disagree");
        assertSome(
          O.map(entry, (value) => value.subject),
          "[NEEDS REVIEW] Possible docket item"
        );
        assertTrue(O.exists(entry, (value) => sameDate(value.date, addDays(RECEIVED, 1))));
      })
    );
  });

  it.layer(
    testLayer({
      enter: () => Effect.succeed(ParalegalNotDocketItem.make({ rationale: "Fixture newsletter." })),
      review: () => Effect.succeed(SecretaryReview.make({ isDocketItem: false, notes: "Agreed." })),
    }),
    { timeout: "5 seconds" }
  )((it) => {
    it.effect(
      "writes nothing when both agents find no docket item",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;
        const harness = yield* Harness;

        const outcome = yield* intake.processMessage(message("m1"), TODAY);

        expect(tagOf(outcome)).toBe("NotDocketItem");
        expect(yield* entriesOf).toHaveLength(0);
        expect(yield* Ref.get(harness.reviews)).toBe(1);
        expect(yield* Ref.get(harness.critiques)).toBe(0);
        expect(yield* Ref.get(harness.marked)).toStrictEqual([]);
      })
    );
  });

  it.layer(
    testLayer(
      { enter: () => Effect.succeed(ParalegalNotDocketItem.make({ rationale: "Fixture newsletter." })) },
      { reviewNegatives: false }
    ),
    { timeout: "5 seconds" }
  )((it) => {
    it.effect(
      "skips the reviewer on negatives when that review is switched off",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;
        const harness = yield* Harness;

        expect(tagOf(yield* intake.processMessage(message("m1"), TODAY))).toBe("NotDocketItem");
        expect(yield* Ref.get(harness.reviews)).toBe(0);
      })
    );
  });

  it.layer(
    testLayer({
      matter: Effect.fail(DocketIntakeError.make({ cause: "unavailable", stage: "lookup" })),
    }),
    { timeout: "5 seconds" }
  )((it) => {
    it.effect(
      "keeps the entry and flags it when the matter lookup fails",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;

        const outcome = yield* intake.processMessage(message("m1"), TODAY);

        expect(outcome._tag === "DocketEntered" ? outcome.flags : ["unexpected"]).toStrictEqual([
          "matter-lookup-failed",
        ]);
      })
    );
  });

  it.layer(
    testLayer({
      matter: Effect.succeed(MatterNotFound.make({})),
      messages: [message("m1", 1), message("m2", 2), message("m3", 3)],
      review: (messageId) =>
        messageId === "m2"
          ? Effect.fail(DocketIntakeError.make({ cause: "timeout", stage: "review" }))
          : Effect.succeed(agreeingReview),
    }),
    { timeout: "5 seconds" }
  )((it) => {
    it.effect(
      "holds the cursor at a failing message, settles it as needs-review after the budget, then digests the day",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;
        const harness = yield* Harness;

        const first = yield* intake.pollOnce(TODAY);
        const afterFirst = O.flatMap(A.last(yield* Ref.get(harness.saves)), (state) => state.cursor);
        const second = yield* intake.pollOnce(TODAY);
        const third = yield* intake.pollOnce(TODAY);
        const afterThird = O.flatMap(A.last(yield* Ref.get(harness.saves)), (state) => state.cursor);
        const fourth = yield* intake.pollOnce(TODAY);
        const sinceSeen = yield* Ref.get(harness.sinceSeen);

        expect([first.entered, first.failed, first.processed, first.seen]).toStrictEqual([2, 1, 3, 3]);
        assertSome(afterFirst, "2030-01-09T10:01:00Z");
        expect([second.processed, second.failed]).toStrictEqual([1, 1]);
        expect([third.processed, third.needsReview, third.failed]).toStrictEqual([1, 1, 0]);
        assertSome(afterThird, "2030-01-09T10:03:00Z");
        expect(fourth.processed).toBe(0);
        assertNone(pipe(A.head(sinceSeen), O.flatten));
        assertSome(pipe(A.get(sinceSeen, 1), O.flatten), "2030-01-09T08:01:00.000Z");
        expect(kinds(yield* entriesOf, "due")).toHaveLength(2);
        expect(kinds(yield* entriesOf, "needs-review")).toHaveLength(1);

        // The digest of that day: one entry, written once, with counts and links but no message text.
        const digest = yield* intake.writeDigest(TODAY);
        const again = yield* intake.writeDigest(TODAY);
        const quiet = yield* intake.writeDigest(addDays(TODAY, 1));
        const state = A.last(yield* Ref.get(harness.saves));

        expect([digest.entered, digest.needsReview, digest.failed]).toStrictEqual([2, 1, 0]);
        expect(digest.written).toStrictEqual(again.written);
        expect(kinds(yield* entriesOf, "digest")).toHaveLength(1);
        assertTrue(!Str.includes("Synthetic fixture body")(digest.bodyText));
        assertNone(quiet.written);
        assertTrue(
          O.exists(
            O.flatMap(state, (value) => value.digestedThrough),
            (day) => sameDate(day, addDays(TODAY, 1))
          )
        );
      })
    );
  });
  it.layer(
    testLayer(
      {
        enter: () =>
          Effect.succeed(
            docketEntry({ citedText: O.some("Due 2030-01-11"), statedDueDate: O.some(addDays(TODAY, 1)) })
          ),
        matter: Effect.succeed(
          MatterUnique.make({
            applications: ["00/000,001"],
            client: O.some("0000"),
            dockets: ["0000.0001US01"],
            familyKey: "0000.0001",
            patents: ["0,000,001"],
            verified: false,
          })
        ),
        review: () => Effect.succeed(SecretaryReview.make({ isDocketItem: true, notes: "No period stated." })),
      },
      lenient
    ),
    { timeout: "5 seconds" }
  )((it) => {
    it.effect(
      "describes an unverified matter in full, notes a missing link, and places no reminder for a date that is tomorrow",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;

        const outcome = yield* intake.processMessage(oldMessage("m-old"), TODAY);
        const due = A.head(kinds(yield* entriesOf, "due"));

        expect(outcome._tag === "DocketEntered" ? outcome.flags : ["unexpected"]).toStrictEqual([
          "matter-unverified",
          "source-document-missing",
          "ladder-truncated",
        ]);
        expect(kinds(yield* entriesOf, "reminder")).toHaveLength(0);
        for (const fragment of [
          "family 0000.0001 (unverified; needs attorney)",
          "client 0000",
          "dockets 0000.0001US01",
          "applications 00/000,001",
          "patents 0,000,001",
          "Source email: link unavailable",
          "Reminders: none ahead",
        ]) {
          assertTrue(O.exists(due, (entry) => Str.includes(fragment)(entry.bodyText)));
        }
      })
    );
  });

  it.layer(
    testLayer(
      {
        enter: () => Effect.succeed(docketEntry()),
        review: () => Effect.succeed(SecretaryReview.make({ isDocketItem: false, notes: "No deadline here." })),
      },
      lenient
    ),
    { timeout: "5 seconds" }
  )((it) => {
    it.effect(
      "escalates when the reviewer dismisses the paralegal's entry, dated today for a message from a past day",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;

        const outcome = yield* intake.processMessage(oldMessage("m-old"), TODAY);
        const entry = A.head(kinds(yield* entriesOf, "needs-review"));

        expect(reasonOf(outcome)).toBe("agents-disagree");
        assertTrue(O.exists(entry, (value) => sameDate(value.date, TODAY)));
        assertTrue(O.exists(entry, (value) => Str.includes("Fixture response due")(value.subject)));
      })
    );
  });

  it.layer(testLayer({ ambiguousLost: true }), { timeout: "5 seconds" })((it) => {
    it.effect(
      "fails the message when an ambiguous create cannot be found afterwards",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;

        const outcome = yield* intake.processMessage(message("m1"), TODAY);

        expect(outcome._tag === "IntakeFailed" ? outcome.stage : "unexpected").toBe("calendar");
        expect(yield* entriesOf).toHaveLength(0);
      })
    );
  });

  it.layer(testLayer({}, {}, FailingCrypto), { timeout: "5 seconds" })((it) => {
    it.effect(
      "fails the message at the calendar stage when no idempotency key can be derived",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;
        const harness = yield* Harness;

        const outcome = yield* intake.processMessage(message("m1"), TODAY);

        expect(outcome._tag === "IntakeFailed" ? outcome.stage : "unexpected").toBe("calendar");
        expect(yield* Ref.get(harness.creates)).toBe(0);
      })
    );
  });

  it.layer(
    testLayer(
      {
        calendarDown: true,
        enter: (messageId) =>
          messageId === "m-news"
            ? Effect.succeed(ParalegalNotDocketItem.make({ rationale: "Fixture newsletter." }))
            : Effect.succeed(docketEntry()),
        messages: [messageAt("m-news", "0-not-a-timestamp"), messageAt("m-broken", "2030-01-09T10:01:00Z")],
        review: (messageId) =>
          messageId === "m-news"
            ? Effect.succeed(SecretaryReview.make({ isDocketItem: false, notes: "Agreed." }))
            : Effect.fail(DocketIntakeError.make({ cause: "timeout", stage: "review" })),
      },
      { maxAttempts: 1 }
    ),
    { timeout: "5 seconds" }
  )((it) => {
    it.effect(
      "keeps a message failing when even its needs-review entry cannot be written, and says so in the digest",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;
        const harness = yield* Harness;

        const first = yield* intake.pollOnce(TODAY);
        const second = yield* intake.pollOnce(TODAY);
        const digest = yield* intake.writeDigest(TODAY).pipe(Effect.flip);
        const sinceSeen = yield* Ref.get(harness.sinceSeen);

        expect([first.notDocket, first.failed, first.needsReview]).toStrictEqual([1, 1, 0]);
        expect([second.processed, second.failed]).toStrictEqual([1, 1]);
        expect(digest.stage).toBe("calendar");
        // A cursor that is not a timestamp is passed through unchanged rather than dropped.
        assertSome(pipe(A.get(sinceSeen, 1), O.flatten), "0-not-a-timestamp");
      })
    );
  });

  it.layer(testLayer({ entryLinks: false, matter: Effect.succeed(MatterNotFound.make({})) }), {
    timeout: "5 seconds",
  })((it) => {
    it.effect(
      "drops a digested ledger record once its message is behind the poll window, and digests entries without links by id",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;
        const harness = yield* Harness;

        yield* intake.pollOnce(TODAY);
        const digest = yield* intake.writeDigest(TODAY);
        yield* Ref.update(harness.script, (script) => ({
          ...script,
          messages: [messageAt("m-later", "2030-01-10T15:00:00Z")],
        }));
        yield* intake.pollOnce(addDays(TODAY, 1));
        const ledger = O.map(A.last(yield* Ref.get(harness.saves)), (state) => Object.keys(state.ledger));

        assertTrue(Str.includes("event event:docket:")(digest.bodyText));
        assertSome(ledger, ["m-later"]);
      })
    );
  });

  it.layer(testLayer({ matter: Effect.succeed(MatterUnique.make({ familyKey: "0000.0002", verified: true })) }), {
    timeout: "5 seconds",
  })((it) => {
    it.effect(
      "names a verified matter that has no client number by its family alone",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;

        const outcome = yield* intake.processMessage(message("m1"), TODAY);
        const due = A.head(kinds(yield* entriesOf, "due"));

        expect(outcome._tag === "DocketEntered" ? outcome.flags : ["unexpected"]).toStrictEqual([]);
        assertTrue(O.exists(due, (entry) => Str.includes("Matter: family 0000.0002\n")(entry.bodyText)));
      })
    );
  });

  it.layer(testLayer(), { timeout: "5 seconds" })((it) => {
    it.effect(
      "enters a message found in Junk Email like any other and says on the entry where it was found",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;

        const outcome = yield* intake.processMessage(foundIn("m1", "junk"), TODAY);
        const due = A.head(kinds(yield* entriesOf, "due"));

        expect(tagOf(outcome)).toBe("DocketEntered");
        expect(outcome._tag === "DocketEntered" ? outcome.flags : ["unexpected"]).toStrictEqual(["junk-folder"]);
        assertTrue(O.exists(due, (entry) => Str.includes("Found in the Junk Email folder.")(entry.bodyText)));
        // Every reminder says where the message was found too.
        expect(kinds(yield* entriesOf, "reminder")).toHaveLength(4);
        assertTrue(
          A.every(kinds(yield* entriesOf, "reminder"), (entry) =>
            Str.includes("Found in the Junk Email folder.\n")(entry.bodyText)
          )
        );
        assertTrue(O.exists(due, (entry) => Str.includes("Check: junk-folder")(entry.bodyText)));
      })
    );
  });

  it.layer(
    testLayer({
      enter: () => Effect.succeed(docketEntry()),
      review: () => Effect.succeed(undatedReview),
    }),
    { timeout: "5 seconds" }
  )((it) => {
    it.effect(
      "flags a needs-review entry for a message found in Deleted Items",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;

        const outcome = yield* intake.processMessage(foundIn("m1", "deleted"), TODAY);
        const review = A.head(kinds(yield* entriesOf, "needs-review"));

        expect(outcome._tag === "DocketNeedsReview" ? outcome.flags : ["unexpected"]).toStrictEqual([
          "source-document-missing",
          "deleted-folder",
        ]);
        assertTrue(O.exists(review, (entry) => Str.includes("Found in the Deleted Items folder.")(entry.bodyText)));
        assertTrue(
          O.exists(review, (entry) => Str.includes("Check: source-document-missing, deleted-folder")(entry.bodyText))
        );
      })
    );
  });

  it.layer(
    testLayer({
      enter: () => Effect.succeed(ParalegalNotDocketItem.make({ rationale: "Fixture newsletter." })),
      review: () => Effect.succeed(SecretaryReview.make({ isDocketItem: false, notes: "Agreed." })),
    }),
    { timeout: "5 seconds" }
  )((it) => {
    it.effect(
      "stays silent about a Junk Email message that is not a docket item",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;

        const outcome = yield* intake.processMessage(foundIn("m1", "junk"), TODAY);

        expect(tagOf(outcome)).toBe("NotDocketItem");
        expect(yield* entriesOf).toHaveLength(0);
      })
    );
  });
  it.layer(
    testLayer({
      // The first entry misreads the period; the revision corrects it and cites the text.
      enter: () => Effect.succeed(datedEntry({ responsePeriod: O.some(twoMonths) })),
      reread: () => Effect.succeed(distinctReview),
      review: () => Effect.succeed(distinctReview),
      revise: () =>
        Effect.succeed(
          ParalegalRevision.make({
            entry: datedEntry({ citedText: O.some(DISTINCT_CITED), responsePeriod: O.some(fortySevenDays) }),
            responses: [
              ExtractorFieldResponse.make({
                action: "revised",
                citedText: O.some(DISTINCT_CITED),
                field: "response-period",
              }),
            ],
            selfReportedConfidence: O.some(UnitInterval.make(0.9)),
          })
        ),
    }),
    { timeout: "5 seconds" }
  )((it) => {
    it.effect(
      "accepts in the second round after a revision, and never shows the extractor what the critic read",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;
        const harness = yield* Harness;

        const outcome = yield* intake.processMessage(distinctMessage, TODAY);
        const revises = yield* Ref.get(harness.revises);
        const rereads = yield* Ref.get(harness.rereads);
        const reasons = A.join(
          A.flatMap(revises, (input) => A.flatMap(input.disputes, (dispute) => dispute.reasons)),
          " "
        );

        expect(tagOf(outcome)).toBe("DocketEntered");
        assertSome(
          O.map(reviewOf(outcome), (review) => [review.status, review.rounds, review.finalScore]),
          ["accepted", 2, 1]
        );
        expect(A.map(revises, (input) => Object.keys(input))).toStrictEqual([["disputes", "message", "previous"]]);
        expect(A.flatMap(revises, (input) => A.map(input.disputes, (dispute) => dispute.field))).toStrictEqual([
          "response-period",
          "due-date",
          "source-document",
        ]);
        // The disputes carry the fields and the reasons. The period the critic read is in none of them.
        assertTrue(
          A.every(revises, (input) => A.every(input.disputes, (dispute) => Object.keys(dispute).length === 2))
        );
        assertTrue(!Str.includes("47")(reasons) && !Str.includes("days")(reasons));
        // The critic re-read only the disputed fields it can read, against the extractor's cited text.
        expect(A.map(rereads, (input) => input.fields)).toStrictEqual([["response-period", "due-date"]]);
        expect(
          A.flatMap(rereads, (input) => A.map(input.extractorResponses, (response) => response.action))
        ).toStrictEqual(["revised"]);
        // What the critic is shown of the entry did not change, so it was not asked for findings again.
        expect(yield* Ref.get(harness.critiques)).toBe(1);
        expect(kinds(yield* entriesOf, "due")).toHaveLength(1);
      })
    );
  });

  it.layer(
    testLayer(
      {
        // The critic objects to the first title. The revision fixes the title but now reads another
        // mail date, so the round limit is reached with new disagreements and nothing material.
        critique: (input) => Effect.succeed(titled(input, "Fixture response due") ? [materialTitleFinding] : []),
        revise: () =>
          Effect.succeed(
            ParalegalRevision.make({
              entry: datedEntry({
                citedText: O.some("Also noted on January 9, 2030\nA response is due within three months"),
                mailDate: O.some(addDays(mailDate, 1)),
                title: "Due Date: fixture response",
              }),
              selfReportedConfidence: O.some(UnitInterval.make(0.95)),
            })
          ),
      },
      { review: DocketReviewConfig.make({ maxRounds: 2 }) }
    ),
    { timeout: "5 seconds" }
  )((it) => {
    it.effect(
      "flags an item as low confidence when the round limit is reached with the score under the threshold",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;
        const harness = yield* Harness;

        const outcome = yield* intake.processMessage(message("m1"), TODAY);
        const entries = yield* entriesOf;
        const flagged = A.head(entries);

        expect(tagOf(outcome)).toBe("DocketNeedsReview");
        expect(reasonOf(outcome)).toBe("flagged-low-confidence");
        // The two candidate dates differ, and the entry says so.
        expect(outcome._tag === "DocketNeedsReview" ? outcome.flags : ["unexpected"]).toStrictEqual(["dates-differ"]);
        // Exactly one entry: no due-date entry and no reminder ladder.
        expect(entries).toHaveLength(1);
        assertSome(
          O.map(flagged, (entry) => [entry.kind, entry.category, entry.subject, entry.tentative]),
          ["needs-review", "Docket - needs review", "[LOW CONFIDENCE] Due Date: fixture response", true]
        );
        // The earliest candidate date: the critic's 8 April, not the extractor's 9 April.
        assertTrue(O.exists(flagged, (entry) => sameDate(entry.date, computedDue)));
        for (const fragment of [
          "the automatic review did not accept it",
          "Review score: 0.8; needed 0.85. Rounds used: 2 of 2.",
          "Paralegal's own confidence (not part of the score): 0.95",
          "- the two readings differ on: mail-date",
          "- the two readings differ on: due-date",
        ]) {
          assertTrue(O.exists(flagged, (entry) => Str.includes(fragment)(entry.bodyText)));
        }
        // A disputed title is nothing the critic can read again, but it does look at the new entry.
        expect(yield* Ref.get(harness.rereads)).toHaveLength(0);
        expect(yield* Ref.get(harness.critiques)).toBe(2);
        expect(yield* Ref.get(harness.marked)).toStrictEqual(["m1"]);
      })
    );
  });

  it.layer(
    testLayer({
      critique: () => Effect.succeed([materialReferenceFinding, minorTitleFinding]),
      messages: [message("m1")],
    }),
    { timeout: "5 seconds" }
  )((it) => {
    it.effect(
      "flags an item at the round limit when a material finding is never cleared, and names the status in the digest",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;
        const harness = yield* Harness;

        const report = yield* intake.pollOnce(TODAY);
        const digest = yield* intake.writeDigest(TODAY);
        const entries = yield* entriesOf;
        const flagged = A.head(kinds(entries, "needs-review"));
        const record = yield* ledgerRecord("m1");

        expect([report.entered, report.needsReview, report.failed]).toStrictEqual([0, 1, 0]);
        expect(kinds(entries, "due")).toHaveLength(0);
        expect(kinds(entries, "reminder")).toHaveLength(0);
        assertTrue(O.exists(flagged, (entry) => Str.startsWith("[REVIEW LIMIT REACHED] ")(entry.subject)));
        for (const fragment of [
          "Review score: 0.5; needed 0.85. Rounds used: 3 of 3.",
          "- P0 matter-references: Names a matter the message does not mention.",
          "- P3 title: Names no date type.",
        ]) {
          assertTrue(O.exists(flagged, (entry) => Str.includes(fragment)(entry.bodyText)));
        }
        // Only the material finding was put to the extractor, and only with its reason.
        expect(
          A.map(yield* Ref.get(harness.revises), (input) => A.map(input.disputes, (dispute) => dispute.field))
        ).toStrictEqual([["matter-references"], ["matter-references"]]);
        assertTrue(Str.includes("- NEEDS REVIEW (flagged-max-rounds)")(digest.bodyText));
        expect([digest.entered, digest.needsReview]).toStrictEqual([0, 1]);
        // The settled record keeps the verdict and drops the rounds.
        assertTrue(O.exists(record, (value) => O.isNone(value.review)));
        assertSome(
          O.map(record, (value) => reasonOf(value.outcome)),
          "flagged-max-rounds"
        );
      })
    );
  });

  it.layer(
    testLayer(
      {
        documents: false,
        enter: () =>
          Effect.succeed(datedEntry({ citedText: O.some("Mailed January 8, 2030; three months, as invented.") })),
      },
      { review: DocketReviewConfig.make({ maxRounds: 1 }) }
    ),
    { timeout: "5 seconds" }
  )((it) => {
    it.effect(
      "flags an item whose cited text is not in the source as a failed check, whatever its score",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;
        const harness = yield* Harness;

        const outcome = yield* intake.processMessage(oldMessage("m-old"), TODAY);
        const entries = yield* entriesOf;
        const flagged = A.head(entries);

        expect(reasonOf(outcome)).toBe("deterministic-failure");
        assertSome(
          O.map(reviewOf(outcome), (review) => [review.status, review.rounds, review.finalScore, review.maxRounds]),
          ["deterministic-failure", 1, 1, 1]
        );
        expect(outcome._tag === "DocketNeedsReview" ? outcome.flags : ["unexpected"]).toStrictEqual([
          "source-document-missing",
        ]);
        expect(entries).toHaveLength(1);
        assertTrue(O.exists(flagged, (entry) => Str.startsWith("[CHECK FAILED] ")(entry.subject)));
        assertTrue(
          O.exists(flagged, (entry) => Str.includes("- failed check (extractor): cited-span-exists")(entry.bodyText))
        );
        expect(yield* Ref.get(harness.revises)).toHaveLength(0);
      })
    );
  });

  it.layer(
    testLayer({
      enter: () =>
        Effect.succeed(datedEntry({ statedDueDate: O.some(LocalDate.make({ year: 2030, month: 1, day: 2 })) })),
      review: () => Effect.succeed(undatedReview),
      reread: () => Effect.succeed(undatedReview),
    }),
    { timeout: "5 seconds" }
  )((it) => {
    it.effect(
      "marks a flagged entry whose earliest candidate date has already passed",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;

        const outcome = yield* intake.processMessage(message("m1"), TODAY);
        const flagged = A.head(yield* entriesOf);

        expect(reasonOf(outcome)).toBe("deterministic-failure");
        expect(outcome._tag === "DocketNeedsReview" ? outcome.flags : ["unexpected"]).toStrictEqual([
          "source-document-missing",
          "due-date-past",
        ]);
        assertTrue(O.exists(flagged, (entry) => entry.date.toISOString() === "2030-01-02"));
      })
    );
  });

  it.layer(
    testLayer({
      enter: () => Effect.succeed(docketEntry()),
      reread: () => Effect.succeed(SecretaryReview.make({ isDocketItem: false, notes: "Still no deadline." })),
      review: () => Effect.succeed(SecretaryReview.make({ isDocketItem: false, notes: "No deadline here." })),
      revise: () =>
        Effect.succeed(
          ParalegalRevision.make({
            entry: ParalegalNotDocketItem.make({ rationale: "On a second look, a newsletter." }),
          })
        ),
    }),
    { timeout: "5 seconds" }
  )((it) => {
    it.effect(
      "ends as not a docket item when the extractor concedes in a later round",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;
        const harness = yield* Harness;

        const outcome = yield* intake.processMessage(message("m1"), TODAY);

        expect(tagOf(outcome)).toBe("NotDocketItem");
        expect(yield* entriesOf).toHaveLength(0);
        expect(A.map(yield* Ref.get(harness.rereads), (input) => input.fields)).toStrictEqual([
          ["classification", "matter-references"],
        ]);
        // Once both dismiss the message there is no entry to find fault with.
        expect(yield* Ref.get(harness.critiques)).toBe(1);
      })
    );
  });

  it.layer(
    testLayer({
      enter: () => Effect.succeed(datedEntry({ responsePeriod: O.some(twoMonths) })),
      messages: [message("m1")],
      // The process dies between rounds: the first re-reading never returns.
      reread: (_input, asked) =>
        asked === 1
          ? Effect.fail(DocketIntakeError.make({ cause: "killed", stage: "review" }))
          : Effect.succeed(agreeingReview),
      revise: () => Effect.succeed(ParalegalRevision.make({ entry: datedEntry() })),
    }),
    { timeout: "5 seconds" }
  )((it) => {
    it.effect(
      "resumes at the next round after a crash between rounds, without asking for the first round again",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;
        const harness = yield* Harness;

        const first = yield* intake.pollOnce(TODAY);
        const interrupted = yield* ledgerRecord("m1");
        const second = yield* intake.pollOnce(TODAY);
        const settled = yield* ledgerRecord("m1");

        expect([first.failed, first.entered]).toStrictEqual([1, 0]);
        // Round 1 is in the ledger, and the record is not settled: the cursor stays behind it.
        assertSome(
          O.map(interrupted, (record) => [
            tagOf(record.outcome),
            record.attempts,
            O.getOrElse(
              O.map(record.review, (review) => A.map(review.rounds, (round) => round.index)),
              () => []
            ),
          ]),
          ["IntakeFailed", 1, [1]]
        );
        expect([second.processed, second.entered]).toStrictEqual([1, 1]);
        expect([
          yield* Ref.get(harness.enters),
          yield* Ref.get(harness.reviews),
          yield* Ref.get(harness.critiques),
          A.length(yield* Ref.get(harness.revises)),
          A.length(yield* Ref.get(harness.rereads)),
        ]).toStrictEqual([1, 1, 1, 2, 2]);
        assertSome(
          O.map(settled, (record) => [tagOf(record.outcome), record.attempts, O.isNone(record.review)]),
          ["DocketEntered", 2, true]
        );
        assertSome(
          O.map(
            O.flatMap(settled, (record) => reviewOf(record.outcome)),
            (review) => [review.status, review.rounds]
          ),
          ["accepted", 2]
        );
        expect(kinds(yield* entriesOf, "due")).toHaveLength(1);
      })
    );
  });

  it.layer(testLayer({ messages: [message("m1")] }), { timeout: "5 seconds" })((it) => {
    it.effect(
      "does not treat a record that still holds review rounds as settled",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;
        const harness = yield* Harness;
        yield* Ref.set(harness.saves, [
          DocketIntakeState.make({
            ledger: {
              m1: DocketLedgerRecord.make({
                attempts: 1,
                outcome: NotDocketItem.make({ messageId: "m1" }),
                processedOn: TODAY,
                receivedAt: "2030-01-09T10:00:00Z",
                review: O.some(DocketReviewProgress.make({ rounds: [] })),
              }),
            },
          }),
        ]);

        const report = yield* intake.pollOnce(TODAY);
        const again = yield* intake.pollOnce(TODAY);

        expect([report.processed, report.entered]).toStrictEqual([1, 1]);
        expect(again.processed).toBe(0);
      })
    );
  });
  it.layer(testLayer({ enter: statedEntry, review: () => Effect.succeed(statedReview()) }), {
    timeout: "5 seconds",
  })((it) => {
    it.effect(
      "accepts a stated-date-only item in the first round when the critic reads and cites the same stated date",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;
        const harness = yield* Harness;

        const outcome = yield* intake.processMessage(statedMessage, TODAY);
        const due = A.head(kinds(yield* entriesOf, "due"));

        expect(tagOf(outcome)).toBe("DocketEntered");
        assertSome(
          O.map(reviewOf(outcome), (review) => [review.status, review.rounds, review.finalScore]),
          ["accepted", 1, 1]
        );
        expect(outcome._tag === "DocketEntered" ? [outcome.dueDate.basis, outcome.flags] : []).toStrictEqual([
          "agreed",
          [],
        ]);
        assertTrue(O.exists(due, (entry) => sameDate(entry.date, statedDue)));
        assertTrue(
          O.exists(due, (entry) =>
            Str.includes("Due date the reviewer read stated in the source: 2030-04-15")(entry.bodyText)
          )
        );
        expect(yield* Ref.get(harness.revises)).toHaveLength(0);
      })
    );
  });

  it.layer(
    testLayer({
      enter: statedEntry,
      reread: () => Effect.succeed(statedReview({ citedText: O.none(), statedDueDate: O.some(addDays(statedDue, 1)) })),
      review: () => Effect.succeed(statedReview({ citedText: O.none(), statedDueDate: O.some(addDays(statedDue, 1)) })),
    }),
    { timeout: "5 seconds" }
  )((it) => {
    it.effect(
      "flags a stated-date-only item when the critic reads a different stated date, on the earlier of the two",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;
        const harness = yield* Harness;

        const outcome = yield* intake.processMessage(statedMessage, TODAY);
        const entries = yield* entriesOf;
        const flagged = A.head(entries);

        expect(reasonOf(outcome)).toBe("flagged-max-rounds");
        assertSome(
          O.map(reviewOf(outcome), (review) => [review.rounds, review.finalScore]),
          [3, 0.75]
        );
        expect(outcome._tag === "DocketNeedsReview" ? outcome.flags : ["unexpected"]).toStrictEqual(["dates-differ"]);
        expect(entries).toHaveLength(1);
        assertTrue(O.exists(flagged, (entry) => sameDate(entry.date, statedDue)));
        for (const fragment of [
          "- the two readings differ on: stated-due-date",
          "- the two readings differ on: due-date",
          "Due date the reviewer read stated in the source: 2030-04-16",
        ]) {
          assertTrue(O.exists(flagged, (entry) => Str.includes(fragment)(entry.bodyText)));
        }
        // The critic read its stated date again each round; the extractor was never shown it.
        expect(A.map(yield* Ref.get(harness.rereads), (input) => input.fields)).toStrictEqual([
          ["stated-due-date", "due-date"],
          ["stated-due-date", "due-date"],
        ]);
        assertTrue(
          A.every(yield* Ref.get(harness.revises), (input) =>
            A.every(input.disputes, (dispute) => A.every(dispute.reasons, (reason) => !Str.includes("16")(reason)))
          )
        );
      })
    );
  });

  it.layer(
    testLayer(
      { enter: statedEntry, review: () => Effect.succeed(inconsistentReview) },
      { review: DocketReviewConfig.make({ maxRounds: 1 }) }
    ),
    { timeout: "5 seconds" }
  )((it) => {
    it.effect(
      "raises a material finding when the source's stated date and its mail date plus period differ, and uses the earlier date",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;

        const outcome = yield* intake.processMessage(statedMessage, TODAY);
        const entries = yield* entriesOf;
        const flagged = A.head(entries);

        expect(reasonOf(outcome)).toBe("flagged-max-rounds");
        expect(outcome._tag === "DocketNeedsReview" ? outcome.flags : ["unexpected"]).toStrictEqual(["dates-differ"]);
        expect(entries).toHaveLength(1);
        // 8 April (mail date plus period) is earlier than the 15 April both sides read stated.
        assertTrue(O.exists(flagged, (entry) => sameDate(entry.date, computedDue)));
        for (const fragment of [
          "- P1 due-date: The due date the source states and the reviewer's mail date plus response period differ.",
          "Date from the email (paralegal entry): 2030-04-15",
          "Due date the reviewer read stated in the source: 2030-04-15",
          "Date recomputed by the reviewer: 2030-04-08 (mail date 2030-01-08 + 3 months)",
        ]) {
          assertTrue(O.exists(flagged, (entry) => Str.includes(fragment)(entry.bodyText)));
        }
      })
    );
  });

  it.layer(
    testLayer(
      { enter: statedEntry, review: () => Effect.succeed(inconsistentReview) },
      { review: DocketReviewConfig.make({ acceptThreshold: UnitInterval.make(0.3), maxRounds: 1 }) }
    ),
    { timeout: "5 seconds" }
  )((it) => {
    it.effect(
      "puts even an accepted entry on the earlier date when the source's two dates differ",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;

        const outcome = yield* intake.processMessage(statedMessage, TODAY);
        const due = A.head(kinds(yield* entriesOf, "due"));

        expect(tagOf(outcome)).toBe("DocketEntered");
        expect(outcome._tag === "DocketEntered" ? [outcome.dueDate.basis, outcome.flags] : []).toStrictEqual([
          "earlier-of-differing",
          ["dates-differ"],
        ]);
        assertTrue(O.exists(due, (entry) => sameDate(entry.date, computedDue)));
      })
    );
  });

  it.layer(
    testLayer(
      {
        enter: () => Effect.succeed(datedEntry({ responsePeriod: O.some(twoMonths) })),
        messages: [message("m1")],
        // The process is killed between rounds: the first re-reading dies instead of failing.
        reread: (_input, asked) => (asked === 1 ? Effect.die("killed") : Effect.succeed(agreeingReview)),
        revise: () => Effect.succeed(ParalegalRevision.make({ entry: datedEntry() })),
      },
      { maxAttempts: 1 }
    ),
    { timeout: "5 seconds" }
  )((it) => {
    it.effect(
      "does not spend the retry budget on a loop that was interrupted, only on steps that failed",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;

        const killed = yield* Effect.exit(intake.pollOnce(TODAY));
        const interrupted = yield* ledgerRecord("m1");
        const resumed = yield* intake.pollOnce(TODAY);
        const settled = yield* ledgerRecord("m1");

        assertTrue(Exit.isFailure(killed));
        // The kill left round 1 in the ledger and no attempt counted against the message.
        assertSome(
          O.map(interrupted, (record) => [tagOf(record.outcome), record.attempts, O.isSome(record.review)]),
          ["IntakeFailed", 0, true]
        );
        // With a budget of one attempt, the resumed loop still finishes instead of being given up on.
        expect([resumed.entered, resumed.needsReview, resumed.failed]).toStrictEqual([1, 0, 0]);
        assertSome(
          O.map(settled, (record) => [tagOf(record.outcome), record.attempts]),
          ["DocketEntered", 1]
        );
      })
    );
  });
});
