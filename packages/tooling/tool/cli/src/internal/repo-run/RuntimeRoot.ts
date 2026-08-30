/**
 * One per-user runtime root shared by admission and proof coordination.
 *
 * Both coordinators used to pick their root by testing whether
 * `XDG_RUNTIME_DIR` was configured, so a session launched with a scrubbed
 * environment coordinated under a different root than its siblings and ran
 * proofs unserialised. This module chooses the base root once and lets each
 * consumer append its own leaf, which keeps every existing on-disk location
 * stable for sessions that already had the variable.
 *
 * @since 0.0.0
 */
import { tmpdir, userInfo } from "node:os";
import * as O from "@beep/utils/Option";
import { Console, Effect, FileSystem, MutableRef, Path, pipe } from "effect";
import { dual } from "effect/Function";
import * as Str from "effect/String";
import { configStringOption } from "../cli/EnvConfig.ts";
import { RuntimeRootChoice, RuntimeRootKind } from "./RuntimeRoot.schemas.ts";

// The fallback notice is diagnostic; one line per process is enough, and it
// goes to stderr so `--json` stdout streams stay machine-parseable.
const fallbackNoticed = MutableRef.make(false);

const isWritableDirectory = Effect.fnUntraced(function* (
  directory: string
): Effect.fn.Return<boolean, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const info = yield* fs.stat(directory).pipe(Effect.option);
  if (!O.exists(info, (entry) => entry.type === "Directory")) {
    return false;
  }
  return yield* fs.access(directory, { writable: true }).pipe(
    Effect.as(true),
    Effect.orElseSucceed(() => false)
  );
});

/**
 * Choose the per-user base root for machine-wide coordination state.
 *
 * **Details**
 *
 * Resolution order: an absolute, non-empty `XDG_RUNTIME_DIR` from the active
 * `ConfigProvider` (trusted without a write probe); otherwise `/run/user/<uid>`
 * when the `FileSystem` service reports a writable directory; otherwise the
 * system temporary directory, announced once per process on stderr. Consumers
 * append their own leaf with {@link admissionRootFor} or their proof-lock
 * directory name, so nothing moves for sessions that already had the variable.
 *
 * **Example** (Resolve from an injected runtime directory)
 *
 * ```ts
 * import { perUserRuntimeRoot } from "@beep/repo-cli/test/RepoRun"
 * import * as NodePath from "@effect/platform-node/NodePath"
 * import { ConfigProvider, Effect, FileSystem } from "effect"
 *
 * const choice = perUserRuntimeRoot().pipe(
 *   Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ XDG_RUNTIME_DIR: "/runtime" })),
 *   Effect.provide(FileSystem.layerNoop({})),
 *   Effect.provide(NodePath.layer)
 * )
 * Effect.runPromise(choice).then((resolved) => console.log(resolved.kind, resolved.root)) // "configured" "/runtime"
 * ```
 *
 * @returns The chosen base root and how it was chosen.
 * @category coordination
 * @since 0.0.0
 */
export const perUserRuntimeRoot = Effect.fn("RuntimeRoot.perUserRuntimeRoot")(function* (): Effect.fn.Return<
  RuntimeRootChoice,
  never,
  FileSystem.FileSystem | Path.Path
> {
  const path = yield* Path.Path;
  const configured = pipe(
    yield* configStringOption("XDG_RUNTIME_DIR"),
    O.filter(Str.isNonEmpty),
    O.filter(path.isAbsolute)
  );
  if (O.isSome(configured)) {
    return RuntimeRootChoice.make({ kind: "configured", root: configured.value });
  }
  const runUserDirectory = path.join("/run/user", `${userInfo().uid}`);
  if (yield* isWritableDirectory(runUserDirectory)) {
    return RuntimeRootChoice.make({ kind: "run-user", root: runUserDirectory });
  }
  const root = tmpdir();
  if (!MutableRef.get(fallbackNoticed)) {
    MutableRef.set(fallbackNoticed, true);
    yield* Console.warn(
      `[yeet] runtime root: XDG_RUNTIME_DIR unset and ${runUserDirectory} unavailable; using ${root}`
    );
  }
  return RuntimeRootChoice.make({ kind: "tmpdir", root });
});

/**
 * Append the admission scheduler leaf to a chosen runtime root.
 *
 * **Details**
 *
 * Per-user roots (configured or `/run/user/<uid>`) get `beep/admit`; the shared
 * temporary directory gets the uid-suffixed `beep-admit-uid-<uid>` leaf it has
 * always used, because `tmpdir()` is not per-user.
 *
 * **Example** (Derive the admission root)
 *
 * ```ts
 * import { admissionRootFor, RuntimeRootChoice } from "@beep/repo-cli/test/RepoRun"
 * import * as NodePath from "@effect/platform-node/NodePath"
 * import { Effect, Path } from "effect"
 *
 * const root = Effect.map(Path.Path, (path) =>
 *   admissionRootFor(path, RuntimeRootChoice.make({ kind: "configured", root: "/run/user/1000" }))
 * ).pipe(Effect.provide(NodePath.layer))
 * Effect.runPromise(root).then(console.log) // "/run/user/1000/beep/admit"
 * ```
 *
 * @param path - Platform path service.
 * @param choice - Chosen base root.
 * @returns Absolute admission state directory.
 * @category coordination
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
