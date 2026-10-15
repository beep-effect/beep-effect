/**
 * The practice knowledge-graph provider, loaded lazily: its toolkit, PGlite
 * and DuckDB resources are imported only when the saved profile selects the
 * knowledge graph, so a missing or broken native sidecar disables only this
 * provider.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PracticeGatewayId } from "@beep/identity/packages";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { GatewaySettings } from "./GatewaySettings.ts";
import { ProviderUnavailable } from "./PracticeGateway.errors.ts";
import { ProfileStore } from "./ProfileStore.ts";
import { profileSelects } from "./Requirements.ts";
import { PRACTICE_GATEWAY_VERSION } from "./Version.ts";
import type { PracticeKgToolkitLayer } from "@beep/law-practice-server";
import type {
  loadPracticeKgBundleContext,
  makePracticeKgHostResourcesLayer,
  runPracticeKgSelfCheck,
} from "@beep/law-practice-server/PracticeKgHost";

const $I = $PracticeGatewayId.create("PracticeKgProvider");

const PRACTICE_KG_UNAVAILABLE = "The practice knowledge-graph engine could not be loaded on this computer.";

/**
 * The practice knowledge-graph host and toolkit exports the gateway uses,
 * as {@link PracticeKgModuleLoader} returns them.
 *
 * @category models
 * @since 0.0.0
 */
export interface PracticeKgModules {
  /**
   * Read a bundle folder into the host's bundle context.
   */
  readonly loadPracticeKgBundleContext: typeof loadPracticeKgBundleContext;
  /**
   * Build the host resources (PGlite, DuckDB) over a bundle context.
   */
  readonly makePracticeKgHostResourcesLayer: typeof makePracticeKgHostResourcesLayer;
  /**
   * The knowledge-graph MCP toolkit.
   */
  readonly PracticeKgToolkitLayer: typeof PracticeKgToolkitLayer;
  /**
   * Check a bundle against this extension version before mounting it.
   */
  readonly runPracticeKgSelfCheck: typeof runPracticeKgSelfCheck;
}

/**
 * Operations of {@link PracticeKgModuleLoader}.
 *
 * @category models
 * @since 0.0.0
 */
export interface PracticeKgModuleLoaderShape {
  /**
   * Load the knowledge-graph modules, or fail with a {@link ProviderUnavailable}
   * for `practice-kg` when they cannot be loaded.
   */
  readonly load: Effect.Effect<PracticeKgModules, ProviderUnavailable>;
}

// The modules pull in the DuckDB native binding and PGlite at evaluation time,
// so they are imported dynamically, never from the gateway's static graph.
const importPracticeKgModules = (): Promise<PracticeKgModules> =>
  Promise.all([import("@beep/law-practice-server/PracticeKgHost"), import("@beep/law-practice-server")]).then(
    ([host, server]) => ({
      loadPracticeKgBundleContext: host.loadPracticeKgBundleContext,
      makePracticeKgHostResourcesLayer: host.makePracticeKgHostResourcesLayer,
      runPracticeKgSelfCheck: host.runPracticeKgSelfCheck,
      PracticeKgToolkitLayer: server.PracticeKgToolkitLayer,
    })
  );

