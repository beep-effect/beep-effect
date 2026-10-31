/**
 * Per-task lint policy fingerprint: `beep lint policy-fingerprint`.
 *
 * **Details**
 *
 * Every Turbo task that runs a `beep` policy command depends on a generated
 * seal task, `//#lint:policy-fingerprint:<key>`, whose inputs are the modules
 * that command reaches (see `internal/PolicyFingerprintGraph.ts`). The seals
 * depend on `//#lint:policy-fingerprint:shared`, which holds what every
 * command loads: the CLI shell, root checker configuration and the root
 * manifest. A source edit therefore replays only the policy tasks whose
 * command can reach it.
 *
 * `//#lint:policy-fingerprint` itself is the drift check. No policy task
 * depends on it; its inputs are every seal's inputs plus the manifests that
 * declare policy scripts, so any edit that could change a closure reruns it.
 * A new policy task declares `dependsOn: ["//#lint:policy-fingerprint"]` and
 * `--write` rewrites that edge to its seal.
 *
 * `--write` owns the declaration file, the check and seal tasks in
 * `turbo.json`, every policy task's fingerprint edge, and the seal scripts in
 * the root manifest. Nothing else in those files is touched.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { FsUtils, findRepoRoot, GlobOptions, resolveWorkspaceDirs } from "@beep/repo-utils";
import { normalizePath } from "@beep/schema";
import { A, O, Str } from "@beep/utils";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as jsonc from "jsonc-parser";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { LINT_POLICY_SUBCOMMANDS } from "../../internal/cli/LintRouting.ts";
import { QualityTaskName } from "../Quality/Quality.schemas.ts";
import { OXLINT_CIRCULAR_CONFIG, OXLINT_DEPRECATED_APIS_CONFIG } from "./internal/LintPackage.ts";
import { makePolicyGraph, renderClosureInputs } from "./internal/PolicyFingerprintGraph.ts";
import { insertAfterOwned, modifyJson, renderJsonDocument } from "./internal/PolicyFingerprintJson.ts";
import {
  PolicyCliLayout,
  PolicyClosure,
  PolicyCommandNode,
  PolicyFingerprintEntry,
  PolicyFingerprintError,
  PolicyToolsFingerprint,
  PolicyWorkspace,
} from "./PolicyFingerprint.schemas.ts";
import type { PolicyGraph, PolicySourceTree } from "./internal/PolicyFingerprintGraph.ts";

const $I = $RepoCliId.create("commands/Lint/PolicyFingerprint");

/** Repo-relative path of the generated declaration. */
const FINGERPRINT_PATH = "standards/policy-tools.fingerprint.json";
/** The drift check task; policy tasks declare this edge and `--write` rewrites it. */
const CHECK_TASK = "//#lint:policy-fingerprint";
const SEAL_TASK_PREFIX = `${CHECK_TASK}:`;
const SEAL_SCRIPT_PREFIX = "lint:policy-fingerprint:";
const SHARED_KEY = "shared";
/** A seal task does no work: Turbo only hashes a root task that has a script. */
const SEAL_SCRIPT = "true";
const CLI_WORKSPACE = "@beep/repo-cli";
const ROOT_CONFIGS = [
  "standards/lint-policy.sweeps.jsonc",
  "tsdoc.json",
  ".oxlintrc.json",
  ".oxlintrc.docs.json",
  OXLINT_DEPRECATED_APIS_CONFIG,
  OXLINT_CIRCULAR_CONFIG,
  "_typos.toml",
  ".fallowrc.jsonc",
  "fallow-plugin-manual-development-tools.json",
  "biome.jsonc",
  "tsconfig.base.json",
  "tsconfig.json",
  "package.json",
  FINGERPRINT_PATH,
];

class TurboTask extends S.Opaque<TurboTask, { readonly brand: unique symbol }>()(
  S.Struct({
    dependsOn: S.Array(S.String).pipe(S.optionalKey),
    inputs: S.Array(S.String).pipe(S.optionalKey),
    outputs: S.Array(S.String).pipe(S.optionalKey),
    cache: S.Boolean.pipe(S.optionalKey),
  }).pipe($I.annoteSchema("TurboTask", { description: "The task fields the fingerprint writer reads." }))
) {}

class TurboConfiguration extends S.Opaque<TurboConfiguration, { readonly brand: unique symbol }>()(
  S.Struct({ tasks: S.Record(S.String, TurboTask) }).pipe(
    $I.annoteSchema("TurboConfiguration", {
      description: "turbo.json tasks; every other key is preserved byte for byte.",
    })
  )
) {}

class WorkspaceManifest extends S.Opaque<WorkspaceManifest, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String.pipe(S.optionalKey),
    scripts: S.Record(S.String, S.String).pipe(S.optionalKey),
    exports: S.Unknown.pipe(S.optionalKey),
    imports: S.Unknown.pipe(S.optionalKey),
  }).pipe($I.annoteSchema("WorkspaceManifest", { description: "The manifest fields the fingerprint reads." }))
) {}

