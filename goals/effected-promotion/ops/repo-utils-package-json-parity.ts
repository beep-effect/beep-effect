/**
 * Before-and-after parity for the repo-utils package.json model re-base (3-A3).
 *
 * 3-A3 rebuilds repo-utils `schemas/PackageJson.ts` on `PackageManifest.extend`
 * from `@beep/package-json` and moves the manifest dependency maps, `scripts`
 * and the `WorkspaceDeps` buckets to `HashMap`. The retired model is about
 * 2,000 lines, too large to copy as an oracle, so this script follows the R1
 * precedent (`semver-owner-switch-differential.ts`): it imports only the
 * barrel names 3-A3 keeps, runs unchanged on both sides of the switch, and
 * compares a recorded baseline with the head.
 *
 * - `--record <path>` runs on the code before the switch and writes the
 *   baseline (`research/repo-utils-package-json-parity-3a3-before.json`). To
 *   re-record after changing this op, check out the pre-switch repo-utils
 *   `src` (f1a0fc8734) in place, run `--record`, and restore the head `src`.
 * - `--compare <path>` runs at the head, reads that baseline, writes the head
 *   report (`--out`, default stdout) and fails on any difference that is not
 *   listed in `INTENDED` with its reason.
 *
 * Every decoded value is rendered through `plain`, which flattens `Option`
 * (the old field shape) and `HashMap` (the new one) to sorted JSON, so the
 * two models compare by value rather than by representation.
 *
 * Per tracked manifest (`git ls-files '*package.json'`, test fixtures
 * excluded) it records the strict verdict, the sorted `(pointer, message)`
 * issues, the canonical pretty bytes, the normalized JSON, the decode-encode
 * round trip, the `beep` projection and the classified workspace dependency
 * buckets. Repo-wide it records the resolved workspace names, the flattened
 * dependency index, the topological order and the root workspace globs. A
 * mutation corpus injects one unknown key, one bad dependency key, one bad
 * `exports` key and one bad `imports` key into every manifest, plus the
 * malformed documents the schema tests pin (one unknown key nested in each
 * object-valued field the kit owns among them), and compares verdict and
 * pointers. A `rawKeyOrder` difference whose fields hold the same keys is
 * reported as `rawKeyOrder:reorder`. `rawKeyOrder` records the key order of every object-valued field
 * of the raw encoder output, which `plain` would otherwise sort away. The
 * JSON Schema document is compared by the root definition's property set and
 * `additionalProperties`, and by each root property's emitted shape (`$ref`s
 * inlined, annotation-only keys dropped); the other definitions are listed,
 * not gated, because the kit fields bring their own names.
 *
 * Usage (from the repo root):
 *
 *   bun goals/effected-promotion/ops/repo-utils-package-json-parity.ts --record <baseline.json>
 *   bun goals/effected-promotion/ops/repo-utils-package-json-parity.ts --compare <baseline.json> [--out <report.json>]
 */
import * as NodeURL from "node:url";
import {
  DomainError,
  decodePackageJsonEffect,
  encodePackageJsonCanonicalPrettyEffect,
  encodePackageJsonEffect,
  FsUtils,
  GlobOptions,
  getPackageJsonSchemaIssues,
  normalizePackageJsonEffect,
  packageJsonJsonSchema,
  topologicalSort,
} from "@beep/repo-utils";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { PackageJson } from "@beep/repo-utils";

const TOOL = "goals/effected-promotion/ops/repo-utils-package-json-parity.ts";
const SCOPE = "git ls-files '*package.json' excluding **/test/fixtures/**";

class ParityFailure extends Data.TaggedError("ParityFailure")<{ readonly message: string }> {}

const repoRoot = NodeURL.fileURLToPath(new URL("../../..", import.meta.url));
const repoRootDir = Str.endsWith("/")(repoRoot) ? repoRoot.slice(0, -1) : repoRoot;

const flagValue = (flag: string): O.Option<string> =>
  O.flatMap(
    A.findFirstIndex(process.argv, (arg) => arg === flag),
    (index) => A.get(process.argv, index + 1)
  );

// --- frozen retired readers ------------------------------------------------------

