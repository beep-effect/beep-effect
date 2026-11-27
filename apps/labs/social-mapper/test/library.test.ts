import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { constant } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as KeyValueStore from "effect/persistence/KeyValueStore";
import * as Ref from "effect/Ref";
import * as RpcTest from "effect/rpc/RpcTest";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";
import { BrowserFailed } from "@/core/browser";
import { Catalog } from "@/core/catalog";
import { Downloads } from "@/core/download";
import { Inventory, Standing } from "@/core/inventory";
import { Library, Limits } from "@/core/library";
import {
  AuthRequired,
  CollectionLocator,
  Cursor,
  Locator,
  MappedItem,
  Page,
  PostLocator,
  RedGifsTarget,
} from "@/core/locator";
import {
  DzenMapper,
  FacebookMapper,
  FanslyMapper,
  InstagramMapper,
  OnlyFansMapper,
  PinterestMapper,
  RedditMapper,
  RedGifsMapper,
  SnapchatMapper,
  ThreadsMapper,
  TikTokMapper,
  VscoMapper,
  XMapper,
  YouTubeMapper,
} from "@/core/mapper";
import { LibraryRpcs } from "@/core/protocol";
import { LibraryHandlers } from "@/core/protocol.layer";
import { Session, Sessions } from "@/core/session";
import { Inventories } from "@/core/store";
import type { MapFailure } from "@/core/locator";

const source = CollectionLocator.make(
  Locator.cases.redgifs.make({ target: RedGifsTarget.cases.collection.make({ user: "example" }) })
);

const other = CollectionLocator.make(
  Locator.cases.redgifs.make({ target: RedGifsTarget.cases.collection.make({ user: "another" }) })
);

const post = (id: string) =>
  PostLocator.make(Locator.cases.redgifs.make({ target: RedGifsTarget.cases.post.make({ id }) }));

const item = (id: string) => MappedItem.make({ source: post(id), videos: 1 });

const page = (ids: ReadonlyArray<string>, next: O.Option<string> = O.none()) =>
  Page.make({ items: A.map(ids, item), next: O.map(next, Cursor.make) });

const ids = (inventory: Inventory) =>
  A.map(inventory.entries, ({ item: { source: locator } }) =>
    RedGifsTarget.guards.post(locator.target) ? locator.target.id : ""
  );

const library = (
  pages: (from: O.Option<Cursor>) => Stream.Stream<Page, MapFailure>,
  limits: Limits = Limits.make({ caughtUpAfter: 2 })
) =>
  Library.layer(limits).pipe(
    Layer.provideMerge(Inventories.layer),
    Layer.provide(
      Layer.mergeAll(
        KeyValueStore.layerMemory,
        Layer.succeed(RedGifsMapper, { pages: (_, from) => pages(from) }),
        Layer.succeed(DzenMapper, { pages: () => Stream.empty }),
        Layer.succeed(FacebookMapper, { pages: () => Stream.empty }),
        Layer.succeed(FanslyMapper, { pages: () => Stream.empty }),
        Layer.succeed(InstagramMapper, { pages: () => Stream.empty }),
        Layer.succeed(OnlyFansMapper, { pages: () => Stream.empty }),
        Layer.succeed(PinterestMapper, { pages: () => Stream.empty }),
        Layer.succeed(RedditMapper, { pages: () => Stream.empty }),
        Layer.succeed(SnapchatMapper, { pages: () => Stream.empty }),
        Layer.succeed(ThreadsMapper, { pages: () => Stream.empty }),
        Layer.succeed(TikTokMapper, { pages: () => Stream.empty }),
        Layer.succeed(VscoMapper, { pages: () => Stream.empty }),
        Layer.succeed(XMapper, { pages: () => Stream.empty }),
        Layer.succeed(YouTubeMapper, { pages: () => Stream.empty })
      )
    )
  );

const scenario = <E>(
  name: string,
  layer: Layer.Layer<Library | Inventories>,
  body: Effect.Effect<void, E, Library | Inventories>
) =>
  it.layer(layer)((it) => {
    it.effect(name, () => body);
  });

const finished = (target: CollectionLocator) =>
  Library.use((service) => Stream.runLast(service.watch(target))).pipe(Effect.map(O.getOrThrow));

scenario(
  "stores every page of a fresh run and ends complete",
  library(() => Stream.make(page(["clipa", "clipb"], O.some("second")), page(["clipc"]))),
  Effect.gen(function* () {
    const service = yield* Library;
    const begun = yield* service.map(source, "fresh");
    const ended = yield* finished(source);
    expect(Inventory.mapping(begun)).toBe(true);
    expect(ids(ended)).toEqual(["clipa", "clipb", "clipc"]);
    expect(ended.pages).toBe(2);
    expect(Standing.guards.complete(ended.standing) && !ended.standing.caughtUp).toBe(true);
    expect(O.isNone(ended.cursor)).toBe(true);
    const listed = yield* service.list;
    expect(listed).toHaveLength(1);
  })
);

scenario(
  "ends an incremental run at posts it already holds and lists the new one first",
  Layer.unwrap(
    Effect.map(Ref.make(0), (calls) =>
      library(() =>
        Stream.unwrap(
          Effect.map(
            Ref.getAndUpdate(calls, (count) => count + 1),
            (count) =>
              count === 0
                ? Stream.make(page(["clipa", "clipb"]), page(["clipc"]))
                : Stream.make(page(["clipn", "clipa", "clipb"]), page(["clipc"]))
          )
        )
      )
    )
  ),
  Effect.gen(function* () {
    const service = yield* Library;
    yield* service.map(source, "fresh");
    yield* finished(source);
    yield* service.map(source, "incremental");
    const ended = yield* finished(source);
    expect(ids(ended)).toEqual(["clipn", "clipa", "clipb", "clipc"]);
    expect(ended.pages).toBe(1);
    expect(Standing.guards.complete(ended.standing) && ended.standing.caughtUp).toBe(true);
  })
);

