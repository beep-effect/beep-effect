import { Browser } from "@beep/playwright/Browser";
import { PlaywrightSpawner } from "@beep/playwright/PlaywrightSpawner";
import { describe, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Stream from "effect/Stream";
import { chromium, chromiumInstalled, launchOptions } from "./support/Chromium.ts";

describe.skipIf(!chromiumInstalled)("eventStream", () => {
  layer(PlaywrightSpawner.layer(chromium, launchOptions), { timeout: "60 seconds" })((it) => {
    it.effect("should complete when the page closes instead of timing out", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        const fiber = yield* Stream.runCollect(page.eventStream("console")).pipe(Effect.forkChild);

        yield* page.close;

        yield* Fiber.await(fiber);
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("should complete when the browser closes instead of timing out", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        const fiber = yield* Stream.runCollect(page.eventStream("console")).pipe(Effect.forkChild);

        yield* browser.close;

        yield* Fiber.await(fiber);
      }).pipe(PlaywrightSpawner.withBrowser)
    );
  });
});