const parseJsonc = Effect.fnUntraced(function* (file: string, text: string) {
  const errors: Array<jsonc.ParseError> = [];
  const value: unknown = jsonc.parse(text, errors, { allowTrailingComma: true });
  if (A.isReadonlyArrayNonEmpty(errors))
    return yield* PolicyFingerprintError.make({ message: `Cannot parse ${file}`, cause: errors });
  return value;
});

const decodeTurbo = S.decodeUnknownEffect(TurboConfiguration);
const decodeManifest = S.decodeUnknownEffect(WorkspaceManifest);
const decodeFailure = (file: string) => (cause: unknown) =>
  PolicyFingerprintError.make({ message: `Cannot decode ${file}`, cause });

const byEntryKey = <V>(): Order.Order<readonly [string, V]> =>
  Order.mapInput(Order.String, (entry: readonly [string, V]) => entry[0]);

const decodeDeclaration = S.decodeEffect(S.fromJsonString(PolicyToolsFingerprint));
const encodeDeclaration = S.encodeEffect(PolicyToolsFingerprint);
const declarationEquivalent = S.toEquivalence(PolicyToolsFingerprint);
const stringsEquivalent = S.toEquivalence(S.Array(S.String));

const sortedUnique = (values: Iterable<string>): Array<string> =>
  A.sort(A.dedupe(A.fromIterable(values)), Order.String);

const isFingerprintEdge = (dependency: string) =>
  dependency === CHECK_TASK || Str.startsWith(SEAL_TASK_PREFIX)(dependency);

const sealTask = (key: string) => `${SEAL_TASK_PREFIX}${key}`;
const sealScript = (key: string) => `${SEAL_SCRIPT_PREFIX}${key}`;

// One policy task's script in one manifest.
interface PolicyTaskScript {
  readonly manifest: string;
  readonly script: string;
  readonly task: string;
}

const SHELL_OPERATORS = ["&&", "||", ";", "|"];
const BEEP_PREFIXES: ReadonlyArray<ReadonlyArray<string>> = [["beep-cli"], ["bun", "run", "beep"]];

const scriptWords = (script: string) => A.filter(Str.split(Str.trim(script), /\s+/), Str.isNonEmpty);

const startsWithWords = (words: ReadonlyArray<string>) => (prefix: ReadonlyArray<string>) =>
  A.every(prefix, (word, index) => words[index] === word);

// `bun run <root script> [args]`: the root script's text with the remaining args appended.
const rootScriptCall = (words: ReadonlyArray<string>, rootScripts: Readonly<Record<string, string>>) => {
  const [first, second, name] = words;
  return first === "bun" && second === "run" && name !== undefined
    ? O.map(R.get(rootScripts, name), (text) => `${text} ${A.join(A.drop(words, 3), " ")}`)
    : O.none<string>();
};

// Split a script into `beep` argv: `beep-cli <argv>`, `bun run beep <argv>`, or `bun run <root script>`
// followed recursively. Shell operators are rejected: the task would run more than one command.
const scriptArgv = (
  script: string,
  rootScripts: Readonly<Record<string, string>>,
  depth = 0
): O.Option<ReadonlyArray<string>> => {
  const words = scriptWords(script);
  if (depth > 8 || A.some(words, (word) => A.contains(SHELL_OPERATORS, word))) return O.none();
  return O.match(A.findFirst(BEEP_PREFIXES, startsWithWords(words)), {
    onSome: (prefix) => O.some(A.drop(words, prefix.length)),
    onNone: () => O.flatMap(rootScriptCall(words, rootScripts), (text) => scriptArgv(text, rootScripts, depth + 1)),
  });
};

const isQualityTask = S.is(QualityTaskName);

// Whether `bin-main.ts` routes this argv to a fast path the graph does not model.
const usesFastPath = (argv: ReadonlyArray<string>): boolean => {
  const [first, second] = argv;
  if (first === "ci") return true;
  return isQualityTask(first) && !(first === "lint" && A.contains(LINT_POLICY_SUBCOMMANDS, second ?? ""));
};

/** Decoded inputs the computation reads from one repository root. */
interface FingerprintSources {
  readonly cliDirectory: string;
  readonly rootManifestText: string;
  readonly rootScripts: Readonly<Record<string, string>>;
  readonly turbo: TurboConfiguration;
  readonly turboText: string;
  readonly workspaces: ReadonlyArray<{
    readonly workspace: PolicyWorkspace;
    readonly scripts: Readonly<Record<string, string>>;
  }>;
}

