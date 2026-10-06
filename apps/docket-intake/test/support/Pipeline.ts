/**
 * The real docket intake pipeline over in-memory ports, for the app's cycle
 * and command proofs. Every fixture is synthetic.
 */
import { DocketResponsePeriod } from "@beep/law-practice-domain/values/DocketDeadline";
import {
  DocketFileStoreOptions,
  DocketJournalingPortsLive,
  DocketMatterLookupUnavailableLive,
  makeDocketFileJournalLayer,
  makeDocketFileStoreLayer,
} from "@beep/law-practice-server/DocketIntake";
import {
  DocketCalendar,
  DocketIntakeConfig,
  DocketIntakeError,
  DocketIntakeState,
  DocketIntakeStore,
  DocketMailbox,
  DocketMessage,
  DocketParalegal,
  DocketSecretary,
  DocketWrittenEntry,
  makeDocketIntakeLayer,
  ParalegalDocketEntry,
  ParalegalRevision,
  SecretaryReview,
} from "@beep/law-practice-use-cases/DocketIntake";
import { LocalDate } from "@beep/schema/LocalDate";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { Context, Deferred, Effect, FileSystem, HashMap, Layer, Path, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { DocketDryRunPortsLive } from "@/DryRun";
import type { DocketCalendarEntry } from "@beep/law-practice-use-cases/DocketIntake";

export const MAILBOX = "docket@fixture.invalid";
export const STATE_DIRECTORY = "/fixture/state/docket-intake";

type PipelineHarnessShape = {
  /** Calendar entries the pipeline created, by idempotency key. */
  readonly entries: Ref.Ref<HashMap.HashMap<string, DocketCalendarEntry>>;
  /** Whether each of the next mailbox listings fails, in order; listings past the end succeed. */
  readonly listingFailures: Ref.Ref<ReadonlyArray<boolean>>;
  /** How many times the mailbox was listed. */
  readonly listings: Ref.Ref<number>;
  /** Completed the first time the mailbox is listed. */
  readonly listed: Deferred.Deferred<void>;
  /** Messages marked entered, in order. */
  readonly marked: Ref.Ref<ReadonlyArray<string>>;
  /** The messages every listing returns. */
  readonly messages: Ref.Ref<ReadonlyArray<DocketMessage>>;
  readonly state: Ref.Ref<DocketIntakeState>;
};

export class PipelineHarness extends Context.Service<PipelineHarness, PipelineHarnessShape>()(
  "@beep/docket-intake/test/support/Pipeline/PipelineHarness"
) {}

const HarnessLayer = Layer.effect(
  PipelineHarness,
  Effect.gen(function* () {
    return PipelineHarness.of({
      entries: yield* Ref.make(HashMap.empty<string, DocketCalendarEntry>()),
      listingFailures: yield* Ref.make<ReadonlyArray<boolean>>([]),
      listed: yield* Deferred.make<void>(),
      listings: yield* Ref.make(0),
      marked: yield* Ref.make<ReadonlyArray<string>>([]),
      messages: yield* Ref.make<ReadonlyArray<DocketMessage>>([message]),
      state: yield* Ref.make(DocketIntakeState.make({})),
    });
  })
);

// The text the fixture entry cites for its dates and period; the review checks it is in the message.
const CITED = "Mailed January 8, 2030. A response is due within three months, by April 8, 2030";

/** A synthetic message that states its dates; the fixture agents enter it as a docket item. */
export const fixtureMessage = (input: { readonly messageId: string; readonly receivedAt: string }) =>
  DocketMessage.make({
    bodyText: `Synthetic fixture body mentioning FIX-0001. ${CITED}.`,
    messageId: input.messageId,
    receivedAt: input.receivedAt,
    receivedDate: LocalDate.make({ year: 2030, month: 1, day: 9 }),
  });

const message = fixtureMessage({ messageId: "m1", receivedAt: "2030-01-09T10:00:00.000Z" });

const MAIL_DATE = LocalDate.make({ year: 2030, month: 1, day: 8 });
const THREE_MONTHS = DocketResponsePeriod.make({ amount: 3, unit: "months" });

// The secretary reads the same date, period and reference for itself, so the review accepts.
const agreeingReview = SecretaryReview.make({
  isDocketItem: true,
  mailDate: O.some(MAIL_DATE),
  matterReferences: ["FIX-0001"],
  notes: "Fixture review.",
  responsePeriod: O.some(THREE_MONTHS),
});

const written = (key: string): DocketWrittenEntry =>
  DocketWrittenEntry.make({ eventId: S.NonEmptyString.make(`event:${key}`) });

// The mailbox and calendar as Graph would answer them; what reaches them was "written".
const MailboxCalendarLayer = Layer.mergeAll(
  Layer.effect(
    DocketMailbox,
    Effect.gen(function* () {
      const harness = yield* PipelineHarness;
      return DocketMailbox.of({
        markEntered: Effect.fnUntraced(function* (marked) {
          yield* Ref.update(harness.marked, A.append(marked.messageId));
        }),
        receivedSince: Effect.fn("FakeMailbox.receivedSince")(function* () {
          yield* Ref.update(harness.listings, (count) => count + 1);
          yield* Deferred.succeed(harness.listed, undefined);
          const pending = yield* Ref.getAndUpdate(harness.listingFailures, A.drop(1));
          if (A.contains(A.take(pending, 1), true)) {
            return yield* DocketIntakeError.make({ cause: "transport", stage: "mailbox" });
          }
          return yield* Ref.get(harness.messages);
        }),
        sourceDocuments: Effect.fnUntraced(function* () {
          return yield* Effect.succeed(A.empty());
        }),
      });
    })
  ),
  Layer.effect(
    DocketCalendar,
    Effect.gen(function* () {
      const harness = yield* PipelineHarness;
      return DocketCalendar.of({
        create: Effect.fn("FakeCalendar.create")(function* (entry) {
          yield* Ref.update(harness.entries, HashMap.set(entry.key, entry));
          return written(entry.key);
        }),
        findByKey: Effect.fn("FakeCalendar.findByKey")(function* (key) {
          return O.map(HashMap.get(yield* Ref.get(harness.entries), key), () => written(key));
        }),
      });
    })
  )
);

const AgentsLayer = Layer.mergeAll(
  Layer.succeed(
    DocketParalegal,
    DocketParalegal.of({
      enter: Effect.fnUntraced(function* () {
        return yield* Effect.succeed(
          ParalegalDocketEntry.make({
            citedText: O.some(CITED),
            mailDate: O.some(MAIL_DATE),
            matterReferences: ["FIX-0001"],
            rationale: "States a due date.",
            responsePeriod: O.some(THREE_MONTHS),
            statedDueDate: O.some(LocalDate.make({ year: 2030, month: 4, day: 8 })),
            title: "Due Date: fixture response",
          })
        );
      }),
      // The fixture review accepts in its first round, so nothing is ever disputed.
      revise: Effect.fnUntraced(function* (input) {
        return yield* Effect.succeed(ParalegalRevision.make({ entry: input.previous }));
      }),
    })
  ),
  Layer.succeed(
    DocketSecretary,
    DocketSecretary.of({
      critique: Effect.fnUntraced(function* () {
        return yield* Effect.succeed([]);
      }),
      reread: Effect.fnUntraced(function* () {
        return yield* Effect.succeed(agreeingReview);
      }),
      review: Effect.fnUntraced(function* () {
        return yield* Effect.succeed(agreeingReview);
      }),
    })
  ),
  DocketMatterLookupUnavailableLive
);

// The state the pipeline saves, kept in the harness.
const RefStoreLayer = Layer.effect(
  DocketIntakeStore,
  Effect.gen(function* () {
    const harness = yield* PipelineHarness;
    return DocketIntakeStore.of({
      load: Ref.get(harness.state),
      save: Effect.fnUntraced(function* (state) {
        yield* Ref.set(harness.state, state);
      }),
    });
  })
);

// The store names its temporary files after the process, which it reads from `/proc/self`.
const LinuxFileSystemLayer = Layer.effect(
  FileSystem.FileSystem,
  Effect.gen(function* () {
    const memory = yield* MemoryFileSystem.make;
    yield* memory.makeDirectory("/proc", { recursive: true });
    yield* memory.symlink("4242", "/proc/self");
    return memory;
  }).pipe(Effect.orDie)
);

/** An in-memory file system that looks like Linux, and POSIX paths, for the digest archive. */
export const FilesLayer = Layer.merge(LinuxFileSystemLayer, Path.layer);

const storeOptions = (directory: string) => DocketFileStoreOptions.make({ directory });

// Every create and mark that reaches the harness is journaled in the state directory.
const JournaledPortsLayer = DocketJournalingPortsLive.pipe(
  Layer.provide(MailboxCalendarLayer),
  Layer.provideMerge(makeDocketFileJournalLayer(storeOptions(STATE_DIRECTORY)))
);

/**
 * The pipeline, its store and its write journal over the in-memory ports; the
 * harness and the in-memory file system are exposed for assertions.
 */
export const PipelineLayer = makeDocketIntakeLayer(DocketIntakeConfig.make({ mailbox: MAILBOX })).pipe(
  Layer.provideMerge(JournaledPortsLayer),
  Layer.provideMerge(Layer.merge(AgentsLayer, RefStoreLayer)),
  Layer.provideMerge(FilesLayer),
  Layer.provide(BunCrypto.layer),
  Layer.provideMerge(HarnessLayer)
);

/**
 * The dry-run pipeline: recording ports over the harness mailbox and
 * calendar, and a file store in the given directory of the in-memory file
 * system.
 */
export const dryRunPipelineLayer = (directory: string) =>
  makeDocketIntakeLayer(DocketIntakeConfig.make({ mailbox: MAILBOX })).pipe(
    Layer.provideMerge(DocketDryRunPortsLive.pipe(Layer.provide(MailboxCalendarLayer))),
    Layer.provideMerge(Layer.merge(AgentsLayer, makeDocketFileStoreLayer(storeOptions(directory)))),
    Layer.provideMerge(FilesLayer),
    Layer.provide(BunCrypto.layer),
    Layer.provideMerge(HarnessLayer)
  );
