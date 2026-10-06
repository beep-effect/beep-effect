/**
 * The real docket intake pipeline over in-memory ports, for the app's cycle
 * and command proofs. Every fixture is synthetic.
 */
import { DocketMatterLookupUnavailableLive } from "@beep/law-practice-server/DocketIntake";
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
  SecretaryReview,
} from "@beep/law-practice-use-cases/DocketIntake";
import { LocalDate } from "@beep/schema/LocalDate";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { Context, Deferred, Effect, HashMap, Layer, Path, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { DocketCalendarEntry } from "@beep/law-practice-use-cases/DocketIntake";

export const MAILBOX = "docket@fixture.invalid";

type PipelineHarnessShape = {
  /** Calendar entries the pipeline created, by idempotency key. */
  readonly entries: Ref.Ref<HashMap.HashMap<string, DocketCalendarEntry>>;
  /** How many of the next mailbox listings fail before one succeeds. */
  readonly failingListings: Ref.Ref<number>;
  /** How many times the mailbox was listed. */
  readonly listings: Ref.Ref<number>;
  /** Completed the first time the mailbox is listed. */
  readonly listed: Deferred.Deferred<void>;
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
      failingListings: yield* Ref.make(0),
      listed: yield* Deferred.make<void>(),
      listings: yield* Ref.make(0),
      state: yield* Ref.make(DocketIntakeState.make({})),
    });
  })
);

const message = DocketMessage.make({
  bodyText: "Synthetic fixture body mentioning FIX-0001.",
  messageId: "m1",
  receivedAt: "2030-01-09T10:00:00.000Z",
  receivedDate: LocalDate.make({ year: 2030, month: 1, day: 9 }),
});

const written = (key: string): DocketWrittenEntry =>
  DocketWrittenEntry.make({ eventId: S.NonEmptyString.make(`event:${key}`) });

const PortsLayer = Layer.mergeAll(
  Layer.effect(
    DocketMailbox,
    Effect.gen(function* () {
      const harness = yield* PipelineHarness;
      return DocketMailbox.of({
        markEntered: Effect.fnUntraced(function* () {
          yield* Effect.void;
        }),
        receivedSince: Effect.fn("FakeMailbox.receivedSince")(function* () {
          yield* Ref.update(harness.listings, (count) => count + 1);
          yield* Deferred.succeed(harness.listed, undefined);
          const failing = yield* Ref.getAndUpdate(harness.failingListings, (count) => Math.max(0, count - 1));
          if (failing > 0) {
            return yield* DocketIntakeError.make({ cause: "transport", stage: "mailbox" });
          }
          return [message];
        }),
        sourceDocuments: Effect.fnUntraced(function* () {
          return yield* Effect.succeed(A.empty());
        }),
      });
    })
  ),
  Layer.succeed(
    DocketParalegal,
    DocketParalegal.of({
      enter: Effect.fnUntraced(function* () {
        return yield* Effect.succeed(
          ParalegalDocketEntry.make({
            matterReferences: ["FIX-0001"],
            rationale: "States a due date.",
            statedDueDate: O.some(LocalDate.make({ year: 2030, month: 4, day: 8 })),
            title: "Due Date: fixture response",
          })
        );
      }),
    })
  ),
  Layer.succeed(
    DocketSecretary,
    DocketSecretary.of({
      review: Effect.fnUntraced(function* () {
        return yield* Effect.succeed(SecretaryReview.make({ isDocketItem: true, notes: "Fixture review." }));
      }),
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
  ),
  Layer.effect(
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
  ),
  DocketMatterLookupUnavailableLive
);

/** The pipeline and its store over the in-memory ports; the harness is exposed for assertions. */
export const PipelineLayer = makeDocketIntakeLayer(DocketIntakeConfig.make({ mailbox: MAILBOX })).pipe(
  Layer.provideMerge(PortsLayer),
  Layer.provide(BunCrypto.layer),
  Layer.provideMerge(HarnessLayer)
);

/** An in-memory file system and POSIX paths for the digest archive. */
export const FilesLayer = Layer.merge(MemoryFileSystem.layer, Path.layer);
