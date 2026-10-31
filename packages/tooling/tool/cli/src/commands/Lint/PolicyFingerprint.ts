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
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as jsonc from "jsonc-parser";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { LINT_POLICY_SUBCOMMANDS } from "../../internal/cli/LintRouting.ts";
import { QualityTaskName } from "../Quality/Quality.schemas.ts";
import { OXLINT_CIRCULAR_CONFIG, OXLINT_DEPRECATED_APIS_CONFIG } from "./internal/LintPackage.ts";
import {
  makePolicyGraph,
  PolicyCliLayout,
  PolicyClosure,
  PolicyGraphOptions,
  PolicyWorkspace,
  renderClosureInputs,
} from "./internal/PolicyFingerprintGraph.ts";
import { PolicyFingerprintEntry, PolicyFingerprintError, PolicyToolsFingerprint } from "./PolicyFingerprint.schemas.ts";
import type { PolicyCommandNode, PolicySourceTree } from "./internal/PolicyFingerprintGraph.ts";

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

/** One policy task and the script texts that run it. */
interface PolicyTaskScripts {
  readonly scripts: ReadonlyArray<{ readonly manifest: string; readonly script: string }>;
  readonly task: string;
}

/**
 * Split a script into `beep` argv tokens.
 *
 * **Details**
 *
 * Accepts `beep-cli <argv>`, `bun run beep <argv>`, and
 * `bun run <script> [args]` where the root manifest defines `<script>`
 * (followed recursively).
 * Shell operators are rejected: the task would run more than one command.
 *
 * @param script - Package script text to split.
 * @param rootScripts - Root manifest scripts used to follow `bun run <script>` indirection.
 * @param depth - Number of root-script indirections already followed.
 * @returns The `beep` argv tokens, or `None` when the script is not a single `beep` command.
 */
const scriptArgv = (
  script: string,
  rootScripts: Readonly<Record<string, string>>,
  depth = 0
): O.Option<ReadonlyArray<string>> => {
  const words = A.filter(Str.split(Str.trim(script), /\s+/), Str.isNonEmpty);
  if (depth > 8 || A.some(words, (word) => A.contains(["&&", "||", ";", "|"], word))) return O.none();
  const [first, second, third] = words;
  if (first === "beep-cli") return O.some(A.drop(words, 1));
  if (first === "bun" && second === "run" && third === "beep") return O.some(A.drop(words, 3));
  if (first === "bun" && second === "run" && third !== undefined && R.has(rootScripts, third))
    return scriptArgv(`${rootScripts[third]} ${A.join(A.drop(words, 3), " ")}`, rootScripts, depth + 1);
  return O.none();
};

const isQualityTask = S.is(QualityTaskName);

/**
 * Whether `bin-main.ts` routes this argv to a fast path the graph does not model.
 *
 * @param argv - The `beep` argv tokens a policy task runs.
 * @returns `true` when the argv takes a fast path outside the command graph.
 */
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
  readonly workspaces: ReadonlyArray<PolicyWorkspace & { readonly scripts: Readonly<Record<string, string>> }>;
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
        ...PolicyWorkspace.make({ name, directory: relative, exports: manifest.exports, imports: manifest.imports }),
        scripts: manifest.scripts ?? {},
      };
    })
  );
  const cli = A.findFirst(workspaces, (workspace) => workspace.name === CLI_WORKSPACE);
  if (O.isNone(cli))
    return yield* PolicyFingerprintError.make({ message: "CLI workspace is missing", cause: CLI_WORKSPACE });
  return {
    turboText,
    turbo,
    rootManifestText,
    rootScripts: rootManifest.scripts ?? {},
    workspaces,
    cliDirectory: cli.value.directory,
  } satisfies FingerprintSources;
});

const policyTasks = (sources: FingerprintSources): ReadonlyArray<PolicyTaskScripts> =>
  A.map(
    A.sort(
      A.filter(
        R.keys(sources.turbo.tasks),
        (task) =>
          !Str.startsWith(SEAL_TASK_PREFIX)(task) &&
          A.some(sources.turbo.tasks[task]?.dependsOn ?? [], isFingerprintEdge)
      ),
      Order.String
    ),
    (task) =>
      Str.startsWith("//#")(task)
        ? {
            task,
            scripts: O.match(R.get(sources.rootScripts, Str.slice(3)(task)), {
              onNone: A.empty<{ readonly manifest: string; readonly script: string }>,
              onSome: (script) => [{ manifest: "package.json", script }],
            }),
          }
        : {
            task,
            scripts: A.getSomes(
              A.map(sources.workspaces, (workspace) =>
                O.map(R.get(workspace.scripts, task), (script) => ({
                  manifest: `${workspace.directory}/package.json`,
                  script,
                }))
              )
            ),
          }
  );

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

