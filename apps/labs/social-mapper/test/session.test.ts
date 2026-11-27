import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import { Browser } from "@/core/browser";
import { Session, Sessions } from "@/core/session";

const session = Session.make({ platform: "onlyfans" });

const windowLeftOpen = Layer.succeed(Browser, {
  open: Effect.fn("Browser.open")(() =>
    Effect.succeed({
      closed: Effect.never,
      cookies: () => Effect.succeed(HashSet.empty<string>()),
      scroll: Effect.succeed(false),
      visit: () => Stream.never,
    })
  ),
});

it.layer(NodeServices.layer)((it) => {
  it.effect("refuses a mapper while the sign-in window of its account is open, and serves it afterwards", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped();
      const services = yield* Layer.build(Sessions.layer(root).pipe(Layer.provide(windowLeftOpen)));
      yield* Effect.gen(function* () {
        const sessions = yield* Sessions;
        const window = yield* Effect.forkScoped(sessions.signIn(session, new URL("https://onlyfans.com")));
        yield* Effect.yieldNow;
        const busy = yield* sessions.tab(session).pipe(Effect.scoped, Effect.flip);
        expect(busy.detail).toContain("still open");
        const again = yield* Effect.flip(sessions.signIn(session, new URL("https://onlyfans.com")));
        expect(again.detail).toContain("still open");
        yield* Fiber.interrupt(window);
        yield* Effect.scoped(sessions.tab(session));
      }).pipe(Effect.provide(services));
    })
  );
});
