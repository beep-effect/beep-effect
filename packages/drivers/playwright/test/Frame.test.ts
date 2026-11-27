import { Browser } from "@beep/playwright/Browser";
import { PlaywrightSpawner } from "@beep/playwright/PlaywrightSpawner";
import { assert, describe, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { chromium, chromiumInstalled, launchOptions } from "./support/Chromium.ts";
import type { FrameShape } from "@beep/playwright/Frame";

const isTestFrame = (frame: FrameShape) => frame.name() === "test-frame";

describe.skipIf(!chromiumInstalled)("Frame", () => {
  layer(PlaywrightSpawner.layer(chromium, launchOptions), { timeout: "60 seconds" })((it) => {
    it.effect(
      "wraps frame methods",
      () =>
        Effect.gen(function* () {
          const browser = yield* Browser;
          const page = yield* browser.newPage();

          yield* page.evaluate(() => {
            const iframe = document.createElement("iframe");
            iframe.name = "test-frame";
            iframe.srcdoc =
              "<html><head><title>Frame Title</title></head><body><div id='target'>Hello from Frame</div></body></html>";
            document.body.appendChild(iframe);
          });

          yield* page.waitForLoadState("networkidle");

          const frame = yield* page.frames.pipe(
            Effect.map(A.findFirst(isTestFrame)),
            Effect.flatMap(Effect.fromOption),
            Effect.retry({ times: 3 })
          );

          const title = yield* frame.title;
          assert.strictEqual(title, "Frame Title");

          const content = yield* frame.content();
          assert.isTrue(Str.includes("Hello from Frame")(content));

          const sum = yield* frame.evaluate(() => 1 + 1);
          assert.strictEqual(sum, 2);

          const text = yield* frame.locator("#target").textContent();
          assert.strictEqual(text, "Hello from Frame");

          const anyFrameText = yield* frame.frameLocator().locator("#target").textContent();
          assert.strictEqual(anyFrameText, "Hello from Frame");

          const byText = yield* frame.getByText("Hello from Frame").count;
          assert.strictEqual(byText, 1);

          yield* frame.evaluate(() => {
            const input = document.createElement("input");
            input.placeholder = "Search...";
            document.body.appendChild(input);
          });
          const byPlaceholder = yield* frame.getByPlaceholder("Search...").count;
          assert.strictEqual(byPlaceholder, 1);

          yield* frame.evaluate(() => {
            const img = document.createElement("img");
            img.alt = "Playwright Logo";
            document.body.appendChild(img);
          });
          const byAltText = yield* frame.getByAltText("Playwright Logo").count;
          assert.strictEqual(byAltText, 1);

          yield* frame.evaluate(() => {
            const span = document.createElement("span");
            span.title = "Tooltip";
            document.body.appendChild(span);
          });
          const byTitle = yield* frame.getByTitle("Tooltip").count;
          assert.strictEqual(byTitle, 1);

          assert.strictEqual(frame.name(), "test-frame");
          assert.isOk(frame.page());
          assert.isTrue(O.isSome(frame.parentFrame()));
          assert.strictEqual(frame.childFrames().length, 0);
          assert.isFalse(frame.isDetached());

          yield* frame.waitForTimeout(100);

          const frameEl = yield* frame.frameElement;
          const tagName = yield* Effect.promise(() => frameEl.evaluate((el) => el.nodeName));
          assert.strictEqual(tagName, "IFRAME");

          yield* frame.setContent("<h1>New Content</h1>");
          const newContent = yield* frame.content();
          assert.isTrue(Str.includes("New Content")(newContent));
        }).pipe(PlaywrightSpawner.withBrowser),
      30_000
    );

    it.effect(
      "evaluate exposes a function-valued argument in the frame context",
      () =>
        Effect.gen(function* () {
          const browser = yield* Browser;
          const page = yield* browser.newPage();
          const frame = page.mainFrame();

          const result = yield* frame.evaluate(
            (triple: (value: number) => number) => triple(14),
            (value: number) => value * 3,
            {
              exposeFunctions: true,
            }
          );

          assert.strictEqual(result, 42);
        }).pipe(PlaywrightSpawner.withBrowser),
      30_000
    );

    it.effect(
      "goto returns the main resource response",
      () =>
        Effect.gen(function* () {
          const browser = yield* Browser;
          const page = yield* browser.newPage();

          yield* page.use((playwrightPage) =>
            playwrightPage.route("http://frame.test/", (route) =>
              route.fulfill({
                status: 404,
                body: "<!doctype html><title>Not found</title>",
              })
            )
          );
          const response = yield* page.mainFrame().goto("http://frame.test/");

          assert.deepStrictEqual(
            O.map(response, (r) => r.status()),
            O.some(404)
          );
        }).pipe(PlaywrightSpawner.withBrowser),
      30_000
    );

    it.effect(
      "waitForLoadState resolves on a frame",
      () =>
        Effect.gen(function* () {
          const browser = yield* Browser;
          const page = yield* browser.newPage();

          yield* page.goto(
            "data:text/html,<html><body><iframe name='test-frame' src='about:blank'></iframe></body></html>"
          );
          yield* page.waitForLoadState("load");

          const frames = yield* page.frames;
          const frame = yield* Effect.fromOption(A.findFirst(frames, isTestFrame));

          yield* frame.waitForLoadState("load");
        }).pipe(PlaywrightSpawner.withBrowser),
      30_000
    );
  });
});