/** One command-path prefix: its command node, parent prefix and the policy tasks that end there. */
interface PrefixSeal {
  readonly command: ReadonlyArray<string>;
  readonly node: PolicyCommandNode;
  readonly parent: O.Option<string>;
  readonly tasks: Array<string>;
}

const prefixKey = (command: ReadonlyArray<string>) => A.join(command, "-");

const fingerprintFromSources = Effect.fnUntraced(function* (sources: FingerprintSources, tree: PolicySourceTree) {
  const graph = makePolicyGraph(PolicyGraphOptions.make({ tree, workspaces: sources.workspaces }));
  const cli = sources.cliDirectory;
  const layout = PolicyCliLayout.make({
    shell: [`${cli}/src/bin.ts`, `${cli}/src/bin-main.ts`],
    rootModule: `${cli}/src/commands/Root.ts`,
    rootBinding: "rootCommand",
    commandsDirectory: `${cli}/src/commands`,
  });

  let prefixes = HashMap.empty<string, PrefixSeal>();
  let manifests = HashSet.empty<string>();
  let rootNode = O.none<PolicyCommandNode>();
  for (const { task, scripts } of policyTasks(sources)) {
    if (A.isReadonlyArrayEmpty(scripts)) {
      return yield* PolicyFingerprintError.make({
        message: `Policy task ${task} depends on ${CHECK_TASK} but no manifest defines its script`,
        cause: task,
      });
    }
    for (const { manifest, script } of scripts) {
      manifests = HashSet.add(manifests, manifest);
      const argv = scriptArgv(script, sources.rootScripts);
      if (O.isNone(argv)) {
        return yield* PolicyFingerprintError.make({
          message: `Policy task ${task} in ${manifest} does not run a single beep command: ${script}`,
          cause: script,
        });
      }
      if (usesFastPath(argv.value)) {
        return yield* PolicyFingerprintError.make({
          message: `Policy task ${task} routes through a bin-main fast path the fingerprint does not model: ${script}`,
          cause: script,
        });
      }
      const [root, ...path] = yield* graph.commandPath(layout, argv.value);
      if (root === undefined || !A.isReadonlyArrayNonEmpty(path)) {
        return yield* PolicyFingerprintError.make({
          message: `Policy task ${task} in ${manifest} names no beep subcommand: ${script}`,
          cause: script,
        });
      }
      rootNode = O.some(root);
      A.forEach(path, (node, index) => {
        const command = A.map(A.take(path, index + 1), (step) => step.name);
        const key = prefixKey(command);
        const existing = HashMap.get(prefixes, key);
        const seal = O.getOrElse(existing, () => ({
          node,
          command,
          parent: index === 0 ? O.none<string>() : O.some(prefixKey(A.take(command, index))),
          tasks: A.empty<string>(),
        }));
        if (index === A.length(path) - 1 && !A.contains(seal.tasks, task)) seal.tasks.push(task);
        if (O.isNone(existing)) prefixes = HashMap.set(prefixes, key, seal);
      });
    }
  }

  // The shared seal: the shell, the root command's own module, and root configuration.
  const shell = yield* graph.shellClosure(layout);
  const rootClosure = O.isSome(rootNode)
    ? yield* graph.commandClosure([rootNode.value])
    : PolicyClosure.make({ modules: HashSet.empty<string>(), opaqueWorkspaces: HashSet.empty<string>() });
  const shared = sortedUnique([
    ...(yield* renderClosureInputs(
      tree,
      graph,
      PolicyClosure.make({
        modules: HashSet.union(shell.modules, rootClosure.modules),
        opaqueWorkspaces: HashSet.union(shell.opaqueWorkspaces, rootClosure.opaqueWorkspaces),
      }),
      HashSet.empty()
    )),
    ...ROOT_CONFIGS,
  ]);

  // Each prefix seals what its command adds over its ancestors; a prefix that adds
  // nothing hands its tasks to the nearest ancestor that does (or the shared seal).
  const ordered = A.sort(
    HashMap.toEntries(prefixes),
    Order.combine(
      Order.mapInput(Order.Number, (entry: readonly [string, PrefixSeal]) => A.length(entry[1].command)),
      byEntryKey<PrefixSeal>()
    )
  );
  let rendered = HashMap.empty<
    string,
    { readonly covered: HashSet.HashSet<string>; readonly effective: O.Option<string> }
  >();
  const sharedCovered = HashSet.fromIterable(shared);
  const entries: Array<PolicyFingerprintEntry> = [];
  let sharedTasks = A.empty<string>();
  for (const [key, seal] of ordered) {
    const parent = O.flatMap(seal.parent, (parentKey) => HashMap.get(rendered, parentKey));
    const covered = O.match(parent, { onNone: () => sharedCovered, onSome: (value) => value.covered });
    const parentEffective = O.flatMap(parent, (value) => value.effective);
    const closure = yield* graph.commandClosure([seal.node]);
    const inputs = yield* renderClosureInputs(tree, graph, closure, covered);
    const effective = A.isReadonlyArrayEmpty(inputs) ? parentEffective : O.some(key);
    rendered = HashMap.set(rendered, key, {
      covered: HashSet.union(covered, HashSet.fromIterable(inputs)),
      effective,
    });
    if (A.isReadonlyArrayNonEmpty(inputs)) {
      entries.push(
        PolicyFingerprintEntry.make({
          key,
          command: seal.command,
          module: seal.node.module,
          parent: O.getOrElse(parentEffective, () => SHARED_KEY),
          tasks: A.sort(seal.tasks, Order.String),
          inputs,
        })
      );
    } else if (A.isReadonlyArrayNonEmpty(seal.tasks)) {
      const target = O.flatMap(parentEffective, (parentKey) =>
        A.findFirstIndex(entries, (entry) => entry.key === parentKey)
      );
      if (O.isNone(target)) sharedTasks = sortedUnique([...sharedTasks, ...seal.tasks]);
      else {
        const entry = entries[target.value];
        if (entry !== undefined)
          entries[target.value] = PolicyFingerprintEntry.make({
            ...entry,
            tasks: sortedUnique([...entry.tasks, ...seal.tasks]),
          });
      }
    }
  }

  // The drift check has no dependents, so its inputs are whole workspaces: any
  // edit that can change a closure (an import, an export map) is inside one.
  const workspaceInputs = A.flatMap(
    sortedUnique(
      A.getSomes(
        A.map([...shared, ...A.flatMap(entries, (entry) => entry.inputs)], (input) =>
          O.map(graph.workspaceOf(input), (workspace) => workspace.directory)
        )
      )
    ),
    (directory) => [`${directory}/package.json`, `${directory}/src/**`]
  );
  const check = sortedUnique([
    ...A.filter(shared, (input) => O.isNone(graph.workspaceOf(input))),
    ...workspaceInputs,
    ...manifests,
    "turbo.json",
  ]);
  return PolicyToolsFingerprint.make({
    schemaVersion: "policy-tools-fingerprint/v2",
    shared,
    sharedTasks,
    check,
    entries: A.sort(
      entries,
      Order.mapInput(Order.String, (entry: PolicyFingerprintEntry) => entry.key)
    ),
  });
});

