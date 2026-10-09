/**
 * The upstream oracle: the tree every copy, parity check and reviewer reads,
 * held at the commit the ledger pins.
 *
 * **Details**
 *
 * The reference checkout is refreshed by a scheduled job, so its HEAD can move
 * past the pin while a port is under way. When it has, the runner reads a
 * byte-exact export of the pinned commit under
 * `~/.cache/beep/effected-port/upstream/<commit>` instead, built once with
 * `git archive` (which only reads the checkout's object store). The export
 * carries a small `node_modules` of links (`effect`, `@effect`, and each
 * `@effected/<m>` package) so a differential probe can import upstream source
 * from it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { LEDGER_PATH, readLedger } from "./LedgerStore.ts";
import { RunnerConfig } from "./Paths.ts";
import { capture } from "./Process.ts";

const $I = $ScratchpadId.create("effected/runner/Oracle");

/**
 * Where the oracle tree comes from.
 *
 * **Example** (Guard a source)
 *
 * ```ts
 * import { OracleSource } from "@beep/scratchpad/effected/runner/Oracle"
 *
 * console.log(OracleSource.is["pinned-export"]("pinned-export")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OracleSource = LiteralKit(["checkout", "pinned-export"]).annotate(
  $I.annote("OracleSource", { description: "The live reference checkout, or an export of the pinned commit." })
);

/**
 * The union of oracle source literals.
 *
 * @see {@link OracleSource} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type OracleSource = typeof OracleSource.Type;

/**
 * The resolved oracle: which tree to read and which commit it holds.
 *
 * **Example** (Describe a pinned export)
 *
 * ```ts
 * import { Oracle } from "@beep/scratchpad/effected/runner/Oracle"
 *
 * const oracle = Oracle.make({ commit: "abc", checkoutCommit: "def", root: "/cache/abc", source: "pinned-export" })
 * console.log(oracle.commit === oracle.checkoutCommit) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Oracle extends S.Class<Oracle>($I`Oracle`)(
  {
    commit: S.NonEmptyString,
    checkoutCommit: S.NonEmptyString,
    root: S.NonEmptyString,
    source: OracleSource,
  },
  $I.annote("Oracle", { description: "The upstream tree the runner reads and the commit it holds." })
) {}

/**
 * The directory that holds the export of one upstream commit.
 *
 * **Example** (Locate an export)
 *
 * ```ts
 * import { pinnedExportDir } from "@beep/scratchpad/effected/runner/Oracle"
 *
 * console.log(pinnedExportDir("/home/me", "abc")) // "/home/me/.cache/beep/effected-port/upstream/abc"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const pinnedExportDir: {
  (commit: string): (home: string) => string;
  (home: string, commit: string): string;
} = dual(2, (home: string, commit: string): string => `${home}/.cache/beep/effected-port/upstream/${commit}`);

/**
 * The commits that decide the oracle: the ledger's pin, when a ledger exists,
 * and the reference checkout's HEAD.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface OracleCommits {
  readonly pin: O.Option<string>;
  readonly checkoutCommit: string;
}

/**
 * Chooses the oracle tree: the live checkout while it still stands on the
 * pin (or no ledger pins anything yet), the pinned export once it has moved.
 *
 * **Example** (A checkout that moved past the pin)
 *
 * ```ts
 * import { chooseOracle } from "@beep/scratchpad/effected/runner/Oracle"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as O from "effect/Option"
 *
 * const config = RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up", upstreamCheckout: "/up", home: "/home/me" })
 * const oracle = chooseOracle(config, { pin: O.some("abc"), checkoutCommit: "def" })
 * console.log(oracle.source) // "pinned-export"
 * console.log(oracle.root) // "/home/me/.cache/beep/effected-port/upstream/abc"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const chooseOracle: {
  (commits: OracleCommits): (config: RunnerConfig) => Oracle;
  (config: RunnerConfig, commits: OracleCommits): Oracle;
} = dual(2, (config: RunnerConfig, commits: OracleCommits): Oracle => {
  const commit = O.getOrElse(commits.pin, () => commits.checkoutCommit);
  return commit === commits.checkoutCommit
    ? Oracle.make({ commit, checkoutCommit: commits.checkoutCommit, root: config.upstreamCheckout, source: "checkout" })
    : Oracle.make({
        commit,
        checkoutCommit: commits.checkoutCommit,
        root: pinnedExportDir(config.home, commit),
        source: "pinned-export",
      });
});

const PIN_MARKER = ".effected-pin";

/**
 * Builds the export of a pinned commit when it is not on disk yet: the tree
 * from `git archive`, links that make upstream source importable, and a
 * marker written last so a half-built export is never read.
 *
 * @category commands
 * @since 0.0.0
 */
