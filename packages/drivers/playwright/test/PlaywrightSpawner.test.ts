import { Browser } from "@beep/playwright/Browser";
import { PlaywrightSpawner } from "@beep/playwright/PlaywrightSpawner";
import { assert, describe, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as F from "effect/Function";
import * as Str from "effect/String";
import { chromium, chromiumInstalled, launchOptions } from "./support/Chromium.ts";
import type { PlaywrightSpawnerShape } from "@beep/playwright/PlaywrightSpawner";

const firstPage = Effect.gen(function* () {
  const browser = yield* Browser;

  assert.isDefined(browser, "Expected browser");

  const contexts = browser.contexts();
  assert.isAbove(contexts.length, 0, "Expected contexts");

  const pages = A.flatMap(A.take(contexts, 1), (context) => context.pages());
  assert.isAbove(pages.length, 0, "Expected pages");

  return yield* Effect.fromOption(A.head(pages));
});

const accessFirst = Effect.gen(function* () {
  const page = yield* firstPage;
  yield* page.goto("about:blank?test=1");
});

const accessSecond = Effect.gen(function* () {
  const page = yield* firstPage;
  assert.isTrue(F.pipe(page.url(), Str.includes("?test=1")), "Expected ?test=1");
});

describe.skipIf(!chromiumInstalled)("PlaywrightSpawner", () => {
  layer(PlaywrightSpawner.layer(chromium, launchOptions), { timeout: "60 seconds" })((it) => {
    it.effect("should launch a browser", () =>
      Effect.gen(function* () {
        const program = Effect.gen(function* () {
          const spawner: PlaywrightSpawnerShape = yield* PlaywrightSpawner;
          const browser = yield* spawner.browser;

          yield* browser.newPage({ baseURL: "about:blank" });
        });
        const result = yield* Effect.exit(program);

        assert.isTrue(Exit.isSuccess(result), "Expected success");
      })
    );

    it.effect("withBrowser helper should work", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;

        yield* browser.newPage({ baseURL: "about:blank" });
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("withBrowser allows shared use", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;

        yield* browser.newPage({ baseURL: "about:blank" });

        yield* accessFirst;
        yield* accessSecond;
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("withBrowser imperative use", () =>
      PlaywrightSpawner.withBrowser(
        Effect.gen(function* () {
          const browser = yield* Browser;

          yield* browser.newPage({ baseURL: "about:blank" });
        })
      )
    );

    it.effect("withBrowser scope cleanup", () =>
      Effect.gen(function* () {
        const capturedBrowser = yield* PlaywrightSpawner.withBrowser(
          Effect.gen(function* () {
            const browser = yield* Browser;

            yield* browser.newPage({ baseURL: "about:blank" });

            yield* accessFirst;
            yield* accessSecond;
            return browser;
          })
        );

        assert.strictEqual(capturedBrowser.contexts().length, 0, "Expected no contexts");
        assert.isFalse(capturedBrowser.isConnected(), "Expected not connected");
      })
    );
  });
});
