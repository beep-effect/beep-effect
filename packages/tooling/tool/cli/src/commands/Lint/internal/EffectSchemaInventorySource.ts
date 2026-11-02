/**
 * Service boundary for every input the schema inventory reads outside its own fixture: the
 * catalog pin and the pinned Effect sources.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { Str } from "@beep/utils";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Inspectable from "effect/Inspectable";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import { runGitRawOutput } from "../../../internal/repo-run/GitExec.ts";
import { EffectSchemaInventoryReferencePath } from "../EffectSchemaInventory.schemas.ts";
import {
  EffectSchemaInventoryCatalogPinError,
  EffectSchemaInventoryError,
  EffectSchemaInventoryPinAbsentError,
  EffectSchemaInventoryReferenceMissingError,
} from "../Lint.errors.ts";
import { parseEffectSchemaInventoryPin } from "./EffectSchemaInventoryModules.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GitCommandErrorAdapter } from "../../../internal/repo-run/GitExec.ts";
import type { EffectSchemaInventoryPin } from "../EffectSchemaInventory.schemas.ts";

const $I = $RepoCliId.create("commands/Lint/internal/EffectSchemaInventorySource");

/**
 * Operations over the inventory's external inputs.
 *
 * **Details**
 *
 * `readPin` never consults the reference HEAD; `readPinned` is the only source-byte path and
 * reads `git show <pin>:<file>`, never the working tree.
 *
 * **Example** (Describe a fake source)
 *
 * ```ts
 * import type { EffectSchemaInventorySourceShape } from "@beep/repo-cli/commands/Lint"
 *
 * const readPin = (source: EffectSchemaInventorySourceShape) => source.readPin
 * console.log(typeof readPin) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface EffectSchemaInventorySourceShape {
  /** `inventoryPin` from the root `package.json` catalog entry for `effect`. */
  readonly readPin: Effect.Effect<EffectSchemaInventoryPin, EffectSchemaInventoryCatalogPinError>;
  /** UTF-8 text of `<file>` at the pin. */
  readonly readPinned: (
    pin: EffectSchemaInventoryPin,
    file: string
  ) => Effect.Effect<string, EffectSchemaInventoryError>;
  /** Fail loud unless the reference clone exists and contains the pinned commit. */
  readonly verifyPin: (
    pin: EffectSchemaInventoryPin
  ) => Effect.Effect<void, EffectSchemaInventoryReferenceMissingError | EffectSchemaInventoryPinAbsentError>;
}

const renderCause = (cause: unknown): string =>
  P.isError(cause) ? cause.message : Inspectable.toStringUnknown(cause, 0);

const gitAdapter = <E>(onFailure: (commandLine: string, detail: string) => E): GitCommandErrorAdapter<E> => ({
  onSpawnFailure: (commandLine) => (cause) => onFailure(commandLine, renderCause(cause)),
  onNonZeroExit: ({ commandLine, exitCode, output }) => onFailure(commandLine, `exit ${exitCode}: ${Str.trim(output)}`),
  onTruncated: O.none(),
});

const makeEffectSchemaInventorySource = Effect.fn("EffectSchemaInventorySource.make")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const context = yield* Effect.context<SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner>();
  const reference = path.join(root, EffectSchemaInventoryReferencePath);
  const manifestPath = path.join(root, "package.json");

  const git = <E>(args: ReadonlyArray<string>, onFailure: (commandLine: string, detail: string) => E) =>
    runGitRawOutput(reference, args, gitAdapter(onFailure)).pipe(Effect.provide(context));

  const readPin: EffectSchemaInventorySourceShape["readPin"] = fs.readFileString(manifestPath).pipe(
    Effect.mapError((cause) =>
      EffectSchemaInventoryCatalogPinError.new("<unreadable>", `Unable to read ${manifestPath}: ${renderCause(cause)}.`)
    ),
    Effect.flatMap(parseEffectSchemaInventoryPin),
    Effect.withSpan("EffectSchemaInventorySource.readPin")
  );

  const verifyPin: EffectSchemaInventorySourceShape["verifyPin"] = Effect.fn("EffectSchemaInventorySource.verifyPin")(
    function* (pin) {
      const present = yield* fs.exists(reference).pipe(Effect.orElseSucceed(() => false));
      if (!present) {
        return yield* EffectSchemaInventoryReferenceMissingError.new(
          reference,
          `The Effect reference clone ${reference} is missing; run bun run beep refs provision. The inventory never regenerates from anything else.`
        );
      }
      yield* git(["rev-parse", "--git-dir"], (commandLine, detail) =>
        EffectSchemaInventoryReferenceMissingError.new(
          reference,
          `${reference} is not a git checkout (${commandLine}: ${detail}); run bun run beep refs provision.`
        )
      );
      yield* git(["cat-file", "-e", `${pin}^{commit}`], (commandLine, detail) =>
        EffectSchemaInventoryPinAbsentError.new(
          pin,
          reference,
          `inventoryPin ${pin} is not in ${reference} yet (${commandLine}: ${detail}); pull the reference past the pin and rerun.`
        )
      );
    }
  );

  const readPinned: EffectSchemaInventorySourceShape["readPinned"] = (pin, file) =>
    git(["show", `${pin}:${file}`], (commandLine, detail) =>
      EffectSchemaInventoryError.new(`Unable to read ${file} at ${pin} (${commandLine}: ${detail}).`)
    ).pipe(Effect.withSpan("EffectSchemaInventorySource.readPinned", { attributes: { file } }));

  return {
    readPin,
    verifyPin,
    readPinned,
  } satisfies EffectSchemaInventorySourceShape;
});

/**
 * Service owning the inventory's external inputs; tests provide a fake implementation or call `make(root)`.
 *
 * **Example** (Read the pin through the service)
 *
 * ```ts
 * import { EffectSchemaInventorySource } from "@beep/repo-cli/commands/Lint"
 * import * as Effect from "effect/Effect";
 * const program = EffectSchemaInventorySource.use((source) => source.readPin)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class EffectSchemaInventorySource extends Context.Service<
  EffectSchemaInventorySource,
  EffectSchemaInventorySourceShape
>()($I`EffectSchemaInventorySource`, { make: makeEffectSchemaInventorySource }) {
  /**
   * Live source for a repository root: `<root>/package.json` and `<root>/.repos/effect`.
   *
   * @param root - Absolute repository root.
   * @returns A layer reading the catalog and git objects for that root.
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = (
    root: string
  ): Layer.Layer<
    EffectSchemaInventorySource,
    never,
    SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  > => Layer.effect(EffectSchemaInventorySource, EffectSchemaInventorySource.make(root));

  /**
   * Live source for the checkout the CLI runs in, located with `findRepoRoot`.
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly live: Layer.Layer<
    EffectSchemaInventorySource,
    EffectSchemaInventoryError,
    SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  > = Layer.effect(
    EffectSchemaInventorySource,
    findRepoRoot().pipe(
      EffectSchemaInventoryError.mapError("Unable to locate the repository root for effect-schema-inventory"),
      Effect.flatMap(EffectSchemaInventorySource.make)
    )
  );
}
