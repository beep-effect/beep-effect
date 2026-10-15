/**
 * Opens a web page in the lawyer's default browser.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PracticeGatewayId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { GatewaySettings } from "./GatewaySettings.ts";
import { BrowserOpenFailure } from "./PracticeGateway.errors.ts";

const $I = $PracticeGatewayId.create("SystemBrowser");

/**
 * Operations of {@link SystemBrowser}.
 *
 * @category models
 * @since 0.0.0
 */
export interface SystemBrowserShape {
  /**
   * Open `url` in the default browser; succeeds once the browser was asked.
   */
  readonly open: (url: string) => Effect.Effect<void, BrowserOpenFailure>;
}

/**
 * The lawyer's default web browser.
 *
 * **Example** (A browser that only records what it was asked to open)
 *
 * ```ts
 * import { SystemBrowser } from "@beep/practice-gateway/SystemBrowser"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const opened: Array<string> = []
 * const layer = Layer.succeed(SystemBrowser, SystemBrowser.of({ open: (url) => Effect.sync(() => { opened.push(url) }) }))
 * console.log(Layer.isLayer(layer))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class SystemBrowser extends Context.Service<SystemBrowser, SystemBrowserShape>()($I`SystemBrowser`) {
  /**
   * The platform's default browser: `rundll32 url.dll,FileProtocolHandler`
   * on Windows (no shell, so `&` in the URL needs no quoting), `xdg-open`
   * elsewhere.
   *
   * **Example** (Compose the live browser)
   *
   * ```ts
   * import { SystemBrowser } from "@beep/practice-gateway/SystemBrowser"
   * import * as Layer from "effect/Layer"
   *
   * console.log(Layer.isLayer(SystemBrowser.layer))
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = Layer.effect(
    SystemBrowser,
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const { isWindows } = yield* GatewaySettings;
      const command = (url: string) =>
        isWindows
          ? ChildProcess.make("rundll32.exe", ["url.dll,FileProtocolHandler", url], {
              stdin: "ignore",
              stdout: "ignore",
              stderr: "ignore",
            })
          : ChildProcess.make("xdg-open", [url], { stdin: "ignore", stdout: "ignore", stderr: "ignore" });
      const open = Effect.fn("SystemBrowser.open")(
        function* (url: string) {
          const child = yield* spawner.spawn(command(url));
          yield* child.exitCode;
        },
        Effect.scoped,
        Effect.mapError((cause) =>
          BrowserOpenFailure.make({ cause, message: "The web browser could not be opened on this computer." })
        )
      );
      return SystemBrowser.of({ open });
    })
  );
}
