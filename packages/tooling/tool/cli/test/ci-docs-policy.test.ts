import { Git } from "@beep/git/Git";
import { GlobPattern, GlobPatternOptions } from "@beep/glob/GlobPattern";
import {
  CI_LANE_DESCRIPTORS,
  CI_RELEVANCE_LANE_VALUES,
  ciOperationalPatterns,
  classifyChangeProfile,
  DOCS_POLICY_EXCLUSIONS,
  DOCS_POLICY_ROOT_TASKS,
  isHeavyDocsOnlyPath,
} from "@beep/repo-cli/commands/Ci";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { assert } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { parseWorkflowYaml, yamlAt } from "./support/WorkflowYaml.ts";

// Route-soundness-repair ROUT-02 (exploration ruling D8): a docs_only pull request never starts
// Heavy / Lint Policy, so every root Turbo task that can fail on a docs-classified path must run in
// the Docs Policy lane or carry a reason in DOCS_POLICY_EXCLUSIONS. Uncached root tasks are always
// classified: only cached task inputs are certified (standards/cache-baseline/).

const TurboTask = S.Struct({
  inputs: S.String.pipe(S.Array, S.optionalKey),
  cache: S.optionalKey(S.Boolean),
});
const TurboJson = S.Struct({ tasks: S.Record(S.String, TurboTask) });
const DependencyMap = S.Record(S.String, S.String).pipe(S.optionalKey);
const WorkspaceManifest = S.Struct({
  name: S.String.pipe(S.optionalKey),
  dependencies: DependencyMap,
  devDependencies: DependencyMap,
  peerDependencies: DependencyMap,
});
const decodeWorkspaceManifest = S.decodeUnknownEffect(S.fromJsonString(WorkspaceManifest));
// Fixture and installed manifests are not workspaces; a fixture may reuse a workspace name.
const WORKSPACE_MANIFEST_EXCLUSION = /(^|\/)(node_modules|test|tests|fixtures|__fixtures__)\//u;

const isManifestPath = (file: string): boolean => file === "package.json" || Str.endsWith("/package.json")(file);

type Workspace = { readonly manifest: typeof WorkspaceManifest.Type; readonly directory: string };

// Every workspace manifest in the tracked tree, by package name.
const workspacesByName = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot();
  const git = yield* Git;
  const entries = yield* git.lsFiles(repoRoot);
  const manifestPaths = A.filter(
    A.map(entries, (entry) => entry.path),
    (file) => isManifestPath(file) && !WORKSPACE_MANIFEST_EXCLUSION.test(file)
  );
  const manifests = yield* Effect.forEach(manifestPaths, (file) =>
    fs.readFileString(path.join(repoRoot, file)).pipe(
      Effect.flatMap(decodeWorkspaceManifest),
      Effect.map((manifest): Workspace => ({ manifest, directory: path.dirname(file) })),
      Effect.option
    )
  );
  return HashMap.fromIterable(
    A.flatMap(A.getSomes(manifests), (workspace) =>
      O.match(O.fromUndefinedOr(workspace.manifest.name), {
        onNone: () => [],
        onSome: (name) => [[name, workspace] as const],
      })
    )
  );
});

const declaredDependencies = (manifest: typeof WorkspaceManifest.Type): ReadonlyArray<string> =>
  A.flatMap([manifest.dependencies, manifest.devDependencies, manifest.peerDependencies], (map) => R.keys(map ?? {}));

// The workspace dependency closure of `root`, the root included.
const workspaceClosure = (byName: HashMap.HashMap<string, Workspace>, root: string): HashSet.HashSet<string> => {
  const visit = (closure: HashSet.HashSet<string>, name: string): HashSet.HashSet<string> =>
    HashSet.has(closure, name)
      ? closure
      : O.match(HashMap.get(byName, name), {
          onNone: () => closure,
          onSome: (workspace) => A.reduce(declaredDependencies(workspace.manifest), HashSet.add(closure, name), visit),
        });
  return visit(HashSet.empty(), root);
};

const closureProbes = (byName: HashMap.HashMap<string, Workspace>, name: string): ReadonlyArray<string> =>
  O.match(HashMap.get(byName, name), {
    onNone: () => [],
    onSome: ({ directory }) => [`${directory}/package.json`, `${directory}/src/index.ts`, `${directory}/README.md`],
  });

// The workspaces each lane's job executes, whose dependency closures its relevance row must cover.
const LANE_EXECUTED_WORKSPACES: ReadonlyArray<
  readonly [(typeof CI_RELEVANCE_LANE_VALUES)[number], ReadonlyArray<string>]
