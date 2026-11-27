import { layerWith } from "@beep/scratchpad/int/browser.playwright";
import { Downloads } from "@beep/scratchpad/int/download";
import { Inventory, Standing } from "@beep/scratchpad/int/inventory";
import { Library } from "@beep/scratchpad/int/library";
import { CollectionLocator, Locator, OnlyFansTarget } from "@beep/scratchpad/int/locator";
import { profile } from "@beep/scratchpad/int/reader";
import { Session, Sessions } from "@beep/scratchpad/int/session";
import { Options, layer as onlyfans } from "@beep/scratchpad/int/sites/onlyfans";
import { layer as unmapped } from "@beep/scratchpad/int/sites/unmapped";
import { Inventories } from "@beep/scratchpad/int/store";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Headers from "effect/http/Headers";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as KeyValueStore from "effect/persistence/KeyValueStore";
import * as R from "effect/Record";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const chromium = "/usr/bin/chromium";

const session = Session.make({ platform: "onlyfans" });

const source = CollectionLocator.make(
  Locator.cases.onlyfans.make({ target: OnlyFansTarget.cases.collection.make({ user: "example" }) })
);

const html = (script: string) =>
  HttpServerResponse.html(`<body style="margin:0"><div id="feed" style="min-height:3000px"></div><script>${script}</script></body>`);

const cookie = (name: string) =>
  HttpServerResponse.jsonUnsafe({ ok: true }, { headers: { "set-cookie": `${name}=1; Max-Age=86400; Path=/` } });

const profilePage = `(async () => {
  const owner = await (await fetch('/api2/v2/users/example')).json()
  await fetch('/api2/v2/users/' + owner.id + '/posts?pinned=1')
  let page = 0, busy = false, more = true
  const load = async () => {
    if (busy || !more) return
    busy = true
    const answer = await (await fetch('/api2/v2/users/' + owner.id + '/posts?page=' + page++)).json()
    more = answer.hasMore
    document.getElementById('feed').style.minHeight = (3000 * (page + 1)) + 'px'
    busy = false
  }
  await load()
  addEventListener('scroll', load)
})()`;

const wire = (origin: string) => ({
  301: { id: 301, author: { id: 7 }, postedAt: "2026-01-01T00:00:00+00:00", media: [{ id: 9301, type: "photo", canView: false }] },
  302: {
    id: 302,
    author: { id: 7 },
    postedAt: "2026-01-02T00:00:00+00:00",
    rawText: "second",
    media: [{ id: 9302, type: "photo", canView: true, files: { full: { url: `${origin}/files/302.jpg`, width: 800, height: 600 } } }],
  },
  303: { id: 303, author: { id: 7 }, postedAt: "2026-01-03T00:00:00+00:00", media: [{ id: 9303, type: "video", canView: true }] },
});

const site = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const origin = `http://${O.getOrElse(Headers.get(request.headers, "host"), () => "fixture")}`;
  const { pathname, searchParams } = new URL(request.url, origin);
  const posts = wire(origin);
  const signedIn = O.exists(Headers.get(request.headers, "cookie"), Str.includes("sess=1"));
  const routes: Record<string, () => HttpServerResponse.HttpServerResponse> = {
    "/signin": () => html("fetch('/api2/v2/session/sess').then(() => fetch('/api2/v2/session/auth_id'))"),
    "/api2/v2/session/sess": () => cookie("sess"),
    "/api2/v2/session/auth_id": () => cookie("auth_id"),
    "/example": () => html(profilePage),
    "/302/example": () => html("fetch('/api2/v2/posts/302')"),
    "/api2/v2/users/example": () =>
      signedIn
        ? HttpServerResponse.jsonUnsafe({ id: 7, username: "example", name: "Example", isVerified: true })
        : HttpServerResponse.empty({ status: 401 }),
    "/api2/v2/users/7/posts": () =>
      HttpServerResponse.jsonUnsafe(
        searchParams.get("pinned") === "1"
          ? { list: [posts[303]], hasMore: false }
          : searchParams.get("page") === "0"
            ? { list: [posts[303], posts[302]], hasMore: true }
            : { list: [posts[301]], hasMore: false }
      ),
    "/303/example": () => html("fetch('/api2/v2/posts/303')"),
    "/api2/v2/posts/302": () => HttpServerResponse.jsonUnsafe(posts[302]),
    "/api2/v2/posts/303": () => HttpServerResponse.jsonUnsafe(posts[303]),
    "/files/302.jpg": () => HttpServerResponse.text("not really a jpeg", { contentType: "image/jpeg" }),
  };
  return O.match(R.get(routes, pathname), {
    onNone: () => HttpServerResponse.empty({ status: 404 }),
    onSome: (respond) => respond(),
  });
});

const finished = (library: typeof Library.Service) =>
  Effect.map(Stream.runLast(library.watch(source)), O.getOrThrow);

const numbers = (inventory: Inventory) =>
  A.sort(
    A.map(inventory.entries, ({ item }) => (OnlyFansTarget.guards.post(item.source.target) ? item.source.target.id : "")),
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
