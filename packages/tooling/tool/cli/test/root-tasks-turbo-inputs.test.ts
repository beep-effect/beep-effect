import { GlobPattern } from "@beep/glob/GlobPattern";
import { $RepoCliId } from "@beep/identity/packages";
import {
  EffectImportsCodeGlobs,
  EffectImportsCodeOnlyExcludedDirectories,
  EffectImportsMarkdownGlobs,
  EffectImportsMarkdownOnlyExcludedDirectories,
  EffectImportsPrunedDirectoryNames,
} from "@beep/repo-cli/commands/Laws/EffectImports";
import {
  EffectVitestConfigFileGlobs,
  EffectVitestInventoryPath,
  EffectVitestPrimitiveGraphPath,
  EffectVitestSourceFileGlobs,
} from "@beep/repo-cli/commands/Lint";
import { ReportOnlyInertLaneId } from "@beep/repo-cli/commands/Quality";
import { StepExec } from "@beep/repo-cli/test/PackageScripts";
import { isPackageSourceFile, TurboConfigProofTaskName } from "@beep/repo-cli/test/Quality";
import { FsUtilsLive, findRepoRoot, jsonStringifyPretty } from "@beep/repo-utils";
import { WorkspacePatterns } from "@beep/repo-workspaces/WorkspacePatterns";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { fcRuns } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { Project, SyntaxKind } from "ts-morph";

const $I = $RepoCliId.create("test/root-tasks-turbo-inputs");
const fingerprintId = "//#lint:policy-fingerprint";
// Generated seal tasks are script-less `@beep/repo-cli` tasks owned and checked by `beep lint policy-fingerprint`.
const isSealId = Str.startsWith("@beep/repo-cli#lint:policy-fingerprint:");
const turboRoot = "$TURBO_ROOT$/";
const nonInput = ".beep/c3-fixture-excluded.bin";
const PlatformLayer = FsUtilsLive.pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)));
const isProofTaskName = S.is(TurboConfigProofTaskName);
const Strings = S.Array(S.String).pipe(S.withDecodingDefaultKey(Effect.succeed([])));

// These domains are disjoint from accepted docs/reports/*.md changes. The
// shared glob compiler proves literalness; patterns and every other config
// input remain exact, including literal Markdown outside the accepted roots.
const GeneratedSourceInput = S.String.check(
  S.isPattern(
    /^\$TURBO_ROOT\$\/(?:apps|packages|infra|scratchpad|tools|scripts|goals|explorations|research|\.claude|\.github)\/.*\.(?:[cm]?[jt]sx?)$/u
  ),
  S.isTrimmed()
).pipe(
  $I.annoteSchema("GeneratedSourceInput", {
    description: "One generated source literal outside accepted report paths.",
  })
);
const GeneratedWorkspaceManifestInput = S.String.check(
  S.isPattern(
    /^\$TURBO_ROOT\$\/(?:apps|packages|infra|scratchpad|tools)\/(?:[\p{L}\p{N}_-][\p{L}\p{N}_.-]*\/)*package\.json$/u
  ),
  S.isTrimmed()
).pipe(
  $I.annoteSchema("GeneratedWorkspaceManifestInput", {
    description: "One literal workspace package.json, disjoint from Markdown report changes.",
  })
);
const SupportedWorkspacePattern = S.String.check(
  S.isPattern(/^!?(?:apps|packages|infra|scratchpad|tools)(?:\/(?:[\p{L}\p{N}_-][\p{L}\p{N}_.-]*|\*|\*\*))*$/u),
  S.isTrimmed()
).pipe(
  $I.annoteSchema("SupportedWorkspacePattern", {
    description: "Workspace pattern confined to the scanner guard's existing root domains.",
  })
);
const isGeneratedSourceInput = S.is(GeneratedSourceInput);
const isGeneratedWorkspaceManifestInput = S.is(GeneratedWorkspaceManifestInput);
const isSupportedWorkspacePattern = S.is(SupportedWorkspacePattern);
const workspaceRootDomains = (patterns: ReadonlyArray<string>) => {
  const normalized = WorkspacePatterns.forMatching(patterns);
  if (!A.every(normalized, isSupportedWorkspacePattern)) return O.none<ReadonlyArray<string>>();
  return O.some(
    A.sort(
      A.dedupe(A.map(normalized, (pattern) => Str.split(Str.replace(/^!/u, "")(pattern), "/")[0] ?? "")),
      Order.String
    )
  );
};
const DeclarationRecord = S.Record(S.String, S.Unknown).pipe(
  $I.annoteSchema("DeclarationRecord", {
    description: "Raw task declaration retaining unknown configuration fields in the qualification contract.",
  })
);
const decodeDeclarationRecord = S.decodeUnknownEffect(DeclarationRecord);
const normalizeReportOnlyDeclaration = Effect.fn("normalizeReportOnlyDeclaration")(function* (
  id: string,
  raw: unknown,
  inputs: ReadonlyArray<string>
) {
  if (!isSealId(id)) return raw;
  const task = yield* decodeDeclarationRecord(raw);
  const classified = yield* Effect.forEach(inputs, (input) =>
    GlobPattern.compile(input).pipe(
      Effect.map((pattern) => {
        const kind = pattern.literalPath.pipe(
          O.filter((literal) => isGeneratedSourceInput(literal) || isGeneratedWorkspaceManifestInput(literal)),
          O.map((literal) => (isGeneratedSourceInput(literal) ? "source" : "workspace-manifest"))
        );
        return Tuple.make(input, kind);
      })
    )
  );
  return {
    task: {
      ...task,
      inputs: A.map(
        A.filter(classified, ([, kind]) => O.isNone(kind)),
        Tuple.get(0)
      ),
    },
    reportDisjointLiteralInputClasses: A.sort(A.dedupe(A.getSomes(A.map(classified, Tuple.get(1)))), Order.String),
  };
});

class RootTask extends S.Opaque<RootTask, { readonly brand: unique symbol }>()(
  S.Struct({
    cache: S.Boolean,
    inputs: S.Array(S.String),
    outputs: Strings,
    dependsOn: Strings,
    env: Strings,
    passThroughEnv: Strings,
  }).pipe($I.annoteSchema("RootTask", { description: "Root task declarations copied into the real Turbo fixture." }))
) {}
class TaskSummary extends S.Opaque<TaskSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    taskId: S.String,
    hash: S.String,
    inputs: S.Record(S.String, S.String),
    dependencies: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("TaskSummary", {
      description: "Observed hashes and input membership from Turbo, never synthesized hashes.",
    })
  )
) {}
// `agentGuidance` must reach the fixture: under an agent-detected environment Turbo 2.11.5+
// otherwise writes an untracked AGENTS.md before every run, which is a declared input of the
// knowledge rows and would select them under --affected.
class SealTask extends S.Opaque<SealTask, { readonly brand: unique symbol }>()(
  S.Struct({ inputs: Strings, dependsOn: Strings }).pipe(
    $I.annoteSchema("SealTask", { description: "A generated seal task's inputs and parent edge." })
  )
) {}
const decodeSeal = S.decodeUnknownEffect(SealTask);
const Configuration = S.Struct({
  tasks: S.Record(S.String, S.Unknown),
  global: S.Unknown,
  futureFlags: S.Unknown,
  agentGuidance: S.Boolean,
});
const Manifest = S.Struct({ scripts: S.Record(S.String, S.String) });
const Summary = S.Struct({ tasks: S.Array(TaskSummary) });
const decodeConfiguration = S.decodeEffect(S.fromJsonString(Configuration));
const decodeManifest = S.decodeEffect(S.fromJsonString(Manifest));
const decodeTask = S.decodeUnknownEffect(RootTask);
const decodeSummary = S.decodeEffect(S.fromJsonString(Summary));
const encodeTaskSummary = S.encodeEffect(S.fromJsonString(TaskSummary));
const decodeTaskSummary = S.decodeEffect(S.fromJsonString(TaskSummary));
const encodeRootTask = S.encodeEffect(S.fromJsonString(RootTask));
const decodeRootTask = S.decodeEffect(S.fromJsonString(RootTask));
const taskSummaryEquivalent = S.toEquivalence(TaskSummary);
const rootTaskEquivalent = S.toEquivalence(RootTask);
const fixtureArbitrary = Arbitrary.all([Arbitrary.schema(TaskSummary), Arbitrary.schema(RootTask)]);