// Simplified stand-ins for repo-utils `Workspaces.ts` `workspaceGlobsFrom` and `resolveWorkspaceDirs`,
// `Dependencies.ts` `extractWorkspaceDependencies` and `sortWorkspacePackages`, and `DependencyIndex.ts`
// `buildRepoDependencyIndex`, written when 4-A3 retired those modules (every caller moved onto
// `@beep/repo-workspaces`). They are NOT the readers the 3-A3 record measured: `workspaceGlobsFrom` reads the
// field as `unknown` instead of the strict `WorkspacesField`, and `resolveWorkspaceDirs` omits the retired
// `isSafeWorkspacePattern` refusal (empty, absolute and `..` globs), the canonical-root containment check on each
// member's real path and the tolerance of a manifest that vanished mid-scan. None of those checks fires on the
// live repository (no unsafe glob, no escaping member), so a re-run reproduces the record; the faithful frozen
// copy is `ops/repo-workspaces-adoption-parity.ts`.
const ROOT_KEY = "@beep/root";
const IGNORED_DIRS = ["**/node_modules/**", "**/dist/**", "**/build/**", "**/coverage/**", "**/.turbo/**"];
const workspaceGlobsFrom = (workspaces: unknown): ReadonlyArray<string> => {
  if (A.isArray(workspaces)) return A.filter(workspaces, P.isString);
  if (P.isObject(workspaces) && P.hasProperty(workspaces, "packages") && A.isArray(workspaces.packages)) {
    return A.filter(workspaces.packages, P.isString);
  }
  return [];
};
type LegacyBuckets = {
  readonly dependencies: HashMap.HashMap<string, string>;
  readonly devDependencies: HashMap.HashMap<string, string>;
  readonly peerDependencies: HashMap.HashMap<string, string>;
  readonly optionalDependencies: HashMap.HashMap<string, string>;
};
type LegacyWorkspaceDeps = {
  readonly packageName: string;
  readonly workspace: LegacyBuckets;
  readonly npm: LegacyBuckets;
};
const extractWorkspaceDependencies = (
  packageJson: PackageJson.Type,
  workspaceNames: HashSet.HashSet<string>
): LegacyWorkspaceDeps => {
  const split = (dependencies: HashMap.HashMap<string, string>) => ({
    workspace: HashMap.filter(dependencies, (_, name) => HashSet.has(workspaceNames, name)),
    npm: HashMap.filter(dependencies, (_, name) => !HashSet.has(workspaceNames, name)),
  });
  const deps = split(packageJson.dependencies);
  const devDeps = split(packageJson.devDependencies);
  const peerDeps = split(packageJson.peerDependencies);
  const optDeps = split(packageJson.optionalDependencies);
  return {
    packageName: `${packageJson.name}`,
    workspace: {
      dependencies: deps.workspace,
      devDependencies: devDeps.workspace,
      peerDependencies: peerDeps.workspace,
      optionalDependencies: optDeps.workspace,
    },
    npm: {
      dependencies: deps.npm,
      devDependencies: devDeps.npm,
      peerDependencies: peerDeps.npm,
      optionalDependencies: optDeps.npm,
    },
  };
};
const resolveWorkspaceDirs = Effect.fn("frozen.resolveWorkspaceDirs")(function* (rootDir: string) {
  const fsUtils = yield* FsUtils;
  const rawRoot = yield* fsUtils.readJson(`${rootDir}/package.json`);
  if (O.isNone(rawRoot)) return yield* DomainError.make({ message: "Failed to parse the root package.json" });
  const rootPackage = yield* decodePackageJsonEffect(rawRoot.value);
  const manifests = yield* fsUtils.globFiles(
    A.map(workspaceGlobsFrom(rootPackage.workspaces), (glob) => `${Str.replace(/\/+$/, "")(glob)}/package.json`),
    GlobOptions.make({ cwd: rootDir, absolute: true, followSymlinks: true, ignore: IGNORED_DIRS })
  );
  const entries = yield* Effect.forEach(manifests, (manifest) =>
    Effect.gen(function* () {
      const dir = yield* fsUtils.getParentDirectory(manifest);
      const canonicalDir = yield* fsUtils.realPath(dir);
      const raw = yield* fsUtils.readJson(`${dir}/package.json`);
      if (O.isNone(raw)) return yield* DomainError.make({ message: `Failed to parse ${dir}/package.json` });
      const pkg = yield* decodePackageJsonEffect(raw.value);
      return [pkg.name, canonicalDir] as const;
    })
  );
  return HashMap.fromIterable(entries);
});
const buildRepoDependencyIndex = Effect.fn("frozen.buildRepoDependencyIndex")(function* (rootDir: string) {
  const fsUtils = yield* FsUtils;
  const workspaces = yield* resolveWorkspaceDirs(rootDir);
  const workspaceNames = HashSet.fromIterable(HashMap.keys(workspaces));
  const readManifest = Effect.fnUntraced(function* (manifestPath: string) {
    const raw = yield* fsUtils.readJson(manifestPath);
    if (O.isNone(raw)) return yield* DomainError.make({ message: `Failed to parse JSON at "${manifestPath}"` });
    return yield* decodePackageJsonEffect(raw.value);
  });
  const rootDeps = extractWorkspaceDependencies(yield* readManifest(`${rootDir}/package.json`), workspaceNames);
  let result = HashMap.make<readonly [readonly [string, LegacyWorkspaceDeps]]>([
    ROOT_KEY,
    { ...rootDeps, packageName: ROOT_KEY },
  ]);
  for (const [name, dir] of workspaces) {
    const manifest = yield* readManifest(`${dir}/package.json`);
    result = HashMap.set(result, `${name}`, extractWorkspaceDependencies(manifest, workspaceNames));
  }
  return result;
});
const sortWorkspacePackages = (index: HashMap.HashMap<string, LegacyWorkspaceDeps>) =>
  topologicalSort(
    HashMap.map(index, (deps) =>
      HashSet.fromIterable([
        ...HashMap.keys(deps.workspace.dependencies),
        ...HashMap.keys(deps.workspace.devDependencies),
        ...HashMap.keys(deps.workspace.peerDependencies),
        ...HashMap.keys(deps.workspace.optionalDependencies),
      ])
    )
  );

