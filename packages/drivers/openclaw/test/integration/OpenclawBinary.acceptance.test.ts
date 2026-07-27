/**
 * Acceptance tests against the real pinned OpenClaw binary.
 *
 * Stages `openclaw@2026.7.1-2` from the npm registry into a reusable cache
 * (`BEEP_OPENCLAW_IT_CACHE`, default `~/.cache/beep-openclaw-driver`), then
 * drives the driver's own live `OpenclawCli` service to prove the P1 exit
 * criteria: the pinned binary's `--version` matches the compatibility set,
 * plugin-aware `config validate` accepts the rendered golden intent and
 * rejects every negative fixture, and the `config schema` export contains no
 * lossy placeholders for the extension surfaces the golden intent declares.
 *
 * Runs only in the `test:integration` lane (requires network + a local
 * Node 24 toolchain). Temp workbench directories are scoped and removed; the
 * staged npm cache is retained across runs.
 */
import { fileURLToPath } from "node:url";
import { OPENCLAW_COMPATIBILITY_SET } from "@beep/openclaw/Openclaw.config";
import { OpenclawInvocationContext } from "@beep/openclaw/Openclaw.models";
import { OpenclawCli } from "@beep/openclaw/OpenclawCli.service";
import {
  OpenclawAgentIntent,
  OpenclawDeploymentIntent,
  OpenclawLoggingIntent,
  OpenclawSecretsResolverIntent,
} from "@beep/openclaw/OpenclawIntent.models";
import {
  declaredExtensionSurfaces,
  findLossySchemaPlaceholders,
  renderOpenclawConfig,
} from "@beep/openclaw/OpenclawRender";
import { collectProcessOutput } from "@beep/utils/Stream";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, layer } from "@effect/vitest";
import { Config, Context, Effect, Layer, pipe } from "effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { goldenDeploymentIntent } from "../fixtures/golden-intent.expected.ts";

const compatibility = OPENCLAW_COMPATIBILITY_SET;
const stagePackage = `openclaw@${compatibility.openclawVersion}`;
const stubScript = "#!/bin/sh\nexit 0\n";
const placeholderRoot = "/beep-openclaw-placeholder";
const negativeFixtureDir = fileURLToPath(new URL("../fixtures/negative/", import.meta.url));
// Note: the design contract's "retired allowSymlinkCommand" defect is a
// 2026.7.2 retirement — the pinned 2026.7.1-2 binary still accepts that key
// (verified directly), so the exec-provider strict-boundary fixture uses an
// unknown provider key, which the pinned binary genuinely rejects.
const negativeFixtureNames = [
  "agents-entries-shape",
  "gateway-port-string",
  "unknown-exec-provider-key",
  "unknown-top-level-key",
];

interface OpenclawItWorkbenchShape {
  readonly binaryPath: string;
  readonly configDir: string;
  readonly homeDir: string;
  readonly nodeBinDir: O.Option<string>;
  readonly opBinaryPath: string;
  readonly resolverCommandPath: string;
  readonly rootDir: string;
  readonly stateDir: string;
  readonly trustedDir: string;
  readonly workspaceDir: string;
}

class OpenclawItWorkbench extends Context.Service<OpenclawItWorkbench, OpenclawItWorkbenchShape>()(
  "@beep/openclaw/test/integration/OpenclawBinary.acceptance.test/OpenclawItWorkbench"
) {}

const runCapturedProcess = Effect.fnUntraced(function* (command: ChildProcess.Command) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  return yield* Effect.scoped(Effect.flatMap(spawner.spawn(command), collectProcessOutput));
});

const ambientProcess = (executable: string, args: ReadonlyArray<string>): ChildProcess.Command =>
  ChildProcess.make(executable, args, {
    env: {},
    extendEnv: true,
    stderr: "pipe",
    stdin: "ignore",
    stdout: "pipe",
  });

/** Stage the pinned npm package once; reuse the cache when already staged. */
const ensurePinnedBinaryStaged = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const home = yield* Config.string("HOME");
  const cacheRoot = O.getOrElse(yield* Config.option(Config.string("BEEP_OPENCLAW_IT_CACHE")), () =>
    path.join(home, ".cache", "beep-openclaw-driver")
  );
  const stagePrefix = path.join(cacheRoot, `openclaw-${compatibility.openclawVersion}`);
  const binaryPath = path.join(stagePrefix, "node_modules", ".bin", "openclaw");
  const alreadyStaged = yield* fs.exists(binaryPath);
  if (!alreadyStaged) {
    const [stdout, stderr, exitCode] = yield* runCapturedProcess(
      ambientProcess("npm", ["install", "--prefix", stagePrefix, "--no-save", "--package-lock=false", stagePackage])
    );
    if (exitCode !== 0) {
      return yield* Effect.die(
        new Error(`npm staging of ${stagePackage} exited with ${exitCode}: ${Str.trim(stderr)} ${Str.trim(stdout)}`)
      );
    }
  }
  return binaryPath;
});

/** Pinned Node bin dir: explicit override, then mise Node 24, then PATH node. */
const resolveNodeBinDirectory = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const override = yield* Config.option(Config.string("BEEP_OPENCLAW_IT_NODE_BIN"));
  if (O.isSome(override)) {
    return override;
  }
  const home = yield* Config.string("HOME");
  const miseNodeBin = path.join(home, ".local", "share", "mise", "installs", "node", "24", "bin");
  const hasMiseNode = yield* fs.exists(miseNodeBin);
  if (hasMiseNode) {
    return O.some(miseNodeBin);
  }
  const [stdout, , exitCode] = yield* runCapturedProcess(ambientProcess("sh", ["-c", "command -v node"]));
  return exitCode === 0 ? pipe(Str.trim(stdout), O.liftPredicate(Str.isNonEmpty), O.map(path.dirname)) : O.none();
});