// One direct read per §2.2 row, including expanded Fallow rows. These are independent
// probes, not strings derived from the input globs whose behavior we are testing.
// Goals doctor reads history and clock; tracked-file discovery also remains
// fresh until its index state and actual scanner behavior are qualified.
// Fallow rows retain their existing cache policy except the base-ref-dependent audit.
const trackedDiscoveryTasks = LiteralKit([
  "lint:opaque-roundtrips",
  "lint:entity-kit-freeze",
  "lint:retired-effect-paths",
  "lint:retired-iri-authorities",
  "lint:private-home-paths",
  "lint:tracked-shell-allowlist",
  "lint:no-tracked-python",
  "lint:markdown-fences",
  "lint:schema-tag-idioms",
  "lint:jsdoc-module-tags",
  "lint:effect-imports-markdown",
]);
const nonReusableTasks: ReadonlyArray<string> = [
  ...trackedDiscoveryTasks.literals,
  "knowledge:semantic-delta",
  "knowledge:refs-check",
  "lint:oxlint",
  "lint:shadcn",
  "goals:doctor",
  "lint:typos",
  "fallow:audit:check",
  "changeset:status",
  "repo-sanity:bun-audit",
];

const directInputs: Readonly<Record<string, string>> = {
  "lint:policy-fingerprint": "standards/policy-tools.fingerprint.json",
  "lint:jsdoc:root": "infra/standalone/c3-probe.ts",
  "lint:native-runtime:roots": "scratchpad/c3-probe.ts",
  "lint:package-scripts": "packages/fixture/vitest.config.ts",
  "knowledge:semantic-delta": "docs/c3-probe.md",
  "knowledge:refs-check": "docs/c3-probe.md",
  "lint:schema-first": "standards/schema-first.inventory.jsonc",
  "lint:schema-catalog": "standards/schema-catalog/@fixture/member.generated.jsonc",
  "lint:identity-registry": "tools/fixture/c3-probe.ts",
  "lint:circular": "packages/foundation/fixture/src/c3-probe.ts",
  "lint:effect-imports": "apps/fixture/c3-probe.mts",
  "lint:effect-imports-markdown": ".patterns/c3-probe.md",
  "lint:markdown-fences": "packages/fixture/README.md",
  "lint:retired-effect-paths": "explorations/fixture/c3-probe.json",
  "lint:entity-kit-freeze": "packages/fixture/src/c3-entity-probe.tsx",
  "lint:retired-iri-authorities": "goals/fixture/c3-probe.ttl",
  "lint:private-home-paths": "apps/fixture/c3-probe.log",
  "lint:tracked-shell-allowlist": "tools/fixture/c3-probe.sh",
  "lint:no-tracked-python": "tools/fixture/c3-probe.py",
  "lint:schema-tag-idioms": "scratchpad/fixture/c3-probe.cts",
  "lint:holds": "hold-ledger/claims.jsonl",
  "lint:tsgo-rules": "tooling/c3-probe.cts",
  "lint:oxlint": "scripts/c3-probe.ts",
  "lint:deprecated-imports": "packages/fixture/src/c3-probe.ts",
  "lint:shadcn": ".oxlintrc.shadcn.json",
  "lint:ecosystem-polarity": "packages/ecosystem/fixture/src/c3-probe.mts",
  "lint:allowlist": "standards/effect-laws.allowlist.jsonc",
  "lint:jsdoc-module-tags": "tooling/c3-probe.hbs",
  "goals:doctor": "goals/fixture/GOAL.md",
  "goals:index-check": "goals/fixture/GOAL.md",
  "lint:reflection-artifacts": "goals/fixture/history/reflections/c3-probe.md",
  "lint:roadmap-refs": "docs/ROADMAP.md",
  "lint:judge-rubric": ".claude/skills/browser-qa-loop/resources/judge-prompt.md",
  "lint:typos": "docs/c3-probe.md",
  "fallow:audit:check": ".fallow/plugins/c3-probe.ts",
  "fallow:dead-code:check": ".fallow/plugins/c3-probe.ts",
  "fallow:health:check": ".fallow/plugins/c3-probe.ts",
  "fallow:health:advisory": ".fallow/plugins/c3-probe.ts",
  "fallow:boundaries:advisory": ".fallow/plugins/c3-probe.ts",
  "fallow:flags:advisory": ".fallow/plugins/c3-probe.ts",
  "fallow:security:advisory": ".fallow/plugins/c3-probe.ts",
  "fallow:fix-preview:advisory": ".fallow/plugins/c3-probe.ts",
  "jsdoc:inventory:check": "packages/fixture/docgen.json",
  "lint:tsconfig-overlay": "packages/fixture/tsconfig.check.json",
  "lint:package-test-typecheck": "standards/test-typecheck.blindspot-baseline.jsonc",
  "lint:effect-vitest": "standards/effect-vitest.inventory.jsonc",
  "lint:opaque-roundtrips": "packages/fixture/test/opaque.test.ts",
  "jsdoc:ratchet:check": "standards/jsdoc-totals.regression-baseline.jsonc",
  "changeset:status": ".changeset/c3-probe.md",
  "config-sync:check": "packages/fixture/docgen.json",
  "repo-sanity:changeset-graph": ".changeset/c3-probe.md",
  "repo-sanity:syncpack": "syncpack.config.ts",
  "repo-sanity:sherif": "packages/fixture/package.json",
  "repo-sanity:versions": "mise.toml",
  "repo-sanity:bun-audit": "osv-scanner.toml",
  "fallow:boundaries:config-check": "standards/fallow.boundaries.generated.jsonc",
  "topo-sort": "packages/fixture/package.json",
};

const writeFile = Effect.fn("RootTasksFixture.writeFile")(function* (root: string, file: string, text: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(root, file);
  yield* fs.makeDirectory(path.dirname(target), { recursive: true });
  yield* fs.writeFileString(target, text);
});
const writeJson = Effect.fn("RootTasksFixture.writeJson")(function* (root: string, file: string, value: unknown) {
  yield* writeFile(root, file, `${yield* jsonStringifyPretty(value)}\n`);
});
const rootScriptName = Str.slice(3);
const isFallowEnvelope = (name: string): boolean =>
  Str.startsWith("fallow:")(name) && name !== "fallow:boundaries:config-check";
const expectsFingerprintEdge = (id: string, script: string): boolean =>
  id !== fingerprintId &&
  (Str.startsWith("bun run beep")(script) || Str.startsWith("beep-cli")(script) || id === "//#repo-sanity:versions");
const expectedOutputs = (id: string, name: string): ReadonlyArray<string> => {
  if (isFallowEnvelope(name)) {
    const lane = O.getOrThrow(A.get(Str.split(":")(name), 1));
    const mode = Str.endsWith(":check")(name) ? "check" : "advisory";
    return [`.beep/fallow/${lane}.${mode}.json`, `.beep/fallow/raw/${lane}.${mode}.*`];
  }
  return id === "//#jsdoc:inventory:check" ? [".beep/ci/jsdoc-documentation.inventory.*"] : [];
};
// One row of the §2.2 contract: script presence, fingerprint edge, cache flag, env and outputs.
const expectRootTaskContract = (id: string, task: RootTask, scripts: Readonly<Record<string, string>>): void => {
  const name = rootScriptName(id);
  expect(isProofTaskName(id), id).toBe(true);
  expect(R.has(directInputs, name), id).toBe(true);
  expect(R.has(scripts, name), id).toBe(true);
  if (expectsFingerprintEdge(id, O.getOrThrow(R.get(scripts, name)))) {
    // Exactly one generated seal per policy task; the JSDoc ratchet also compares
    // the inventory its producer task restores from cache.
    expect(A.length(A.filter(task.dependsOn, isSealId)), id).toBe(1);
    expect(
      A.filter(task.dependsOn, (dependency) => !isSealId(dependency)),
      id
    ).toEqual(id === "//#jsdoc:ratchet:check" ? ["//#jsdoc:inventory:check"] : []);
  }
  expect(task.cache, id).toBe(!A.contains(nonReusableTasks, name));
  const environment = Match.value(name).pipe(
    Match.when(isFallowEnvelope, () => ["BEEP_PROOF_BASE"]),
    Match.when(S.is(trackedDiscoveryTasks), () => ["BEEP_CACHE_TOOLCHAIN_DIGEST"]),
    Match.orElse(() => [])
  );
  expect(task.env, id).toEqual(environment);
  expect(task.passThroughEnv, id).toEqual(id === "//#knowledge:semantic-delta" ? ["GITHUB_EVENT_PATH"] : []);
  expect(task.outputs, id).toEqual(expectedOutputs(id, name));
};

