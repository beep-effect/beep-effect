/**
 * One per-user runtime root shared by admission and proof coordination.
 *
 * Both coordinators used to choose between launcher-specific environment state,
 * `/run/user/<uid>`, and the system temporary directory. Any fallible choice can
 * split sibling sessions across separate trees. This module instead fixes the
 * base below the effective user's home at `.beep/runtime` on every platform.
 * Each consumer appends its existing scoped leaf.
 *
 * This change is a hard cutover, not a mixed-version migration. The immediate
 * predecessor coordinated below `/tmp`; still older versions could select
 * `/run/user/<uid>`. Before adopting this version, operators must drain every
 * Yeet process and `agent-run-*.scope` from those versions, then remove their
 * admission leases or tickets and proof-lock files only after proving the
 * owning processes are gone. Running a legacy root concurrently with the new
 * home-backed root is not supported: an old process cannot observe a
 * compatibility lock introduced only in the new process, so a one-sided bridge
 * would provide false safety.
 *
 * @since 0.0.0
 */
import { userInfo } from "node:os";
import * as O from "@beep/utils/Option";
import { Context, Effect } from "effect";
import { dual } from "effect/Function";
import { RuntimeRootChoice, RuntimeRootKind } from "./RuntimeRoot.schemas.ts";
import type { Path } from "effect";

/**
 * Resolve the invariant production base for an explicit platform and user home.
 *
 * **Example** (Resolve the Windows base)
 *
 * ```ts
 * import { canonicalRuntimeRootForTesting } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(canonicalRuntimeRootForTesting("win32", "C:\\Users\\alice"))
 * // "C:\\Users\\alice\\.beep\\runtime"
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const canonicalRuntimeRootForTesting: {
  (platform: NodeJS.Platform, userHome: string): string;
  (userHome: string): (platform: NodeJS.Platform) => string;
} = dual(2, (platform: NodeJS.Platform, userHome: string): string =>
  platform === "win32"
    ? `${userHome.replace(/[\\/]+$/u, "")}\\.beep\\runtime`
    : `${userHome.replace(/\/+$/u, "")}/.beep/runtime`
);

const CANONICAL_RUNTIME_ROOT = canonicalRuntimeRootForTesting(process.platform, userInfo().homedir);

class RuntimeRootTestOverride extends Context.Service<RuntimeRootTestOverride, RuntimeRootChoice>()(
  "@beep/repo-cli/internal/repo-run/RuntimeRoot/RuntimeRootTestOverride"
) {}

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
 * Production returns a stable directory below the effective user's home on
 * every platform. It does not consult `XDG_RUNTIME_DIR`,
 * `TMPDIR`, `TEMP`, or a fallible `/run/user/<uid>` probe, so sibling sessions
 * cannot independently select different coordination trees or reserve a
 * victim's namespace in a shared temporary directory. Admission and proof
 * consumers retain their existing scoped leaves below this base.
 * Deployment must follow the module-level hard-cutover procedure; in
 * particular, the immediate predecessor's `/tmp/beep-admit-uid-<uid>` and
 * `/tmp/beep-yeet-proof-locks-*-uid-<uid>` trees must be drained before new
 * coordination begins. Mixed-version coordination with either legacy root is
 * intentionally refused as an operational rollout shape.
 *
 * **Example** (Resolve the invariant host base)
 *
 * ```ts
 * import { perUserRuntimeRoot } from "@beep/repo-cli/test/RepoRun"
 * import { Effect } from "effect"
 *
 * Effect.runPromise(perUserRuntimeRoot()).then((resolved) => console.log(resolved.kind)) // "canonical"
 * ```
 *
 * @returns The chosen base root and how it was chosen.
 * @category configuration
 * @since 0.0.0
 */
export const perUserRuntimeRoot = Effect.fn("RuntimeRoot.perUserRuntimeRoot")(function* (): Effect.fn.Return<
  RuntimeRootChoice,
  never,
  never
> {
  const override = yield* Effect.serviceOption(RuntimeRootTestOverride);
  if (O.isSome(override)) {
    return override.value;
  }
  return RuntimeRootChoice.make({ kind: "canonical", root: CANONICAL_RUNTIME_ROOT });
});

/**
 * Append the admission scheduler leaf to a chosen runtime root.
 *
 * **Details**
 *
 * The canonical host base gets the historical uid-suffixed
 * `beep-admit-uid-<uid>` leaf. Test overrides get `beep/admit`, keeping isolated
 * fixtures self-contained.
 *
 * **Example** (Derive the admission root)
 *
 * ```ts
 * import { admissionRootFor, RuntimeRootChoice } from "@beep/repo-cli/test/RepoRun"
 * import * as NodePath from "@effect/platform-node/NodePath"
 * import { Effect, Path } from "effect"
 *
 * const root = Effect.map(Path.Path, (path) =>
 *   admissionRootFor(path, RuntimeRootChoice.make({ kind: "canonical", root: "/home/alice/.beep/runtime" }))
 * ).pipe(Effect.provide(NodePath.layer))
 * Effect.runPromise(root).then(console.log) // "/home/alice/.beep/runtime/beep-admit-uid-1000"
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
  RuntimeRootKind.is.canonical(choice.kind)
    ? path.join(choice.root, `beep-admit-uid-${userInfo().uid}`)
    : path.join(choice.root, "beep", "admit")
);