/**
 * The fingerprint edges each policy task should carry, keyed by task id.
 *
 * @param fingerprint - The computed policy tools fingerprint.
 * @returns The sorted seal-task dependencies per policy task id.
 */
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
  const first = A.findFirstIndex(dependsOn, isFingerprintEdge);
  const kept = A.filter(dependsOn, (dependency) => !isFingerprintEdge(dependency));
  return O.match(first, {
    onNone: () => [...kept, ...seals],
    onSome: (index) => {
      const before = A.length(A.filter(A.take(dependsOn, index), (dependency) => !isFingerprintEdge(dependency)));
      return [...A.take(kept, before), ...seals, ...A.drop(kept, before)];
    },
  });
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

/**
 * Every generated task in `turbo.json`, keyed by task id.
 *
 * @param fingerprint - The computed policy tools fingerprint.
 * @returns The seal task values to write, keyed by seal task id.
 */
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

const FORMATTING = { formattingOptions: { insertSpaces: true, tabSize: 2, eol: "\n" } } as const;
/** The repository's Biome JSON line width; generated values are laid out the way Biome formats them. */
const JSON_LINE_WIDTH = 80;

const insertAfterOwned =
  (owned: (property: string) => boolean, key: string) =>
  (properties: Array<string>): number => {
    const index = A.findLastIndex(properties, (property) => owned(property) && property <= key);
    return O.match(index, { onNone: () => properties.length, onSome: (value) => value + 1 });
  };