const fixture = Effect.fn("RootTasksFixture.make")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repo = yield* findRepoRoot();
  const readFileString1 = yield* fs.readFileString(path.join(repo, "turbo.json"));
  const configuration = yield* decodeConfiguration(readFileString1);
  expect(configuration.agentGuidance).toBe(false);
  const readFileString2 = yield* fs.readFileString(path.join(repo, "package.json"));
  const manifest = yield* decodeManifest(readFileString2);
  const rootEntries = yield* Effect.forEach(
    A.filter(R.toEntries(configuration.tasks), ([id]) => Str.startsWith("//#")(id) && !isSealId(id)),
    Effect.fnUntraced(function* ([id, raw]) {
      const decodedTask3 = yield* decodeTask(raw);
      return Tuple.make(id, decodedTask3);
    })
  );
  const seals = R.fromEntries(A.filter(R.toEntries(configuration.tasks), ([id]) => isSealId(id)));
  const forEach4 = yield* Effect.forEach(
    R.toEntries(seals),
    Effect.fnUntraced(function* ([id, raw]) {
      const decodedSeal = yield* decodeSeal(raw);
      return Tuple.make(id, decodedSeal);
    })
  );
  const decodedSeals = R.fromEntries(forEach4);
  const tasks = R.fromEntries(rootEntries);
  expect(A.length(rootEntries)).toBe(A.length(R.keys(directInputs)));
  for (const [id, task] of rootEntries) {
    expectRootTaskContract(id, task, manifest.scripts);
  }
  const root = yield* fs.makeTempDirectoryScoped({ directory: "/tmp", prefix: "root-tasks-turbo-" });
  yield* writeFile(root, ".gitignore", "node_modules\n.turbo\n");
  yield* writeJson(root, "package.json", {
    name: "root-tasks-fixture",
    private: true,
    packageManager: "bun@1.4.2",
    workspaces: ["packages/fixture", "packages/tooling/tool/cli"],
    scripts: manifest.scripts,
  });
  // The seals belong to the CLI workspace; a manifest is all Turbo needs to host them.
  yield* writeJson(root, "packages/tooling/tool/cli/package.json", { name: "@beep/repo-cli", private: true });
  yield* Effect.forEach(A.dedupe([...R.values(directInputs), nonInput]), (file) => writeFile(root, file, "{}\n"));
  yield* writeJson(root, "packages/fixture/package.json", { name: "@fixture/member" });
  // Candidate tool reads omitted from many direct row inputs, but carried by D15.
  // All are real entries in the production fingerprint declaration.
  yield* Effect.forEach(closureInputs, (file) => writeFile(root, file, "{}\n"));
  yield* writeJson(root, "turbo.json", { ...configuration, tasks: { ...tasks, ...seals } });
  return { root, tasks, seals: decodedSeals, binary: path.join(repo, "node_modules/.bin/turbo") };
});
// Candidate tool reads: the CLI shell (shared by every command) and root checker configuration, which
// the fingerprint routes to the seals whose closure reads it. All are real production seal inputs.
const closureInputs = [
  ".fallowrc.jsonc",
  ".oxlintrc.json",
  "_typos.toml",
  "biome.jsonc",
  "tsdoc.json",
  "packages/tooling/tool/cli/src/bin-main.ts",
];
// A seal input without its root prefix; a negated glob keeps its leading `!`.
const sealInput = (input: string): string =>
  Str.startsWith("!")(input)
    ? `!${Str.slice(1 + Str.length(turboRoot))(input)}`
    : Str.slice(Str.length(turboRoot))(input);
// Every root-relative input a seal chain declares.
const chainInputs = (seals: Readonly<Record<string, SealTask>>, id: string): ReadonlyArray<string> =>
  O.match(R.get(seals, id), {
    onNone: A.empty<string>,
    onSome: (seal) => [
      ...A.map(seal.inputs, sealInput),
      ...A.flatMap(seal.dependsOn, (parent) => chainInputs(seals, parent)),
    ],
  });
const dryRun = Effect.fn("RootTasksFixture.dryRun")(function* (
  root: string,
  binary: string,
  taskIds: ReadonlyArray<string>,
  affected: boolean
) {
  const result = yield* StepExec.runCaptured({
    command: binary,
    args: ["run", ...taskIds, "--dry-run=json", "--cache=local:rw", ...(affected ? ["--affected"] : [])],
    cwd: root,
    source: "stdout",
    timeout: "30 seconds",
    extendEnv: true,
    env: { TURBO_TELEMETRY_DISABLED: "1", TURBO_UI: "stream", TURBO_SCM_BASE: "base", TURBO_SCM_HEAD: "HEAD" },
  });
  expect(result.exitCode, result.output).toBe(0);
  expect(result.truncated).toBe(false);
  // Seal rows ride along as dependencies; they are reported only when requested.
  return A.filter(
    (yield* decodeSummary(result.output)).tasks,
    (row) => !isSealId(row.taskId) || A.contains(taskIds, row.taskId)
  );
});
const rowFor = (rows: ReadonlyArray<TaskSummary>, id: string) =>
  O.getOrThrow(A.findFirst(rows, (row) => row.taskId === id));
const mutate = Effect.fn("RootTasksFixture.mutate")(function* <E, R>(
  root: string,
  file: string,
  check: Effect.Effect<void, E, R>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const original = yield* fs.readFileString(path.join(root, file));
  yield* writeFile(root, file, `${original}\n`);
  yield* check.pipe(Effect.ensuring(writeFile(root, file, original).pipe(Effect.orDie)));
});

const git = Effect.fn("RootTasksFixture.git")(function* (root: string, args: ReadonlyArray<string>) {
  const result = yield* StepExec.runCaptured({
    command: "git",
    args,
    cwd: root,
    source: "stdout",
    extendEnv: true,
  });
  expect(result.exitCode, result.output).toBe(0);
  return result;
});
const commit = (root: string) =>
  git(root, [
    "-c",
    "user.name=Turbo Fixture",
    "-c",
    "user.email=turbo-fixture@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "--no-verify",
    "-m",
    "fixture",
  ]);
const initializeGit = Effect.fn("RootTasksFixture.initializeGit")(function* (root: string) {
  yield* git(root, ["init", "--initial-branch=main"]);
  yield* writeFile(root, "README.md", "fixture base\n");
  yield* git(root, ["add", "."]);
  yield* commit(root);
  yield* git(root, ["branch", "base"]);
  yield* writeFile(root, "README.md", "fixture readme change\n");
  yield* git(root, ["add", "README.md"]);
  yield* commit(root);
  expect((yield* git(root, ["status", "--porcelain"])).output).toBe("");
});
const selectedIds = (rows: ReadonlyArray<TaskSummary>) =>
  A.sort(
    A.map(rows, (row) => row.taskId),
    Str.Order
  );
const withDependencies = (ids: ReadonlyArray<string>, rows: ReadonlyArray<TaskSummary>) =>
  A.sort(
    A.dedupe([
      ...ids,
      ...A.filter(
        A.flatMap(ids, (id) => rowFor(rows, id).dependencies),
        (id) => !isSealId(id)
      ),
    ]),
    Str.Order
  );

