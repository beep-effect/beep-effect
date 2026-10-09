/**
 * Where the runner finds the repository, the upstream checkout, and the lab
 * directories of each target.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity/packages";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { AuditTarget, type ModuleName, RUNNER_TARGET } from "./Ledger.schema.ts";

const $I = $ScratchpadId.create("effected/runner/Paths");

/**
 * Absolute roots the runner works between.
 *
 * **Details**
 *
 * `upstreamRoot` is the tree every read uses (the oracle); `upstreamCheckout`
 * is the live git checkout it came from. The two differ once the checkout has
 * moved past the ledger's pinned commit.
 *
 * **Example** (Build a config by hand)
 *
 * ```ts
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 *
 * const config = RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/upstream", upstreamCheckout: "/upstream", home: "/home/me" })
 * console.log(config.repoRoot) // "/repo"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class RunnerConfig extends S.Class<RunnerConfig>($I`RunnerConfig`)(
  {
    repoRoot: S.NonEmptyString,
    upstreamRoot: S.NonEmptyString,
    upstreamCheckout: S.NonEmptyString,
    home: S.NonEmptyString,
  },
  $I.annote("RunnerConfig", { description: "Absolute repository, upstream oracle, upstream checkout and home roots." })
) {}

/**
 * The repository root is three directories above this file; the upstream
 * checkout defaults to `~/YeeBois/references/effect/effected` and can be
 * overridden with `EFFECTED_UPSTREAM`.
 *
 * **Details**
 *
 * The oracle root starts as the checkout itself; `resolveOracle` replaces it
 * with the pinned export when the checkout has moved past the ledger's pin.
 *
 * **Example** (Resolve the roots)
 *
 * ```ts
 * import { resolveRunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import { BunServices } from "@effect/platform-bun"
 * import * as Effect from "effect/Effect"
 *
 * const program = resolveRunnerConfig().pipe(Effect.provide(BunServices.layer))
 * console.log(typeof program) // "object"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const resolveRunnerConfig = Effect.fn("Runner.resolveRunnerConfig")(function* () {
  const path = yield* Path.Path;
  const here = path.dirname(yield* path.fromFileUrl(new URL(import.meta.url)));
  const repoRoot = path.resolve(here, "..", "..", "..");
  const home = yield* Config.String("HOME");
  const upstreamRoot = yield* Config.String("EFFECTED_UPSTREAM").pipe(
    Config.withDefault(path.join(home, "YeeBois", "references", "effect", "effected"))
  );
  return RunnerConfig.make({ repoRoot, upstreamRoot, upstreamCheckout: upstreamRoot, home });
});

/**
 * Repo-relative lab paths of one audit target.
 *
 * **Example** (Locate a module's lab directories)
 *
 * ```ts
 * import { labPaths } from "@beep/scratchpad/effected/runner/Paths"
 *
 * const paths = labPaths("yaml")
 * console.log(paths.sourceDir) // "scratchpad/effected/yaml"
 * console.log(paths.testDir) // "scratchpad/test/yaml"
 * console.log(labPaths("jsonl").extraTests) // ["scratchpad/test/jsonl.test.ts"]
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const labPaths = (
  target: AuditTarget
): {
  readonly sourceDir: string;
  readonly testDir: string;
  readonly extraSources: ReadonlyArray<string>;
  readonly extraTests: ReadonlyArray<string>;
  readonly tsconfig: string;
  readonly docgenConfig: string;
  readonly docgenSrcDir: string;
  readonly coverageDir: string;
} => ({
  sourceDir: `scratchpad/effected/${target}`,
  testDir: `scratchpad/test/${target}`,
  extraSources: AuditTarget.is.runner(target) ? ["scratchpad/effected/audit.ts"] : [],
  extraTests: AuditTarget.is.jsonl(target) ? ["scratchpad/test/jsonl.test.ts"] : [],
  tsconfig: `scratchpad/effected/${target}/tsconfig.json`,
  docgenConfig: `scratchpad/docgen.${target}.json`,
  docgenSrcDir: `effected/${target}`,
  coverageDir: `coverage/scratchpad-effected/${target}`,
});

/**
 * Upstream-relative paths of one module.
 *
 * **Example** (Locate a module upstream)
 *
 * ```ts
 * import { upstreamPaths } from "@beep/scratchpad/effected/runner/Paths"
 *
 * console.log(upstreamPaths("yaml").srcDir) // "packages/yaml/src"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const upstreamPaths = (
  module: ModuleName
): {
  readonly packageDir: string;
  readonly srcDir: string;
  readonly testDir: string;
  readonly packageJson: string;
  readonly readme: string;
  readonly license: string;
  readonly claudeMd: string;
  readonly okfModule: string;
} => ({
  packageDir: `packages/${module}`,
  srcDir: `packages/${module}/src`,
  testDir: `packages/${module}/__test__`,
  packageJson: `packages/${module}/package.json`,
  readme: `packages/${module}/README.md`,
  license: `packages/${module}/LICENSE`,
  claudeMd: `packages/${module}/CLAUDE.md`,
  okfModule: `okf/modules/${module}.md`,
});

/**
 * Whether a target is a ported module rather than the runner.
 *
 * **Example** (Narrow a target)
 *
 * ```ts
 * import { isModuleTarget } from "@beep/scratchpad/effected/runner/Paths"
 *
 * console.log(isModuleTarget("yaml")) // true
 * console.log(isModuleTarget("runner")) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isModuleTarget = (target: AuditTarget): target is ModuleName => target !== RUNNER_TARGET;
