import { makeBrowser } from "@beep/playwright/Browser";
import { makeBrowserContext } from "@beep/playwright/BrowserContext";
import { makeClock } from "@beep/playwright/Clock";
import {
  makeDialog,
  makeDownload,
  makeFileChooser,
  makeRequest,
  makeResponse,
  makeWorker,
} from "@beep/playwright/Common";
import { makeCredentials } from "@beep/playwright/Credentials";
import { makeFrame } from "@beep/playwright/Frame";
import { makeFrameLocator } from "@beep/playwright/FrameLocator";
import { makeKeyboard } from "@beep/playwright/Keyboard";
import { makeLocator } from "@beep/playwright/Locator";
import { makeMouse } from "@beep/playwright/Mouse";
import { makePage } from "@beep/playwright/Page";
import { Playwright } from "@beep/playwright/Playwright";
import { makeScreencast } from "@beep/playwright/Screencast";
import { makeTouchscreen } from "@beep/playwright/Touchscreen";
import { makeTracing } from "@beep/playwright/Tracing";
import { makeWebStorage } from "@beep/playwright/WebStorage";
import { assert, describe, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { chromium, chromiumInstalled, launchOptions } from "./support/Chromium.ts";
import type { BrowserShape, LaunchOptions, NewContextOptions, NewPageOptions } from "@beep/playwright/Browser";
import type { BrowserContextShape } from "@beep/playwright/BrowserContext";
import type { ClockShape } from "@beep/playwright/Clock";
import type { CredentialsShape } from "@beep/playwright/Credentials";
import type { FrameShape } from "@beep/playwright/Frame";
import type { FrameLocatorShape } from "@beep/playwright/FrameLocator";
import type { KeyboardShape } from "@beep/playwright/Keyboard";
import type { LocatorShape } from "@beep/playwright/Locator";
import type { MouseShape } from "@beep/playwright/Mouse";
import type { PageShape } from "@beep/playwright/Page";
import type { PlaywrightShape } from "@beep/playwright/Playwright";
import type { PlaywrightError } from "@beep/playwright/PlaywrightError";
import type { ScreencastShape } from "@beep/playwright/Screencast";
import type { TouchscreenShape } from "@beep/playwright/Touchscreen";
import type { TracingShape } from "@beep/playwright/Tracing";
import type { WebStorageShape } from "@beep/playwright/WebStorage";

describe.skipIf(!chromiumInstalled)("Playwright", () => {
  layer(Playwright.layer, { timeout: "60 seconds" })((it) => {
    it.effect("should launch a browser", () =>
      Effect.gen(function* () {
        const program = Effect.gen(function* () {
          const playwright: PlaywrightShape = yield* Playwright;
          const options: LaunchOptions = launchOptions;
          const browser: BrowserShape = yield* playwright.launchScoped(chromium, options);

          const contextOptions: NewContextOptions = {};
          const context: BrowserContextShape = yield* browser.newContext(contextOptions);

          const pageOptions: NewPageOptions = {};
          const page: PageShape = yield* browser.newPage(pageOptions);
          const clock: ClockShape = page.clock;
          const credentials: CredentialsShape = context.credentials;
          const frame: FrameShape = page.mainFrame();
          const keyboard: KeyboardShape = page.keyboard;
          const locator: LocatorShape = page.locator("body");
          const frameLocator: FrameLocatorShape = locator.frameLocator("iframe");
          const mouse: MouseShape = page.mouse;
          const screencast: ScreencastShape = page.screencast;
          const touchscreen: TouchscreenShape = page.touchscreen;
          const tracing: TracingShape = context.tracing;
          const storage: WebStorageShape = page.localStorage;

          yield* page.setContent("testing");

          for (const service of [
            clock,
            credentials,
            frame,
            frameLocator,
            keyboard,
            locator,
            mouse,
            screencast,
            storage,
            touchscreen,
            tracing,
          ]) {
            assert.isDefined(service);
          }

          for (const constructor of [
            makeBrowser,
            makeBrowserContext,
            makeClock,
            makeCredentials,
            makeDialog,
            makeDownload,
            makeFileChooser,
            makeFrame,
            makeFrameLocator,
            makeKeyboard,
            makeLocator,
            makeMouse,
            makeRequest,
            makeResponse,
            makePage,
            makeScreencast,
            makeTouchscreen,
            makeTracing,
            makeWorker,
            makeWebStorage,
          ]) {
            assert.strictEqual(typeof constructor, "function");
          }
        }).pipe(Effect.scoped);
        const result = yield* Effect.exit(program);

        assert.isTrue(Exit.isSuccess(result), "Expected success");
      })
    );

    it.effect("should launch and run some commands", () =>
      Effect.gen(function* () {
        const program = Effect.gen(function* () {
          const playwright = yield* Playwright;
          const browser = yield* playwright.launchScoped(chromium, launchOptions);

          const page = yield* browser.newPage({ baseURL: "about:blank" });

          const addition = yield* page.evaluate(() => 1 + 1);

          assert.strictEqual(addition, 2, "Expected addition to be 2");
        });
        const result = yield* Effect.exit(program);

        assert.isTrue(Exit.isSuccess(result), "Expected success");
      })
    );

    it.effect("should launch a persistent context", () =>
      Effect.gen(function* () {
        const playwright = yield* Playwright;
        const context = yield* playwright.launchPersistentContext(chromium, "", launchOptions);
        const page = yield* context.newPage;

        yield* page.goto("data:text/html,<title>persistent-context</title>");
        const title = yield* page.title;

        assert.strictEqual(title, "persistent-context", "Expected title to match");
        yield* context.close;
      })
    );

    it.effect("should launch a persistent context and close with scope", () =>
      Effect.gen(function* () {
        const playwright = yield* Playwright;

        const capturedContext = yield* Effect.gen(function* () {
          const context = yield* playwright.launchPersistentContextScoped(chromium, "", launchOptions);

          const page = yield* context.newPage;
          const content = yield* page.evaluate(() => "scoped-persistent");
          assert.strictEqual(content, "scoped-persistent", "Expected content to match");
          return context;
        }).pipe(Effect.scoped);

        const error = yield* capturedContext.newPage.pipe(Effect.flip);
        assert.strictEqual(error._tag, "PlaywrightError", "Expected failure after scoped close");
      })
    );

    it.effect("should fail to launch a browser with invalid path", () =>
      Effect.gen(function* () {
        const playwright = yield* Playwright;
        const result: PlaywrightError = yield* playwright
          .launchScoped(chromium, { ...launchOptions, executablePath: "/invalid/path" })
          .pipe(Effect.flip);
        assert.strictEqual(result._tag, "PlaywrightError", "Expected failure with invalid path");
      })
    );

    it.effect("should fail with timeout 1", () =>
      Effect.gen(function* () {
        const playwright = yield* Playwright;
        const result = yield* playwright
          .launchScoped(chromium, { ...launchOptions, timeout: 1, executablePath: "/bin/cat" })
          .pipe(Effect.flip);
        assert.strictEqual(result._tag, "PlaywrightError", "Expected failure with timeout 1");
        assert.strictEqual(result.reason, "Timeout", "Expected reason to be timeout");
      })
    );

    it.effect("should connect via CDP to a loopback browser it launched and close only the CDP connection", () =>
      Effect.gen(function* () {
        const playwright = yield* Playwright;

        const directBrowser = yield* playwright.launchScoped(chromium, {
          ...launchOptions,
          args: ["--remote-debugging-port=9222", "--remote-debugging-address=127.0.0.1"],
        });

        const browser = yield* playwright.connectCDP("http://127.0.0.1:9222");

        yield* browser.close;

        assert.isTrue(directBrowser.isConnected(), "Expected direct browser to be still connected");

        const page = yield* directBrowser.newPage();
        const content = yield* page.evaluate(() => "eval works");
        assert.strictEqual(content, "eval works", "Expected content to be eval works");
      })
    );

    it.effect("should connect via CDP to a loopback browser it launched and close automatically with scope", () =>
      Effect.gen(function* () {
        const playwright = yield* Playwright;

        const directBrowser = yield* playwright.launchScoped(chromium, {
          ...launchOptions,
          args: ["--remote-debugging-port=9223", "--remote-debugging-address=127.0.0.1"],
        });

        yield* Effect.gen(function* () {
          const browser = yield* playwright.connectCDPScoped("http://127.0.0.1:9223");
          assert.isTrue(browser.isConnected(), "Expected connected true");
        }).pipe(Effect.scoped);

        assert.isTrue(directBrowser.isConnected(), "Expected browser to still be connected");

        const page = yield* directBrowser.newPage();
        const content = yield* page.evaluate(() => "eval after cdp closed");
        assert.strictEqual(content, "eval after cdp closed", "Expected content to be correct");
      })
    );
  });
});
