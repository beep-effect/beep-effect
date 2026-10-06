/**
 * A scripted `M365` service for the smoke proofs. Only the verbs the smoke
 * check calls are scripted; every other verb is a defect if it is reached.
 */
import {
  GraphEvent,
  GraphMessage,
  GraphOutlookCategory,
  M365,
  M365Error,
  M365EventCollection,
  M365MessageCollection,
  M365OutlookCategoryCollection,
} from "@beep/m365";
import { Context, Effect, Layer, Ref } from "effect";
import * as A from "effect/Array";

export type M365Script = {
  readonly createEvent: Effect.Effect<GraphEvent, M365Error>;
  readonly deleteEvent: Effect.Effect<void, M365Error>;
  readonly findEvents: Effect.Effect<M365EventCollection, M365Error>;
  readonly listCategories: Effect.Effect<M365OutlookCategoryCollection, M365Error>;
  readonly listMessages: Effect.Effect<M365MessageCollection, M365Error>;
};

type FakeM365Shape = {
  /** Verbs called, in order, with the event id for deletes. */
  readonly calls: Ref.Ref<ReadonlyArray<string>>;
  readonly script: Ref.Ref<M365Script>;
};

export class FakeM365 extends Context.Service<FakeM365, FakeM365Shape>()("@beep/docket-intake/test/support/FakeM365") {}

export const refused = M365Error.fromReason("response status", { status: 403 });
export const unreachable = M365Error.fromReason("transport");
export const ambiguous = M365Error.fromReason("ambiguous write");

/** A found-events answer holding the given event ids. */
export const eventsFound = (ids: ReadonlyArray<string>) =>
  Effect.succeed(M365EventCollection.make({ value: A.map(ids, (id) => GraphEvent.make({ id })) }));

export const passingScript: M365Script = {
  createEvent: Effect.succeed(GraphEvent.make({ id: "event-1" })),
  deleteEvent: Effect.void,
  findEvents: eventsFound(["event-1"]),
  listCategories: Effect.succeed(
    M365OutlookCategoryCollection.make({
      value: A.map(["Docket - unverified", "Docket - entered", "M: FIX-0001"], (displayName) =>
        GraphOutlookCategory.make({ displayName })
      ),
    })
  ),
  listMessages: Effect.succeed(
    M365MessageCollection.make({ value: A.map(["m1", "m2"], (id) => GraphMessage.make({ id })) })
  ),
};

const unused = () => Effect.die("this verb is not part of the smoke check");

export const FakeM365Layer = Layer.effect(
  M365,
  Effect.gen(function* () {
    const fake = yield* FakeM365;
    const run = <A>(call: string, pick: (script: M365Script) => Effect.Effect<A, M365Error>) =>
      Ref.update(fake.calls, A.append(call)).pipe(Effect.andThen(Ref.get(fake.script)), Effect.flatMap(pick));

    return M365.of({
      createEvent: Effect.fnUntraced(function* () {
        return yield* run("createEvent", (script) => script.createEvent);
      }),
      createMasterCategory: unused,
      deleteEvent: Effect.fnUntraced(function* (request) {
        return yield* run(`deleteEvent ${request.eventId}`, (script) => script.deleteEvent);
      }),
      deltaDriveItems: unused,
      downloadDriveItemContent: unused,
      downloadMessageAttachment: unused,
      ensureMasterCategories: unused,
      findEventsByIdempotencyKey: Effect.fnUntraced(function* () {
        return yield* run("findEvents", (script) => script.findEvents);
      }),
      getEvent: unused,
      getListItem: unused,
      getMailFolder: unused,
      getMessage: unused,
      getSite: unused,
      listDriveItemVersions: unused,
      listDrives: unused,
      listEvents: unused,
      listMasterCategories: Effect.fnUntraced(function* () {
        return yield* run("listCategories", (script) => script.listCategories);
      }),
      listMessageAttachments: unused,
      listMessages: Effect.fnUntraced(function* () {
        return yield* run("listMessages", (script) => script.listMessages);
      }),
      listSites: unused,
      updateEvent: unused,
      updateMessageCategories: unused,
    });
  })
).pipe(
  Layer.provideMerge(
    Layer.effect(
      FakeM365,
      Effect.gen(function* () {
        return FakeM365.of({
          calls: yield* Ref.make<ReadonlyArray<string>>([]),
          script: yield* Ref.make(passingScript),
        });
      })
    )
  )
);
