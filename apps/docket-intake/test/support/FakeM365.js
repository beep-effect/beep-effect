/**
 * A scripted `M365` service for the smoke and undo proofs. Only the verbs
 * those commands call are scripted; every other verb is a defect if it is
 * reached.
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
import * as O from "effect/Option";
export class FakeM365 extends Context.Service()("@beep/docket-intake/test/support/FakeM365") {}
export const refused = M365Error.fromReason("response status", { status: 403 });
export const unreachable = M365Error.fromReason("transport");
export const ambiguous = M365Error.fromReason("ambiguous write");
export const throttled = M365Error.fromReason("throttled", { status: 429 });
/** A found-events answer holding the given event ids. */
export const eventsFound = (ids) =>
  Effect.succeed(M365EventCollection.make({ value: A.map(ids, (id) => GraphEvent.make({ id })) }));
export const passingScript = {
  createEvent: Effect.succeed(GraphEvent.make({ id: "event-1" })),
  deleteEvent: Effect.void,
  findEvents: eventsFound(["event-1"]),
  getEvent: Effect.succeed(GraphEvent.make({ categories: O.some(["Docket - unverified"]), id: "event-1" })),
  getMessage: Effect.succeed(
    GraphMessage.make({ categories: O.some(["M: FIX-0001", "Docket - entered"]), changeKey: O.some("ck-1"), id: "m1" })
  ),
  updateMessageCategories: Effect.succeed(GraphMessage.make({ id: "m1" })),
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
    const run = (call, pick) =>
      Ref.update(fake.calls, A.append(call)).pipe(Effect.andThen(Ref.get(fake.script)), Effect.flatMap(pick));
    return M365.of({
      addMessageAttachment: unused,
      createDraftMessage: unused,
      createEvent: Effect.fnUntraced(function* () {
        return yield* run("createEvent", (script) => script.createEvent);
      }),
      createMasterCategory: unused,
      deleteDraftMessage: unused,
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
      getEvent: Effect.fnUntraced(function* (request) {
        return yield* run(`getEvent ${request.eventId}`, (script) => script.getEvent);
      }),
      getListItem: unused,
      getMailFolder: unused,
      getMessage: Effect.fnUntraced(function* (request) {
        return yield* run(`getMessage ${request.messageId}`, (script) => script.getMessage);
      }),
      getMessageAuthoredText: unused,
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
      sendDraftMessage: unused,
      updateEvent: unused,
      updateMessageCategories: Effect.fnUntraced(function* (request) {
        return yield* run(
          `updateMessageCategories ${request.messageId} ${A.join(request.categories, "|")}`,
          (script) => script.updateMessageCategories
        );
      }),
    });
  })
).pipe(
  Layer.provideMerge(
    Layer.effect(
      FakeM365,
      Effect.gen(function* () {
        return FakeM365.of({
          calls: yield* Ref.make([]),
          script: yield* Ref.make(passingScript),
        });
      })
    )
  )
);