const isScalar = (value: unknown) => !P.isObject(value) || value === null;

/**
 * Render a JSON value the way Biome formats it: objects expanded, an array of
 * scalars on one line when it fits the line width (counting a following
 * comma), otherwise one element per line.
 *
 * @param value - The JSON value to render.
 * @param indent - The indentation of the line the value starts on.
 * @param column - The column the value starts at.
 * @param trailing - Characters that follow the value on its line (1 for a comma, else 0).
 * @returns The rendered JSON text.
 */
const renderJson = (value: unknown, indent: string, column: number, trailing: number): string => {
  if (A.isArray(value)) {
    if (A.isReadonlyArrayEmpty(value)) return "[]";
    const items = A.map(value, (item) => renderJson(item, `${indent}  `, indent.length + 2, 1));
    const inline = `[${A.join(items, ", ")}]`;
    if (A.every(value, isScalar) && column + inline.length + trailing <= JSON_LINE_WIDTH) return inline;
    const lines = A.map(
      value,
      (item, index) =>
        `${indent}  ${renderJson(item, `${indent}  `, indent.length + 2, index === value.length - 1 ? 0 : 1)}`
    );
    return `[\n${A.join(lines, ",\n")}\n${indent}]`;
  }
  if (P.isObject(value) && value !== null) {
    const entries = R.toEntries(value as Readonly<Record<string, unknown>>);
    if (A.isReadonlyArrayEmpty(entries)) return "{}";
    const lines = A.map(entries, ([key, member], index) => {
      const prefix = `${indent}  ${JSON.stringify(key)}: `;
      return `${prefix}${renderJson(member, `${indent}  `, prefix.length, index === entries.length - 1 ? 0 : 1)}`;
    });
    return `{\n${A.join(lines, ",\n")}\n${indent}}`;
  }
  return JSON.stringify(value);
};

/**
 * Set a value with jsonc, then re-lay the written node out the way Biome would.
 *
 * @param text - The JSON document text to edit.
 * @param path - The JSON path of the value to set.
 * @param value - The value to write, or `undefined` to remove the property.
 * @param insertion - Optional insertion-index chooser for a new property.
 * @returns The edited document text.
 */
const modify = (
  text: string,
  path: jsonc.JSONPath,
  value: unknown,
  insertion?: (properties: Array<string>) => number
) => {
  const next = jsonc.applyEdits(
    text,
    jsonc.modify(
      text,
      path,
      value,
      insertion === undefined ? FORMATTING : { ...FORMATTING, getInsertionIndex: insertion }
    )
  );
  if (value === undefined) return next;
  const tree = jsonc.parseTree(next);
  const node = tree === undefined ? undefined : jsonc.findNodeAtLocation(tree, path);
  if (node === undefined) return next;
  const lineStart = Str.lastIndexOf("\n")(Str.slice(0, node.offset)(next));
  const start = O.match(lineStart, { onNone: () => 0, onSome: (index) => index + 1 });
  const line = Str.slice(start, node.offset)(next);
  const indent = O.getOrElse(
    O.map(Str.match(/^ */)(line), (match) => match[0]),
    () => ""
  );
  const following = Str.trimStart(Str.slice(node.offset + node.length)(next));
  const rendered = renderJson(value, indent, node.offset - start, Str.startsWith(",")(following) ? 1 : 0);
  return `${Str.slice(0, node.offset)(next)}${rendered}${Str.slice(node.offset + node.length)(next)}`;
};

/**
 * Apply the generated edits to `turbo.json` text.
 *
 * @param text - The current `turbo.json` text.
 * @param turbo - The decoded `turbo.json` configuration.
 * @param fingerprint - The computed policy tools fingerprint.
 * @returns The `turbo.json` text with the generated seal tasks and edges.
 */
