import { Browser } from "@beep/playwright/Browser";
import { PlaywrightSpawner } from "@beep/playwright/PlaywrightSpawner";
import { assert, describe, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as F from "effect/Function";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { errors } from "playwright";
import { chromium, chromiumInstalled, launchOptions } from "./support/Chromium.ts";

const armTimerInBrowser = "window.timerFired = false; setTimeout(() => { window.timerFired = true; }, 10000);";
const throwInBrowserTask = "setTimeout(() => { throw new Error('Test Error'); }, 0);";
const logInBrowserConsole = "console.log('Hello from page'); console.warn('Warning from page');";

describe.skipIf(!chromiumInstalled)("Page", () => {
  layer(PlaywrightSpawner.layer(chromium, launchOptions), { timeout: "60 seconds" })((it) => {
    it.effect("goto should navigate to a URL", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.goto("about:blank");
        const url = yield* page.use((p) => Promise.resolve(p.url()));
        assert(url === "about:blank");
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("setContent should set the page content", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.setContent("<h1>Hello World</h1>");
        const content = yield* page.content();
        assert.include(content, "<h1>Hello World</h1>");
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("title should return the page title", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.goto("data:text/html,<title>Test Page</title>");
        const title = yield* page.title;
        assert(title === "Test Page");
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("content should return the page content", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.goto("data:text/html,<html><head><title>Content</title></head><body><h1>Hello</h1></body></html>");
        const content = yield* page.content();
        assert.include(content, "<h1>Hello</h1>");
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("click should click an element", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.evaluate(() => {
          document.body.innerHTML = '<button id="mybutton" onclick="window.clicked = true">Click Me</button>';
          Reflect.set(window, "clicked", false);
        });

        yield* page.click("#mybutton");

        const clicked = yield* page.evaluate(() => Reflect.get(window, "clicked"));
        assert(clicked === true);
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("goto should work with options", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.goto("about:blank", { waitUntil: "domcontentloaded" });
        const url = yield* page.use((p) => Promise.resolve(p.url()));
        assert(url === "about:blank");
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("goto should return the main resource response", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.use((playwrightPage) =>
          playwrightPage.route("http://status.test/", (route) =>
            route.fulfill({
              status: 404,
              body: "<!doctype html><title>Not found</title>",
            })
          )
        );
        const response = yield* page.goto("http://status.test/");

        assert.deepStrictEqual(
          O.map(response, (response) => [response.status(), response.ok()]),
          O.some([404, false])
        );
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("goto should return None when there is no response", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        const response = yield* page.goto("about:blank");

        assert.isTrue(O.isNone(response));
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("reload should return the response of the reloaded page", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();
        let requests = 0;

        yield* page.use((playwrightPage) =>
          playwrightPage.route("http://reload.test/", (route) => {
            requests++;
            return route.fulfill({
              status: requests === 1 ? 200 : 503,
              body: "<!doctype html><title>Reload</title>",
            });
          })
        );
        yield* page.goto("http://reload.test/");
        const response = yield* page.reload();

        assert.deepStrictEqual(
          O.map(response, (response) => response.status()),
          O.some(503)
        );
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("reload should time out after the timeout option", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();
        let requests = 0;

        yield* page.use((playwrightPage) =>
          playwrightPage.route("http://reload.test/", (route) => {
            requests++;
            return requests === 1 ? route.fulfill({ body: "<!doctype html><title>Reload</title>" }) : Promise.resolve();
          })
        );
        yield* page.goto("http://reload.test/");
        const error = yield* page.reload({ timeout: 100 }).pipe(Effect.flip);

        assert.strictEqual(error.reason, "Timeout");
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("waitForTimeout should wait", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        const start = yield* page.evaluate(() => performance.now());
        yield* page.waitForTimeout(100);
        const end = yield* page.evaluate(() => performance.now());
        assert(end - start >= 100);
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("evaluate should run code in the page context with destructured arg", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        const result = yield* page.evaluate(([a, b]: readonly [number, number]) => a + b, [10, 20] as const);
        assert(result === 30);
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("evaluate should run code with a single value arg", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        const result = yield* page.evaluate((val: number) => val * 2, 21);
        assert(result === 42);
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("evaluate should expose a function-valued argument in the page context", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        const result = yield* page.evaluate(
          (double: (value: number) => Promise<number>) => double(21),
          (value: number) => Promise.resolve(value * 2),
          { exposeFunctions: true }
        );

        assert.strictEqual(result, 42);
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("click should work with options", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.evaluate(() => {
          document.body.innerHTML = '<button id="mybutton" style="width: 100px; height: 100px">Click Me</button>';
          Reflect.set(window, "clickCoords", null);
          document.getElementById("mybutton")?.addEventListener("click", (e) => {
            Reflect.set(window, "clickCoords", { x: e.clientX, y: e.clientY });
          });
        });

        yield* page.click("#mybutton", { position: { x: 10, y: 10 } });

        const coords = yield* page.evaluate(() => Reflect.get(window, "clickCoords"));
        assert(coords !== null);
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("use should allow accessing raw playwright page", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        const content = yield* page.use((p) => p.content());
        assert.isString(content);
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("locator should work with options", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.evaluate(() => {
          document.body.innerHTML = `
          <div class="test">One</div>
          <div class="test" data-id="target">Two</div>
        `;
        });

        const locator = page.locator(".test", { hasText: "Two" });
        const text = yield* locator.textContent();
        assert(text === "Two");

        const attr = yield* locator.getAttribute("data-id");
        assert(attr === "target");
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("getBy* methods should work", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.evaluate(() => {
          document.body.innerHTML = `
          <button role="button">Click Me</button>
          <span>Hello World</span>
          <label for="input">Label Text</label>
          <input id="input" />
          <div data-testid="test-id">Test Content</div>
          <img alt="Alt Text" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" />
          <input placeholder="Placeholder Text" />
          <div title="Title Text">Hover Me</div>
        `;
        });

        const byRole = yield* page.getByRole("button").textContent();
        assert(byRole === "Click Me");

        const byText = yield* page.getByText("Hello World").textContent();
        assert(byText === "Hello World");

        const byLabel = yield* page.getByLabel("Label Text").getAttribute("id");
        assert(byLabel === "input");

        const byTestId = yield* page.getByTestId("test-id").textContent();
        assert(byTestId === "Test Content");

        const byAltText = yield* page.getByAltText("Alt Text").getAttribute("alt");
        assert(byAltText === "Alt Text");

        const byPlaceholder = yield* page.getByPlaceholder("Placeholder Text").getAttribute("placeholder");
        assert(byPlaceholder === "Placeholder Text");

        const byTitle = yield* page.getByTitle("Title Text").textContent();
        assert(byTitle === "Hover Me");
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("Playwright 1.63 page and locator APIs", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.setContent(`
        <button style="display: none">Hidden</button>
        <button>Visible</button>
        <iframe srcdoc="<button>Framed</button>"></iframe>
      `);

        const pageSnapshot = yield* page.ariaSnapshotJSON();
        assert.deepStrictEqual(pageSnapshot, [{ role: "button", name: "Visible" }, { role: "iframe" }]);

        const visibleButtons = page.locator("button").visible();
        const visibleCount = yield* visibleButtons.count;
        assert.strictEqual(visibleCount, 1);
        const visibleText = yield* visibleButtons.textContent();
        assert.strictEqual(visibleText, "Visible");

        const locatorSnapshot = yield* visibleButtons.ariaSnapshotJSON();
        assert.deepStrictEqual(locatorSnapshot, [{ role: "button", name: "Visible" }]);

        const framedText = yield* page.frameLocator().getByText("Framed").textContent();
        assert.strictEqual(framedText, "Framed");
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("waitForURL should work with History API", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.goto("about:blank");
        yield* page.evaluate(() => {
          history.pushState({}, "", "#test-history");
        });

        yield* page.waitForURL((url) => url.hash === "#test-history");
        const url = page.url();
        assert(F.pipe(url, Str.endsWith("#test-history")));
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("filechooser event should work", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.evaluate(() => {
          document.body.innerHTML = '<input type="file" id="fileinput" />';
        });

        const fileChooser = yield* page.eventStream("filechooser").pipe(Stream.runHead, Effect.forkChild);

        yield* page.locator("#fileinput").click();

        const results = yield* Fiber.join(fileChooser).pipe(Effect.flatMap(Effect.fromOption));

        assert(results.isMultiple() === false, "isMultiple should be false");
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("waitForLoadState should resolve", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.goto("about:blank");
        yield* page.waitForLoadState("load");

        assert.ok(true);
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("url property should update after navigation", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        const url1 = "data:text/html,<h1>Page 1</h1>";
        yield* page.goto(url1);
        assert.strictEqual(page.url(), url1);

        const url2 = "data:text/html,<h1>Page 2</h1>";
        yield* page.goto(url2);
        assert.strictEqual(page.url(), url2);
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("goBack and goForward should navigate through history", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        const url1 = "data:text/html,<h1>Page 1</h1>";
        yield* page.goto(url1);

        const url2 = "data:text/html,<h1>Page 2</h1>";
        yield* page.goto(url2);
        assert.strictEqual(page.url(), url2, "URL should be updated to url2");

        yield* page.goBack();
        assert.strictEqual(page.url(), url1, "URL should be updated to url1");

        yield* page.goForward();
        assert.strictEqual(page.url(), url2, "URL should be updated to url2");
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("requestGC should execute without error", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.requestGC;
        assert.ok(true);
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("clock should allow fast forwarding time", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.clock.install({ time: "2024-01-01T00:00:00.000Z" });

        yield* page.evaluate(armTimerInBrowser);

        let timerFired = yield* page.evaluate(() => Reflect.get(window, "timerFired"));
        assert.strictEqual(timerFired, false);

        yield* page.clock.fastForward(10000);

        timerFired = yield* page.evaluate(() => Reflect.get(window, "timerFired"));
        assert.strictEqual(timerFired, true);
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("clock should allow fast forwarding time on context", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const context = yield* browser.newContext();
        const page = yield* context.newPage;

        yield* context.clock.install({
          time: "2024-01-01T00:00:00.000Z",
        });

        yield* page.evaluate(armTimerInBrowser);

        let timerFired = yield* page.evaluate(() => Reflect.get(window, "timerFired"));
        assert.strictEqual(timerFired, false);

        yield* context.clock.fastForward(10000);

        timerFired = yield* page.evaluate(() => Reflect.get(window, "timerFired"));
        assert.strictEqual(timerFired, true);
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("addInitScript should execute script before page load", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.addInitScript(
          (double: (value: number) => Promise<number>) =>
            double(21).then((value) => {
              Reflect.set(window, "magicValue", value);
            }),
          (value: number) => Promise.resolve(value * 2),
          { exposeFunctions: true }
        );

        yield* page.goto("about:blank");

        const magicValue = yield* page.evaluate(() => Reflect.get(window, "magicValue"));
        assert.strictEqual(magicValue, 42);
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("keyboard should allow typing text", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.evaluate(() => {
          document.body.innerHTML = '<input id="input" />';
          document.getElementById("input")?.focus();
        });

        yield* page.keyboard.type("Hello Effect");

        const value = yield* page.evaluate(() => document.querySelector("input")?.value);
        assert.strictEqual(value, "Hello Effect");
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("mouse should allow dispatching events", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.evaluate(() => {
          document.body.innerHTML = '<div id="target" style="width: 100px; height: 100px; background: red;"></div>';
          document.getElementById("target")?.addEventListener("click", () => {
            Reflect.set(window, "clicked", true);
          });
        });

        yield* page.mouse.click(50, 50);

        const clicked = yield* page.evaluate(() => Reflect.get(window, "clicked"));
        assert.strictEqual(clicked, true);
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("touchscreen should allow dispatching events", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const context = yield* browser.newContext({ hasTouch: true });
        const page = yield* context.newPage;

        yield* page.evaluate(() => {
          document.body.innerHTML = '<div id="target" style="width: 100px; height: 100px; background: red;"></div>';
          document.getElementById("target")?.addEventListener("touchstart", (e) => {
            const touch = e.touches.item(0);
            Reflect.set(window, "clicked", true);
            Reflect.set(window, "clickCoords", { x: touch?.clientX, y: touch?.clientY });
          });
        });

        yield* page.touchscreen.tap(50, 50);

        const clicked = yield* page.evaluate(() => Reflect.get(window, "clicked"));
        assert.strictEqual(clicked, true);

        const coords = yield* page.evaluate(() => Reflect.get(window, "clickCoords"));
        assert.deepStrictEqual(coords, { x: 50, y: 50 });
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("screenshot should capture an image", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.goto("data:text/html,<h1>Screenshot Test</h1>");
        const buffer = yield* page.screenshot({ type: "png" });

        assert(Buffer.isBuffer(buffer));
        assert(buffer.length > 0);
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("pdf should capture a PDF", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.goto("data:text/html,<h1>PDF Test</h1>");
        const buffer = yield* page.pdf();

        assert(Buffer.isBuffer(buffer));
        assert(buffer.length > 0);
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("addScriptTag should add a script tag to the page", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.goto("about:blank");

        yield* page.addScriptTag({ content: "window.magicValue = 42;" });

        const magicValue = yield* page.evaluate(() => Reflect.get(window, "magicValue"));
        assert.strictEqual(magicValue, 42);
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("addStyleTag should add a style tag to the page", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.goto("about:blank");

        yield* page.evaluate(() => {
          document.body.innerHTML = '<div id="test-div">Hello</div>';
        });

        yield* page.addStyleTag({
          content: "#test-div { color: rgb(255, 0, 0); }",
        });

        const color = yield* page.evaluate(() => {
          const el = document.getElementById("test-div");
          return el === null ? null : window.getComputedStyle(el).color;
        });
        assert.strictEqual(color, "rgb(255, 0, 0)");
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("bringToFront should bring the page to the front", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const context = yield* browser.newContext();
        const page1 = yield* context.newPage;
        const page2 = yield* context.newPage;

        yield* page1.bringToFront;
        yield* page2.bringToFront;

        assert.ok(true);
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("consoleMessages should return console messages", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.goto("about:blank");

        yield* page.evaluate(logInBrowserConsole);

        const messages = yield* page.consoleMessages();

        assert.deepStrictEqual(
          A.map(messages, (message) => message.text()),
          ["Hello from page", "Warning from page"]
        );
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("pageerror event should work", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.goto("about:blank");

        const errorFiber = yield* page.eventStream("pageerror").pipe(Stream.runHead, Effect.forkChild);

        yield* page.evaluate(throwInBrowserTask);

        const errorOpt = yield* Fiber.join(errorFiber);
        const error = O.getOrThrow(errorOpt);
        assert.strictEqual(error.message, "Test Error");
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("pageErrors should return all page errors", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.goto("about:blank");

        const errorFiber = yield* page.eventStream("pageerror").pipe(Stream.runHead, Effect.forkChild);

        yield* page.evaluate(throwInBrowserTask);

        yield* Fiber.join(errorFiber);

        const pageErrors = yield* page.pageErrors();
        assert.ok(pageErrors.length >= 1);
        assert.deepStrictEqual(
          O.map(A.head(pageErrors), (error) => error.message),
          O.some("Test Error")
        );
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("context should return the associated browser context", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const context = yield* browser.newContext();
        const page = yield* context.newPage;

        const pageContext = page.context();

        const pages = pageContext.pages();
        assert.strictEqual(pages.length, 1);
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("dragAndDrop should drag and drop an element", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.evaluate(() => {
          document.body.innerHTML = `
          <div id="source" style="width: 50px; height: 50px; background: red;" draggable="true"></div>
          <div id="target" style="width: 100px; height: 100px; background: blue; position: absolute; top: 200px; left: 200px;"></div>
        `;

          const target = document.getElementById("target");
          target?.addEventListener("drop", (e) => {
            e.preventDefault();
            Reflect.set(window, "magicValue", 42);
          });
          target?.addEventListener("dragover", (e) => {
            e.preventDefault();
          });
        });

        yield* page.dragAndDrop("#source", "#target");

        const magicValue = yield* page.evaluate(() => Reflect.get(window, "magicValue"));
        assert.strictEqual(magicValue, 42);
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("emulateMedia should emulate media features", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.goto("about:blank");

        yield* page.emulateMedia({ colorScheme: "dark" });

        let isDark = yield* page.evaluate(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
        assert.strictEqual(isDark, true);

        yield* page.emulateMedia({ colorScheme: "light" });

        isDark = yield* page.evaluate(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
        assert.strictEqual(isDark, false);
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("exposeFunction should expose an function that runs an effect", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        const ref = yield* Ref.make(0);

        yield* page.exposeFunction("myCustomEffect", () => Ref.updateAndGet(ref, (n) => n + 1));

        const result = yield* page.evaluate("window.myCustomEffect()");

        const counted = yield* Ref.get(ref);
        assert.strictEqual(counted, 1, "Ref value is 1");
        assert.strictEqual(result, 1, "Return value is 1");
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("exposeFunction should work with Effect.fn", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        const ref = yield* Ref.make(0);

        yield* page.exposeFunction(
          "myCustomEffectFn",
          Effect.fn(function* (num: number) {
            return yield* Ref.updateAndGet(ref, (n) => n + num);
          })
        );

        const result = yield* page.evaluate("window.myCustomEffectFn(15)");

        const counted = yield* Ref.get(ref);
        assert.strictEqual(counted, 15, "Ref value is 15");
        assert.strictEqual(result, 15, "Return value is 15");
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("exposeEffect should expose an effect", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        const ref = yield* Ref.make(0);

        yield* page.exposeEffect(
          "myCustomEffect",
          Ref.updateAndGet(ref, (n) => n + 1)
        );

        const result = yield* page.evaluate("window.myCustomEffect()");

        const counted = yield* Ref.get(ref);
        assert.strictEqual(counted, 1, "Ref value is 1");
        assert.strictEqual(result, 1, "Return value is 1");
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("frame should return an Option of Frame", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.use((p) => p.setContent('<iframe name="test-frame" id="test-frame"></iframe>'));

        const frameOpt = page.frame("test-frame");
        assert(O.isSome(frameOpt), "Frame should be Some");

        const frameOptByName = page.frame({ name: "test-frame" });
        assert(O.isSome(frameOptByName), "Frame should be Some");

        const nonExistentFrame = page.frame("foo");
        assert(O.isNone(nonExistentFrame), "Frame should be None");
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("isClosed should return the closed state of the page", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        assert.strictEqual(page.isClosed(), false);

        yield* page.close;

        assert.strictEqual(page.isClosed(), true);
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("mainFrame should return the main frame", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        const mainFrame = page.mainFrame();
        assert.ok(mainFrame);

        const url = mainFrame.url();
        assert.strictEqual(url, "about:blank");
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("opener should return the opener page", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.goto("about:blank");

        const popupFiber = yield* page.eventStream("popup").pipe(Stream.runHead, Effect.forkChild);

        yield* page.evaluate(() => {
          window.open("about:blank");
        });

        const popupOpt = yield* Fiber.join(popupFiber);
        const popup = O.getOrThrow(popupOpt);

        const openerOpt = yield* popup.opener;
        assert(O.isSome(openerOpt), "Opener should be Some");

        const opener = O.getOrThrow(openerOpt);
        const url = opener.url();
        assert.strictEqual(url, "about:blank");
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("setViewportSize should update viewport dimensions", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.setViewportSize({ width: 600, height: 400 });
        const size = yield* page.evaluate(() => ({
          width: window.innerWidth,
          height: window.innerHeight,
        }));

        assert.strictEqual(size.width, 600);
        assert.strictEqual(size.height, 400);
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("viewportSize should return the current viewport size", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.setViewportSize({ width: 600, height: 400 });
        assert.deepStrictEqual(page.viewportSize(), O.some({ width: 600, height: 400 }));
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("setExtraHTTPHeaders should not crash", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.setExtraHTTPHeaders({ "x-custom-header": "test-value" });
        assert.ok(true);
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("setDefaultNavigationTimeout should not crash", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        page.setDefaultNavigationTimeout(1000);
        assert.ok(true);
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("setDefaultTimeout should surface timeout errors", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        page.setDefaultTimeout(1);

        const result = yield* page.locator("#non-existent").click().pipe(Effect.flip);

        assert.strictEqual(result._tag, "PlaywrightError");
        assert.strictEqual(result.reason, "Timeout");
        assert.instanceOf(result.cause, errors.TimeoutError);
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("workers should return the list of workers", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        const workerFiber = yield* page.eventStream("worker").pipe(Stream.runHead, Effect.forkChild);

        yield* page.goto(
          "data:text/html,<script>new Worker(URL.createObjectURL(new Blob(['console.log(\"worker\")'], {type: 'application/javascript'})));</script>"
        );

        yield* Fiber.join(workerFiber);

        const workers = page.workers();
        assert(workers.length >= 1);
        assert.deepStrictEqual(
          O.map(A.head(workers), (worker) => typeof worker.url()),
          O.some("string")
        );
      }).pipe(PlaywrightSpawner.withBrowser)
    );

    it.effect("web storage should round-trip items on a page origin", () =>
      Effect.gen(function* () {
        const browser = yield* Browser;
        const page = yield* browser.newPage();

        yield* page.use((playwrightPage) =>
          playwrightPage.route("http://storage.test/", (route) =>
            route.fulfill({ body: "<!doctype html><title>Storage</title>" })
          )
        );
        yield* page.goto("http://storage.test/");

        for (const storage of [page.localStorage, page.sessionStorage]) {
          yield* storage.clear;

          yield* storage.setItem("first", "one");
          yield* storage.setItem("second", "two");

          const first = yield* storage.getItem("first");
          assert.deepStrictEqual(first, O.some("one"));

          const items = yield* storage.items;
          assert.deepStrictEqual(items, [
            { name: "first", value: "one" },
            { name: "second", value: "two" },
          ]);

          yield* storage.removeItem("first");
          const removed = yield* storage.getItem("first");
          assert.isTrue(O.isNone(removed));

          yield* storage.clear;
          const afterClear = yield* storage.items;
          assert.deepStrictEqual(afterClear, []);
        }
      }).pipe(PlaywrightSpawner.withBrowser)
    );
  });
});