// --- value rendering ------------------------------------------------------------

const ABSENT = "<absent>";

// Flatten Option, HashMap, arrays and objects to sorted plain JSON values.
const plain = (value: unknown): unknown => {
  if (O.isOption(value)) {
    return O.match(value, { onNone: () => ABSENT, onSome: plain });
  }
  if (HashMap.isHashMap(value)) {
    return pipe(
      A.fromIterable(value as HashMap.HashMap<unknown, unknown>),
      A.map(([key, entry]) => [`${key}`, plain(entry)] as const),
      A.sort(Order.mapInput(Order.String, ([key]: readonly [string, unknown]) => key)),
      R.fromEntries
    );
  }
  if (A.isArray(value)) {
    return A.map(value, plain);
  }
  if (P.isObject(value)) {
    return pipe(
      R.toEntries(value as Readonly<Record<string, unknown>>),
      A.filter(([, entry]) => entry !== undefined),
      A.map(([key, entry]) => [key, plain(entry)] as const),
      A.sort(Order.mapInput(Order.String, ([key]: readonly [string, unknown]) => key)),
      R.fromEntries
    );
  }
  return value === undefined ? ABSENT : value;
};

const render = (value: unknown): string => JSON.stringify(plain(value));

// The source-order keys of each object-valued top-level field, the fields themselves sorted by name.
const rawKeyOrderOf = (encoded: unknown): string =>
  P.isObject(encoded)
    ? JSON.stringify(
        pipe(
          R.toEntries(encoded as Readonly<Record<string, unknown>>),
          A.filter(([, value]) => P.isObject(value) && !A.isArray(value)),
          A.map(([field, value]) => [field, R.keys(value as Readonly<Record<string, unknown>>)] as const),
          A.sort(Order.mapInput(Order.String, ([field]: readonly [string, unknown]) => field)),
          R.fromEntries
        )
      )
    : ABSENT;

const REJECTED = "rejected";

const issuesOf = (error: S.SchemaError): ReadonlyArray<string> =>
  pipe(
    getPackageJsonSchemaIssues(error),
    A.map((issue) => `${issue.pointer} :: ${issue.message}`),
    A.sort(Order.String)
  );

const pointersOf = (error: S.SchemaError): ReadonlyArray<string> =>
  pipe(
    getPackageJsonSchemaIssues(error),
    A.map((issue) => issue.pointer),
    A.dedupe,
    A.sort(Order.String)
  );

// --- per-manifest probes --------------------------------------------------------

type Probe = { readonly field: string; readonly value: string };

