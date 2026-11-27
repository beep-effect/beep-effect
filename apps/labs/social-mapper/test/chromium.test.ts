import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpServer from "effect/http/HttpServer";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as KeyValueStore from "effect/persistence/KeyValueStore";
import * as Stream from "effect/Stream";
import { layerWith } from "@/core/browser.playwright";
import { Downloads } from "@/core/download";
import { Standing } from "@/core/inventory";
import { Library } from "@/core/library";
import { CollectionLocator, Locator, OnlyFansTarget } from "@/core/locator";
import { profile } from "@/core/reader";
import { Session, Sessions } from "@/core/session";
import { Options, layer as onlyfans } from "@/core/sites/onlyfans";
import { layer as unmapped } from "@/core/sites/unmapped";
import { Inventories } from "@/core/store";
import { site } from "../server/StandIn.ts";
import type { Inventory } from "@/core/inventory";

const chromium = "/usr/bin/chromium";

const session = Session.make({ platform: "onlyfans" });

const source = CollectionLocator.make(
  Locator.cases.onlyfans.make({ target: OnlyFansTarget.cases.collection.make({ user: "example" }) })
);

const finished = (library: typeof Library.Service) => Effect.map(Stream.runLast(library.watch(source)), O.getOrThrow);

const numbers = (inventory: Inventory) =>
  A.sort(
    A.map(inventory.entries, ({ item }) =>
      OnlyFansTarget.guards.post(item.source.target) ? item.source.target.id : ""
    ),
    Order.String
  );

it.layer(NodeHttpServer.layerTest, { timeout: "90 seconds", excludeTestServices: true })((it) => {
  it.effect("signs in once, then maps, reads and downloads through a real browser", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const installed = yield* fs.exists(chromium);
      if (!installed) {
        return;
      }
      const server = yield* HttpServer.HttpServer;
      yield* server.serve(site);
      const origin = new URL(HttpServer.formatAddress(server.address));
      const root = yield* fs.makeTempDirectoryScoped();
      const options = Options.make({
        origin,
        media: [origin.host],
        moved: Duration.millis(50),
        still: Duration.millis(100),
      });
      const services = yield* Layer.build(
        Downloads.layer(path.join(root, "files")).pipe(
          Layer.provide(FetchHttpClient.layer),
          Layer.provideMerge(Library.layer()),
          Layer.provideMerge(Inventories.layer),
          Layer.provide(KeyValueStore.layerFileSystem(path.join(root, "store"))),
          Layer.provideMerge(Layer.merge(onlyfans(options), unmapped)),
          Layer.provideMerge(Sessions.layer(path.join(root, "sessions"))),
          Layer.provide(layerWith(O.some(chromium)))
        )
      );
      yield* Effect.gen(function* () {
        const library = yield* Library;
        const sessions = yield* Sessions;
        const downloads = yield* Downloads;

        yield* library.map(source, "fresh");
        const refused = yield* finished(library);
        expect(Standing.guards.failed(refused.standing) && refused.standing.failure._tag).toBe("AuthRequired");

        yield* Effect.scoped(
          Effect.gen(function* () {
            const tab = yield* sessions.tab(session);
            yield* tab.visit(new URL("/signin", origin)).pipe(Stream.take(2), Stream.runDrain);
          })
        );
        const kept = yield* sessions.list;
        expect(kept).toEqual([session]);

        yield* library.map(source, "fresh");
        const mapped = yield* finished(library);
        expect(Standing.guards.complete(mapped.standing)).toBe(true);
        expect(numbers(mapped)).toEqual(["301", "302", "303"]);
        expect(mapped.pages).toBe(3);
        expect(A.map(mapped.entries, ({ item }) => item.locked)).toContain(1);

        const owner = yield* profile(source);
        expect(owner.verified).toBe(true);

        const files = yield* downloads.pending(source);
        expect(files).toHaveLength(1);
        const first = yield* Effect.fromOption(A.head(files));
        const text = yield* fs.readFileString(first.path);
        expect(text).toBe("not really a jpeg");
        const after = yield* library.get(source);
        expect(A.flatMap(after.entries, ({ files: saved }) => saved)).toHaveLength(1);
      }).pipe(Effect.provide(services));
    })
  );
});