> = [
  ["security", ["@beep/repo-cli"]],
  ["sast", ["@beep/repo-cli"]],
  ["codegen", ["@beep/repo-cli", "@beep/acp", "@beep/ecfr", "@beep/govinfo", "@beep/runpod", "@beep/codegen-kit"]],
];

const laneRow = (lane: (typeof CI_RELEVANCE_LANE_VALUES)[number]): string =>
  O.getOrElse(O.fromUndefinedOr(ciOperationalPatterns.lanes?.[lane]), () => "^$");

const isStepList = S.is(S.Array(S.Unknown));
const isText = S.is(S.String);
const decodeTurboJson = S.decodeUnknownEffect(S.fromJsonString(TurboJson));

const ROOT_TASK_PREFIX = "//#";
const CODE_ROOT_GLOB = /^(?:packages|apps|infra)\//u;

// Shapes a docs root can hold, beside the tracked tree: a docs-classified path a future change adds
// must be covered as surely as one that already exists.
const SYNTHETIC_DIRECTORIES = [
  "",
  "docs/",
  "goals/demo/",
  "goals/demo/research/",
  "goals/demo/ops/",
  "goals/demo/history/reflections/",
  "explorations/demo/",
  "research/demo/",
  ".claude/skills/demo/",
  ".github/",
  ".patterns/",
  "hold-ledger/",
  "standards/",
];
const SYNTHETIC_BASENAMES = [
  "README.md",
  "notes.md",
  "SKILL.md",
  "data.json",
  "data.jsonl",
  "data.yml",
  "config.toml",
  "run.sh",
  "probe.py",
  "page.html",
  "style.css",
  "notes.txt",
  "image.svg",
  "tsconfig.json",
  "package.json",
  ".gitignore",
  "docgen.json",
  "biome.json",
  "turbo.json",
  "components.json",
  "probe.ts",
  "probe.mjs",
  "requirements.txt",
  "Cargo.toml",
];

const globOptions = GlobPatternOptions.make({ dot: true });

type RootTaskObligation = {
  readonly task: string;
  readonly uncached: boolean;
  readonly docsHit: O.Option<string>;
};

const rootTaskObligations = Effect.fnUntraced(function* (repoRoot: string, docsPaths: ReadonlyArray<string>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const turbo = yield* fs.readFileString(path.join(repoRoot, "turbo.json")).pipe(Effect.flatMap(decodeTurboJson));
  const rootTasks = pipe(
    R.toEntries(turbo.tasks),
    A.filter(([key]) => Str.startsWith(ROOT_TASK_PREFIX)(key))
  );
  return yield* Effect.forEach(rootTasks, ([key, task]) =>
    Effect.gen(function* () {
      const sources = A.map(task.inputs ?? ["$TURBO_DEFAULT$"], (input) =>
        pipe(input, Str.replace("$TURBO_DEFAULT$", "**/*"), Str.replace("$TURBO_ROOT$/", ""))
      );
      const excludeSources = A.filter(sources, Str.startsWith("!"));
      const includeSources = A.filter(sources, (source) => !Str.startsWith("!")(source));
      // A docs-classified path never sits under a code root, so those includes cannot match.
      const includes = yield* Effect.forEach(
        A.filter(includeSources, (source) => !CODE_ROOT_GLOB.test(source)),
        (source) => GlobPattern.compile(source, globOptions)
      );
      const excludes = yield* Effect.forEach(excludeSources, (source) =>
        GlobPattern.compile(Str.slice(1)(source), globOptions)
      );
      const docsHit = A.findFirst(
        docsPaths,
        (candidate) =>
          A.some(includes, (glob) => glob.matches(candidate)) && !A.some(excludes, (glob) => glob.matches(candidate))
      );
      return {
        task: Str.slice(ROOT_TASK_PREFIX.length)(key),
        uncached: task.cache === false,
        docsHit,
      } satisfies RootTaskObligation;
    })
  );
});

const docsClassifiedPaths = Effect.fnUntraced(function* (repoRoot: string) {
  const git = yield* Git;
  const entries = yield* git.lsFiles(repoRoot);
  const tracked = A.map(entries, (entry) => entry.path);
  const synthetic = A.flatMap(SYNTHETIC_DIRECTORIES, (directory) =>
    A.map(SYNTHETIC_BASENAMES, (basename) => `${directory}${basename}`)
  );
  return A.filter(A.appendAll(synthetic, tracked), isHeavyDocsOnlyPath);
});

const excludedTasks = A.map(DOCS_POLICY_EXCLUSIONS, (row) => row.task);