const readSources = Effect.fnUntraced(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const read = (file: string) =>
    fs
      .readFileString(path.join(root, file))
      .pipe(Effect.mapError((cause) => PolicyFingerprintError.make({ message: `Cannot read ${file}`, cause })));
  const turboText = yield* read("turbo.json");
  const turbo = yield* decodeTurbo(yield* parseJsonc("turbo.json", turboText)).pipe(
    Effect.mapError(decodeFailure("turbo.json"))
  );
  const rootManifestText = yield* read("package.json");
  const rootManifest = yield* decodeManifest(yield* parseJsonc("package.json", rootManifestText)).pipe(
    Effect.mapError(decodeFailure("package.json"))
  );
  const directories = yield* resolveWorkspaceDirs(root).pipe(
    Effect.mapError((cause) => PolicyFingerprintError.make({ message: "Cannot resolve workspaces", cause }))
  );
  const workspaces = yield* Effect.forEach(
    A.sort(HashMap.toEntries(directories), byEntryKey<string>()),
    Effect.fnUntraced(function* ([name, directory]) {
      const relative: string = normalizePath(path.relative(root, directory));
      const file = `${relative}/package.json`;
      const manifest = yield* decodeManifest(yield* parseJsonc(file, yield* read(file))).pipe(
        Effect.mapError(decodeFailure(file))
      );
      return {
        workspace: PolicyWorkspace.make({
          name,
          directory: relative,
          exports: manifest.exports,
          imports: manifest.imports,
        }),
        scripts: manifest.scripts ?? {},
      };
    })
  );
  const cli = A.findFirst(workspaces, (entry) => entry.workspace.name === CLI_WORKSPACE);
  if (O.isNone(cli))
    return yield* PolicyFingerprintError.make({ message: "CLI workspace is missing", cause: CLI_WORKSPACE });
  return {
    turboText,
    turbo,
    rootManifestText,
    rootScripts: rootManifest.scripts ?? {},
    workspaces,
    cliDirectory: cli.value.workspace.directory,
  } satisfies FingerprintSources;
});

const liveTree = Effect.fnUntraced(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const fsUtils = yield* FsUtils;
  const listings = MutableHashMap.empty<string, ReadonlyArray<string>>();
  const read = Effect.fnUntraced(
    function* (file: string) {
      const absolute = path.join(root, file);
      if (!(yield* fs.exists(absolute))) return O.none<string>();
      const info = yield* fs.stat(absolute);
      return info.type === "File" ? O.some(yield* fs.readFileString(absolute)) : O.none<string>();
    },
    (effect, file) =>
      effect.pipe(Effect.mapError((cause) => PolicyFingerprintError.make({ message: `Cannot read ${file}`, cause })))
  );
  const glob = Effect.fnUntraced(
    function* (directory: string) {
      const absolute = path.join(root, directory);
      if (!(yield* fs.exists(absolute))) return A.empty<string>();
      const files = yield* fsUtils.globFiles(
        "**/*",
        GlobOptions.make({ cwd: absolute, dot: true, ignore: ["**/node_modules/**"] })
      );
      const listed = A.sort(
        A.map(files, (file) => `${directory}/${normalizePath(file)}`),
        Order.String
      );
      MutableHashMap.set(listings, directory, listed);
      return listed;
    },
    (effect, directory) =>
      effect.pipe(
        Effect.mapError((cause) => PolicyFingerprintError.make({ message: `Cannot list ${directory}`, cause }))
      )
  );
  const tree: PolicySourceTree = {
    read,
    // Every seal renders the same workspace listings, so each directory is globbed once.
    files: (directory) =>
      O.match(MutableHashMap.get(listings, directory), {
        onSome: Effect.succeed,
        onNone: () => glob(directory),
      }),
  };
  return tree;
});

