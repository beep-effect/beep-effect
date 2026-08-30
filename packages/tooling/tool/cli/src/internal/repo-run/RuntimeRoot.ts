/**
 * One per-user runtime root shared by admission and proof coordination.
 *
 * Both coordinators used to pick their root by testing whether
 * `XDG_RUNTIME_DIR` was configured, so a session launched with a scrubbed
 * environment coordinated under a different root than its siblings and ran
 * proofs unserialised. This module ignores launcher-specific environment state,
 * chooses the base root once, and lets each consumer append its own leaf.
 *
 * @since 0.0.0
 */
import { tmpdir, userInfo } from "node:os";
import * as O from "@beep/utils/Option";
import { Console, Context, Effect, FileSystem, MutableRef, Path } from "effect";
import { dual } from "effect/Function";
import { RuntimeRootChoice, RuntimeRootKind } from "./RuntimeRoot.schemas.ts";

// The fallback notice is diagnostic; one line per process is enough, and it
// goes to stderr so `--json` stdout streams stay machine-parseable.
const fallbackNoticed = MutableRef.make(false);

class RuntimeRootTestOverride extends Context.Service<RuntimeRootTestOverride, RuntimeRootChoice>()(
  "@beep/repo-cli/internal/repo-run/RuntimeRoot/RuntimeRootTestOverride"
) {}

const canCreateChildDirectory = Effect.fnUntraced(function* (
  directory: string
): Effect.fn.Return<boolean, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const info = yield* fs.stat(directory).pipe(Effect.option);
  if (!O.exists(info, (entry) => entry.type === "Directory")) {
    return false;
  }
  const probe = yield* fs.makeTempDirectory({ directory, prefix: ".beep-runtime-root-probe-" }).pipe(Effect.option);
  if (O.isNone(probe)) {
    return false;
  }
  yield* fs.remove(probe.value, { recursive: true, force: true }).pipe(Effect.ignore);
  return true;
});

/**
 * Inject a runtime-root choice into an Effect for isolated scheduler tests.
 *
 * **Example** (Provide an isolated root)
 *
 * ```ts
 * import { provideRuntimeRootForTesting, RuntimeRootChoice } from "@beep/repo-cli/test/RepoRun"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed("isolated").pipe(
 *   provideRuntimeRootForTesting(RuntimeRootChoice.make({ kind: "test-override", root: "/tmp/test-runtime" }))
 * )
 *
 * console.log(Effect.runSync(program)) // "isolated"
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const provideRuntimeRootForTesting: {
  <Value, Error2, Requirements>(
    choice: RuntimeRootChoice
  ): (self: Effect.Effect<Value, Error2, Requirements>) => Effect.Effect<Value, Error2, Requirements>;
  <Value, Error2, Requirements>(
    self: Effect.Effect<Value, Error2, Requirements>,
    choice: RuntimeRootChoice
  ): Effect.Effect<Value, Error2, Requirements>;
} = dual(
  2,
  <Value, Error2, Requirements>(
    self: Effect.Effect<Value, Error2, Requirements>,
    choice: RuntimeRootChoice
  ): Effect.Effect<Value, Error2, Requirements> => Effect.provideService(self, RuntimeRootTestOverride, choice)
);

/**
 * Choose the per-user base root for machine-wide coordination state.
 *
 * **Details**
 *
 * Resolution order: `/run/user/<uid>` when the `FileSystem` service can create
 * and remove a child directory there; otherwise the system temporary directory,
 * announced once per process on stderr. `XDG_RUNTIME_DIR` is deliberately not
 * consulted, so configured and env-scrubbed sibling sessions converge.
 *
 * **Example** (Resolve with a temporary fallback)
 *
 * ```ts
 * import { perUserRuntimeRoot } from "@beep/repo-cli/test/RepoRun"
 * import * as NodePath from "@effect/platform-node/NodePath"
 * import { Effect, FileSystem } from "effect"
 *
 * const choice = perUserRuntimeRoot().pipe(
 *   Effect.provide(FileSystem.layerNoop({})),
 *   Effect.provide(NodePath.layer)
 * )
 * Effect.runPromise(choice).then((resolved) => console.log(resolved.kind)) // "tmpdir"
 * ```
 *
 * @returns The chosen base root and how it was chosen.
 * @category configuration
 * @since 0.0.0
 */
export const perUserRuntimeRoot = Effect.fn("RuntimeRoot.perUserRuntimeRoot")(function* (): Effect.fn.Return<
  RuntimeRootChoice,
  never,
  FileSystem.FileSystem | Path.Path
> {
  const override = yield* Effect.serviceOption(RuntimeRootTestOverride);
  if (O.isSome(override)) {
    return override.value;
  }
  const path = yield* Path.Path;
  const runUserDirectory = path.join("/run/user", `${userInfo().uid}`);
  if (yield* canCreateChildDirectory(runUserDirectory)) {
    return RuntimeRootChoice.make({ kind: "run-user", root: runUserDirectory });
  }
  const root = tmpdir();
  if (!MutableRef.get(fallbackNoticed)) {
    MutableRef.set(fallbackNoticed, true);
    yield* Console.warn(`[yeet] runtime root: ${runUserDirectory} unavailable; using ${root}`);
  }
  return RuntimeRootChoice.make({ kind: "tmpdir", root });
});

/**
 * Append the admission scheduler leaf to a chosen runtime root.
 *
 * **Details**
 *
 * Per-user roots get `beep/admit`; the shared temporary directory gets the
 * uid-suffixed `beep-admit-uid-<uid>` leaf it has always used, because
 * `tmpdir()` is not per-user.
 *
 * **Example** (Derive the admission root)
 *
 * ```ts
 * import { admissionRootFor, RuntimeRootChoice } from "@beep/repo-cli/test/RepoRun"
 * import * as NodePath from "@effect/platform-node/NodePath"
 * import { Effect, Path } from "effect"
 *
 * const root = Effect.map(Path.Path, (path) =>
 *   admissionRootFor(path, RuntimeRootChoice.make({ kind: "run-user", root: "/run/user/1000" }))
 * ).pipe(Effect.provide(NodePath.layer))
 * Effect.runPromise(root).then(console.log) // "/run/user/1000/beep/admit"
 * ```
 *
 * @param path - Platform path service.
 * @param choice - Chosen base root.
 * @returns Absolute admission state directory.
 * @category utilities
 * @since 0.0.0
 */
export const admissionRootFor: {
  (path: Path.Path, choice: RuntimeRootChoice): string;
  (choice: RuntimeRootChoice): (path: Path.Path) => string;
} = dual(2, (path: Path.Path, choice: RuntimeRootChoice): string =>
  RuntimeRootKind.is.tmpdir(choice.kind)
    ? path.join(choice.root, `beep-admit-uid-${userInfo().uid}`)
    : path.join(choice.root, "beep", "admit")
);