describe("Stage C root task inputs", { concurrent: false }, () => {
  it.effect.prop(
    "round-trips the fixture's schema-derived rows through JSON",
    [fixtureArbitrary],
    Effect.fnUntraced(function* ([[summary, task]]) {
      const encodedSummary = yield* encodeTaskSummary(summary);
      const decodedSummary = yield* decodeTaskSummary(encodedSummary);
      expect(taskSummaryEquivalent(decodedSummary, summary)).toBe(true);
      const encodedTaskSummary = yield* encodeTaskSummary(decodedSummary);
      expect(encodedTaskSummary).toBe(encodedSummary);
      const encodedTask = yield* encodeRootTask(task);
      const decodedTask = yield* decodeRootTask(encodedTask);
      expect(rootTaskEquivalent(decodedTask, task)).toBe(true);
      const encodedRootTask = yield* encodeRootTask(decodedTask);
      expect(encodedRootTask).toBe(encodedTask);
    }),
    { arbitrary: fcRuns(25) }
  );

  it.layer(PlatformLayer, { timeout: "30 seconds" })("report-only source input contract", (it) => {
    it.effect("requires input-closure review when qualified scanner implementations change", () =>
      Effect.gen(function* () {
        const repo = yield* findRepoRoot();
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const digest = yield* Digest.Digest;
        // These are reviewed consumer implementations, never ordinary application
        // sources or workspace membership. A changed seal requires input-closure
        // review and controls before updating the expected value.
        const consumers = [
          Tuple.make(
            "packages/foundation/capability/walker/src/Expand.ts",
            "27393369d43732e128561717062b07d9a5862e7c21fa82ca10e5f3167bdcb93b"
          ),
          Tuple.make(
            "packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts",
            "03ea7c99c6e3eaa10e4dada1a7acd1641cabb62bfd7aa2a21f39638c8bf4adee"
          ),
          Tuple.make(
            "packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts",
            "ba71424c438ad763704deab9814761d4b97429d69bf6f439e0bb7c5f8abbf279"
          ),
          Tuple.make(
            "packages/tooling/tool/cli/src/commands/Quality/internal/JSDocRatchet.ts",
            "a233fd811b0d00f98032c13ba5a2346fc57b72e80c5656dc033ff6df063a137a"
          ),
          Tuple.make(
            "packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts",
            "79365873c3aa467a84ba0801b91806f71fda7e2698b22c34b6c04f32802ed5ff"
          ),
          Tuple.make(
            "packages/tooling/library/repo-cli-kit/src/tsmorph/ProjectFactory.ts",
            "f18f549174c1c8a57db6438aedf0aef5e90d287ae1a7a45668e0740c8ac6bd9a"
          ),
          Tuple.make(
            "packages/foundation/capability/walker/src/Descend.ts",
            "0b116dc99e01c10ca9da12beb9862bd04863c1e7f7862c3eef383c145417188d"
          ),
          Tuple.make(
            "packages/tooling/library/repo-utils/src/FsUtils.ts",
            "137344232f545cdd140c568803cd367b8723fdeb1f47c468e7577ebaeda3161e"
          ),
          Tuple.make(
            "packages/tooling/library/repo-workspaces/src/WorkspacePatterns.ts",
            "ed0556d6b78f97a61f848e66bb125516643945751419ced47594db3ee0672199"
          ),
        ];
        for (const [file, expected] of consumers) {
          const content = yield* fs.readFileString(path.join(repo, file));
          const bytes = yield* digest.digest(Digest.sha256, new TextEncoder().encode(content));
          expect(Hex.encode(bytes), `${file}: re-review report-only scanner input closure`).toBe(expected);
        }
      })
    );

    it.effect("accepts ordinary future source and package additions within supported roots", () =>
      Effect.gen(function* () {
        const id = "@beep/repo-cli#lint:policy-fingerprint:fixture";
        const inputs = [
          "$TURBO_ROOT$/packages/existing/src/index.ts",
          "$TURBO_ROOT$/packages/existing/package.json",
          "tsconfig.json",
        ];
        const raw = { cache: true, inputs, dependsOn: ["shared"], unknownConfig: "preserved" };
        const before = yield* normalizeReportOnlyDeclaration(id, raw, inputs);
        const future = [
          "$TURBO_ROOT$/apps/future/src/index.ts",
          "$TURBO_ROOT$/apps/future/package.json",
          ...inputs,
          "$TURBO_ROOT$/packages/existing/src/index.ts",
          "$TURBO_ROOT$/packages/existing/package.json",
        ];
        const after = yield* normalizeReportOnlyDeclaration(id, { ...raw, inputs: future }, future);
        expect(after).toEqual(before);
        expect(workspaceRootDomains(["apps/existing", "packages/existing"])).toEqual(
          workspaceRootDomains(["apps/existing", "packages/existing", "packages/future", "apps/*"])
        );
      })
    );

    for (const input of [
      "$TURBO_ROOT$/docs/reports/probe.md",
      "$TURBO_ROOT$/docs/reports/**",
      "$TURBO_DEFAULT$",
      "$TURBO_ROOT$/packages/*/src/*.ts",
      "$TURBO_ROOT$/standards/future-config.json",
      "$TURBO_ROOT$/new-root/future.ts",
      "!$TURBO_ROOT$/packages/existing/src/index.ts",
      "$TURBO_ROOT$/packages/{one,two}/src/index.ts",
    ]) {
      it.effect(`keeps unknown or report-related generated input exact: ${input}`, () =>
        Effect.gen(function* () {
          const id = "@beep/repo-cli#lint:policy-fingerprint:fixture";
          const inputs = ["$TURBO_ROOT$/packages/existing/src/index.ts"];
          const before = yield* normalizeReportOnlyDeclaration(id, { cache: true, inputs }, inputs);
          const future = [...inputs, input];
          const after = yield* normalizeReportOnlyDeclaration(id, { cache: true, inputs: future }, future);
          expect(after).not.toEqual(before);
        })
      );
    }
    it.effect("preserves command structure and refuses unsupported workspace roots", () =>
      Effect.gen(function* () {
        const id = "@beep/repo-cli#lint:policy-fingerprint:fixture";
        const inputs = ["$TURBO_ROOT$/packages/existing/src/index.ts"];
        const before = yield* normalizeReportOnlyDeclaration(
          id,
          { cache: true, inputs, dependsOn: ["shared"] },
          inputs
        );
        const changed = yield* normalizeReportOnlyDeclaration(
          id,
          { cache: false, inputs, dependsOn: ["other"], futureConfig: true },
          inputs
        );
        expect(changed).not.toEqual(before);
        const direct = yield* normalizeReportOnlyDeclaration("//#lint:effect-imports", { inputs }, inputs);
        expect(direct).toEqual({ inputs });
        for (const pattern of [
          "future-root/*",
          "docs/reports/*",
          "packages/../../outside",
          "packages/{..,safe}",
          "packages/future\n",
        ])
          assertNone(workspaceRootDomains([pattern]));
      })
    );

    it.effect("locks the selected source tasks and every dependency against prose input expansion", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repo = yield* findRepoRoot();
        // The actual CLI forces the syntax-only Effect leaf-import mode. A
        // handler rewrite must renew this qualification, even if Turbo's raw
        // declarations remain identical.
        const handlerText = yield* fs.readFileString(
          path.join(repo, "packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts")
        );
        const handler = new Project({ useInMemoryFileSystem: true }).createSourceFile("Laws.command.ts", handlerText);
        const calls = A.filter(
          handler.getDescendantsOfKind(SyntaxKind.CallExpression),
          (call) => call.getExpression().getText() === "runEffectImportRules"
        );
        expect(A.length(calls)).toBe(1);
        const options = O.getOrThrow(A.head(calls)).getArguments()[0];
        expect(options?.getText()).toContain("EffectImportRulesOptions.make");
        const effectOnly = A.filter(
          options?.getDescendantsOfKind(SyntaxKind.PropertyAssignment) ?? [],
          (property) => property.getName() === "effectOnly"
        );
        expect(A.map(effectOnly, (property) => property.getInitializer()?.getKind())).toEqual([SyntaxKind.TrueKeyword]);
        const text = yield* fs.readFileString(path.join(repo, "turbo.json"));
        const configuration = yield* decodeConfiguration(text);
        expect(ReportOnlyInertLaneId.literals).toEqual(["quality:jsdoc-ratchet:regenerated", "lint:effect-imports"]);
        let pending: ReadonlyArray<string> = ["//#lint:effect-imports", "//#jsdoc:ratchet:check"];
        let closure = A.empty<readonly [string, unknown]>();
        while (A.isReadonlyArrayNonEmpty(pending)) {
          const id = pending[0];
          pending = A.drop(pending, 1);
          if (A.some(closure, ([seen]) => seen === id)) continue;
          const raw = R.get(configuration.tasks, id).pipe(O.getOrThrow);
          const task = yield* decodeTask(raw);
          expect(task.cache, id).toBe(true);
          expect(A.isReadonlyArrayNonEmpty(task.inputs), id).toBe(true);
          expect(A.contains(task.inputs, "$TURBO_DEFAULT$"), id).toBe(false);
          const normalized = yield* normalizeReportOnlyDeclaration(id, raw, task.inputs);
          closure = A.append(closure, [id, normalized]);
          pending = A.appendAll(pending, task.dependsOn);
        }
        // Structural declarations, patterns, config and dependency edges stay
        // exact. Generated literal sources/manifests are name-disjoint from
        // reports, so ordinary source/package additions need no manual hash.
        const manifestText = yield* fs.readFileString(path.join(repo, "package.json"));
        const rootManifest = yield* decodeManifest(manifestText);
        expect(rootManifest.scripts["lint:effect-imports"]).toBe("bun run beep laws effect-imports --check");
        const workspacePatterns = yield* WorkspacePatterns.read(repo);
        const encoded = yield* jsonStringifyPretty({
          workspaceRoots: O.getOrThrow(workspaceRootDomains(workspacePatterns)),
          global: configuration.global,
          futureFlags: configuration.futureFlags,
          agentGuidance: configuration.agentGuidance,
          closure,
        });
        const digest = yield* Digest.Digest;
        const bytes = yield* digest.digest(Digest.sha256, new TextEncoder().encode(encoded));
        expect(Hex.encode(bytes)).toBe("cd5f5c2fa66d7255480d6d17fb30fbbb01243d71a7abcd6b241ad425a0c11f46");
      })
    );
  });

  it.layer(PlatformLayer, { timeout: "30 seconds" })("native Turbo fixtures", (it) => {
    it.effect("keeps all selected source hashes identical across five report-only edits", () =>
      Effect.gen(function* () {
        const { root, binary } = yield* fixture();
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const ids = ["//#lint:effect-imports", "//#jsdoc:ratchet:check"];
        const baseline = yield* dryRun(root, binary, ids, false);
        for (const file of [
          "docs/reports/probe.md",
          "docs/reports/nested/probe.md",
          "docs/reports/日本語.md",
          "docs/reports/new\nline.md",
          "docs/reports/code-fence.md",
        ]) {
          yield* writeFile(root, file, '```ts\nimport { Effect } from "effect";\n```\n');
          const changed = yield* dryRun(root, binary, ids, false);
          for (const id of ids) expect(rowFor(changed, id).hash, `${id}: ${file}`).toBe(rowFor(baseline, id).hash);
          yield* fs.remove(path.join(root, file));
        }
      })
    );

    it.effect(
      "hashes declared inputs and excludes non-inputs for every registered root task",
      Effect.fnUntraced(function* () {
        const { root, tasks, binary } = yield* fixture();
        const ids = R.keys(tasks);
        const baseline = yield* dryRun(root, binary, ids, false);
        expect(A.length(baseline)).toBe(A.length(ids));
        for (const [name, file] of R.toEntries(directInputs)) {
          const id = `//#${name}`;
          expect(R.has(rowFor(baseline, id).inputs, file), `${id}: ${file}`).toBe(true);
          yield* mutate(
            root,
            file,
            Effect.gen(function* () {
              const changed = yield* dryRun(root, binary, ids, false);
              expect(rowFor(changed, id).hash, `${id}: ${file}`).not.toBe(rowFor(baseline, id).hash);
            })
          );
        }
        yield* mutate(
          root,
          nonInput,
          Effect.gen(function* () {
            const changed = yield* dryRun(root, binary, ids, false);
            for (const id of ids) {
              expect(R.has(rowFor(baseline, id).inputs, nonInput), id).toBe(false);
              expect(rowFor(changed, id).hash, id).toBe(rowFor(baseline, id).hash);
            }
          })
        );
        const dryRun5 = yield* dryRun(root, binary, ids, false);
        expect(dryRun5).toEqual(baseline);
      }),
      { timeout: 180_000 }
    );

    it.effect(
      "ignores generated job artifacts in qualified root input boundaries",
      Effect.fnUntraced(function* () {
        const { root, tasks, binary } = yield* fixture();
        // `lint:schema-catalog` shares the schema-first scanner's globs (same owner
        // resolver, same source walk), so it carries the same artifact exposure.
        const scannerOwnedInputs = [
          "//#lint:allowlist",
          "//#lint:schema-first",
          "//#lint:schema-catalog",
          "//#lint:tsgo-rules",
        ];
        const ids = A.map(
          A.filter(R.toEntries(tasks), ([id, task]) => task.cache && !A.contains(scannerOwnedInputs, id)),
          ([id]) => id
        );
        const baseline = yield* dryRun(root, binary, ids, false);
        const artifacts = [
          "packages/fixture/node_modules/dependency/package.json",
          "packages/fixture/.beep/docgen/proof.json",
          "packages/fixture/.turbo/run.json",
          "packages/fixture/dist/package.json",
          "packages/fixture/coverage/report.ts",
          "apps/fixture/.next/package.json",
          "apps/fixture/storybook-static/preview.js",
        ];
        yield* Effect.forEach(artifacts, (file) => writeFile(root, file, "{}\n"));
        const changed = yield* dryRun(root, binary, ids, false);
        for (const id of ids) {
          expect(rowFor(changed, id).hash, id).toBe(rowFor(baseline, id).hash);
          for (const file of artifacts) {
            expect(R.has(rowFor(changed, id).inputs, file), `${id}: ${file}`).toBe(false);
          }
        }
      }),
      { timeout: 60_000 }
    );

    it.effect(
      "hashes every effect-imports corpus family and no directory the scanner prunes",
      Effect.fnUntraced(function* () {
        const { root, binary } = yield* fixture();
        const code = "//#lint:effect-imports";
        const markdown = "//#lint:effect-imports-markdown";
        const ids = [code, markdown];
        const baseline = yield* dryRun(root, binary, ids, false);
        // A file under any pruned directory name, at any depth, is never read by either walk.
        // `.git` is left out of the plant: a nested `.git` directory turns the fixture into a submodule.
        const pruned = A.flatMap(
          A.filter(EffectImportsPrunedDirectoryNames, (name) => name !== ".git"),
          (name) => [`packages/fixture/${name}/c3-pruned.ts`, `scratchpad/${name}/c3-pruned.md`]
        );
        yield* Effect.forEach(pruned, (file) => writeFile(root, file, "export const pruned = 1;\n"));
        const withPruned = yield* dryRun(root, binary, ids, false);
        for (const id of ids) {
          expect(rowFor(withPruned, id).hash, id).toBe(rowFor(baseline, id).hash);
          for (const file of pruned) expect(R.has(rowFor(withPruned, id).inputs, file), `${id}: ${file}`).toBe(false);
        }
        // One authored file per code family root, derived from the scanner's own globs, plus Markdown
        // outside the documentation roots: each is read by the scanner, so each must re-key its row.
        const familyProbes = A.map(EffectImportsCodeGlobs, (glob) =>
          Str.replace(/(?:\*\*\/)?\*\.\{[^}]+\}$/u, "c3-family-probe.ts")(glob)
        );
        const markdownProbes = ["packages/fixture/c3-family-probe.md", "explorations/fixture/c3-family-probe.md"];
        for (const [id, file] of [
          ...A.map(familyProbes, (file) => Tuple.make(code, file)),
          ...A.map(markdownProbes, (file) => Tuple.make(markdown, file)),
        ]) {
          const before = yield* dryRun(root, binary, [id], false);
          yield* writeFile(root, file, "export const authored = 1;\n");
          const after = yield* dryRun(root, binary, [id], false);
          expect(R.has(rowFor(after, id).inputs, file), `${id}: ${file}`).toBe(true);
          expect(rowFor(after, id).hash, `${id}: ${file}`).not.toBe(rowFor(before, id).hash);
        }
      }),
      { timeout: 120_000 }
    );

    it.effect(
      "ignores gitignored Vitest runtime residue in the tasks whose scanners skip it",
      Effect.fnUntraced(function* () {
        const { root, binary } = yield* fixture();
        // `Vitest.runtime.test.ts` creates `.runtime-<mode>-*` under this fixture directory and
        // leaves it behind when killed before its scoped finalizer runs. The repository ignores
        // the family; every task below reads git-visible files, walks without entering dot
        // directories, prunes `test`, or (Fallow) ignores `**/test/fixtures/**`. `lint:effect-vitest`
        // walks with `dot: false`; its pinned scope (`EffectVitestSourceFileGlobs`) negates every dot
        // directory, so the inputs drop exactly what the walk skips.
        const residueRoot = "packages/tooling/test-kit/test-utils/test/fixtures/vitest-instrumentation";
        yield* writeFile(root, ".gitignore", `node_modules\n.turbo\n/${residueRoot}/.runtime-*/\n`);
        const negated = [
          "//#fallow:boundaries:advisory",
          "//#fallow:boundaries:config-check",
          "//#fallow:dead-code:check",
          "//#fallow:fix-preview:advisory",
          "//#fallow:flags:advisory",
          "//#fallow:health:advisory",
          "//#fallow:health:check",
          "//#fallow:security:advisory",
          "//#jsdoc:inventory:check",
          "//#lint:allowlist",
          "//#lint:deprecated-imports",
          "//#lint:effect-imports",
          "//#lint:effect-imports-markdown",
          "//#lint:effect-vitest",
          "//#lint:identity-registry",
          "//#lint:jsdoc-module-tags",
          "//#lint:jsdoc:root",
          "//#lint:schema-catalog",
          "//#lint:schema-first",
          "//#lint:schema-tag-idioms",
          "//#lint:tsgo-rules",
        ];
        // `lint:markdown-fences` keeps hashing the residue (uncached, `**/*.ts` with no residue
        // negation), which proves the planted files are real input candidates.
        const control = "//#lint:markdown-fences";
        const ids = A.append(negated, control);
        const baseline = yield* dryRun(root, binary, ids, false);
        const residue = A.map(
          ["runtime.test.ts", "diagnostic-reporter.ts", "result.json"],
          (name) => `${residueRoot}/.runtime-probe-killed/${name}`
        );
        yield* Effect.forEach(residue, (file) => writeFile(root, file, "export const residue = 1;\n"));
        const changed = yield* dryRun(root, binary, ids, false);
        for (const id of negated) {
          expect(rowFor(changed, id).hash, id).toBe(rowFor(baseline, id).hash);
          for (const file of residue) {
            expect(R.has(rowFor(changed, id).inputs, file), `${id}: ${file}`).toBe(false);
          }
        }
        expect(R.has(rowFor(changed, control).inputs, residue[0] ?? "")).toBe(true);
        expect(rowFor(changed, control).hash).not.toBe(rowFor(baseline, control).hash);
        // A real test file outside a dot directory still re-keys the effect-vitest row.
        const authored = "packages/fixture/test/c3-probe.test.ts";
        yield* writeFile(root, authored, "export const authored = 1;\n");
        const edited = yield* dryRun(root, binary, ["//#lint:effect-vitest"], false);
        expect(R.has(rowFor(edited, "//#lint:effect-vitest").inputs, authored)).toBe(true);
        expect(rowFor(edited, "//#lint:effect-vitest").hash).not.toBe(rowFor(changed, "//#lint:effect-vitest").hash);
      }),
      { timeout: 60_000 }
    );

    it.effect(
      "keeps build output out of the effect-vitest inputs while a real test edit re-keys them",
      Effect.fnUntraced(function* () {
        const { root, binary } = yield* fixture();
        // `tsc` emits `dist/test/*.d.ts` beside a built package, which the `test/**` glob would
        // otherwise match. The scanner's pinned scope negates `**/dist/**`, so a local build
        // never re-keys the row and a hosted cache entry still serves a built lane.
        const id = "//#lint:effect-vitest";
        yield* writeFile(root, ".gitignore", "node_modules\n.turbo\ndist/\n");
        const baseline = yield* dryRun(root, binary, [id], false);
        const built = [
          "packages/fixture/dist/test/c3-probe.test-kit.d.ts",
          "packages/fixture/dist/internal/test/c3-probe.d.ts",
          "apps/fixture/dist/c3-probe.test.js",
        ];
        yield* Effect.forEach(built, (file) => writeFile(root, file, "export declare const built: 1;\n"));
        const withBuild = yield* dryRun(root, binary, [id], false);
        expect(rowFor(withBuild, id).hash).toBe(rowFor(baseline, id).hash);
        for (const file of built) expect(R.has(rowFor(withBuild, id).inputs, file), file).toBe(false);
        const authored = "packages/fixture/test/c3-dist-control.test.ts";
        yield* writeFile(root, authored, "export const authored = 1;\n");
        const edited = yield* dryRun(root, binary, [id], false);
        expect(R.has(rowFor(edited, id).inputs, authored)).toBe(true);
        expect(rowFor(edited, id).hash).not.toBe(rowFor(withBuild, id).hash);
      }),
      { timeout: 60_000 }
    );

    it.effect(
      "keeps .turbo trees out of the typos inputs",
      Effect.fnUntraced(function* () {
        const { root, binary } = yield* fixture();
        // typos honors `.gitignore` and skips hidden directories, so `.turbo` churn must not
        // put the uncached task back into the affected set.
        const id = "//#lint:typos";
        const control = "packages/fixture/c3-typos-probe.md";
        const planted = ["packages/fixture/.turbo/x.md", ".turbo/x.md"];
        yield* Effect.forEach([control, ...planted], (file) => writeFile(root, file, "typo probe\n"));
        const rows = yield* dryRun(root, binary, [id], false);
        const row = rowFor(rows, id);
        expect(R.has(row.inputs, control)).toBe(true);
        for (const file of planted) expect(R.has(row.inputs, file), file).toBe(false);
      }),
      { timeout: 60_000 }
    );

    it.effect(
      "ignores sources outside root JSDoc scan scope while retaining lab manifest discovery",
      Effect.fnUntraced(function* () {
        const { root, binary } = yield* fixture();
        const id = "//#lint:jsdoc:root";
        const baseline = yield* dryRun(root, binary, [id], false);
        const excludedSources = [
          "scripts/check.ts",
          "tools/check.ts",
          "scratchpad/check.ts",
          "apps/labs/probe/check.ts",
          "packages/probe/.context/check.ts",
          "infra/standalone/check.tsx",
          "apps/probe/check.js",
        ];
        yield* Effect.forEach(excludedSources, (file) => writeFile(root, file, "export const value = 1;\n"));
        const changed = yield* dryRun(root, binary, [id], false);
        expect(rowFor(changed, id).hash).toBe(rowFor(baseline, id).hash);
        for (const file of excludedSources) {
          expect(R.has(rowFor(changed, id).inputs, file), file).toBe(false);
        }
        const manifest = "apps/labs/probe/package.json";
        yield* writeFile(root, manifest, "{}\n");
        const discovered = yield* dryRun(root, binary, [id], false);
        expect(R.has(rowFor(discovered, id).inputs, manifest)).toBe(true);
        expect(rowFor(discovered, id).hash).not.toBe(rowFor(baseline, id).hash);
      }),
      { timeout: 60_000 }
    );

    it.effect(
      "retains nested authored source directories consumed by root scanners",
      Effect.fnUntraced(function* () {
        const { root, binary } = yield* fixture();
        const probes = [
          Tuple.make("//#lint:circular", "packages/tooling/tool/cli/src/build/cycle.ts"),
          Tuple.make("//#lint:jsdoc:root", "packages/tooling/fixture/unit/src/build/check.ts"),
          Tuple.make("//#lint:jsdoc:root", "packages/tooling/fixture/unit/src/.beep/check.ts"),
          Tuple.make("//#lint:jsdoc:root", "infra/standalone/src-tauri/gen/check.ts"),
          Tuple.make(
            "//#lint:effect-imports-markdown",
            "packages/foundation/primitive/fixture/src/generated/bindings.ts"
          ),
          Tuple.make(
            "//#lint:effect-imports-markdown",
            "packages/foundation/primitive/fixture/src/_generated/bindings.ts"
          ),
          Tuple.make("//#lint:ecosystem-polarity", "packages/ecosystem/fixture/src/docs/consumer.ts"),
          // `docs/_internal` is gitignored and excluded by the Markdown walk; nested authored docs are read.
          Tuple.make("//#lint:effect-imports-markdown", "docs/runbooks/nested/cache-contract.md"),
          // The zero-legacy gate reads every tracked `packages|apps/**/src/**` file, fixtures
          // included; the inventory analyzes every workspace, scratchpad and tools included;
          // the D9 scan reads fixture tests.
          Tuple.make("//#jsdoc:ratchet:check", "packages/tooling/fixture/test/fixtures/pkg/src/index.ts"),
          Tuple.make("//#jsdoc:inventory:check", "scratchpad/c3-probe.ts"),
          Tuple.make("//#jsdoc:inventory:check", "scratchpad/c3-probe.tsx"),
          // Both scans admit every git-visible source file: a fixture tree under a source
          // root is not gitignored, and the zero-legacy listing applies no directory filter.
          Tuple.make("//#jsdoc:inventory:check", "packages/fixture/src/test/fixtures/New.ts"),
          Tuple.make("//#jsdoc:ratchet:check", "packages/fixture/src/build/Legacy.ts"),
          Tuple.make("//#jsdoc:ratchet:check", "packages/fixture/src/coverage/Legacy.ts"),
          Tuple.make("//#jsdoc:inventory:check", "tools/fixture/src/c3-probe.ts"),
          Tuple.make("//#lint:effect-vitest", "packages/drivers/fixture/test/fixtures/zz-probe.test.ts"),
          // The browser-mode filter parses every vitest config, so a config edit re-keys the row.
          Tuple.make("//#lint:effect-vitest", "packages/fixture/vitest.browser.config.ts"),
          Tuple.make("//#lint:effect-vitest", "apps/fixture/vitest.config.mts"),
          Tuple.make("//#lint:opaque-roundtrips", "packages/fixture/src/Nested.ts"),
          Tuple.make("//#lint:opaque-roundtrips", "apps/fixture/tsconfig.test.json"),
          Tuple.make("//#lint:opaque-roundtrips", "infra/fixture/test/opaque.test.tsx"),
          Tuple.make("//#lint:opaque-roundtrips", "tsconfig.base.json"),
          Tuple.make("//#lint:opaque-roundtrips", "scratchpad/fixture/opaque.test.ts"),
          Tuple.make("//#lint:opaque-roundtrips", "goals/fixture/ops/opaque.test.ts"),
        ];
        for (const [taskId, input] of probes) {
          const baseline = yield* dryRun(root, binary, [taskId], false);
          yield* writeFile(root, input, "authored source\n");
          const changed = yield* dryRun(root, binary, [taskId], false);
          expect(R.has(rowFor(changed, taskId).inputs, input), input).toBe(true);
          expect(rowFor(changed, taskId).hash, input).not.toBe(rowFor(baseline, taskId).hash);
        }
      }),
      { timeout: 60_000 }
    );

    it.effect(
      "keeps scanner-owned root inputs equal to the scanner's own constants",
      Effect.fnUntraced(function* () {
        const { tasks } = yield* fixture();
        const effectVitest = O.getOrThrow(R.get(tasks, "//#lint:effect-vitest"));
        expect(effectVitest.inputs).toEqual([
          ...EffectVitestSourceFileGlobs,
          ...EffectVitestConfigFileGlobs,
          EffectVitestInventoryPath,
          EffectVitestPrimitiveGraphPath,
        ]);
        // Build output is negated in the prunable `**/<name>/**` shape the shared walk skips outright.
        expect(effectVitest.inputs).toContain("!**/dist/**");
        // The ratchet's input glob and the gate's predicate must agree on fixture sources.
        const fixtureSource = "packages/tooling/fixture/test/fixtures/pkg/src/index.ts";
        expect(isPackageSourceFile(fixtureSource)).toBe(true);
        const ratchet = O.getOrThrow(R.get(tasks, "//#jsdoc:ratchet:check"));
        expect(ratchet.inputs).not.toContain("!**/test/fixtures/**");
        expect(ratchet.inputs).toContain("{packages,apps}/**/src/**/*.{ts,tsx}");
      })
    );

    it.effect(
      "closes tool reads through the fingerprint for every CLI-backed task, and only those",
      Effect.fnUntraced(function* () {
        const { root, tasks, seals, binary } = yield* fixture();
        const ids = R.keys(tasks);
        expect(A.filter(ids, isSealId)).toEqual([]);
        const baseline = yield* dryRun(root, binary, ids, false);
        const sealed = A.filter(R.toEntries(tasks), ([, task]) => A.some(task.dependsOn, isSealId));
        expect(A.length(sealed)).toBeGreaterThan(0);
        const declares = (id: string, task: RootTask, file: string) =>
          R.has(rowFor(baseline, id).inputs, file) ||
          A.some(A.filter(task.dependsOn, isSealId), (seal) => A.contains(chainInputs(seals, seal), file));
        // The shell is in every chain; each checker configuration is in some chain and absent from another.
        const shell = "packages/tooling/tool/cli/src/bin-main.ts";
        expect(A.every(sealed, ([id, task]) => declares(id, task, shell))).toBe(true);
        for (const file of A.filter(closureInputs, (candidate) => candidate !== shell)) {
          expect(
            A.some(sealed, ([id, task]) => declares(id, task, file)),
            file
          ).toBe(true);
        }
        expect(A.some(sealed, ([id, task]) => !declares(id, task, "biome.jsonc"))).toBe(true);
        for (const file of closureInputs) {
          yield* mutate(
            root,
            file,
            Effect.gen(function* () {
              const changed = yield* dryRun(root, binary, ids, false);
              for (const [id, task] of sealed) {
                expect(rowFor(changed, id).hash !== rowFor(baseline, id).hash, `${id}: ${file}`).toBe(
                  declares(id, task, file)
                );
              }
            })
          );
        }
      }),
      { timeout: 180_000 }
    );

    it.effect(
      "selects root tasks under --affected from declared inputs only (Git fixture)",
      Effect.fnUntraced(function* () {
        const { root, tasks, binary } = yield* fixture();
        yield* initializeGit(root);
        const ids = R.keys(tasks);
        const baseline = yield* dryRun(root, binary, ids, false);
        const readmeIds = A.map(
          A.filter(baseline, (row) => R.has(row.inputs, "README.md")),
          (row) => row.taskId
        );
        expect(readmeIds).toEqual(expect.arrayContaining(["//#lint:typos"]));
        const dryRun6 = yield* dryRun(root, binary, A.map(ids, Str.slice(3)), true);
        expect(selectedIds(dryRun6)).toEqual(withDependencies(readmeIds, baseline));
        // Scope each independent row probe to that row and the whole-tree walkers.
        // Other production rows intentionally share source/config globs.
        const wholeTreeIds = A.map(
          A.filter(R.toEntries(tasks), ([, task]) => A.contains(task.inputs, "**/*")),
          ([id]) => id
        );
        for (const [name, file] of R.toEntries(directInputs)) {
          const requested = A.dedupe([`//#${name}`, ...wholeTreeIds]);
          yield* mutate(
            root,
            file,
            Effect.gen(function* () {
              const isolated = yield* dryRun(root, binary, [name], true);
              expect(selectedIds(isolated), `${name}: isolated ${file}`).toEqual(
                withDependencies([`//#${name}`], baseline)
              );
              const selected = yield* dryRun(root, binary, A.map(requested, Str.slice(3)), true);
              expect(selectedIds(selected), `${name}: ${file}`).toEqual(withDependencies(requested, baseline));
            })
          );
        }
        // README is an input of the two whole-tree walkers. A non-input edit adds
        // no selection to that committed baseline; all other requested rows stay absent.
        yield* mutate(
          root,
          nonInput,
          Effect.gen(function* () {
            const dryRun7 = yield* dryRun(root, binary, A.map(ids, Str.slice(3)), true);
            expect(selectedIds(dryRun7)).toEqual(withDependencies(readmeIds, baseline));
            const narrow = A.filter(ids, (id) => !A.contains(readmeIds, id));
            const dryRun8 = yield* dryRun(root, binary, A.map(narrow, Str.slice(3)), true);
            expect(dryRun8).toEqual([]);
          })
        );
      }),
      { timeout: 180_000 }
    );

    it.effect(
      "explicit root selectors bypass --affected for the same non-input edit",
      Effect.fnUntraced(function* () {
        const { root, tasks, binary } = yield* fixture();
        yield* initializeGit(root);
        const ids = R.keys(tasks);
        yield* mutate(
          root,
          nonInput,
          Effect.gen(function* () {
            const dryRun9 = yield* dryRun(root, binary, ids, true);
            expect(selectedIds(dryRun9)).toEqual(A.sort(ids, Str.Order));
            const bare = yield* dryRun(root, binary, A.map(ids, Str.slice(3)), true);
            expect(selectedIds(bare)).not.toEqual(A.sort(ids, Str.Order));
          })
        );
      }),
      { timeout: 180_000 }
    );

    it.effect(
      "excludes loose Git objects from every registered root task hash",
      Effect.fnUntraced(function* () {
        const { root, tasks, binary } = yield* fixture();
        yield* initializeGit(root);
        const ids = R.keys(tasks);
        const baseline = yield* dryRun(root, binary, ids, false);
        // Non-input bytes are absent from the initial commit, so this creates a new object.
        yield* writeFile(root, nonInput, "untracked object payload\n");
        const candidate = yield* git(root, ["hash-object", "--", nonInput]);
        const fs = yield* FileSystem.FileSystem;
        const candidateHash = Str.trim(candidate.output);
        const exists10 = yield* fs.exists(
          `${root}/.git/objects/${Str.slice(0, 2)(candidateHash)}/${Str.slice(2)(candidateHash)}`
        );
        expect(exists10).toBe(false);
        // Hash a new blob without adding any working-tree input or updating refs.
        const object = yield* git(root, ["hash-object", "-w", "--", nonInput]);
        const hash = Str.trim(object.output);
        const exists11 = yield* fs.exists(`${root}/.git/objects/${Str.slice(0, 2)(hash)}/${Str.slice(2)(hash)}`);
        expect(exists11).toBe(true);
        yield* writeFile(root, "nested/.git/objects/ab/c3-probe", "nested git metadata");
        const changed = yield* dryRun(root, binary, ids, false);
        for (const id of ids) {
          expect(rowFor(changed, id).hash, id).toBe(rowFor(baseline, id).hash);
          expect(
            A.filter(
              R.keys(rowFor(changed, id).inputs),
              (file) => Str.startsWith(".git/")(file) || Str.includes("/.git/")(file)
            ),
            id
          ).toEqual([]);
        }
      }),
      { timeout: 180_000 }
    );
  });
});

