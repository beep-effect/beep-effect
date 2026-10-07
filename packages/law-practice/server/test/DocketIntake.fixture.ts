/**
 * Shared scaffolding of the docket intake journal and undo proofs: an
 * in-memory file system that looks like Linux to the file store, and an
 * in-memory mailbox and calendar behind the `M365` service. Every id,
 * category and timestamp is synthetic.
 */
import { DocketFileStoreOptions, makeDocketFileStoreLayer } from "@beep/law-practice-server/DocketIntake";
import { GraphEvent, GraphMessage, M365Error } from "@beep/m365";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import { Context, Effect, FileSystem, HashMap, Layer, Path, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { makeM365Stub } from "./MailTagging.adapters.fixture.ts";

export const DIRECTORY = "/fixture/state/docket-intake";
export const MAILBOX = "docket@fixture.invalid";

// The store names its temporary files after the process, which it reads from `/proc/self`.
// The app's test support has the same layer; neither can import the other's test files.
// fallow-ignore-next-line code-duplication -- test-only Linux-shaped memory file system
const LinuxFileSystemLayer = Layer.effect(
  FileSystem.FileSystem,
  Effect.gen(function* () {
    const memory = yield* MemoryFileSystem.make;
    yield* memory.makeDirectory("/proc", { recursive: true });
    yield* memory.symlink("4242", "/proc/self");
    return memory;
  }).pipe(Effect.orDie)
);

/** An in-memory file system that looks like Linux, and POSIX paths. */
const FilesLayer = Layer.merge(LinuxFileSystemLayer, Path.layer);

/** The file store of the fixture directory over the in-memory file system. */
export const StoreLayer = makeDocketFileStoreLayer(DocketFileStoreOptions.make({ directory: DIRECTORY })).pipe(
  Layer.provideMerge(FilesLayer)
);

type FakeGraphShape = {
  /** Verbs called, in order, with the id they were called for. */
  readonly calls: Ref.Ref<ReadonlyArray<string>>;
  readonly events: Ref.Ref<HashMap.HashMap<string, GraphEvent>>;
  /** A verb that fails with this error from now on, by verb name. */
  readonly failing: Ref.Ref<HashMap.HashMap<string, M365Error>>;
  readonly messages: Ref.Ref<HashMap.HashMap<string, GraphMessage>>;
  /** How many category writes still answer 412 before one goes through. */
  readonly staleWrites: Ref.Ref<number>;
};

export class FakeGraph extends Context.Service<FakeGraph, FakeGraphShape>()(
  "@beep/law-practice-server/test/DocketIntake.fixture/FakeGraph"
) {}

const notFound = M365Error.fromReason("response status", { status: 404 });
export const throttled = M365Error.fromReason("throttled", { status: 429 });
const preconditionFailed = M365Error.fromReason("response status", { status: 412 });

type Categorised = { readonly categories: ReadonlyArray<string>; readonly id: string };

export const event = (input: Categorised) => GraphEvent.make({ categories: O.some(input.categories), id: input.id });

export const mailMessage = (input: Categorised & { readonly changeKey?: string }) =>
  GraphMessage.make({
    categories: O.some(input.categories),
    changeKey: O.some(input.changeKey ?? "ck-1"),
    id: input.id,
  });

const FakeGraphStateLayer = Layer.effect(
  FakeGraph,
  Effect.gen(function* () {
    return FakeGraph.of({
      calls: yield* Ref.make<ReadonlyArray<string>>([]),
      events: yield* Ref.make(HashMap.empty<string, GraphEvent>()),
      failing: yield* Ref.make(HashMap.empty<string, M365Error>()),
      messages: yield* Ref.make(HashMap.empty<string, GraphMessage>()),
      staleWrites: yield* Ref.make(0),
    });
  })
);

/** An `M365` service over the fake mailbox and calendar; the fake is exposed for assertions. */
export const FakeGraphLayer = Layer.unwrap(
  Effect.gen(function* () {
    const fake = yield* FakeGraph;
    const call = Effect.fnUntraced(function* (verb: string, id: string) {
      yield* Ref.update(fake.calls, A.append(`${verb} ${id}`));
      const failure = HashMap.get(yield* Ref.get(fake.failing), verb);
      if (O.isSome(failure)) {
        return yield* failure.value;
      }
    });
    const found = <A>(item: O.Option<A>) => Effect.fromOption(item).pipe(Effect.mapError(() => notFound));

    return makeM365Stub({
      deleteEvent: Effect.fnUntraced(function* (request) {
        yield* call("deleteEvent", request.eventId);
        yield* found(HashMap.get(yield* Ref.get(fake.events), request.eventId));
        yield* Ref.update(fake.events, HashMap.remove(request.eventId));
      }),
      getEvent: Effect.fnUntraced(function* (request) {
        yield* call("getEvent", request.eventId);
        return yield* found(HashMap.get(yield* Ref.get(fake.events), request.eventId));
      }),
      getMessage: Effect.fnUntraced(function* (request) {
        yield* call("getMessage", request.messageId);
        return yield* found(HashMap.get(yield* Ref.get(fake.messages), request.messageId));
      }),
      updateMessageCategories: Effect.fnUntraced(function* (request) {
        yield* call("updateMessageCategories", request.messageId);
        const current = yield* found(HashMap.get(yield* Ref.get(fake.messages), request.messageId));
        const stale = yield* Ref.getAndUpdate(fake.staleWrites, (count) => count - 1);
        if (stale > 0) {
          // Someone else changed the message in between: its change key moves on.
          yield* Ref.update(
            fake.messages,
            HashMap.set(
              request.messageId,
              mailMessage({
                categories: O.getOrElse(current.categories, A.empty),
                changeKey: "ck-2",
                id: request.messageId,
              })
            )
          );
          return yield* preconditionFailed;
        }
        yield* Ref.update(
          fake.messages,
          HashMap.set(request.messageId, mailMessage({ categories: request.categories, id: request.messageId }))
        );
        return GraphMessage.make({ id: request.messageId });
      }),
    });
  })
).pipe(Layer.provideMerge(FakeGraphStateLayer));