/**
 * Compute the per-task fingerprint declaration for a repository root.
 *
 * **Details**
 *
 * Reads `turbo.json`, the root manifest and every workspace manifest, maps
 * each policy task's script to a `beep` command path, and walks that path's
 * import graph. Fails when a policy script is not a single `beep` command or
 * routes through a `bin-main.ts` fast path.
 *
 * **Example** (Prepare a fingerprint computation)
 *
 * ```ts
 * import { computePolicyFingerprint } from "@beep/repo-cli/commands/Lint"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(computePolicyFingerprint("/repo"))) // true
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const computePolicyFingerprint = Effect.fn("computePolicyFingerprint")(function* (root: string) {
  const sources = yield* readSources(root);
  const tree = yield* liveTree(root);
  return yield* fingerprintFromSources(sources, tree);
});

const isPolicyTask = (sources: FingerprintSources) => (task: string) =>
  !Str.startsWith(SEAL_TASK_PREFIX)(task) && A.some(sources.turbo.tasks[task]?.dependsOn ?? [], isFingerprintEdge);

const rootTaskScripts = (sources: FingerprintSources, task: string): Array<PolicyTaskScript> =>
  O.match(R.get(sources.rootScripts, Str.slice(3)(task)), {
    onNone: A.empty<PolicyTaskScript>,
    onSome: (script) => [{ task, manifest: "package.json", script }],
  });

const packageTaskScripts = (sources: FingerprintSources, task: string): Array<PolicyTaskScript> =>
  A.getSomes(
    A.map(sources.workspaces, (entry) =>
      O.map(R.get(entry.scripts, task), (script) => ({
        task,
        manifest: `${entry.workspace.directory}/package.json`,
        script,
      }))
    )
  );

const taskScripts = (sources: FingerprintSources, task: string) =>
  Str.startsWith("//#")(task) ? rootTaskScripts(sources, task) : packageTaskScripts(sources, task);

const fingerprintFailure = (message: string, cause: unknown) => PolicyFingerprintError.make({ message, cause });

// Every policy task's scripts; a marker edge without a script is an authoring error.
const policyTaskScripts = Effect.fnUntraced(function* (sources: FingerprintSources) {
  const tasks = A.sort(A.filter(R.keys(sources.turbo.tasks), isPolicyTask(sources)), Order.String);
  const missing = A.findFirst(tasks, (task) => A.isReadonlyArrayEmpty(taskScripts(sources, task)));
  if (O.isSome(missing))
    return yield* fingerprintFailure(
      `Policy task ${missing.value} depends on ${CHECK_TASK} but no manifest defines its script`,
      missing.value
    );
  return A.flatMap(tasks, (task) => taskScripts(sources, task));
});

/** One command-path prefix: its command node, parent prefix and the policy tasks that end there. */
interface PrefixSeal {
  readonly command: ReadonlyArray<string>;
  readonly node: PolicyCommandNode;
  readonly parent: O.Option<string>;
  readonly tasks: ReadonlyArray<string>;
}

const prefixKey = (command: ReadonlyArray<string>) => A.join(command, "-");

// The command path one policy script runs, root excluded.
const scriptPath = Effect.fnUntraced(function* (
  graph: PolicyGraph,
  layout: PolicyCliLayout,
  rootScripts: Readonly<Record<string, string>>,
  entry: PolicyTaskScript
) {
  const where = `Policy task ${entry.task} in ${entry.manifest}`;
  const argv = scriptArgv(entry.script, rootScripts);
  if (O.isNone(argv))
    return yield* fingerprintFailure(`${where} does not run a single beep command: ${entry.script}`, entry.script);
  if (usesFastPath(argv.value))
    return yield* fingerprintFailure(
      `${where} routes through a bin-main fast path the fingerprint does not model: ${entry.script}`,
      entry.script
    );
  const path = A.drop(yield* graph.commandPath(layout, argv.value), 1);
  if (A.isReadonlyArrayEmpty(path))
    return yield* fingerprintFailure(`${where} names no beep subcommand: ${entry.script}`, entry.script);
  return path;
});

const pathPrefixes = (task: string, path: ReadonlyArray<PolicyCommandNode>): ReadonlyArray<PrefixSeal> =>
  A.map(path, (node, index) => {
    const command = A.map(A.take(path, index + 1), (step) => step.name);
    return {
      node,
      command,
      parent: index === 0 ? O.none() : O.some(prefixKey(A.take(command, index))),
      tasks: index === A.length(path) - 1 ? [task] : [],
    };
  });

const addPrefix = (prefixes: HashMap.HashMap<string, PrefixSeal>, seal: PrefixSeal) => {
  const key = prefixKey(seal.command);
  return HashMap.set(
    prefixes,
    key,
    O.match(HashMap.get(prefixes, key), {
      onNone: () => seal,
      onSome: (existing) => ({ ...existing, tasks: sortedUnique([...existing.tasks, ...seal.tasks]) }),
    })
  );
};

const cliLayout = (cli: string): PolicyCliLayout =>
  PolicyCliLayout.make({
    shell: [`${cli}/src/bin.ts`, `${cli}/src/bin-main.ts`],
    rootModule: `${cli}/src/commands/Root.ts`,
    rootBinding: "rootCommand",
    commandsDirectory: `${cli}/src/commands`,
  });

// The shared seal: the shell, the root command's own module, and root configuration.
const sharedInputs = Effect.fnUntraced(function* (tree: PolicySourceTree, graph: PolicyGraph, layout: PolicyCliLayout) {
  const shell = yield* graph.shellClosure(layout);
  const root = yield* graph.commandClosure([
    PolicyCommandNode.make({ module: layout.rootModule, binding: layout.rootBinding, name: "" }),
  ]);
  const reached = PolicyClosure.make({
    modules: HashSet.union(shell.modules, root.modules),
    opaqueWorkspaces: HashSet.union(shell.opaqueWorkspaces, root.opaqueWorkspaces),
  });
  return sortedUnique([...(yield* renderClosureInputs(tree, graph, reached, HashSet.empty())), ...ROOT_CONFIGS]);
});