/**
 * Loads the practice knowledge-graph host and toolkit modules on demand.
 *
 * **Details**
 *
 * The modules pull in the DuckDB native binding and PGlite at evaluation
 * time, so the live loader imports them dynamically: the gateway starts, and
 * the setup tools answer, on a machine where the DuckDB sidecar is missing. A
 * failed import is a {@link ProviderUnavailable} for `practice-kg`. The
 * runtime caches a successful import, so repeated loads are cheap.
 *
 * **Example** (A loader whose import fails, as without the native sidecar)
 *
 * ```ts
 * import { PracticeKgModuleLoader } from "@beep/practice-gateway/PracticeKgProvider"
 * import * as Effect from "effect/Effect"
 *
 * const loader = PracticeKgModuleLoader.fromImport(() => Promise.reject(new Error("Cannot find module")))
 * const program = loader.load.pipe(
 *   Effect.map(() => "loaded"),
 *   Effect.catchTag("ProviderUnavailable", (error) => Effect.succeed(error.message))
 * )
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PracticeKgModuleLoader extends Context.Service<PracticeKgModuleLoader, PracticeKgModuleLoaderShape>()(
  $I`PracticeKgModuleLoader`
) {
  /**
   * A loader over `importModules`, with a rejected import mapped to a
   * {@link ProviderUnavailable} for `practice-kg`.
   *
   * **Example** (A loader over a stand-in import)
   *
   * ```ts
   * import { PracticeKgModuleLoader } from "@beep/practice-gateway/PracticeKgProvider"
   * import * as Effect from "effect/Effect"
   *
   * const loader = PracticeKgModuleLoader.fromImport(() => Promise.reject(new Error("Cannot find module")))
   * console.log(Effect.isEffect(loader.load))
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromImport = (importModules: () => Promise<PracticeKgModules>): PracticeKgModuleLoaderShape =>
    PracticeKgModuleLoader.of({
      load: Effect.tryPromise({
        try: importModules,
        catch: (cause) =>
          ProviderUnavailable.make({ provider: "practice-kg", cause, message: PRACTICE_KG_UNAVAILABLE }),
      }),
    });

  /**
   * The live loader: dynamic imports of `@beep/law-practice-server`.
   *
   * **Example** (Compose the live loader)
   *
   * ```ts
   * import { PracticeKgModuleLoader } from "@beep/practice-gateway/PracticeKgProvider"
   * import * as Layer from "effect/Layer"
   *
   * console.log(Layer.isLayer(PracticeKgModuleLoader.layer))
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = Layer.succeed(
    PracticeKgModuleLoader,
    PracticeKgModuleLoader.fromImport(importPracticeKgModules)
  );
}

/**
 * The practice knowledge-graph toolkit, mounted in process when the saved
 * profile selects `practice-kg` and the extension settings name a bundle
 * that passes its self-check.
 *
 * **Details**
 *
 * Anything short of that mounts nothing and logs why: the setup tools must
 * stay reachable so `setup_status` can explain the problem. The provider's
 * modules are imported only after the profile selects it (see
 * {@link PracticeKgModuleLoader}). The profile is read once at startup, so a
 * newly saved profile takes effect after Claude restarts the gateway.
 *
 * **Example** (Compose the provider)
 *
 * ```ts
 * import { PracticeKgProviderLayer } from "@beep/practice-gateway/PracticeKgProvider"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(PracticeKgProviderLayer))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PracticeKgProviderLayer = Layer.unwrap(
  Effect.gen(function* () {
    const settings = yield* GatewaySettings;
    const store = yield* ProfileStore;
    const profile = yield* store.get;
    const selected = O.exists(profile, profileSelects("practice-kg"));
    if (!selected || O.isNone(settings.bundleDir)) {
      return Layer.empty;
    }
    const bundleDir = settings.bundleDir.value;
    const corpusRoot = O.getOrUndefined(settings.corpusRoot);
    const modules = yield* PracticeKgModuleLoader.use((loader) => loader.load);
    yield* modules.runPracticeKgSelfCheck({ extensionVersion: PRACTICE_GATEWAY_VERSION, bundleDir, corpusRoot });
    const context = yield* modules.loadPracticeKgBundleContext(bundleDir, corpusRoot);
    return modules.PracticeKgToolkitLayer.pipe(Layer.provide(modules.makePracticeKgHostResourcesLayer(context)));
  })
).pipe(
  Layer.catchCause((cause) =>
    Layer.effectDiscard(Effect.logWarning("The practice knowledge-graph tools were not mounted.", Cause.pretty(cause)))
  )
);
