/**
 * Pinned external runtime: discovery of the installed package and bounded
 * execution of its CLI.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
// This role file deliberately owns both runtime discovery (the config-provider
// concern a `.config.ts` role would normally hold) and child-process execution:
// a Security process is only ever spawned against a verified pin, so the two
// concerns share one module rather than one reaching into the other.
import { Config, Effect, FileSystem, Path } from "effect";
import * as Duration from "effect/Duration";
import * as S from "effect/Schema";
import { ChildProcess } from "effect/unstable/process";
import { CodexSecurityError, toCodexSecurityError } from "./Security.errors.ts";
import { SECURITY_PACKAGE_VERSION, SECURITY_PLUGIN_VERSION } from "./Security.schemas.ts";

const INSTALL_PREFIX = `~/.cache/beep/codex-security/${SECURITY_PACKAGE_VERSION}`;
const PackageMetadata = S.fromJsonString(
  S.Struct({ name: S.Literal("@openai/codex-security"), version: S.Literal(SECURITY_PACKAGE_VERSION) })
);
const PluginMetadata = S.fromJsonString(
  S.Struct({ name: S.Literal("codex-security"), version: S.Literal(SECURITY_PLUGIN_VERSION) })
);

const decodePackageMetadata = S.decodeEffect(PackageMetadata);
const decodePluginMetadata = S.decodeEffect(PluginMetadata);

/**
 * Resolves and verifies the pinned package and bundled plugin without installing.
 *
 * **Example** (Composing runtime discovery)
 * ```ts
 * import { securityRuntime } from "@beep/repo-cli/commands/Codex/Security.runtime"
 * import * as Effect from "effect/Effect"
 * const program = securityRuntime.pipe(Effect.map(runtime => runtime.cli))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const securityRuntime = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const home = yield* Config.String("HOME");
  const searchPath = yield* Config.String("PATH");
  const packageRoot = path.join(
    home,
    `.cache/beep/codex-security/${SECURITY_PACKAGE_VERSION}/node_modules/@openai/codex-security`
  );
  const cli = path.join(packageRoot, "bin/codex-security.mjs");
  if (!(yield* fs.exists(cli))) {
    return yield* CodexSecurityError.make({
      message: `Install the pinned runtime: npm install --prefix ${INSTALL_PREFIX} --ignore-scripts --no-audit --no-fund --save-exact @openai/codex-security@${SECURITY_PACKAGE_VERSION}`,
    });
  }
  yield* decodePackageMetadata(yield* fs.readFileString(path.join(packageRoot, "package.json")));
  yield* decodePluginMetadata(
    yield* fs.readFileString(path.join(packageRoot, "_bundled_plugin/.codex-plugin/plugin.json"))
  );
  return {
    cli,
    env: {
      HOME: home,
      PATH: searchPath,
      CODEX_SECURITY_STATE_DIR: path.join(home, ".cache/beep/codex-security/state"),
    },
  };
}).pipe(
  Effect.withSpan("CodexSecurity.runtime"),
  Effect.mapError(toCodexSecurityError("Pinned Security package or plugin metadata failed validation."))
);

/**
 * Runs the pinned Security CLI with a closed environment and a hard deadline.
 *
 * **Details**
 * The child inherits nothing beyond the runtime's `HOME`, `PATH`, and state
 * directory (`extendEnv: false`), never reads stdin, receives `SIGTERM` at the
 * deadline and `SIGKILL` five seconds later. Stdout and stderr policies are
 * separate so a validator can discard the export while still surfacing the
 * upstream tool's diagnostics. The exit code is returned as-is so callers
 * decide what a non-zero status means for their step.
 *
 * **Example** (Composing a bounded export)
 * ```ts
 * import { runSecurityCli } from "@beep/repo-cli/commands/Codex/Security.runtime"
 * import * as Effect from "effect/Effect"
 * import * as Duration from "effect/Duration"
 * const program = runSecurityCli({
 *   args: ["export", "/private/scan", "--export-format", "json", "--output", "-"],
 *   stdout: "ignore",
 *   stderr: "inherit",
 *   timeout: Duration.minutes(1),
 *   timeoutMessage: "Export timed out.",
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - CLI arguments, optional working directory, stdout and stderr policies, and deadline.
 * @returns The child's exit code.
 * @category processes
 * @since 0.0.0
 */
export const runSecurityCli = Effect.fn("CodexSecurity.runCli")(function* (options: {
  readonly args: ReadonlyArray<string>;
  readonly cwd?: string | undefined;
  readonly stdout: "inherit" | "ignore";
  readonly stderr: "inherit" | "ignore";
  readonly timeout: Duration.Duration;
  readonly timeoutMessage: string;
}) {
  const runtime = yield* securityRuntime;
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make("node", [runtime.cli, ...options.args], {
        cwd: options.cwd,
        env: runtime.env,
        extendEnv: false,
        stdin: "ignore",
        stdout: options.stdout,
        stderr: options.stderr,
        killSignal: "SIGTERM",
        forceKillAfter: Duration.seconds(5),
      });
      return yield* handle.exitCode;
    })
  ).pipe(
    Effect.timeoutOrElse({
      duration: options.timeout,
      orElse: () => Effect.fail(CodexSecurityError.make({ message: options.timeoutMessage })),
    })
  );
});

/**
 * Runs the upstream sealed-contract validator without scanning or exporting a file.
 *
 * **Details**
 * Export to discarded stdout validates the full upstream schema in addition to
 * the adapter's bounded projection. No credentials or scan runtime are loaded.
 * The upstream exporter shells out to `python3`; stderr is inherited so a
 * missing interpreter reaches the operator instead of surfacing as a contract
 * rejection.
 *
 * **Example** (Composing upstream validation)
 * ```ts
 * import { verifySecurityBundleContract } from "@beep/repo-cli/commands/Codex/Security.runtime"
 * import * as Effect from "effect/Effect"
 * const verification = verifySecurityBundleContract("/private/scan")
 * console.log(Effect.isEffect(verification)) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const verifySecurityBundleContract = Effect.fn("CodexSecurity.verifyBundleContract")(
  function* (directory: string) {
    const exitCode = yield* runSecurityCli({
      args: ["export", directory, "--export-format", "json", "--output", "-"],
      stdout: "ignore",
      stderr: "inherit",
      timeout: Duration.minutes(1),
      timeoutMessage: "Upstream bundle validation timed out.",
    });
    if (exitCode !== 0)
      return yield* CodexSecurityError.make({
        message: "The pinned upstream exporter rejected the sealed bundle contract. No packet was written.",
      });
  },
  Effect.mapError(toCodexSecurityError("Upstream bundle validation could not run."))
);