// A rendered prefix: its own inputs, everything its chain declares, and the seal its tasks land on.
interface RenderedPrefix {
  readonly covered: HashSet.HashSet<string>;
  readonly effective: O.Option<string>;
  readonly inputs: ReadonlyArray<string>;
  readonly key: string;
  readonly parentEffective: O.Option<string>;
  readonly seal: PrefixSeal;
}

const renderPrefix = Effect.fnUntraced(function* (
  tree: PolicySourceTree,
  graph: PolicyGraph,
  sharedCovered: HashSet.HashSet<string>,
  rendered: HashMap.HashMap<string, RenderedPrefix>,
  [key, seal]: readonly [string, PrefixSeal]
) {
  const parent = O.flatMap(seal.parent, (parentKey) => HashMap.get(rendered, parentKey));
  const covered = O.match(parent, { onNone: () => sharedCovered, onSome: (value) => value.covered });
  const parentEffective = O.flatMap(parent, (value) => value.effective);
  const inputs = yield* renderClosureInputs(tree, graph, yield* graph.commandClosure([seal.node]), covered);
  return {
    key,
    seal,
    inputs,
    parentEffective,
    covered: HashSet.union(covered, HashSet.fromIterable(inputs)),
    effective: A.isReadonlyArrayEmpty(inputs) ? parentEffective : O.some(key),
  } satisfies RenderedPrefix;
});

// Parents before children, so each prefix subtracts what its chain already declares.
const renderPrefixes = Effect.fnUntraced(function* (
  tree: PolicySourceTree,
  graph: PolicyGraph,
  shared: ReadonlyArray<string>,
  prefixes: HashMap.HashMap<string, PrefixSeal>
) {
  const ordered = A.sort(
    HashMap.toEntries(prefixes),
    Order.combine(
      Order.mapInput(Order.Number, (entry: readonly [string, PrefixSeal]) => A.length(entry[1].command)),
      byEntryKey<PrefixSeal>()
    )
  );
  const sharedCovered = HashSet.fromIterable(shared);
  let rendered = HashMap.empty<string, RenderedPrefix>();
  for (const entry of ordered)
    rendered = HashMap.set(rendered, entry[0], yield* renderPrefix(tree, graph, sharedCovered, rendered, entry));
  return A.map(ordered, ([key]) => O.getOrThrow(HashMap.get(rendered, key)));
});

// A prefix that adds nothing hands its tasks to the nearest ancestor that does (or the shared seal).
const delegatesTo = (target: O.Option<string>) => (prefix: RenderedPrefix) =>
  A.isReadonlyArrayEmpty(prefix.inputs) && O.getOrUndefined(prefix.parentEffective) === O.getOrUndefined(target);

const delegatedTasks = (rendered: ReadonlyArray<RenderedPrefix>, target: O.Option<string>): ReadonlyArray<string> =>
  A.flatMap(A.filter(rendered, delegatesTo(target)), (prefix: RenderedPrefix) => prefix.seal.tasks);

const byKeyOrder = Order.mapInput(Order.String, (entry: PolicyFingerprintEntry) => entry.key);

const sealEntries = (rendered: ReadonlyArray<RenderedPrefix>) =>
  A.sort(
    A.map(
      A.filter(rendered, (prefix) => A.isReadonlyArrayNonEmpty(prefix.inputs)),
      (prefix) =>
        PolicyFingerprintEntry.make({
          key: prefix.key,
          command: prefix.seal.command,
          module: prefix.seal.node.module,
          parent: O.getOrElse(prefix.parentEffective, () => SHARED_KEY),
          tasks: sortedUnique([...prefix.seal.tasks, ...delegatedTasks(rendered, O.some(prefix.key))]),
          inputs: prefix.inputs,
        })
    ),
    byKeyOrder
  );

// The drift check has no dependents, so its inputs are whole workspaces: any
// edit that can change a closure (an import, an export map) is inside one.
const checkInputs = (
  graph: PolicyGraph,
  shared: ReadonlyArray<string>,
  entries: ReadonlyArray<PolicyFingerprintEntry>,
  manifests: ReadonlyArray<string>
) => {
  const declared = [...shared, ...A.flatMap(entries, (entry) => entry.inputs)];
  const directories = sortedUnique(
    A.map(A.getSomes(A.map(declared, graph.workspaceOf)), (workspace) => workspace.directory)
  );
  return sortedUnique([
    ...A.filter(shared, (input) => O.isNone(graph.workspaceOf(input))),
    ...A.flatMap(directories, (directory) => [`${directory}/package.json`, `${directory}/src/**`]),
    ...manifests,
    "turbo.json",
  ]);
};