const probeManifest = Effect.fnUntraced(function* (input: unknown, workspaceNames: HashSet.HashSet<string>) {
  const decoded = yield* Effect.result(decodePackageJsonEffect(input));
  const rows: Array<Probe> = [];
  if (decoded._tag === "Failure") {
    rows.push({ field: "verdict", value: REJECTED });
    rows.push({ field: "issues", value: JSON.stringify(issuesOf(decoded.failure)) });
    return rows;
  }
  const manifest = decoded.success;
  rows.push({ field: "verdict", value: "accepted" });
  rows.push({ field: "issues", value: "[]" });
  const pretty = yield* Effect.result(encodePackageJsonCanonicalPrettyEffect(input));
  rows.push({ field: "canonicalPretty", value: pretty._tag === "Success" ? pretty.success : REJECTED });
  const normalized = yield* Effect.result(normalizePackageJsonEffect(input));
  rows.push({
    field: "normalized",
    value: normalized._tag === "Success" ? JSON.stringify(normalized.success) : REJECTED,
  });
  const encoded = yield* Effect.result(encodePackageJsonEffect(input));
  rows.push({ field: "roundTrip", value: encoded._tag === "Success" ? render(encoded.success) : REJECTED });
  // `plain` sorts every object, so `roundTrip` cannot see key order: record the raw key order of every
  // object-valued top-level field of the encoded output (an emptied map shows up as a missing field).
  rows.push({ field: "rawKeyOrder", value: encoded._tag === "Success" ? rawKeyOrderOf(encoded.success) : REJECTED });
  rows.push({ field: "beep", value: render(manifest.beep) });
  rows.push({ field: "workspaceDeps", value: render(extractWorkspaceDependencies(manifest, workspaceNames)) });
  return rows;
});

// --- mutation corpus ------------------------------------------------------------

type Mutation = { readonly name: string; readonly apply: (manifest: Record<string, unknown>) => unknown };

const MUTATIONS: ReadonlyArray<Mutation> = [
  { name: "unknown top-level key", apply: (manifest) => ({ ...manifest, k: true }) },
  {
    name: "bad dependency key",
    apply: (manifest) => ({
      ...manifest,
      dependencies: { ...(P.isObject(manifest.dependencies) ? manifest.dependencies : {}), "Invalid Name": "x" },
    }),
  },
  { name: "bad exports key", apply: (manifest) => ({ ...manifest, exports: { "1invalid": "./dist/index.js" } }) },
  { name: "bad imports key", apply: (manifest) => ({ ...manifest, imports: { internal: "./src/internal.ts" } }) },
];

// The malformed documents `test/schemas/PackageJson.test.ts` pins as rejected.
const MALFORMED: ReadonlyArray<{ readonly name: string; readonly input: unknown }> = [
  { name: "missing name", input: { version: "1.0.0" } },
  { name: "empty name", input: { name: "" } },
  { name: "invalid name", input: { name: "Invalid Name" } },
  { name: "invalid type", input: { name: "pkg", type: "esm" } },
  {
    name: "repository object without type",
    input: { name: "pkg", repository: { url: "git@github.com:user/repo.git" } },
  },
  { name: "funding object without url", input: { name: "pkg", funding: { type: "github" } } },
  { name: "invalid exports key", input: { name: "pkg", exports: { "1invalid": "./dist/index.js" } } },
  { name: "invalid imports key", input: { name: "pkg", imports: { internal: "./src/internal.ts" } } },
  { name: "workspaces as a string", input: { name: "pkg", workspaces: "packages/*" } },
  { name: "unexpected top-level key", input: { name: "pkg", unexpected: true } },
  { name: "private as a string", input: { name: "pkg", private: "true" } },
  { name: "invalid dependency key", input: { name: "pkg", dependencies: { "Invalid Name": "catalog:" } } },
  { name: "empty dependency value", input: { name: "pkg", dependencies: { effect: "" } } },
  { name: "ecosystem beep with kind", input: { name: "pkg", beep: { family: "ecosystem", kind: "modeling" } } },
  { name: "unknown beep family", input: { name: "pkg", beep: { family: "shared" } } },
  { name: "drivers beep with kind", input: { name: "pkg", beep: { family: "drivers", kind: "modeling" } } },
  { name: "foundation beep without kind", input: { name: "pkg", beep: { family: "foundation" } } },
  { name: "string input", input: "not-an-object" },
  { name: "number input", input: 42 },
  { name: "null input", input: null },
  { name: "array input", input: [] },
  { name: "rest key", input: { name: "pkg", rest: { smuggled: true } } },
  // An unknown key nested in each object-valued field the kit owns: the retired model closed these objects.
  { name: "author object with an unknown key", input: { name: "pkg", author: { name: "a", twitter: "@a" } } },
  { name: "bugs object with an unknown key", input: { name: "pkg", bugs: { url: "https://x.test", extra: 1 } } },
  { name: "directories with an unknown key", input: { name: "pkg", directories: { assets: "./assets" } } },
  {
    name: "funding object with an unknown key",
    input: { name: "pkg", funding: { url: "https://x.test", extra: 1 } },
  },
  {
    name: "repository object with an unknown key",
    input: { name: "pkg", repository: { type: "git", url: "https://x.test", extra: 1 } },
  },
  { name: "workspaces object with an unknown key", input: { name: "pkg", workspaces: { packages: ["a"], extra: 1 } } },
  {
    name: "peerDependenciesMeta entry with an unknown key",
    input: { name: "pkg", peerDependenciesMeta: { effect: { optional: true, extra: 1 } } },
  },
];

