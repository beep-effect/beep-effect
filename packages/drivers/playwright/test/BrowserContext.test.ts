import { Browser } from "@beep/playwright/Browser";
import { PlaywrightSpawner } from "@beep/playwright/PlaywrightSpawner";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import { chromium, chromiumInstalled, launchOptions } from "./support/Chromium.ts";

const cookieScope = "https://example.com";

describe.skipIf(!chromiumInstalled)("BrowserContext", () => {
  layer(Layer.merge(PlaywrightSpawner.layer(chromium, launchOptions), NodeServices.layer), { timeout: "60 seconds" })(
    (it) => {
      it.effect("should wrap context methods", () =>
        Effect.gen(function* () {
          const browser = yield* Browser;
          const context = yield* browser.newContext();

          assert.isTrue(O.isSome(context.browser()));

          yield* context.addCookies([{ name: "test-cookie", value: "test-value", url: cookieScope }]);
          const cookies = yield* context.cookies([cookieScope]);
          assert.deepStrictEqual(
            A.map(cookies, (cookie) => cookie.name),
            ["test-cookie"]
          );

          const state = yield* context.storageState();
          assert.isTrue(
            A.some(state.cookies, (cookie) => cookie.name === "test-cookie" && cookie.value === "test-value")
          );

          yield* context.clearCookies();
          const cookiesAfterClear = yield* context.cookies([cookieScope]);
          assert.strictEqual(cookiesAfterClear.length, 0);

          yield* context.setStorageState(state);
          const cookiesAfterRestore = yield* context.cookies([cookieScope]);
          assert.deepStrictEqual(
            A.map(cookiesAfterRestore, (cookie) => cookie.name),
            ["test-cookie"]
          );

          yield* context.clearCookies();

          yield* context.grantPermissions(["notifications"]);
          yield* context.clearPermissions;

          context.setDefaultNavigationTimeout(30000);
          context.setDefaultTimeout(30000);
          yield* context.setExtraHTTPHeaders({ "X-Test": "test" });
          yield* context.setGeolocation({ latitude: 52, longitude: 13 });
          yield* context.setOffline(false);
        }).pipe(PlaywrightSpawner.withBrowser)
      );

      it.effect("addInitScript should execute script in all new pages", () =>
        Effect.gen(function* () {
          const browser = yield* Browser;
          const context = yield* browser.newContext();

          yield* context.addInitScript(
            (double: (value: number) => Promise<number>) =>
              double(42).then((value) => Reflect.set(globalThis, "magicValue", value)),
            (value: number) => Promise.resolve(value * 2),
            { exposeFunctions: true }
          );

          const page1 = yield* context.newPage;
          yield* page1.goto("about:blank");
          const magicValue1 = yield* page1.evaluate(() => Reflect.get(globalThis, "magicValue"));
          assert.strictEqual(magicValue1, 84);

          const page2 = yield* context.newPage;
          yield* page2.goto("about:blank");
          const magicValue2 = yield* page2.evaluate(() => Reflect.get(globalThis, "magicValue"));
          assert.strictEqual(magicValue2, 84);
        }).pipe(PlaywrightSpawner.withBrowser)
      );

      it.effect("isClosed should return the closed state of the browser context", () =>
        Effect.gen(function* () {
          const browser = yield* Browser;
          const context = yield* browser.newContext();

          assert.isFalse(context.isClosed());

          yield* context.close;

          assert.isTrue(context.isClosed());
        }).pipe(PlaywrightSpawner.withBrowser)
      );

      it.effect("credentials should create, get, and delete credentials", () =>
        Effect.gen(function* () {
          const browser = yield* Browser;
          const context = yield* browser.newContext();

          yield* context.credentials.install;

          const created = yield* context.credentials.create("example.test");
          assert.strictEqual(created.rpId, "example.test");

          const credentials = yield* context.credentials.get({ id: created.id });
          assert.deepStrictEqual(credentials, [created]);

          yield* context.credentials.delete(created.id);

          const afterDelete = yield* context.credentials.get({ id: created.id });
          assert.strictEqual(afterDelete.length, 0);
        }).pipe(PlaywrightSpawner.withBrowser)
      );

      it.effect("tracing.startScoped saves the trace when the scope fails", () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const browser = yield* Browser;
          const context = yield* browser.newContext();
          const dir = yield* fs.makeTempDirectoryScoped({ prefix: "effect-playwright-trace-" });
          const tracePath = path.join(dir, "trace.zip");

          const exit = yield* Effect.gen(function* () {
            yield* context.tracing.startScoped({ snapshots: true }, { path: tracePath });
            const page = yield* context.newPage;
            yield* page.setContent("<h1>traced</h1>");
            return yield* Effect.fail("workflow failed");
          }).pipe(Effect.scoped, Effect.exit);

          assert.isTrue(Exit.isFailure(exit));
          const trace = yield* fs.stat(tracePath);
          assert.isTrue(trace.size > 0n);

          yield* context.tracing.start();
          yield* context.tracing.stop();
        }).pipe(PlaywrightSpawner.withBrowser)
      );

      it.effect("tracing.startChunkScoped saves the chunk when the scope closes", () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const browser = yield* Browser;
          const context = yield* browser.newContext();
          const dir = yield* fs.makeTempDirectoryScoped({ prefix: "effect-playwright-trace-" });
          const chunkPath = path.join(dir, "chunk.zip");

          yield* context.tracing.start();
          yield* Effect.gen(function* () {
            yield* context.tracing.startChunkScoped(undefined, { path: chunkPath });
            const page = yield* context.newPage;
            yield* page.setContent("<h1>chunk</h1>");
          }).pipe(Effect.scoped);

          const chunk = yield* fs.stat(chunkPath);
          assert.isTrue(chunk.size > 0n);
          yield* context.tracing.stop();
        }).pipe(PlaywrightSpawner.withBrowser)
      );
    }
  );
});
