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
 *   baseline (`research/repo-utils-package-json-parity-3a3-before.json`).
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
 * malformed documents the schema tests pin, and compares verdict and
 * pointers. The JSON Schema document is compared by each definition's
 * property set and `additionalProperties` for the root definition; the other
 * definitions are listed, not gated, because the kit fields bring their own.
 *
 * Usage (from the repo root):
 *
 *   bun goals/effected-promotion/ops/repo-utils-package-json-parity.ts --record <baseline.json>
 *   bun goals/effected-promotion/ops/repo-utils-package-json-parity.ts --compare <baseline.json> [--out <report.json>]
 */
import * as NodeURL from "node:url";
import {
  buildRepoDependencyIndex,
  decodePackageJsonEffect,
  encodePackageJsonCanonicalPrettyEffect,
  encodePackageJsonEffect,
  extractWorkspaceDependencies,
  getPackageJsonSchemaIssues,
  normalizePackageJsonEffect,
  packageJsonJsonSchema,
  resolveWorkspaceDirs,
  sortWorkspacePackages,
  workspaceGlobsFrom,
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
];

const verdictOf = Effect.fnUntraced(function* (input: unknown) {
  const decoded = yield* Effect.result(decodePackageJsonEffect(input));
  return decoded._tag === "Success" ? "accepted" : `${REJECTED} ${JSON.stringify(pointersOf(decoded.failure))}`;
});

// --- JSON Schema ----------------------------------------------------------------

const jsonSchemaRows = (): Record<string, string> => {
  const document = packageJsonJsonSchema as unknown as {
    readonly schema: Readonly<Record<string, unknown>>;
    readonly definitions: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  };
  const rows: Record<string, string> = {};
  const rootRef = P.isString(document.schema.$ref) ? document.schema.$ref : "";
  // The root `$ref` is a JSON Pointer into `$defs`: unescape `~1` and `~0` to recover the definition name.
  const rootName = pipe(rootRef, Str.replace("#/$defs/", ""), Str.replaceAll("~1", "/"), Str.replaceAll("~0", "~"));
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
});
type Report = typeof Report.Type;

const ReportJson = S.fromJsonString(Report);
const encodeReport = S.encodeEffect(S.fromJsonString(Report, { space: 2 }));

// Differences the PR intends, keyed `<section>|<row key>|<field>`; each is pinned by a test.
// A `*` path matches every manifest.
const INTENDED: ReadonlyArray<{ readonly key: string; readonly reason: string }> = [
  ...A.map(["canonicalPretty", "normalized", "roundTrip", "workspaceDeps"], (field) => ({
    key: `manifest|packages/tooling/library/repo-utils/package.json|${field}`,
    reason:
      "Corpus change, not a model change: 3-A3 adds the @beep/package-json dependency to this manifest after the baseline was recorded.",
  })),
  {
    key: "repo|dependencyIndex",
    reason: "Corpus change: the @beep/repo-utils entry gains its new @beep/package-json workspace edge.",
  },
  {
    key: "repo|topologicalOrder",
    reason:
      "Corpus change: the new @beep/repo-utils -> @beep/package-json edge moves @beep/package-json and its closure ahead of repo-utils; the order is still a valid topological sort of the same members.",
  },
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
    key: "mutation|<malformed>|repository object without type",
    reason:
      "Kit-strict field: @beep/package-json Repository treats `type` as optional (npm documents it as optional), so a repository object with only `url` is accepted (pinned in PackageJson.test.ts).",
  },
  {
    key: "jsonSchema|<root>|definition",
    reason:
      "The root definition gains the closed `rest` property (an optional key whose schema admits nothing); every other property and additionalProperties: false are unchanged.",
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
        out.push(`manifest|${path}|${field}`);
      }
    }
  }
  compareRecord("mutation", before.mutations, after.mutations);
  compareRecord("repo", before.repo, after.repo);
  // Only the root definition is gated; kit fields bring their own definitions.
  if (before.jsonSchema["<root>"] !== after.jsonSchema["<root>"]) {
    out.push("jsonSchema|<root>|definition");
  }
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