// Nested lanes under `.claude/worktrees/` are full gitignored checkouts. A task glob that starts at
// the repository root reaches them and hashes every lane's files on each run (quality audit M8,
// 2026-11-02: 528,370 inputs and 9.1 s for one dry run with ten live lanes), although every scanner
// lists files through git. Root `//#` tasks resolve globs from the root, package overlays only
// through `$TURBO_ROOT$`.
const turboRootPrefix = "$TURBO_ROOT$/";
const TurboInputsFile = S.Struct({ tasks: S.Record(S.String, S.Struct({ inputs: Strings })) });
const decodeTurboInputsFile = S.decodeEffect(S.fromJsonString(TurboInputsFile));
const rootRelativeGlob = (id: string, glob: string): O.Option<string> =>
  Str.startsWith(turboRootPrefix)(glob)
    ? O.some(Str.slice(Str.length(turboRootPrefix))(glob))
    : Str.startsWith("//#")(id)
      ? O.some(glob)
      : O.none();
const reachesNestedLanes = (id: string) => (glob: string) =>
  O.exists(
    rootRelativeGlob(id, glob),
    (relative) => Str.startsWith("**")(relative) || Str.startsWith(".claude/*")(relative)
  );
// The exclusion resolves through the same scope rule: a package task's bare `!.claude/worktrees/**`
// is package-relative and removes nothing, so only the `$TURBO_ROOT$` form counts there.
const excludesNestedLanes = (id: string) => (glob: string) =>
  Str.startsWith("!")(glob) && O.contains(rootRelativeGlob(id, Str.slice(1)(glob)), ".claude/worktrees/**");