const materializeExport = Effect.fn("Oracle.materializeExport")(function* (config: RunnerConfig, oracle: Oracle) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  if (yield* fs.exists(path.join(oracle.root, PIN_MARKER))) return;
  const partial = `${oracle.root}.partial`;
  yield* fs.remove(partial, { recursive: true, force: true });
  yield* fs.makeDirectory(partial, { recursive: true });
  yield* capture({
    command: "bash",
    args: ["-c", 'set -o pipefail; git -C "$1" archive --format=tar "$2" | tar -x -C "$3"', "export", config.upstreamCheckout, oracle.commit, partial],
    cwd: config.repoRoot,
  });
  const modules = path.join(partial, "node_modules");
  yield* fs.makeDirectory(path.join(modules, "@effected"), { recursive: true });
  yield* fs.symlink(path.join(config.repoRoot, "node_modules", "effect"), path.join(modules, "effect"));
  yield* fs.symlink(path.join(config.repoRoot, "node_modules", "@effect"), path.join(modules, "@effect"));
  const packages = yield* fs.readDirectory(path.join(partial, "packages"));
  yield* Effect.forEach(packages, (name) =>
    fs.symlink(path.join(oracle.root, "packages", name), path.join(modules, "@effected", name))
  );
  yield* fs.writeFileString(path.join(partial, PIN_MARKER), `${oracle.commit}\n`);
  yield* fs.remove(oracle.root, { recursive: true, force: true });
  yield* fs.rename(partial, oracle.root);
});

/**
 * Resolves the oracle for this run and returns the runner config that reads
 * it: the ledger's pin against the reference checkout's HEAD, with the pinned
 * export built on first use.
 *
 * **Example** (Resolve the oracle)
 *
 * ```ts
 * import { resolveOracle } from "@beep/scratchpad/effected/runner/Oracle"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * const config = RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up", upstreamCheckout: "/up", home: "/home/me" })
 * console.log(Effect.isEffect(resolveOracle(config))) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const resolveOracle = Effect.fn("Oracle.resolve")(function* (config: RunnerConfig) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const checkoutCommit = yield* capture({ command: "git", args: ["rev-parse", "HEAD"], cwd: config.upstreamCheckout });
  const pin = (yield* fs.exists(path.join(config.repoRoot, LEDGER_PATH)))
    ? O.some((yield* readLedger(config)).effectedCommit)
    : O.none<string>();
  const oracle = chooseOracle(config, { pin, checkoutCommit });
  if (OracleSource.is["pinned-export"](oracle.source)) {
    yield* materializeExport(config, oracle);
    yield* Console.log(
      `[effected] upstream oracle: the reference checkout is at ${checkoutCommit}, the ledger pins ${oracle.commit}; reading the pinned export ${oracle.root}`
    );
  }
  return {
    oracle,
    config: RunnerConfig.make({
      repoRoot: config.repoRoot,
      upstreamRoot: oracle.root,
      upstreamCheckout: config.upstreamCheckout,
      home: config.home,
    }),
  };
});