scenario(
  "stores the failure of a run with the pages read before it",
  library(() => Stream.concat(Stream.make(page(["clipa"])), Stream.fail(AuthRequired.make({ platform: "redgifs" })))),
  Effect.gen(function* () {
    const service = yield* Library;
    yield* service.map(source, "fresh");
    const ended = yield* finished(source);
    expect(ids(ended)).toEqual(["clipa"]);
    expect(Standing.guards.failed(ended.standing) && ended.standing.failure._tag).toBe("AuthRequired");
  })
);

scenario(
  "refuses a second run of one listing, queues another listing, and stops on request",
  library(() => Stream.concat(Stream.make(page(["clipa"], O.some("second"))), Stream.never)),
  Effect.gen(function* () {
    const service = yield* Library;
    yield* service.map(source, "fresh");
    const refused = yield* Effect.flip(service.map(source, "fresh"));
    yield* service.map(other, "fresh");
    const stopped = yield* service.stop(source);
    const waiting = yield* service.stop(other);
    expect(refused._tag).toBe("Busy");
    expect(Standing.guards.partial(stopped.standing) && stopped.standing.halt).toBe("stopped");
    expect(Standing.guards.partial(waiting.standing) && waiting.standing.halt).toBe("stopped");
    expect(O.isSome(stopped.cursor)).toBe(true);
  })
);

scenario(
  "resumes a stopped run from the cursor it stored",
  library(
    O.match({
      onNone: () => Stream.concat(Stream.make(page(["clipa"], O.some("second"))), Stream.never),
      onSome: () => Stream.make(page(["clipb"])),
    })
  ),
  Effect.gen(function* () {
    const service = yield* Library;
    yield* service.map(source, "fresh");
    yield* Stream.runHead(Stream.filter(service.watch(source), ({ pages }) => pages === 1));
    yield* service.stop(source);
    yield* service.map(source, "resume");
    const ended = yield* finished(source);
    expect(ids(ended)).toEqual(["clipa", "clipb"]);
    expect(ended.pages).toBe(2);
    expect(Standing.guards.complete(ended.standing)).toBe(true);
  })
);

scenario(
  "gives up on a silent site and keeps the record partial",
  library(() => Stream.never, Limits.make({ idle: Duration.minutes(1) })),
  Effect.gen(function* () {
    const service = yield* Library;
    yield* service.map(source, "fresh");
    yield* TestClock.adjust(Duration.minutes(2));
    const ended = yield* finished(source);
    expect(Standing.guards.partial(ended.standing) && ended.standing.halt).toBe("idle");
  })
);

scenario(
  "reads a run that died with its process as stopped",
  library(() => Stream.empty),
  Effect.gen(function* () {
    const startedAt = yield* DateTime.now;
    yield* Inventories.use((store) => store.put(Inventory.begin(Inventory.empty(source), startedAt, false)));
    const found = yield* Library.use((service) => service.get(source));
    expect(Standing.guards.partial(found.standing) && found.standing.halt).toBe("stopped");
  })
);

it.layer(
  LibraryHandlers.pipe(
    Layer.provideMerge(library(() => Stream.make(page(["clipa"])))),
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(Sessions, {
          list: Effect.succeed([Session.make({ platform: "redgifs" })]),
          signIn: constant(Effect.void),
          tab: constant(Effect.fail(BrowserFailed.make({ detail: "no browser in this test" }))),
          forget: constant(Effect.void),
        }),
        Layer.succeed(Downloads, { post: constant(Effect.succeed([])), pending: constant(Effect.succeed([])) }),
        Layer.succeed(Catalog, { installed: [] })
      )
    )
  )
)("the library protocol", (it) => {
  it.effect("starts a run, follows it to its end and lists the record", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(LibraryRpcs);
      const begun = yield* client.MapRun({ source, mode: "fresh" });
      const ended = yield* Stream.runLast(client.MapWatch({ source }));
      const records = yield* client.InventoryList({});
      const sessions = yield* client.SessionList({});
      expect(Inventory.mapping(begun)).toBe(true);
      expect(O.map(ended, ids)).toEqual(O.some(["clipa"]));
      expect(A.map(records, (record) => record.source)).toContainEqual(source);
      expect(A.map(sessions, ({ platform }) => platform)).toEqual(["redgifs"]);
    })
  );

  it.effect("stops a run a dead process left behind and maps the listing again", () =>
    Effect.gen(function* () {
      const client = yield* RpcTest.makeClient(LibraryRpcs);
      const begun = yield* Inventories.use((store) => store.get(other));
      yield* Inventories.use((store) =>
        store.put(
          Inventory.begin(
            O.getOrElse(begun, () => Inventory.empty(other)),
            DateTime.makeUnsafe(0),
            false
          )
        )
      );
      yield* client.MapStop({ source: other });
      yield* client.MapRun({ source: other, mode: "fresh" });
      const settled = yield* Stream.runLast(client.MapWatch({ source: other }));
      expect(O.map(settled, Inventory.mapping)).toEqual(O.some(false));
    })
  );
});