describe("Root-reaching task inputs", () => {
  it.layer(PlatformLayer)("tracked Turbo configurations", (it) => {
    it.effect(
      "exclude nested lanes from every task whose inputs glob from the repository root",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repo = yield* findRepoRoot();
        const listing = yield* StepExec.runCaptured({
          command: "git",
          args: ["ls-files", "-z", "--", "turbo.json", "*/turbo.json"],
          cwd: repo,
          source: "stdout",
          extendEnv: true,
          env: { GIT_LITERAL_PATHSPECS: "0" },
        });
        expect(listing.exitCode, listing.output).toBe(0);
        const files = A.filter(Str.split("\0")(listing.output), Str.isNonEmpty);
        expect(files).toContain("turbo.json");
        expect(files).toContain("packages/foundation/modeling/identity/turbo.json");
        const offenders = yield* Effect.forEach(
          files,
          Effect.fnUntraced(function* (file) {
            const readFileString12 = yield* fs.readFileString(path.join(repo, file));
            const { tasks } = yield* decodeTurboInputsFile(readFileString12);
            return A.flatMap(R.toEntries(tasks), ([id, { inputs }]) =>
              A.some(inputs, reachesNestedLanes(id)) && !A.some(inputs, excludesNestedLanes(id))
                ? [`${file} ${id}`]
                : []
            );
          })
        );
        expect(A.flatten(offenders)).toEqual([]);
      })
    );

    it("classifies root-reaching globs by task scope", () => {
      expect(reachesNestedLanes("//#lint:typos")("**/*")).toBe(true);
      expect(reachesNestedLanes("//#lint:holds")("**/package.json")).toBe(true);
      expect(reachesNestedLanes("lint")("$TURBO_ROOT$/**/package.json")).toBe(true);
      expect(reachesNestedLanes("lint")("**/*.ts")).toBe(false);
      expect(reachesNestedLanes("//#lint:typos")("!**/*")).toBe(false);
      expect(reachesNestedLanes("//#fallow:audit:check")("apps/**")).toBe(false);
      expect(reachesNestedLanes("//#fallow:audit:check")(".claude/skills/**")).toBe(false);
      expect(excludesNestedLanes("//#lint:holds")("!.claude/worktrees/**")).toBe(true);
      expect(excludesNestedLanes("//#lint:holds")("!$TURBO_ROOT$/.claude/worktrees/**")).toBe(true);
      expect(excludesNestedLanes("lint")("!$TURBO_ROOT$/.claude/worktrees/**")).toBe(true);
      expect(excludesNestedLanes("lint")("!.claude/worktrees/**")).toBe(false);
      expect(excludesNestedLanes("lint")("$TURBO_ROOT$/.claude/worktrees/**")).toBe(false);
    });
  });
});

