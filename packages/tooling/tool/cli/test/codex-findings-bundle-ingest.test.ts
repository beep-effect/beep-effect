import { findingsCommand, runCodexFindingsIngest } from "@beep/repo-cli/commands/Codex";
import { SECURITY_PACKAGE_VERSION, SECURITY_PLUGIN_VERSION } from "@beep/repo-cli/test/Codex";
import { Sha256HexFromBytes } from "@beep/schema";
import { A, O, Str } from "@beep/utils";
import { NodeChildProcessSpawner, NodeCrypto } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, FileSystem, Layer, Path } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";
import { NodeTestLayer, withTempWorkingDirectory } from "./support/CommandTest.ts";

const encode = S.encodeEffect(S.fromJsonString(S.Unknown));
const hash = S.decodeEffect(Sha256HexFromBytes);

// Bundle ingest hashes sealed artifacts and spawns the pinned upstream
// validator, so the command needs crypto, a spawner, and a console to print to.
const testLayer = Layer.mergeAll(NodeCrypto.layer, NodeChildProcessSpawner.layer, TestConsole.layer).pipe(
  Layer.provideMerge(NodeTestLayer)
);

const runFindingsCommand = Command.runWith(findingsCommand, { version: "0.0.0" });

const SLUG = "codex-security-findings-2026-09-16-local";
// Secret-shaped text in a report body is the finding, not a leak: it must reach
// the ignored raw evidence file and no tracked document.
const TOKEN = "TOKEN=abc123def456";

/** A sealed scan directory carrying one finding with secret-shaped evidence. */
const sealedBundle = Effect.fn("BundleIngestTest.sealedBundle")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped();
  const findings = {
    documentType: "codex-security.findings",
    schemaVersion: "1.0",
    scanId: "scan-bundle-ingest",
    findings: [
      {
        findingId: "csf_aaaaaaaaaaaaaaaaaaaaaaaa",
        occurrenceId: "occ_bbbbbbbbbbbbbbbbbbbbbbbb",
        fingerprints: { algorithm: "codex-security/v1", primary: `codex-security/v1:sha256:${Str.repeat(64)("c")}` },
        title: "Synthetic sealed bundle finding",
        summary: `Hard-coded ${TOKEN} in config.`,
        severity: { level: "medium" },
        locations: [{ path: "src/example.ts", startLine: 1 }],
        remediation: "Validate the input.",
      },
    ],
  };
  const coverage = {
    documentType: "codex-security.coverage",
    schemaVersion: "1.0",
    scanId: "scan-bundle-ingest",
    completeness: "complete",
    includePaths: ["src"],
    excludePaths: [],
    deferred: [],
    explicitExclusions: [],
  };
  const artifacts = yield* Effect.forEach(
    [
      { path: "findings.json", contents: findings },
      { path: "coverage.json", contents: coverage },
    ],
    Effect.fnUntraced(function* (artifact: { readonly path: string; readonly contents: unknown }) {
      const text = yield* encode(artifact.contents);
      yield* fs.writeFileString(path.join(root, artifact.path), text);
      return {
        path: artifact.path,
        sha256: yield* hash(new TextEncoder().encode(text)),
        mediaType: "application/json",
      };
    })
  );
  const manifest = {
    documentType: "codex-security.scan-manifest",
    schemaVersion: "1.0",
    scan: {
      id: "scan-bundle-ingest",
      producer: { name: "codex-security-plugin", version: SECURITY_PLUGIN_VERSION },
      status: "completed",
      startedAt: "2026-09-16T01:00:00Z",
      completedAt: "2026-09-16T01:01:00Z",
      sealedAt: "2026-09-16T01:01:01Z",
      target: {
        kind: "git_revision",
        revision: Str.repeat(40)("a"),
        remote: "https://github.com/example/project.git",
        targetId: "bundle-ingest-target",
      },
      scope: { includePaths: ["src"], excludePaths: [] },
      coverageRef: "coverage.json",
      findingsRef: "findings.json",
      artifacts,
    },
  };
  yield* fs.writeFileString(path.join(root, "scan-manifest.json"), yield* encode(manifest));
  return root;
});

/**
 * A stub install of the pinned Security package, selected through a scoped
 * `HOME`. The stub never scans and never opens a socket: it only reports the
 * exit code the upstream contract check would have reported.
 */
const pinnedRuntime = Effect.fn("BundleIngestTest.pinnedRuntime")(function* (exitCode: number) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const home = yield* fs.makeTempDirectoryScoped();
  const packageRoot = path.join(
    home,
    ".cache/beep/codex-security",
    SECURITY_PACKAGE_VERSION,
    "node_modules/@openai/codex-security"
  );
  yield* fs.makeDirectory(path.join(packageRoot, "bin"), { recursive: true });
  yield* fs.makeDirectory(path.join(packageRoot, "_bundled_plugin/.codex-plugin"), { recursive: true });
  yield* fs.writeFileString(
    path.join(packageRoot, "package.json"),
    `{"name":"@openai/codex-security","version":"${SECURITY_PACKAGE_VERSION}"}`
  );
  yield* fs.writeFileString(
    path.join(packageRoot, "_bundled_plugin/.codex-plugin/plugin.json"),
    `{"name":"codex-security","version":"${SECURITY_PLUGIN_VERSION}"}`
  );
  yield* fs.writeFileString(path.join(packageRoot, "bin/codex-security.mjs"), `process.exit(${exitCode})\n`);
  return ConfigProvider.fromEnv({ env: { HOME: home, PATH: process.env.PATH ?? "" } });
});