const fingerprintFromSources = Effect.fnUntraced(function* (sources: FingerprintSources, tree: PolicySourceTree) {
  const graph = makePolicyGraph({
    tree,
    workspaces: A.map(sources.workspaces, (entry) => entry.workspace),
  });
  const layout = cliLayout(sources.cliDirectory);
  const scripts = yield* policyTaskScripts(sources);
  const paths = yield* Effect.forEach(scripts, (entry) =>
    Effect.map(scriptPath(graph, layout, sources.rootScripts, entry), (path) => pathPrefixes(entry.task, path))
  );
  const prefixes = A.reduce(A.flatten(paths), HashMap.empty<string, PrefixSeal>(), addPrefix);
  const shared = yield* sharedInputs(tree, graph, layout);
  const rendered = yield* renderPrefixes(tree, graph, shared, prefixes);
  const entries = sealEntries(rendered);
  return PolicyToolsFingerprint.make({
    schemaVersion: "policy-tools-fingerprint/v2",
    shared,
    sharedTasks: sortedUnique(delegatedTasks(rendered, O.none())),
    check: checkInputs(graph, shared, entries, sortedUnique(A.map(scripts, (entry) => entry.manifest))),
    entries,
  });
});

// The fingerprint edges each policy task should carry, keyed by task id.
const expectedEdges = (fingerprint: PolicyToolsFingerprint): HashMap.HashMap<string, ReadonlyArray<string>> =>
  A.reduce(
    [
      { key: SHARED_KEY, tasks: fingerprint.sharedTasks },
      ...A.map(fingerprint.entries, (entry) => ({ key: entry.key, tasks: entry.tasks })),
    ],
    HashMap.empty<string, ReadonlyArray<string>>(),
    (edges, entry) =>
      A.reduce(entry.tasks, edges, (acc, task) =>
        HashMap.set(
          acc,
          task,
          sortedUnique([...O.getOrElse(HashMap.get(acc, task), A.empty<string>), sealTask(entry.key)])
        )
      )
  );

const rewriteEdges = (dependsOn: ReadonlyArray<string>, seals: ReadonlyArray<string>): ReadonlyArray<string> => {
  const kept = A.filter(dependsOn, (dependency) => !isFingerprintEdge(dependency));
  const before = O.match(A.findFirstIndex(dependsOn, isFingerprintEdge), {
    onNone: () => A.length(kept),
    onSome: (index) => A.length(A.filter(A.take(dependsOn, index), (dependency) => !isFingerprintEdge(dependency))),
  });
  return [...A.take(kept, before), ...seals, ...A.drop(kept, before)];
};

/** A generated seal task's `turbo.json` value. */
interface SealTaskValue {
  readonly cache: true;
  readonly dependsOn?: ReadonlyArray<string>;
  readonly inputs: ReadonlyArray<string>;
  readonly outputs: ReadonlyArray<string>;
}

const sealTaskValue = (inputs: ReadonlyArray<string>, dependsOn: ReadonlyArray<string>): SealTaskValue =>
  A.isReadonlyArrayEmpty(dependsOn)
    ? { cache: true, outputs: [], inputs }
    : { cache: true, outputs: [], dependsOn, inputs };

// Every generated task in `turbo.json`, keyed by task id.
const expectedSealTasks = (fingerprint: PolicyToolsFingerprint): HashMap.HashMap<string, SealTaskValue> =>
  HashMap.fromIterable([
    [sealTask(SHARED_KEY), sealTaskValue(fingerprint.shared, [])] as const,
    ...A.map(
      fingerprint.entries,
      (entry) => [sealTask(entry.key), sealTaskValue(entry.inputs, [sealTask(entry.parent)])] as const
    ),
  ]);

const expectedSealScripts = (fingerprint: PolicyToolsFingerprint) =>
  sortedUnique([sealScript(SHARED_KEY), ...A.map(fingerprint.entries, (entry) => sealScript(entry.key))]);

const isOwnedTask = (property: string) => property === CHECK_TASK || Str.startsWith(SEAL_TASK_PREFIX)(property);
const isOwnedScript = (property: string) =>
  property === "lint:policy-fingerprint" || Str.startsWith(SEAL_SCRIPT_PREFIX)(property);