// Directories the effect-imports walks never read although no exclusion of the scanner names them:
// the code walk runs with `dot: false` and the Markdown walk keeps only git-visible paths, so each
// of these must be a dot directory and gitignored. The nested-lane form is the root-reaching law.
const effectImportsUnreadResidue = [
  Tuple.make("!.claude/worktrees/**", ".claude/worktrees/c3/README.md"),
  Tuple.make("!**/.next/**", "apps/c3/.next/server/page.md"),
  Tuple.make(
    "!packages/tooling/test-kit/test-utils/test/fixtures/vitest-instrumentation/.runtime-*/**",
    "packages/tooling/test-kit/test-utils/test/fixtures/vitest-instrumentation/.runtime-c3/runtime.md"
  ),
];
const sortedStrings = (values: ReadonlyArray<string>) => A.sort(A.dedupe(values), Str.Order);
const negatedDirectory = (directory: string) => `!${directory}/**`;

describe("effect-imports scanner and Turbo inputs", () => {
  it.layer(PlatformLayer)("tracked root configuration", (it) => {
    it.effect(
      "derives both effect-imports rows from the scanner's corpus globs and exclusions",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repo = yield* findRepoRoot();
        const text = yield* fs.readFileString(path.join(repo, "turbo.json"));
        const configuration = yield* decodeConfiguration(text);
        const inputsOf = Effect.fnUntraced(function* (id: string) {
          const task = yield* R.get(configuration.tasks, id).pipe(O.getOrThrow, decodeTask);
          return sortedStrings(task.inputs);
        });
        const pruned = A.map(EffectImportsPrunedDirectoryNames, (name) => negatedDirectory(`**/${name}`));
        // The foundation sources resolve exports for the mapping phase in both modes.
        const foundation = ["packages/foundation/**/package.json", "packages/foundation/**/src/**"];
        const residue = A.map(effectImportsUnreadResidue, Tuple.get(0));
        const codeInputs = yield* inputsOf("//#lint:effect-imports");
        const markdownInputs = yield* inputsOf("//#lint:effect-imports-markdown");
        expect(codeInputs).toEqual(
          sortedStrings([
            ...EffectImportsCodeGlobs,
            ...foundation,
            ...pruned,
            ...A.map(EffectImportsCodeOnlyExcludedDirectories, negatedDirectory),
            ...residue,
          ])
        );
        expect(markdownInputs).toEqual(
          sortedStrings([
            ...EffectImportsMarkdownGlobs,
            ...foundation,
            ...pruned,
            ...A.map(EffectImportsMarkdownOnlyExcludedDirectories, negatedDirectory),
            ...residue,
          ])
        );
        // Each residue negation names a dot directory (the code walk never enters one) that git
        // ignores (the Markdown walk drops it), so neither walk reads what the rows stop hashing.
        for (const [negation, sample] of effectImportsUnreadResidue) {
          expect(A.some(Str.split("/")(Str.slice(1)(negation)), Str.startsWith(".")), negation).toBe(true);
          const ignored = yield* StepExec.runCaptured({
            command: "git",
            args: ["check-ignore", "--no-index", "-q", "--", sample],
            cwd: repo,
            source: "stdout",
            extendEnv: true,
          });
          expect(ignored.exitCode, sample).toBe(0);
        }
      })
    );
  });
});