/** A repository-shaped working directory the packet can be written into. */
const withRepository = <A, E, R>(use: Effect.Effect<A, E, R>) =>
  withTempWorkingDirectory(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.makeDirectory(".git", { recursive: true });
      yield* fs.makeDirectory("goals", { recursive: true });
      return yield* use;
    })
  );

const ingestOptions = (from: string, overrides: Record<string, unknown> = {}) => ({
  source: "security-bundle" as const,
  from,
  slug: O.none<string>(),
  date: O.none<string>(),
  branch: O.none<string>(),
  expectedCount: O.none<number>(),
  refresh: false,
  force: false,
  dryRun: false,
  json: false,
  ...overrides,
});

const printedLines = Effect.map(TestConsole.logLines, (lines) => A.filter(lines, P.isString));

it.layer(testLayer, { timeout: "60 seconds" })("codex findings sealed bundle ingest", (it) => {
  it.effect(
    "writes a local packet from a sealed bundle and keeps its raw evidence untracked",
    Effect.fnUntraced(function* () {
      const provider = yield* pinnedRuntime(0);
      const bundle = yield* sealedBundle();

      yield* withRepository(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* runFindingsCommand(["ingest", "--source", "security-bundle", "--from", bundle]).pipe(
            Effect.provideService(ConfigProvider.ConfigProvider, provider)
          );

          const evidence = yield* fs.readFileString(`goals/${SLUG}/raw/security-bundle.json`);
          expect(evidence).toContain(TOKEN);
          const goal = yield* fs.readFileString(`goals/${SLUG}/GOAL.md`);
          expect(goal).not.toContain(TOKEN);
          expect(goal).toContain("Do not close cloud dashboard IDs");

          const lines = yield* printedLines;
          expect(A.some(lines, Str.includes("report body/bodies carry sensitive-shaped text"))).toBe(true);
          expect(A.some(lines, Str.includes(`✓ packet   goals/${SLUG}`))).toBe(true);
        })
      );
    })
  );

  it.effect(
    "plans an overridden slug and branch as machine JSON without writing the packet",
    Effect.fnUntraced(function* () {
      const provider = yield* pinnedRuntime(0);
      const bundle = yield* sealedBundle();

      yield* withRepository(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* runCodexFindingsIngest(
            ingestOptions(bundle, {
              slug: O.some("codex-security-findings-local-override"),
              branch: O.some("security/codex-bundle-override"),
              expectedCount: O.some(1),
              dryRun: true,
              json: true,
            })
          ).pipe(Effect.provideService(ConfigProvider.ConfigProvider, provider));

          expect(yield* fs.exists("goals/codex-security-findings-local-override")).toBe(false);

          // The same plan again, rendered for a human: machine JSON goes to
          // stdout rather than the console service, so the lines are asserted
          // from the human branch.
          yield* runCodexFindingsIngest(
            ingestOptions(bundle, {
              slug: O.some("codex-security-findings-local-override"),
              branch: O.some("security/codex-bundle-override"),
              expectedCount: O.some(1),
              dryRun: true,
            })
          ).pipe(Effect.provideService(ConfigProvider.ConfigProvider, provider));

          const lines = yield* printedLines;
          expect(
            A.some(lines, Str.includes("• dry run  goals/codex-security-findings-local-override not written"))
          ).toBe(true);
          expect(yield* fs.exists("goals/codex-security-findings-local-override")).toBe(false);
        })
      );
    })
  );

  it.effect(
    "refuses the cloud-only refresh, force, and date modes on the bundle path",
    Effect.fnUntraced(function* () {
      const bundle = yield* sealedBundle();

      yield* withRepository(
        Effect.gen(function* () {
          for (const overrides of [{ refresh: true }, { force: true }, { date: O.some("2026-09-16") }]) {
            const error = yield* Effect.flip(runCodexFindingsIngest(ingestOptions(bundle, overrides)));
            expect(error.message).toContain("--refresh, --force, or --date");
          }
        })
      );
    })
  );

  it.effect(
    "writes nothing when the pinned upstream exporter rejects the sealed contract",
    Effect.fnUntraced(function* () {
      const provider = yield* pinnedRuntime(1);
      const bundle = yield* sealedBundle();

      yield* withRepository(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const error = yield* Effect.flip(
            runCodexFindingsIngest(ingestOptions(bundle)).pipe(
              Effect.provideService(ConfigProvider.ConfigProvider, provider)
            )
          );
          expect(error.message).toContain("rejected the sealed bundle contract");
          expect(yield* fs.exists(`goals/${SLUG}`)).toBe(false);
        })
      );
    })
  );

  it.effect(
    "names both capture sources when invoked without a subcommand",
    Effect.fnUntraced(function* () {
      yield* runFindingsCommand([]);

      const lines = yield* printedLines;
      expect(A.some(lines, Str.includes("--source security-bundle --from <sealed-scan-directory>"))).toBe(true);
    })
  );
});