// Apply the generated edits to `turbo.json` text.
const materializeTurbo = (text: string, turbo: TurboConfiguration, fingerprint: PolicyToolsFingerprint): string => {
  const seals = expectedSealTasks(fingerprint);
  const stale = A.filter(
    R.keys(turbo.tasks),
    (task) => Str.startsWith(SEAL_TASK_PREFIX)(task) && !HashMap.has(seals, task)
  );
  const withCheck = modifyJson({ text: text, path: ["tasks", CHECK_TASK, "inputs"], value: fingerprint.check });
  const pruned = A.reduce(stale, withCheck, (next, task) =>
    modifyJson({ text: next, path: ["tasks", task], value: undefined })
  );
  const sealed = A.reduce(
    A.sort(HashMap.toEntries(seals), byEntryKey<SealTaskValue>()),
    pruned,
    (next, [task, value]) =>
      modifyJson({ text: next, path: ["tasks", task], value, insertion: insertAfterOwned(isOwnedTask)(task) })
  );
  return A.reduce(HashMap.toEntries(expectedEdges(fingerprint)), sealed, (next, [task, edges]) =>
    modifyJson({
      text: next,
      path: ["tasks", task, "dependsOn"],
      value: rewriteEdges(turbo.tasks[task]?.dependsOn ?? [], edges),
    })
  );
};

// Apply the generated seal scripts to the root manifest text.
const materializeRootManifest = (
  text: string,
  scripts: Readonly<Record<string, string>>,
  fingerprint: PolicyToolsFingerprint
): string => {
  const expected = expectedSealScripts(fingerprint);
  const stale = A.filter(
    R.keys(scripts),
    (name) => Str.startsWith(SEAL_SCRIPT_PREFIX)(name) && !A.contains(expected, name)
  );
  const pruned = A.reduce(stale, text, (next, name) =>
    modifyJson({ text: next, path: ["scripts", name], value: undefined })
  );
  return A.reduce(expected, pruned, (next, name) =>
    modifyJson({
      text: next,
      path: ["scripts", name],
      value: SEAL_SCRIPT,
      insertion: insertAfterOwned(isOwnedScript)(name),
    })
  );
};

const declarationDrift = Effect.fnUntraced(function* (
  declarationText: O.Option<string>,
  fingerprint: PolicyToolsFingerprint
) {
  if (O.isNone(declarationText)) return [FINGERPRINT_PATH];
  const declared = yield* Effect.option(decodeDeclaration(declarationText.value));
  return O.exists(declared, (value) => declarationEquivalent(value, fingerprint)) ? [] : [FINGERPRINT_PATH];
});

const sealMatches = (actual: TurboTask | undefined, expected: SealTaskValue) =>
  actual !== undefined &&
  actual.cache === true &&
  stringsEquivalent(actual.outputs ?? [], []) &&
  stringsEquivalent(actual.inputs ?? [], expected.inputs) &&
  stringsEquivalent(actual.dependsOn ?? [], expected.dependsOn ?? []);

const turboDrift = (tasks: Readonly<Record<string, TurboTask>>, fingerprint: PolicyToolsFingerprint) => {
  const seals = expectedSealTasks(fingerprint);
  const check = stringsEquivalent(tasks[CHECK_TASK]?.inputs ?? [], fingerprint.check)
    ? []
    : [`turbo.json tasks["${CHECK_TASK}"].inputs`];
  const sealed = A.map(
    A.filter(
      A.sort(HashMap.toEntries(seals), byEntryKey<SealTaskValue>()),
      ([task, value]) => !sealMatches(tasks[task], value)
    ),
    ([task]) => `turbo.json tasks["${task}"]`
  );
  const stale = A.map(
    A.filter(R.keys(tasks), (task) => Str.startsWith(SEAL_TASK_PREFIX)(task) && !HashMap.has(seals, task)),
    (task) => `turbo.json tasks["${task}"] (stale)`
  );
  const edges = A.map(
    A.filter(
      A.sort(HashMap.toEntries(expectedEdges(fingerprint)), byEntryKey<ReadonlyArray<string>>()),
      ([task, expected]) =>
        !stringsEquivalent(sortedUnique(A.filter(tasks[task]?.dependsOn ?? [], isFingerprintEdge)), expected)
    ),
    ([task]) => `turbo.json tasks["${task}"].dependsOn`
  );
  return [...check, ...sealed, ...stale, ...edges];
};

const scriptDrift = (rootScripts: Readonly<Record<string, string>>, fingerprint: PolicyToolsFingerprint) => {
  const expected = expectedSealScripts(fingerprint);
  return [
    ...A.map(
      A.filter(expected, (name) => rootScripts[name] !== SEAL_SCRIPT),
      (name) => `package.json scripts["${name}"]`
    ),
    ...A.map(
      A.filter(R.keys(rootScripts), (name) => Str.startsWith(SEAL_SCRIPT_PREFIX)(name) && !A.contains(expected, name)),
      (name) => `package.json scripts["${name}"] (stale)`
    ),
  ];
};

// The drift between a repository's generated files and a fingerprint.
const driftOf = Effect.fnUntraced(function* (
  sources: FingerprintSources,
  declarationText: O.Option<string>,
  fingerprint: PolicyToolsFingerprint
) {
  return [
    ...(yield* declarationDrift(declarationText, fingerprint)),
    ...turboDrift(sources.turbo.tasks, fingerprint),
    ...scriptDrift(sources.rootScripts, fingerprint),
  ];
});