it.layer(Layer.provideMerge(Git.layer, NodeServices.layer), { timeout: "120 seconds" })(
  "Docs Policy completeness",
  (it) => {
    it.effect(
      "runs or justifies every root Turbo task a documentation-only diff can fail",
      Effect.fnUntraced(function* () {
        const repoRoot = yield* findRepoRoot();
        const docsPaths = yield* docsClassifiedPaths(repoRoot);
        assert.isAbove(A.length(docsPaths), 100, "the docs-classified probe set is not empty");
        const obligations = yield* rootTaskObligations(repoRoot, docsPaths);
        const owned = (task: string) =>
          A.contains(DOCS_POLICY_ROOT_TASKS as ReadonlyArray<string>, task) || A.contains(excludedTasks, task);
        const missing = A.map(
          A.filter(obligations, (row) => (row.uncached || O.isSome(row.docsHit)) && !owned(row.task)),
          (row) => `${row.task} (${O.getOrElse(row.docsHit, () => "uncached")})`
        );
        assert.deepStrictEqual(missing, [], "add each task to DOCS_POLICY_ROOT_TASKS or DOCS_POLICY_EXCLUSIONS");

        const rootTasks = A.map(obligations, (row) => row.task);
        for (const task of [...DOCS_POLICY_ROOT_TASKS, ...excludedTasks]) {
          assert.include(rootTasks, task, `${task} is a root task in turbo.json`);
        }
        // An exclusion is a standing claim that the task could run here; one for a task no
        // documentation diff can reach is stale.
        const staleExclusions = A.filter(
          obligations,
          (row) => A.contains(excludedTasks, row.task) && !row.uncached && O.isNone(row.docsHit)
        );
        assert.deepStrictEqual(
          A.map(staleExclusions, (row) => row.task),
          [],
          "exclusions for tasks no documentation diff can reach"
        );
        assert.deepStrictEqual(
          A.filter(DOCS_POLICY_ROOT_TASKS, (task) => A.contains(excludedTasks, task)),
          [],
          "a task is either run or excluded"
        );
        assert.strictEqual(A.length(A.dedupe(excludedTasks)), A.length(excludedTasks));
      })
    );

    it.effect(
      "keeps code-shaped files inside docs roots on the code route",
      Effect.fnUntraced(function* () {
        for (const candidate of [
          "goals/demo/research/refresh.ts",
          "explorations/demo/assets/build.mjs",
          "research/demo/probe.cjs",
          "goals/demo/package.json",
          "docs/examples/bun.lock",
          "research/demo/requirements.txt",
          "goals/demo/ops/codemod/tsconfig.json",
          "explorations/demo/assets/.gitignore",
          "goals/demo/docgen.json",
          // Every dependency-graph manifest GitHub recognizes, not only the JavaScript ones.
          "docs/example/composer.lock",
          "goals/demo/pom.xml",
          "research/demo/Package.resolved",
          "explorations/demo/app.csproj",
          "docs/example/pubspec.lock",
          "goals/demo/main.tf",
          "docs/example/build.gradle.kts",
          "research/demo/demo.gemspec",
        ]) {
          assert.isFalse(isHeavyDocsOnlyPath(candidate), candidate);
        }
        for (const candidate of ["goals/demo/research/notes.md", "docs/runbooks/ci.md", "goals/demo/research/run.sh"]) {
          assert.isTrue(isHeavyDocsOnlyPath(candidate), candidate);
        }
      })
    );
  }
);

const readCheckWorkflow = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot();
  const text = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/check.yml"));
  return parseWorkflowYaml(text);
});

const RELEVANCE_JOBS = {
  codegen: "codegen",
  ecosystem: "ecosystem",
  nix: "nix",
  desktop_ipc: "professional-desktop-ipc-stdio",
  sast: "sast",
  security: "security",
} as const;