const verdictOf = Effect.fnUntraced(function* (input: unknown) {
  const decoded = yield* Effect.result(decodePackageJsonEffect(input));
  return decoded._tag === "Success" ? "accepted" : `${REJECTED} ${JSON.stringify(pointersOf(decoded.failure))}`;
});

// --- JSON Schema ----------------------------------------------------------------

// The root `$ref` is a JSON Pointer into `$defs`: unescape `~1` and `~0` to recover the definition name.
const definitionNameOf = (ref: string): string =>
  pipe(ref, Str.replace("#/$defs/", ""), Str.replaceAll("~1", "/"), Str.replaceAll("~0", "~"));

const jsonSchemaRows = (): Record<string, string> => {
  const document = packageJsonJsonSchema as unknown as {
    readonly schema: Readonly<Record<string, unknown>>;
    readonly definitions: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  };
  const rows: Record<string, string> = {};
  const rootRef = P.isString(document.schema.$ref) ? document.schema.$ref : "";
  const rootName = definitionNameOf(rootRef);
  for (const [name, definition] of R.toEntries(document.definitions)) {
    const properties = P.isObject(definition.properties) ? A.sort(R.keys(definition.properties), Order.String) : [];
    const key = name === rootName ? "<root>" : name;
    rows[key] = JSON.stringify({
      properties,
      additionalProperties: definition.additionalProperties ?? ABSENT,
    });
  }
  return rows;
};

// Each root property's emitted schema with `$ref`s inlined and annotation-only keys dropped, so the
// shape compares across the two models even though their definition names differ. A definition met
// again on the same path renders as `<recursive>`.
const ANNOTATION_KEYS = HashSet.make("title", "description", "examples", "default", "$comment");

const shapeOf = (
  node: unknown,
  definitions: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
  seen: HashSet.HashSet<string>
): unknown => {
  if (A.isArray(node)) {
    return A.map(node, (entry) => shapeOf(entry, definitions, seen));
  }
  if (!P.isObject(node)) {
    return node;
  }
  const { $ref, ...record } = node as Readonly<Record<string, unknown>>;
  if (P.isString($ref) && Str.startsWith("#/$defs/")($ref)) {
    const name = definitionNameOf($ref);
    const target = definitions[name];
    if (target === undefined || HashSet.has(seen, name)) {
      return { $ref: "<recursive>" };
    }
    return shapeOf({ ...target, ...record }, definitions, HashSet.add(seen, name));
  }
  const shaped: Record<string, unknown> = pipe(
    R.toEntries(P.isString($ref) ? { ...record, $ref } : record),
    A.filter(([key]) => !HashSet.has(ANNOTATION_KEYS, key)),
    A.map(
      ([key, value]) =>
        [key, key === "allOf" ? shapeOfAllOf(value, definitions, seen) : shapeOf(value, definitions, seen)] as const
    ),
    // An annotation-only `allOf` member (identifier or description wrapper) carries no shape.
    A.filter(([key, value]) => !(key === "allOf" && A.isArray(value) && A.isReadonlyArrayEmpty(value))),
    // Member order of `anyOf`, `enum` and `required` carries no meaning for what a document accepts.
    A.map(
      ([key, value]) =>
        [
          key,
          (key === "anyOf" || key === "enum" || key === "required") && A.isArray(value)
            ? A.sort(
                value,
                Order.mapInput(Order.String, (member: unknown) => JSON.stringify(member))
              )
            : value,
        ] as const
    ),
    A.sort(Order.mapInput(Order.String, ([key]: readonly [string, unknown]) => key)),
    R.fromEntries
  );
  // A lone `allOf` member left by an annotation wrapper is the schema itself.
  const { allOf, ...rest } = shaped;
  return A.isArray(allOf) && A.length(allOf) === 1 && R.isEmptyRecord(rest) ? allOf[0] : shaped;
};