const makeWorkbench = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const binaryPath = yield* ensurePinnedBinaryStaged;
  const nodeBinDir = yield* resolveNodeBinDirectory;
  const rootDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-openclaw-it-" });
  const configDir = path.join(rootDir, "configs");
  const homeDir = path.join(rootDir, "home");
  const stateDir = path.join(rootDir, "state");
  const trustedDir = path.join(rootDir, "trusted");
  const workspaceDir = path.join(rootDir, "workspace");
  const opBinaryPath = path.join(trustedDir, "bin", "op");
  const resolverCommandPath = path.join(trustedDir, "op-resolver.sh");
  yield* Effect.forEach(
    [configDir, homeDir, path.join(stateDir, "log"), path.join(trustedDir, "bin"), workspaceDir],
    (directory) => fs.makeDirectory(directory, { recursive: true })
  );
  yield* Effect.forEach([opBinaryPath, resolverCommandPath], (stubPath) =>
    Effect.flatMap(fs.writeFileString(stubPath, stubScript), () => fs.chmod(stubPath, 0o755))
  );

  return OpenclawItWorkbench.of({
    binaryPath,
    configDir,
    homeDir,
    nodeBinDir,
    opBinaryPath,
    resolverCommandPath,
    rootDir,
    stateDir,
    trustedDir,
    workspaceDir,
  });
});

const acceptanceLayer = Layer.provideMerge(
  Layer.mergeAll(OpenclawCli.makeLayer(), Layer.effect(OpenclawItWorkbench, Effect.orDie(makeWorkbench))),
  NodeServices.layer
);

const workbenchContext = (bench: OpenclawItWorkbenchShape, configPath: O.Option<string>): OpenclawInvocationContext =>
  OpenclawInvocationContext.make({
    binaryPath: bench.binaryPath,
    configPath,
    home: O.some(bench.homeDir),
    nodeBinDir: bench.nodeBinDir,
    stateDir: O.some(bench.stateDir),
  });

/** The golden intent re-anchored onto the workbench's real temp paths. */
const workbenchIntent = (bench: OpenclawItWorkbenchShape): OpenclawDeploymentIntent =>
  OpenclawDeploymentIntent.make({
    ...goldenDeploymentIntent,
    agent: OpenclawAgentIntent.make({ ...goldenDeploymentIntent.agent, workspace: bench.workspaceDir }),
    logging: OpenclawLoggingIntent.make({ filePath: `${bench.stateDir}/log/openclaw.log` }),
    secretsResolver: OpenclawSecretsResolverIntent.make({
      commandPath: bench.resolverCommandPath,
      opBinaryPath: bench.opBinaryPath,
      trustedDir: bench.trustedDir,
    }),
  });

const writeRenderedGoldenConfig = Effect.fnUntraced(function* (bench: OpenclawItWorkbenchShape, fileName: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const configPath = path.join(bench.configDir, fileName);
  yield* fs.writeFileString(configPath, renderOpenclawConfig(workbenchIntent(bench)).canonicalJson);
  return configPath;
});

describe("@beep/openclaw pinned-binary acceptance", () => {
  layer(acceptanceLayer, { timeout: "10 minutes" })((it) => {
    it.effect(
      "verifies the staged binary --version against the pinned compatibility set",
      Effect.fnUntraced(function* () {
        const cli = yield* OpenclawCli;
        const bench = yield* OpenclawItWorkbench;
        const info = yield* cli.version(workbenchContext(bench, O.none()));

        expect(info.version).toBe(compatibility.openclawVersion);
        expect(O.getOrThrow(info.commit)).toBe(compatibility.openclawCommit);
      }),
      120_000
    );

    it.effect(
      "accepts the rendered golden intent with plugin-aware config validate",
      Effect.fnUntraced(function* () {
        const cli = yield* OpenclawCli;
        const bench = yield* OpenclawItWorkbench;
        const configPath = yield* writeRenderedGoldenConfig(bench, "golden-openclaw.json");
        const validation = yield* cli.configValidate(workbenchContext(bench, O.some(configPath)));

        expect(validation).toMatchObject({ _tag: "Valid" });
      }),
      120_000
    );

    it.effect(
      "rejects every negative fixture with config validate",
      Effect.fnUntraced(function* () {
        const cli = yield* OpenclawCli;
        const bench = yield* OpenclawItWorkbench;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;

        yield* Effect.forEach(
          negativeFixtureNames,
          Effect.fnUntraced(function* (fixtureName) {
            const fixtureJson = yield* fs.readFileString(path.join(negativeFixtureDir, `${fixtureName}.json`));
            const configPath = path.join(bench.configDir, `negative-${fixtureName}.json`);
            yield* fs.writeFileString(configPath, pipe(fixtureJson, Str.replaceAll(placeholderRoot, bench.rootDir)));
            const validation = yield* cli.configValidate(workbenchContext(bench, O.some(configPath)));

            expect({ fixture: fixtureName, tag: validation._tag }).toEqual({ fixture: fixtureName, tag: "Invalid" });
          })
        );
      }),
      240_000
    );

    it.effect(
      "exports a config schema without lossy placeholders for declared surfaces",
      Effect.fnUntraced(function* () {
        const cli = yield* OpenclawCli;
        const bench = yield* OpenclawItWorkbench;
        const configPath = yield* writeRenderedGoldenConfig(bench, "golden-schema-probe.json");
        const schemaExport = yield* cli.configSchema(workbenchContext(bench, O.some(configPath)));
        const findings = findLossySchemaPlaceholders(schemaExport, declaredExtensionSurfaces(workbenchIntent(bench)));

        expect(findings).toEqual([]);
      }),
      120_000
    );
  });
});
