/**
 * Service boundary for every input the schema inventory reads outside its own fixture: the
 * catalog pin, the pinned Effect sources, and optional local graft context.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { A, Str } from "@beep/utils";
import { Duration, Effect, FileSystem, Inspectable, Layer, Path, pipe } from "effect";
import * as Context from "effect/Context";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { OutputBound, runCapturedStreams } from "../../../internal/process/StepExec.ts";
import { runGitRawOutput } from "../../../internal/repo-run/GitExec.ts";
import {
  EffectSchemaInventoryGraftContext,
  EffectSchemaInventoryGraftSkeleton,
  EffectSchemaInventoryPin,
  EffectSchemaInventoryReferencePath,
} from "../EffectSchemaInventory.schemas.ts";
import {
  EffectSchemaInventoryCatalogPinError,
  EffectSchemaInventoryError,
  EffectSchemaInventoryGraftUnavailableError,
  EffectSchemaInventoryPinAbsentError,
  EffectSchemaInventoryReferenceMissingError,
} from "../Lint.errors.ts";
import { parseEffectSchemaInventoryPin } from "./EffectSchemaInventoryModules.ts";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/process";
import type { GitCommandErrorAdapter } from "../../../internal/repo-run/GitExec.ts";

const $I = $RepoCliId.create("commands/Lint/internal/EffectSchemaInventorySource");

const GRAFT_TIMEOUT = Duration.seconds(60);
const graftOutputBound = OutputBound.make({ maxChars: 4 * 1024 * 1024, truncatedNotice: "\n[graft] output truncated" });
const decodeGraftSkeleton = S.decodeUnknownEffect(S.fromJsonString(EffectSchemaInventoryGraftSkeleton));
const decodePin = S.decodeUnknownEffect(EffectSchemaInventoryPin);

/**
 * Operations over the inventory's external inputs.
 *
 * **Details**
 *
 * `readPin` never consults the reference HEAD; `readPinned` is the only source-byte path and
 * reads `git show <pin>:<file>`, never the working tree. `graftContext` never fails: graft is
 * local-only and never a hosted-CI input, but when a prompt asks for it and it cannot be read,
 * `graftContext` fails with {@link EffectSchemaInventoryGraftUnavailableError}.
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
  /** Graft skeleton of `<file>` in the reference working tree; fails when graft cannot be read. */
  readonly graftContext: (
    pin: EffectSchemaInventoryPin,
    file: string
  ) => Effect.Effect<EffectSchemaInventoryGraftContext, EffectSchemaInventoryGraftUnavailableError>;
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
  const context = yield* Effect.context<Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner>();
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
          `The Effect reference clone ${reference} is missing; run scripts/setup-effect-ref.sh. The inventory never regenerates from anything else.`
        );
      }
      yield* git(["rev-parse", "--git-dir"], (commandLine, detail) =>
        EffectSchemaInventoryReferenceMissingError.new(
          reference,
          `${reference} is not a git checkout (${commandLine}: ${detail}); run scripts/setup-effect-ref.sh.`
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

  // Messages can land in terminal output and committed prompts, so they never carry the checkout's
  // absolute path.
  const graftFailure = (commandLine: string, detail: string) =>
    EffectSchemaInventoryGraftUnavailableError.new(
      pipe(`${commandLine}: ${detail}`, Str.split("\n"), A.take(3), A.join(" "), Str.replaceAll(root, "<repo>"))
    );

  const graftSkeleton = Effect.fn("EffectSchemaInventorySource.graftSkeleton")(function* (file: string) {
    const commandLine = `graft skeleton --json --no-refresh ${file} ${EffectSchemaInventoryReferencePath}`;
    const captured = yield* runCapturedStreams({
      command: "graft",
      args: ["skeleton", "--json", "--no-refresh", file, reference],
      cwd: root,
      extendEnv: true,
      bound: graftOutputBound,
    }).pipe(
      Effect.provide(context),
      Effect.timeoutOption(GRAFT_TIMEOUT),
      Effect.mapError((cause) => graftFailure(commandLine, `could not run: ${renderCause(cause)}`))
    );
    if (O.isNone(captured))
      return yield* graftFailure(commandLine, `timed out after ${Duration.format(GRAFT_TIMEOUT)}`);
    if (captured.value.exitCode !== 0)
      return yield* graftFailure(commandLine, `exit ${captured.value.exitCode}: ${Str.trim(captured.value.stderr)}`);
    return yield* decodeGraftSkeleton(captured.value.stdout).pipe(
      Effect.mapError((cause) => graftFailure(commandLine, `output did not decode: ${renderCause(cause)}`))
    );
  });

  // Graft reads the working tree, so span alignment is judged by the working-tree file's blob id
  // (`git hash-object`) against the pin's blob, never by the committed HEAD blob.
  const graftContext: EffectSchemaInventorySourceShape["graftContext"] = Effect.fn(
    "EffectSchemaInventorySource.graftContext"
  )(function* (pin, file) {
    const head = yield* git(["rev-parse", "--verify", "HEAD^{commit}"], graftFailure).pipe(
      Effect.map(Str.trim),
      Effect.flatMap((sha) =>
        decodePin(sha).pipe(Effect.mapError((cause) => graftFailure("git rev-parse HEAD", renderCause(cause))))
      )
    );
    const [workingTreeBlob, pinBlob] = yield* Effect.all([
      git(["hash-object", "--", file], graftFailure).pipe(Effect.map(Str.trim)),
      git(["rev-parse", `${pin}:${file}`], graftFailure).pipe(Effect.map(Str.trim)),
    ]);
    const skeleton = yield* graftSkeleton(file);
    return EffectSchemaInventoryGraftContext.make({
      head,
      workingTreeMatchesPin: workingTreeBlob === pinBlob,
      entries: skeleton.entries,
    });
  });

  return {
    readPin,
    verifyPin,
    readPinned,
    graftContext,
  } satisfies EffectSchemaInventorySourceShape;
});

/**
 * Service owning the inventory's external inputs; tests provide a fake implementation or call `make(root)`.
 *
 * **Example** (Read the pin through the service)
 *
 * ```ts
 * import { EffectSchemaInventorySource } from "@beep/repo-cli/commands/Lint"
 * import { Effect } from "effect"
 *
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
   * @returns A layer reading the catalog, git objects, and graft for that root.
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = (
    root: string
  ): Layer.Layer<
    EffectSchemaInventorySource,
    never,
    FileSystem.FileSystem | Path.Path | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
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
    FileSystem.FileSystem | Path.Path | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
  > = Layer.effect(
    EffectSchemaInventorySource,
    findRepoRoot().pipe(
      EffectSchemaInventoryError.mapError("Unable to locate the repository root for effect-schema-inventory"),
      Effect.flatMap(EffectSchemaInventorySource.make)
    )
  );
}