interface PolicyToolsFingerprintPolicyShape {
  readonly check: Effect.Effect<void, PolicyFingerprintError>;
  readonly write: Effect.Effect<void, PolicyFingerprintError>;
}

/**
 * Checks or writes the generated per-task fingerprint files of one repository root.
 *
 * **Example** (Reference the fingerprint policy service)
 *
 * ```ts
 * import { PolicyToolsFingerprintPolicy } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(typeof PolicyToolsFingerprintPolicy.make) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PolicyToolsFingerprintPolicy extends Context.Service<
  PolicyToolsFingerprintPolicy,
  PolicyToolsFingerprintPolicyShape
>()($I`PolicyToolsFingerprintPolicy`, {
  make: Effect.fn("PolicyToolsFingerprintPolicy.make")(function* (root: string) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const fsUtils = yield* FsUtils;
    const provide = <A, E>(
      effect: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path | FsUtils>
    ): Effect.Effect<A, E> =>
      effect.pipe(
        Effect.provideService(FileSystem.FileSystem, fs),
        Effect.provideService(Path.Path, path),
        Effect.provideService(FsUtils, fsUtils)
      );
    const declarationFile = path.join(root, FINGERPRINT_PATH);
    const readDeclaration = fs.exists(declarationFile).pipe(
      Effect.flatMap((exists) => (exists ? Effect.asSome(fs.readFileString(declarationFile)) : Effect.succeedNone)),
      Effect.mapError((cause) => PolicyFingerprintError.make({ message: `Cannot read ${FINGERPRINT_PATH}`, cause }))
    );
    const compute = provide(
      Effect.gen(function* () {
        const sources = yield* readSources(root);
        const tree = yield* liveTree(root);
        return { sources, fingerprint: yield* fingerprintFromSources(sources, tree) } as const;
      })
    );
    const check = Effect.gen(function* () {
      const { sources, fingerprint } = yield* compute;
      const drift = yield* driftOf(sources, yield* readDeclaration, fingerprint);
      if (A.isReadonlyArrayNonEmpty(drift)) {
        return yield* PolicyFingerprintError.make({
          message: `Policy fingerprint drift: ${A.join(drift, "; ")}; run bun run beep lint policy-fingerprint --write.`,
          cause: drift,
        });
      }
    }).pipe(Effect.withSpan("PolicyToolsFingerprintPolicy.check"));
    const write = Effect.gen(function* () {
      const { sources, fingerprint } = yield* compute;
      const declaration = renderJsonDocument(
        yield* encodeDeclaration(fingerprint).pipe(
          Effect.mapError((cause) => PolicyFingerprintError.make({ message: "Cannot encode the declaration", cause }))
        )
      );
      const turbo = materializeTurbo(sources.turboText, sources.turbo, fingerprint);
      const manifest = materializeRootManifest(sources.rootManifestText, sources.rootScripts, fingerprint);
      yield* Effect.all([
        fs
          .makeDirectory(path.dirname(declarationFile), { recursive: true })
          .pipe(Effect.andThen(fs.writeFileString(declarationFile, `${declaration}\n`))),
        fs.writeFileString(path.join(root, "turbo.json"), turbo),
        fs.writeFileString(path.join(root, "package.json"), manifest),
      ]).pipe(
        Effect.mapError((cause) => PolicyFingerprintError.make({ message: "Cannot write the fingerprint", cause }))
      );
    }).pipe(Effect.withSpan("PolicyToolsFingerprintPolicy.write"));
    return { check, write };
  }),
}) {}

/**
 * Fails on per-task fingerprint drift, or writes the generated files.
 *
 * **Example** (Inspect the fingerprint gate name)
 *
 * ```ts
 * import { lintPolicyFingerprintCommand } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(lintPolicyFingerprintCommand.name) // policy-fingerprint
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const lintPolicyFingerprintCommand = Command.make(
  "policy-fingerprint",
  {
    check: Flag.Boolean("check").pipe(Flag.withDefault(false)),
    write: Flag.Boolean("write").pipe(Flag.withDefault(false)),
  },
  Effect.fn("lintPolicyFingerprint")(function* ({ check, write }) {
    if (check && write) return yield* failWithReportedExit("Choose --check or --write, not both.");
    const root = yield* findRepoRoot();
    const policy = yield* PolicyToolsFingerprintPolicy.make(root);
    if (write) {
      yield* policy.write;
      yield* Console.log("policy-fingerprint: written");
    } else {
      yield* policy.check;
      yield* Console.log("policy-fingerprint: current");
    }
  })
).pipe(Command.withDescription("Check or generate the per-task policy fingerprint seal tasks"));