it.layer(NodeServices.layer, { timeout: "60 seconds" })("Docs Policy and lane relevance workflow contract", (it) => {
  it.effect(
    "runs Docs Policy on documentation-only pull requests right after Change Profile",
    Effect.fnUntraced(function* () {
      const workflow = yield* readCheckWorkflow();
      assert.strictEqual(yamlAt(workflow, ["jobs", "docs-policy", "name"]), "Docs Policy");
      assert.deepStrictEqual(yamlAt(workflow, ["jobs", "docs-policy", "needs"]), ["change-profile"]);
      assert.strictEqual(
        yamlAt(workflow, ["jobs", "docs-policy", "if"]),
        "${{ !cancelled() && needs.change-profile.outputs.docs_only == 'true' }}"
      );
      assert.deepStrictEqual(yamlAt(workflow, ["jobs", "docs-policy", "permissions"]), { contents: "read" });
      assert.strictEqual(yamlAt(workflow, ["jobs", "docs-policy", "env", "BEEP_CI_LANE_ID"]), "docs-policy");
      const steps = yamlAt(workflow, ["jobs", "docs-policy", "steps"]);
      assert.isTrue(isStepList(steps));
      const runs = A.filter(
        A.map(isStepList(steps) ? steps : [], (step) => yamlAt(step, ["run"])),
        isText
      );
      assert.include(runs, 'bun run beep ci lane docs-policy --base "origin/${GITHUB_BASE_REF:-main}"');
      const descriptor = O.getOrThrow(A.findFirst(CI_LANE_DESCRIPTORS, (row) => row.id === "docs-policy"));
      assert.strictEqual(descriptor.contextName, "Docs Policy");
      // Repo Sanity keeps the merge-blocking documentation checks; Docs Policy is advisory.
      assert.isFalse(descriptor.required);
    })
  );

  it.effect(
    "exports every relevance lane and guards each job so an older binary still runs it",
    Effect.fnUntraced(function* () {
      const workflow = yield* readCheckWorkflow();
      for (const lane of CI_RELEVANCE_LANE_VALUES) {
        assert.strictEqual(
          yamlAt(workflow, ["jobs", "change-profile", "outputs", `${lane}_relevant`]),
          `\${{ steps.profile.outputs.${lane}_relevant }}`,
          lane
        );
        const guard = yamlAt(workflow, ["jobs", RELEVANCE_JOBS[lane], "if"]);
        assert.isTrue(isText(guard), lane);
        const guardText = isText(guard) ? guard : "";
        assert.include(guardText, `needs.change-profile.outputs.${lane}_relevant != 'false'`, lane);
        assert.include(guardText, "needs.change-profile.outputs.docs_only != 'true'", lane);
      }
      // `== 'true'` would skip a lane whenever the pinned binary predates its output (empty).
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const text = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/check.yml"));
      const comparisons = A.fromIterable(
        Str.matchAll(/outputs\.([a-z_]+)_relevant\s*(==|!=)\s*'(true|false)'/gu)(text)
      );
      assert.isAbove(A.length(comparisons), 0);
      for (const match of comparisons) {
        assert.strictEqual(`${match[2]} '${match[3]}'`, "!= 'false'", match[0]);
      }
    })
  );
});

// [changed path, the relevance lanes it selects]
const RELEVANCE_ROWS: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
  ["README.md", []],
  ["docs/runbooks/ci.md", []],
  ["goals/demo/research/notes.md", []],
  ["goals/demo/ops/tool.py", []],
  // Outside the @beep/repo-cli closure: only the source scan applies.
  ["apps/beep-effect-web/src/app/page.tsx", ["sast"]],
  ["packages/law-practice/server/src/Citation.ts", ["sast"]],
  ["packages/ecosystem/drizzle/src/index.ts", ["ecosystem", "sast"]],
  ["packages/drivers/acp/openapi.json", ["codegen", "sast", "security"]],
  // A driver manifest defines its `generate:check` script, so it is a drift input.
  ["packages/drivers/acp/package.json", ["codegen", "sast", "security"]],
  ["packages/drivers/acp/src/_generated/Client.ts", ["codegen", "sast", "security"]],
  ["packages/tooling/library/codegen-kit/src/index.ts", ["codegen", "sast", "security"]],
  [".gitattributes", ["codegen"]],
  ["packages/tooling/tool/cli/src/commands/Worktree/Worktree.service.ts", ["codegen", "sast", "security"]],
  ["flake.nix", ["nix"]],
  ["apps/professional-desktop/src-tauri/src/lib.rs", ["desktop_ipc"]],
  ["packages/foundation/modeling/schema/src/index.ts", ["codegen", "desktop_ipc", "sast", "security"]],
  [".semgrep/first-party.yml", ["sast"]],
  ["osv-scanner.toml", ["security"]],
  [".github/workflows/storybook.yml", ["security"]],
  // Every job runs the shared setup actions.
  [".github/actions/setup-bun/action.yml", CI_RELEVANCE_LANE_VALUES],
  [".github/actions/fetch-beep-ci/action.yml", CI_RELEVANCE_LANE_VALUES],
  [".github/actions/setup-monorepo-ci/action.yml", CI_RELEVANCE_LANE_VALUES],
  ["packages/tooling/tool/cli/src/commands/Ci/DependencyReview.ts", ["codegen", "sast", "security"]],
  // The hosted GitHub policy reads run through the CLI closure (LaneTimings' client layer, the
  // GitHub driver's transport), so Security runs on those sources too.
  ["packages/tooling/tool/cli/src/commands/Ci/LaneTimings.ts", ["codegen", "sast", "security"]],
  ["packages/drivers/github/src/internal/octokit.ts", ["codegen", "sast", "security"]],
  // The driver generators import identity, schema and utils.
  ["packages/foundation/modeling/identity/src/packages.ts", ["codegen", "desktop_ipc", "sast", "security"]],
  // Dependency review reads every manifest GitHub's dependency graph recognizes.
  ["docs/example/composer.lock", ["security"]],
  ["packages/agents/domain/package.json", ["desktop_ipc", "security"]],
  ["packages/tooling/library/repo-utils/package.json", ["codegen", "sast", "security"]],
  ["tsconfig.base.json", ["codegen", "ecosystem", "sast", "security"]],
  ["bun.lock", ["codegen", "ecosystem", "desktop_ipc", "sast", "security"]],
  [".github/workflows/check.yml", CI_RELEVANCE_LANE_VALUES],
  ["packages/tooling/tool/cli/src/commands/Ci/CiLane.ts", CI_RELEVANCE_LANE_VALUES],
  ["packages/tooling/tool/cli/src/commands/Ci/CiOperational.patterns.json", CI_RELEVANCE_LANE_VALUES],
];

