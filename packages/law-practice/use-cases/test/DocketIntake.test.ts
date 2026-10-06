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
  DocketMailbox,
  DocketMatterLookup,
  DocketMessage,
  DocketParalegal,
  DocketSecretary,
  DocketSourceDocument,
  DocketWrittenEntry,
  MatterAmbiguous,
  MatterNotFound,
  MatterUnique,
  makeDocketIntakeLayer,
  ParalegalDocketEntry,
  ParalegalNotDocketItem,
  SecretaryReview,
} from "@beep/law-practice-use-cases/DocketIntake";
import { addDays, isAfter, LocalDate, equals as sameDate } from "@beep/schema/LocalDate";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { Context, Effect, HashMap, Layer, pipe, Ref } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type {
  DocketCalendarEntry,
  DocketIntakeOutcome,
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

const message = (id: string, minute = 0): DocketMessage =>
  DocketMessage.make({
    bodyText: "Synthetic fixture body.",
    internetMessageId: O.some(`<${id}@fixture.invalid>`),
    messageId: id,
    receivedAt: `2030-01-09T10:${Str.padStart(2, "0")(`${minute}`)}:00Z`,
    receivedDate: RECEIVED,
    webLink: O.some(`https://outlook.fixture.invalid/mail/${id}`),
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

const agreeingReview = SecretaryReview.make({
  isDocketItem: true,
  mailDate: O.some(mailDate),
  notes: "Read the attached fixture action.",
  readFromSourceDocument: true,
  responsePeriod: O.some(threeMonths),
});

type Script = {
  readonly ambiguousCreates: number;
  readonly ambiguousLost: boolean;
  readonly calendarDown: boolean;
  readonly entryLinks: boolean;
  readonly documents: boolean;
  readonly enter: (messageId: string) => Effect.Effect<ParalegalEntry, DocketIntakeError>;
  readonly matter: Effect.Effect<MatterLookupResult, DocketIntakeError>;
  readonly messages: ReadonlyArray<DocketMessage>;
  readonly review: (messageId: string) => Effect.Effect<SecretaryReview, DocketIntakeError>;
};

const defaultScript: Script = {
  ambiguousCreates: 0,
  ambiguousLost: false,
  calendarDown: false,
  entryLinks: true,
  documents: true,
  enter: () => Effect.succeed(docketEntry({ mailDate: O.some(mailDate), responsePeriod: O.some(threeMonths) })),
  matter: Effect.succeed(MatterUnique.make({ client: O.some("0000"), familyKey: "0000.0001", verified: true })),
  messages: [message("m1")],
  review: () => Effect.succeed(agreeingReview),
};

type HarnessShape = {
  readonly creates: Ref.Ref<number>;
  readonly entries: Ref.Ref<HashMap.HashMap<string, DocketCalendarEntry>>;
  readonly marked: Ref.Ref<ReadonlyArray<string>>;
  readonly reviews: Ref.Ref<number>;
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
        entries: yield* Ref.make(HashMap.empty<string, DocketCalendarEntry>()),
        marked: yield* Ref.make<ReadonlyArray<string>>([]),
        reviews: yield* Ref.make(0),
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
          const script = yield* Ref.get(harness.script);
          return yield* script.enter(entered.messageId);
        }),
      });
    })
  ),
  Layer.effect(
    DocketSecretary,
    Effect.gen(function* () {
      const harness = yield* Harness;
      return DocketSecretary.of({
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
    bodyText: "Synthetic fixture body.",
    messageId: id,
    receivedAt: "2029-12-20T09:00:00Z",
    receivedDate: LocalDate.make({ year: 2029, month: 12, day: 20 }),
  });

const messageAt = (id: string, receivedAt: string): DocketMessage =>
  DocketMessage.make({
    bodyText: "Synthetic fixture body.",
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

        // Processing the same message again finds every entry by key and creates nothing.
        const createsBefore = yield* Ref.get(harness.creates);
        const again = yield* intake.processMessage(message("m1"), TODAY);

        expect(tagOf(again)).toBe("DocketEntered");
        expect(yield* Ref.get(harness.creates)).toBe(createsBefore);
        expect(yield* entriesOf).toHaveLength(5);
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

  it.layer(testLayer(), { timeout: "20 seconds" })((it) => {
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
          enter: () => Effect.succeed(docketEntry({ statedDueDate: O.some(stated) })),
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

        const outcome = yield* intake.processMessage(message(id), TODAY);
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
      review: () => Effect.succeed(SecretaryReview.make({ isDocketItem: true, notes: "No date anywhere." })),
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
        expect(outcome._tag === "DocketNeedsReview" ? outcome.reason : "unexpected").toBe("no-usable-date");
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
      "escalates to needs-review when the reviewer finds a docket item the paralegal dismissed",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;

        const outcome = yield* intake.processMessage(message("m1"), TODAY);

        expect(outcome._tag === "DocketNeedsReview" ? outcome.reason : "unexpected").toBe("agents-disagree");
        expect(kinds(yield* entriesOf, "needs-review")).toHaveLength(1);
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
    testLayer({
      enter: () => Effect.succeed(docketEntry({ statedDueDate: O.some(addDays(TODAY, 1)) })),
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
    }),
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
    testLayer({
      enter: () => Effect.succeed(docketEntry()),
      review: () => Effect.succeed(SecretaryReview.make({ isDocketItem: false, notes: "No deadline here." })),
    }),
    { timeout: "5 seconds" }
  )((it) => {
    it.effect(
      "escalates when the reviewer dismisses the paralegal's entry, dated today for a message from a past day",
      Effect.fnUntraced(function* () {
        const intake = yield* DocketIntake;

        const outcome = yield* intake.processMessage(oldMessage("m-old"), TODAY);
        const entry = A.head(kinds(yield* entriesOf, "needs-review"));

        expect(outcome._tag === "DocketNeedsReview" ? outcome.reason : "unexpected").toBe("agents-disagree");
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
});
