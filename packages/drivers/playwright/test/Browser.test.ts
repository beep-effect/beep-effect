import { Playwright } from "@beep/playwright/Playwright";
import { assert, describe, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Stream from "effect/Stream";
import { chromium, chromiumInstalled, launchOptions } from "./support/Chromium.ts";

describe.skipIf(!chromiumInstalled)("Browser", () => {
  layer(Playwright.layer, { timeout: "60 seconds" })((it) => {
    it.effect("newPage should create a page", () =>
      Effect.gen(function* () {
        const playwright = yield* Playwright;
        const browser = yield* playwright.launchScoped(chromium, launchOptions);

        const page = yield* browser.newPage();
        assert.isDefined(page);
      })
    );

    it.effect("use should allow accessing raw browser", () =>
      Effect.gen(function* () {
        const playwright = yield* Playwright;
        const browser = yield* playwright.launchScoped(chromium, launchOptions);

        const isConnected = yield* browser.use((b) => Promise.resolve(b.isConnected()));
        assert.isTrue(isConnected);
      })
    );

    it.effect("browserType should return the browser type", () =>
      Effect.gen(function* () {
        const playwright = yield* Playwright;
        const browser = yield* playwright.launchScoped(chromium, launchOptions);

        assert.strictEqual(browser.browserType().name(), "chromium");
      })
    );

    it.effect("version should return the browser version", () =>
      Effect.gen(function* () {
        const playwright = yield* Playwright;
        const browser = yield* playwright.launchScoped(chromium, launchOptions);

        const version = browser.version();
        assert.isString(version);
        assert.isNotEmpty(version);
      })
    );

    it.effect("close should close the browser", () =>
      Effect.gen(function* () {
        const playwright = yield* Playwright;
        const browser = yield* playwright.launchScoped(chromium, launchOptions);

        yield* browser.close;

        const isConnected = yield* browser.use((b) => Promise.resolve(b.isConnected()));
        assert.isFalse(isConnected);
      })
    );

    it.effect("contexts should return the list of contexts", () =>
      Effect.gen(function* () {
        const playwright = yield* Playwright;
        const browser = yield* playwright.launchScoped(chromium, launchOptions);

        assert.strictEqual(browser.contexts().length, 0);

        yield* browser.newContext();
        assert.strictEqual(browser.contexts().length, 1);
      })
    );

    it.effect("newContext should create a new context", () =>
      Effect.gen(function* () {
        const playwright = yield* Playwright;
        const browser = yield* playwright.launchScoped(chromium, launchOptions);

        const context = yield* browser.newContext();
        assert.isDefined(context);
        assert.strictEqual(context.pages().length, 0);
      })
    );

    it.effect("newContext should allow creating pages", () =>
      Effect.gen(function* () {
        const playwright = yield* Playwright;
        const browser = yield* playwright.launchScoped(chromium, launchOptions);

        const context = yield* browser.newContext();
        const page = yield* context.newPage;
        assert.isDefined(page);
        assert.strictEqual(context.pages().length, 1);
      })
    );

    it.effect("contexts should reflect newPage creation", () =>
      Effect.gen(function* () {
        const playwright = yield* Playwright;
        const browser = yield* playwright.launchScoped(chromium, launchOptions);

        yield* browser.newPage();
        const contexts = browser.contexts();
        assert.strictEqual(contexts.length, 1);
        assert.deepStrictEqual(
          A.map(contexts, (context) => context.pages().length),
          [1]
        );
      })
    );

    it.effect("newContext and browser finalizers should work", () =>
      Effect.gen(function* () {
        const playwright = yield* Playwright;

        const capturedBrowser = yield* Effect.scoped(
          Effect.gen(function* () {
            const browser = yield* playwright.launchScoped(chromium, launchOptions);

            yield* Effect.scoped(
              Effect.gen(function* () {
                yield* browser.newContext();
                assert.strictEqual(browser.contexts().length, 1);
              })
            );

            assert.strictEqual(browser.contexts().length, 0);
            return browser;
          })
        );

        assert.isFalse(capturedBrowser.isConnected());
      })
    );

    it.effect("eventStream should emit disconnected event", () =>
      Effect.gen(function* () {
        const playwright = yield* Playwright;
        const browser = yield* playwright.launchScoped(chromium, launchOptions);

        const eventsFiber = yield* browser.eventStream("disconnected").pipe(Stream.runCollect, Effect.forkChild);

        yield* browser.close;
        const events = yield* Fiber.join(eventsFiber);
        assert.deepStrictEqual(
          A.map(events, (event) => event.version()),
          [browser.version()]
        );
      })
    );
  });
});
