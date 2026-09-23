import {
  isEffortAllowedOnSurface,
  ModelsCatalogError,
  ModelsCommandError,
  ModelsLedgerError,
  ModelsLocatorError,
  ModelsManifestError,
  ModelsManifestStore,
  ModelsManifestStoreLive,
} from "@beep/repo-cli/commands/Models";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it, layer } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";

// Every `beep models` error carries a `mapError` that wraps the upstream cause
// with a message and an optional origin; the command-boundary error folds the
// internal ones into itself. These are pure, so they are exercised directly.
describe("models errors", () => {
  it.effect("catalog mapError records the source when one is given", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        Effect.fail("upstream unreachable").pipe(ModelsCatalogError.mapError("Failed to fetch catalog", "vendor"))
      );
      expect(error._tag).toBe("ModelsCatalogError");
      expect(error.message).toContain("Failed to fetch catalog");
      expect(error.source).toBe("vendor");
    })
  );

  it.effect("catalog mapError omits the source when none is given", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        Effect.fail("upstream unreachable").pipe(ModelsCatalogError.mapError("Failed to fetch catalog"))
      );
      expect(error.source).toBeUndefined();
    })
  );

  it.effect("manifest, locator, and ledger mapError record the path", () =>
    Effect.gen(function* () {
      const manifest = yield* Effect.flip(
        Effect.fail("ENOENT").pipe(ModelsManifestError.mapError("Failed to read manifest", "models.yaml"))
      );
      const locator = yield* Effect.flip(
        Effect.fail("bad toml").pipe(ModelsLocatorError.mapError("Failed to parse target", "config.toml"))
      );
      const ledger = yield* Effect.flip(
        Effect.fail("EACCES").pipe(ModelsLedgerError.mapError("Failed to write snapshot", "ledger/2026.json"))
      );
      expect(manifest).toMatchObject({ _tag: "ModelsManifestError", path: "models.yaml" });
      expect(locator).toMatchObject({ _tag: "ModelsLocatorError", path: "config.toml" });
      expect(ledger).toMatchObject({ _tag: "ModelsLedgerError", path: "ledger/2026.json" });
      expect(ledger.message).toContain("Failed to write snapshot");
    })
  );

  it.effect("command error folds an internal error and wraps a raw cause", () =>
    Effect.gen(function* () {
      const internal = ModelsCatalogError.make({ message: "catalog broke" });
      const folded = ModelsCommandError.fromInternal(internal);
      expect(folded).toMatchObject({
        _tag: "ModelsCommandError",
        message: "catalog broke",
        detail: "ModelsCatalogError",
      });
      expect(folded.cause).toBe(internal);

      const wrapped = yield* Effect.flip(
        Effect.fail("exit 1").pipe(ModelsCommandError.mapError("models check failed"))
      );
      expect(wrapped._tag).toBe("ModelsCommandError");
      expect(wrapped.message).toContain("models check failed");
      expect(wrapped.detail).toBeUndefined();
    })
  );
});

describe("surface effort domain", () => {
  it("answers in both data-first and data-last form", () => {
    expect(isEffortAllowedOnSurface("codex-cli", "xhigh")).toBe(true);
    expect(isEffortAllowedOnSurface("ultra")("proxy-workflow")).toBe(false);
    expect(isEffortAllowedOnSurface("cursor-seat", "low")).toBe(false);
    expect(isEffortAllowedOnSurface("minimal")("proxy-workflow")).toBe(true);
  });
});

const storeLayer = Layer.provide(ModelsManifestStoreLive, NodeServices.layer);

layer(Layer.mergeAll(storeLayer, NodeServices.layer))("models manifest store failures", (it) => {
  it.effect("reports a YAML parse failure with the manifest path", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const store = yield* ModelsManifestStore;
      const home = yield* fs.makeTempDirectoryScoped({ prefix: "models-manifest-" });
      const file = path.join(home, "models.yaml");
      // An alias to an anchor that was never set is the one shape `yaml` parses
      // but refuses to materialise, so `toJS` throws inside the store.
      yield* fs.writeFileString(file, "version: beep-models/v1\nbindings: *missing\n");

      const error = yield* Effect.flip(store.load(file));
      expect(error._tag).toBe("ModelsManifestError");
      expect(error.path).toBe(file);
      expect(error.message).toContain("Failed to parse YAML");
    }).pipe(Effect.scoped)
  );

  it.effect("reports a missing manifest as a read failure", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const store = yield* ModelsManifestStore;
      const home = yield* fs.makeTempDirectoryScoped({ prefix: "models-manifest-" });
      const file = path.join(home, "absent.yaml");

      const error = yield* Effect.flip(store.load(file));
      expect(error._tag).toBe("ModelsManifestError");
      expect(error.message).toContain("Failed to read the models manifest");
    }).pipe(Effect.scoped)
  );
});