const shapeOfAllOf = (
  members: unknown,
  definitions: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
  seen: HashSet.HashSet<string>
): unknown =>
  A.isArray(members)
    ? A.filter(
        A.map(members, (member) => shapeOf(member, definitions, seen)),
        (member) => !(P.isObject(member) && R.isEmptyRecord(member as Readonly<Record<string, unknown>>))
      )
    : shapeOf(members, definitions, seen);

const jsonSchemaPropertyRows = (): Record<string, string> => {
  const document = packageJsonJsonSchema as unknown as {
    readonly schema: Readonly<Record<string, unknown>>;
    readonly definitions: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  };
  const rootName = P.isString(document.schema.$ref) ? definitionNameOf(document.schema.$ref) : "";
  const root = document.definitions[rootName] ?? {};
  const properties = P.isObject(root.properties) ? (root.properties as Readonly<Record<string, unknown>>) : {};
  const rows: Record<string, string> = {
    "<required>": JSON.stringify(
      A.sort(A.isArray(root.required) ? (root.required as Array<string>) : [], Order.String)
    ),
  };
  for (const [name, schema] of R.toEntries(properties)) {
    rows[name] = JSON.stringify(shapeOf(schema, document.definitions, HashSet.empty()));
  }
  return rows;
};

// --- report ---------------------------------------------------------------------

const Report = S.Struct({
  schemaVersion: S.tag(1),
  tool: S.String,
  scope: S.String,
  commit: S.optionalKey(S.String),
  manifests: S.Record(S.String, S.Record(S.String, S.String)),
  mutations: S.Record(S.String, S.String),
  repo: S.Record(S.String, S.String),
  jsonSchema: S.Record(S.String, S.String),
  jsonSchemaProperties: S.Record(S.String, S.String),
});
type Report = typeof Report.Type;

const ReportJson = S.fromJsonString(Report);
const encodeReport = S.encodeEffect(S.fromJsonString(Report, { space: 2 }));

// Differences the PR intends, keyed `<section>|<row key>|<field>`; each is pinned by a test.
// A `*` path matches every manifest.
const INTENDED: ReadonlyArray<{ readonly key: string; readonly reason: string }> = [
  {
    key: "manifest|apps/practice-kg-mcp/package.json|canonicalPretty",
    reason:
      "The kit decodes a bin map to a HashMap, which keeps no source order, so the canonical form now sorts bin keys (pinned in PackageJson.test.ts).",
  },
  {
    key: "manifest|apps/practice-kg-mcp/package.json|normalized",
    reason: "Same as canonicalPretty: the normalized bin map is sorted by key.",
  },
  {
    key: "manifest|*|rawKeyOrder:reorder",
    reason:
      "Raw encoder only, same keys in a new order: the dependency maps, scripts, engines and bin decode to HashMap and encode with sorted keys, and the kit replays person and repository objects in its own key order. The canonical encoder restores the repo order (canonicalPretty is unchanged on every other manifest); documented under Gotchas on encodePackageJsonEffect.",
  },
  {
    key: "mutation|<malformed>|repository object without type",
    reason:
      "Kit-strict field: @beep/package-json Repository treats `type` as optional (npm documents it as optional), so a repository object with only `url` is accepted (pinned in PackageJson.test.ts).",
  },
  ...A.map(
    [
      "author object with an unknown key",
      "bugs object with an unknown key",
      "directories with an unknown key",
      "funding object with an unknown key",
      "repository object with an unknown key",
      "workspaces object with an unknown key",
    ],
    (name) => ({
      key: `mutation|<malformed>|${name}`,
      reason:
        "Kit field semantics (one owner per field, D-08): the kit's person, bugs, funding, repository, directories and workspaces codecs keep unknown nested keys for round-trip fidelity, so a nested unknown key is accepted; the top-level object stays closed (pinned in PackageJson.test.ts).",
    })
  ),
  {
    key: "mutation|<malformed>|peerDependenciesMeta entry with an unknown key",
    reason:
      "Kit-strict field: the kit's peerDependenciesMeta entry is a closed `{ optional }` object, so an unknown entry key is now rejected (pinned in PackageJson.test.ts).",
  },
  ...A.map(["author", "bugs", "contributors", "maintainers", "funding", "repository", "workspaces"], (name) => ({
    key: `jsonSchemaProperty|${name}`,
    reason:
      "The kit codec decodes this field from an open JSON object and validates it in the transformation, so the emitted object branch carries no property shape (the nested unknown-key mutations above pin the accepted shape).",
  })),
  {
    key: "jsonSchemaProperty|directories",
    reason:
      "The kit's directories field is a string-valued record, so it emits additionalProperties: string instead of six closed keys.",
  },
  {
    key: "jsonSchemaProperty|config",
    reason:
      "The kit's config field decodes from an open JSON object, so the emitted schema is `type: object` without the recursive JSON value shape; every JSON value is still accepted.",
  },
  {
    key: "jsonSchemaProperty|name",
    reason:
      "Tightened: the kit PackageName emits the npm lowercase scoped and unscoped patterns (W3-f (h): mixed-case names rejected).",
  },
  {
    key: "jsonSchemaProperty|type",
    reason: "Tightened: the kit emits the `module` / `commonjs` enum that both models enforce at decode time.",
  },
  {
    key: "jsonSchemaProperty|peerDependenciesMeta",
    reason: "Tightened: the kit's entry is a closed `{ optional }` object (see the peerDependenciesMeta mutation).",
  },
];