it.layer(Layer.provideMerge(Git.layer, NodeServices.layer), { timeout: "60 seconds" })(
  "lane relevance patterns",
  (it) => {
    it.effect(
      "selects each lane from its inputs only",
      Effect.fnUntraced(function* () {
        for (const [changed, expected] of RELEVANCE_ROWS) {
          const profile = classifyChangeProfile(ciOperationalPatterns, [changed]);
          const relevant = A.filter(CI_RELEVANCE_LANE_VALUES, (lane) => profile.lanes[lane]);
          assert.deepStrictEqual(relevant, [...expected], changed);
        }
        const empty = classifyChangeProfile(ciOperationalPatterns, []);
        assert.deepStrictEqual(
          A.filter(CI_RELEVANCE_LANE_VALUES, (lane) => empty.lanes[lane]),
          [],
          "an empty diff selects no lane"
        );
      })
    );

    // A lane whose job executes workspace code must run when any workspace in that code's dependency
    // closure changes: Security's GitHub policy reads and SAST's dispatcher run through `bun run
    // beep`, and Codegen runs the driver generators and the CLI's `worktree prepare`.
    it.effect(
      "covers each lane's executed workspace closure in its relevance row",
      Effect.fnUntraced(function* () {
        const byName = yield* workspacesByName();
        const misses = A.flatMap(LANE_EXECUTED_WORKSPACES, ([lane, roots]) => {
          const closure = A.reduce(roots, HashSet.empty<string>(), (acc, root) =>
            HashSet.union(acc, workspaceClosure(byName, root))
          );
          const row = new RegExp(laneRow(lane), "u");
          return A.flatMap(A.fromIterable(closure), (name) =>
            A.map(
              A.filter(closureProbes(byName, name), (probe) => !row.test(probe)),
              (probe) => `${lane} misses ${name}: ${probe}`
            )
          );
        });
        assert.deepStrictEqual(misses, []);
        for (const [lane, roots] of LANE_EXECUTED_WORKSPACES) {
          assert.isTrue(
            A.every(roots, (root) => HashMap.has(byName, root)),
            `${lane} roots are workspaces`
          );
        }
      })
    );

    // The check.yml path gates run the same pattern data through `grep -Eq`; POSIX ERE and the
    // binary's JavaScript RegExp must agree on every row.
    it.effect(
      "agrees with grep -E, the engine the check.yml path gates use",
      Effect.fnUntraced(function* () {
        const lanes = ciOperationalPatterns.lanes;
        assert.isDefined(lanes);
        for (const lane of CI_RELEVANCE_LANE_VALUES) {
          const pattern: string | undefined = lanes?.[lane];
          assert.isDefined(pattern, lane);
          for (const [changed] of RELEVANCE_ROWS) {
            const grep = Bun.spawnSync(["bash", "-c", 'grep -Eq "$1" <<< "$2"', "_", pattern ?? "", changed]);
            assert.oneOf(grep.exitCode, [0, 1], `${lane} ${changed}: ${grep.stderr.toString()}`);
            assert.strictEqual(
              grep.exitCode === 0,
              new RegExp(pattern ?? "", "u").test(changed),
              `${lane} disagrees on ${changed}`
            );
          }
        }
      })
    );
  }
);