const materializeTurbo = (text: string, turbo: TurboConfiguration, fingerprint: PolicyToolsFingerprint): string => {
  const seals = expectedSealTasks(fingerprint);
  const edges = expectedEdges(fingerprint);
  let next = modify(text, ["tasks", CHECK_TASK, "inputs"], fingerprint.check);
  for (const task of R.keys(turbo.tasks))
    if (Str.startsWith(SEAL_TASK_PREFIX)(task) && !HashMap.has(seals, task))
      next = modify(next, ["tasks", task], undefined);
  for (const [task, value] of A.sort(HashMap.toEntries(seals), byEntryKey<SealTaskValue>())) {
    next = modify(
      next,
      ["tasks", task],
      value,
      insertAfterOwned((property) => property === CHECK_TASK || Str.startsWith(SEAL_TASK_PREFIX)(property), task)
    );
  }
  for (const [task, seals] of HashMap.toEntries(edges)) {
    const current = turbo.tasks[task]?.dependsOn ?? [];
    next = modify(next, ["tasks", task, "dependsOn"], rewriteEdges(current, seals));
  }
  return next;
};

/**
 * Apply the generated seal scripts to the root manifest text.
 *
 * @param text - The current root `package.json` text.
 * @param scripts - The root manifest's current scripts.
 * @param fingerprint - The computed policy tools fingerprint.
 * @returns The root manifest text with the generated seal scripts.
 */
const materializeRootManifest = (
  text: string,
  scripts: Readonly<Record<string, string>>,
  fingerprint: PolicyToolsFingerprint
): string => {
  const expected = expectedSealScripts(fingerprint);
  let next = text;
  for (const name of R.keys(scripts))
    if (Str.startsWith(SEAL_SCRIPT_PREFIX)(name) && !A.contains(expected, name))
      next = modify(next, ["scripts", name], undefined);
  for (const name of expected) {
    next = modify(
      next,
      ["scripts", name],
      SEAL_SCRIPT,
      insertAfterOwned(
        (property) => property === "lint:policy-fingerprint" || Str.startsWith(SEAL_SCRIPT_PREFIX)(property),
        name
      )
    );
  }
  return next;
};

/** The drift between a repository's generated files and a fingerprint. */
const driftOf = Effect.fnUntraced(function* (
  sources: FingerprintSources,
  declarationText: O.Option<string>,
  fingerprint: PolicyToolsFingerprint
) {
  const drift: Array<string> = [];
  const declared = O.isNone(declarationText)
    ? O.none<PolicyToolsFingerprint>()
    : yield* decodeDeclaration(declarationText.value).pipe(Effect.option);
  if (O.isNone(declared) || !declarationEquivalent(declared.value, fingerprint)) drift.push(FINGERPRINT_PATH);
  const tasks = sources.turbo.tasks;
  if (!stringsEquivalent(tasks[CHECK_TASK]?.inputs ?? [], fingerprint.check))
    drift.push(`turbo.json tasks["${CHECK_TASK}"].inputs`);
  const seals = expectedSealTasks(fingerprint);
  for (const [task, value] of A.sort(HashMap.toEntries(seals), byEntryKey<SealTaskValue>())) {
    const actual = tasks[task];
    if (
      actual === undefined ||
      actual.cache !== true ||
      !stringsEquivalent(actual.outputs ?? [], []) ||
      !stringsEquivalent(actual.inputs ?? [], value.inputs) ||
      !stringsEquivalent(actual.dependsOn ?? [], value.dependsOn ?? [])
    )
      drift.push(`turbo.json tasks["${task}"]`);
  }
  for (const task of R.keys(tasks))
    if (Str.startsWith(SEAL_TASK_PREFIX)(task) && !HashMap.has(seals, task))
      drift.push(`turbo.json tasks["${task}"] (stale)`);
  for (const [task, expected] of A.sort(
    HashMap.toEntries(expectedEdges(fingerprint)),
    byEntryKey<ReadonlyArray<string>>()
  )) {
    const actual = A.filter(tasks[task]?.dependsOn ?? [], isFingerprintEdge);
    if (!stringsEquivalent(sortedUnique(actual), expected)) drift.push(`turbo.json tasks["${task}"].dependsOn`);
  }
  const scripts = expectedSealScripts(fingerprint);
  for (const name of scripts)
    if (sources.rootScripts[name] !== SEAL_SCRIPT) drift.push(`package.json scripts["${name}"]`);
  for (const name of R.keys(sources.rootScripts))
    if (Str.startsWith(SEAL_SCRIPT_PREFIX)(name) && !A.contains(scripts, name))
      drift.push(`package.json scripts["${name}"] (stale)`);
  return drift;
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
      const declaration = renderJson(
        yield* encodeDeclaration(fingerprint).pipe(
          Effect.mapError((cause) => PolicyFingerprintError.make({ message: "Cannot encode the declaration", cause }))
        ),
        "",
        0,
        0
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