const isIntended = (key: string): boolean =>
  A.some(INTENDED, (entry) => {
    if (entry.key === key) {
      return true;
    }
    const [section, path, field] = Str.split(entry.key, "|");
    const [keySection, keyPath, keyField] = Str.split(key, "|");
    return section === keySection && field === keyField && path === "*" && keyPath !== undefined;
  });

// Whether two `rawKeyOrder` rows hold the same fields with the same keys, in any order.
const sameKeySets = (left: string | undefined, right: string | undefined): boolean => {
  if (left === undefined || right === undefined || left === REJECTED || right === REJECTED) {
    return false;
  }
  const sortedRows = (row: string): string =>
    JSON.stringify(
      R.map(JSON.parse(row) as Record<string, ReadonlyArray<string>>, (keys) => A.sort(keys, Order.String))
    );
  return sortedRows(left) === sortedRows(right);
};

const diffReports = (before: Report, after: Report): ReadonlyArray<string> => {
  const out: Array<string> = [];
  const compareRecord = (section: string, left: Record<string, string>, right: Record<string, string>) => {
    const keys = A.sort(A.dedupe([...R.keys(left), ...R.keys(right)]), Order.String);
    for (const key of keys) {
      if (left[key] !== right[key]) {
        out.push(`${section}|${key}`);
      }
    }
  };
  const manifestPaths = A.sort(A.dedupe([...R.keys(before.manifests), ...R.keys(after.manifests)]), Order.String);
  for (const path of manifestPaths) {
    const left = before.manifests[path] ?? {};
    const right = after.manifests[path] ?? {};
    for (const field of A.sort(A.dedupe([...R.keys(left), ...R.keys(right)]), Order.String)) {
      if (left[field] !== right[field]) {
        const reorderOnly = field === "rawKeyOrder" && sameKeySets(left[field], right[field]);
        out.push(`manifest|${path}|${reorderOnly ? "rawKeyOrder:reorder" : field}`);
      }
    }
  }
  compareRecord("mutation", before.mutations, after.mutations);
  compareRecord("repo", before.repo, after.repo);
  // Only the root definition is gated; kit fields bring their own definitions.
  if (before.jsonSchema["<root>"] !== after.jsonSchema["<root>"]) {
    out.push("jsonSchema|<root>|definition");
  }
  // Each root property's emitted shape is gated too, so a loosened field schema cannot pass unnoticed.
  compareRecord("jsonSchemaProperty", before.jsonSchemaProperties, after.jsonSchemaProperties);
  return out;
};

// --- program --------------------------------------------------------------------

const program = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const listing = yield* spawner.string(
    ChildProcess.make("git", ["ls-files", "-z", "--", "*package.json", ":(exclude)**/test/fixtures/**"], {
      cwd: repoRoot,
    })
  );
  const paths = A.sort(
    A.filter(Str.split(listing, "\u0000"), (path) => path === "package.json" || Str.endsWith("/package.json")(path)),
    Order.String
  );

  const workspaces = yield* resolveWorkspaceDirs(repoRootDir);
  const workspaceNames = HashSet.fromIterable(HashMap.keys(workspaces));

  const manifests: Record<string, Record<string, string>> = {};
  const mutations: Record<string, string> = {};
  for (const path of paths) {
    const text = yield* fileSystem.readFileString(`${repoRoot}${path}`);
    const input: unknown = JSON.parse(text);
    const rows = yield* probeManifest(input, workspaceNames);
    manifests[path] = R.fromEntries(A.map(rows, (row) => [row.field, row.value] as const));
    if (P.isObject(input) && !A.isArray(input)) {
      for (const mutation of MUTATIONS) {
        mutations[`${path}|${mutation.name}`] = yield* verdictOf(mutation.apply(input as Record<string, unknown>));
      }
    }
  }
  for (const entry of MALFORMED) {
    mutations[`<malformed>|${entry.name}`] = yield* verdictOf(entry.input);
  }

  const rootText = yield* fileSystem.readFileString(`${repoRoot}package.json`);
  const root = yield* decodePackageJsonEffect(JSON.parse(rootText));
  const index = yield* buildRepoDependencyIndex(repoRootDir);
  const order = yield* sortWorkspacePackages(index);
  const repo: Record<string, string> = {
    workspaceNames: JSON.stringify(A.sort(A.fromIterable(HashMap.keys(workspaces)), Order.String)),
    workspaceDirs: render(
      HashMap.map(workspaces, (dir) => (Str.startsWith(repoRoot)(dir) ? dir.slice(repoRoot.length) : dir))
    ),
    dependencyIndex: render(index),
    topologicalOrder: JSON.stringify(order),
    rootWorkspaceGlobs: JSON.stringify(workspaceGlobsFrom(root.workspaces)),
  };

  const commit = yield* spawner.string(ChildProcess.make("git", ["rev-parse", "HEAD"], { cwd: repoRoot })).pipe(
    Effect.map(Str.trim),
    Effect.map(O.liftPredicate(Str.isNonEmpty)),
    Effect.orElseSucceed(() => O.none<string>())
  );
  const report: Report = {
    schemaVersion: 1,
    tool: TOOL,
    scope: SCOPE,
    ...O.match(commit, { onNone: () => ({}), onSome: (sha) => ({ commit: sha }) }),
    manifests,
    mutations,
    repo,
    jsonSchema: jsonSchemaRows(),
    jsonSchemaProperties: jsonSchemaPropertyRows(),
  };
  const json = yield* encodeReport(report);

  const recordPath = flagValue("--record");
  if (O.isSome(recordPath)) {
    yield* fileSystem.writeFileString(recordPath.value, `${json}\n`);
    yield* Console.log(`recorded ${A.length(paths)} manifests, ${R.size(mutations)} mutations to ${recordPath.value}`);
    return;
  }
  yield* O.match(flagValue("--out"), {
    onNone: () => Console.log(json),
    onSome: (path) => fileSystem.writeFileString(path, `${json}\n`),
  });
  const comparePath = flagValue("--compare");
  if (O.isNone(comparePath)) {
    return;
  }
  const baseline = yield* fileSystem.readFileString(comparePath.value).pipe(Effect.flatMap(S.decodeEffect(ReportJson)));
  const differences = diffReports(baseline, report);
  const intended = A.filter(differences, isIntended);
  const unclassified = A.filter(differences, (key) => !isIntended(key));
  yield* Console.log(
    `${A.length(paths)} manifests, ${R.size(mutations)} mutations: ${A.length(differences)} differences, ${A.length(intended)} intended, ${A.length(unclassified)} unclassified`
  );
  for (const key of intended) {
    yield* Console.log(`  intended      ${key}`);
  }
  for (const key of unclassified) {
    yield* Console.log(`  UNCLASSIFIED  ${key}`);
  }
  if (A.isReadonlyArrayNonEmpty(unclassified)) {
    return yield* new ParityFailure({ message: `${A.length(unclassified)} unclassified difference(s)` });
  }
});

// The entry point builds the platform services once and runs the program in their context.
NodeRuntime.runMain(
  Layer.build(Layer.provideMerge(FsUtilsLive, NodeServices.layer)).pipe(
    Effect.flatMap((services) => program.pipe(Effect.provide(services))),
    Effect.scoped
  )
);
