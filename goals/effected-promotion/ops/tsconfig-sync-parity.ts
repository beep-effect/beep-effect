/**
 * Byte parity of `beep tsconfig-sync` across the 3-A7 schema switch.
 *
 * 3-A7 replaces repo-cli's four partial tsconfig projections in
 * `TsconfigSync.schemas.ts` (`TsconfigReferenceEntry`,
 * `TsconfigCompilerOptionsPaths`, `TsconfigWithReferences`,
 * `TsconfigWithPaths`) with the `@beep/tsconfig` kit (`Reference`,
 * `CompilerOptions`, `TsconfigJson`). Every write still goes through a JSONC
 * edit of the original text, so the switch must not move a single output byte.
 *
 * The script proves that in two parts:
 *
 * 1. Corpus: every git-tracked file whose basename matches `tsconfig*.json` decodes through
 *    `TsconfigJson` on the same JSONC path the command uses
 *    (`decodeJsoncTextAs`). The gate is zero failures (wave-4 ruling 4: a
 *    failure means the adoption takes the kit-derived pick, never a looser kit).
 * 2. Runs: the files tsconfig-sync reads (every `package.json`,
 *    `tsconfig*.json` and `docgen.json`, plus the root syncpack, fallow,
 *    vitest-alias and lockfile inputs) are extracted from one git revision into
 *    a scratch root. For each fixed mutation the script runs the lane's own CLI
 *    there with `tsconfig-sync --dry-run --verbose`, then `tsconfig-sync
 *    --write`, and records the exit codes, the normalized stdout and stderr, and
 *    the sha256 of every file afterwards (as one tree digest plus the digest of
 *    each file that differs from the extracted input).
 *
 * The baseline is recorded on the unchanged code. When the working tree holds
 * the repo-cli sources of an older revision (`git checkout <rev> --
 * packages/tooling/tool/cli/src`), `--code-rev <rev>` first proves that tree
 * matches `<rev>` and records `<rev>` as the report's `commit`.
 * `--compare <baseline.json>` re-extracts the baseline's revision (so both runs
 * see identical inputs), runs the same matrix with the current code and fails
 * on any difference in the runs or in the corpus counts.
 * Nothing here runs in CI; the reports ride in `research/` and the PR body.
 *
 * Usage (from the repo root):
 *
 *   bun goals/effected-promotion/ops/tsconfig-sync-parity.ts [--rev <git-rev>] [--code-rev <git-rev>] [--out <report.json>]
 *   bun goals/effected-promotion/ops/tsconfig-sync-parity.ts --compare <baseline.json> [--out <report.json>]
 */
import * as NodeURL from "node:url";
import { applyJsoncModification, JsoncModification } from "@beep/repo-cli/test/SharedInternals";
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { TsconfigJson } from "@beep/tsconfig/TsconfigJson";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

// --- report schema ------------------------------------------------------------

const TOOL = "goals/effected-promotion/ops/tsconfig-sync-parity.ts";

const CorpusFailure = S.Struct({ path: S.String, message: S.String });

const Corpus = S.Struct({
  scope: S.String,
  files: S.Finite,
  decoded: S.Finite,
  failures: S.Array(CorpusFailure),
});

const RunRecord = S.Struct({
  argv: S.Array(S.String),
  exitCode: S.Finite,
  stdout: S.String,
  stderr: S.String,
});

const MutationRecord = S.Struct({
  mutation: S.String,
  description: S.String,
  dryRun: RunRecord,
  write: RunRecord,
  files: S.Finite,
  treeSha256: S.String,
  changed: S.Record(S.String, S.String),
});

const Difference = S.Struct({ mutation: S.String, field: S.String });
const Differences = S.Array(Difference);

const ParityReport = S.Struct({
  schemaVersion: S.tag(1),
  tool: S.String,
  rev: S.String,
  commit: S.String,
  inputs: S.Finite,
  inputsSha256: S.String,
  corpus: Corpus,
  mutations: S.Array(MutationRecord),
  comparedWith: S.optionalKey(S.String),
  differences: S.optionalKey(Differences),
});

type MutationRecord = typeof MutationRecord.Type;
type ParityReport = typeof ParityReport.Type;

const encodeReport = S.encodeEffect(S.fromJsonString(ParityReport, { space: 2 }));
const decodeReport = S.decodeUnknownEffect(S.fromJsonString(ParityReport));

class ParityFailure extends S.TaggedError<ParityFailure, { readonly brand: unique symbol }>()("ParityFailure", {
  message: S.String,
}) {}

const failWith = (cause: unknown) => ParityFailure.make({ message: String(cause) });

const repoRoot = NodeURL.fileURLToPath(new URL("../../..", import.meta.url));
const CLI_SOURCES = "packages/tooling/tool/cli/src";
const cliEntry = `${repoRoot}${CLI_SOURCES}/bin.ts`;

const flagValue = (flag: string): O.Option<string> =>
  O.flatMap(
    A.findFirstIndex(process.argv, (arg) => arg === flag),
    (index) => A.get(process.argv, index + 1)
  );

const sha256 = (bytes: Uint8Array | string): string => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");

// --- inputs ---------------------------------------------------------------------

// Every file tsconfig-sync reads or plans, by repo-relative path.
const ROOT_INPUTS: ReadonlyArray<string> = [
  ".fallowrc.jsonc",
  "bun.lock",
  "standards/fallow.boundaries.generated.jsonc",
  "syncpack.config.ts",
  "vitest.aliases.generated.json",
];

const basename = (path: string): string =>
  pipe(
    Str.split(path, "/"),
    A.last,
    O.getOrElse(() => path)
  );

// A tsconfig file by basename (`tsconfig.json`, `tsconfig.check.json`, ...), never
// a `package.json` or report that merely sits below a `tsconfig` directory.
const isTsconfigFile = (path: string): boolean => {
  const base = basename(path);
  return Str.startsWith("tsconfig")(base) && Str.endsWith(".json")(base);
};

const isInput = (path: string): boolean => {
  const base = basename(path);
  return base === "package.json" || base === "docgen.json" || isTsconfigFile(path) || A.contains(ROOT_INPUTS, path);
};

const git = Effect.fn("TsconfigSyncParity.git")(function* (args: ReadonlyArray<string>) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  return yield* spawner.string(ChildProcess.make("git", [...args], { cwd: repoRoot }));
});

// Run a command for its effect and fail unless it exits 0 (`string` would end the
// process as soon as its stdout closes, before `git archive -o` finishes).
const exec = Effect.fn("TsconfigSyncParity.exec")(function* (
  command: string,
  args: ReadonlyArray<string>,
  cwd: string
) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const exitCode = yield* spawner.exitCode(ChildProcess.make(command, [...args], { cwd, stdin: "ignore" }));
  if (Number(exitCode) !== 0) {
    return yield* ParityFailure.make({ message: `${command} ${A.join(args, " ")} exited ${exitCode}` });
  }
});

const listInputs = Effect.fn("TsconfigSyncParity.listInputs")(function* (rev: string) {
  const listing = yield* git(["ls-tree", "-r", "-z", "--name-only", rev]);
  return A.sort(A.filter(Str.split(listing, "\u0000"), isInput), Order.String);
});

// Extract the inputs of `rev` into a fresh scratch root (scoped).
const extractInputs = Effect.fn("TsconfigSyncParity.extractInputs")(function* (
  rev: string,
  inputs: ReadonlyArray<string>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const scratch = yield* fs.makeTempDirectoryScoped({ prefix: "beep-tsconfig-sync-parity-" });
  const archive = path.join(scratch, "inputs.tar");
  const root = path.join(scratch, "root");
  yield* fs.makeDirectory(root);
  yield* exec("git", ["archive", "--format=tar", "-o", archive, rev, "--", ...inputs], repoRoot);
  yield* exec("tar", ["-xf", archive, "-C", root], scratch);
  return root;
});

// The sha256 of every regular file below `root`, by root-relative path.
const digestTree = Effect.fn("TsconfigSyncParity.digestTree")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = A.sort(yield* fs.readDirectory(root, { recursive: true }), Order.String);
  const digests = yield* Effect.forEach(entries, (entry) => {
    const absolute = path.join(root, entry);
    return Effect.flatMap(fs.stat(absolute), (info) =>
      info.type === "File"
        ? Effect.map(fs.readFile(absolute), (bytes) =>
            O.some([Str.replaceAll("\\", "/")(entry), sha256(bytes)] as const)
          )
        : Effect.succeed(O.none())
    );
  });
  return HashMap.fromIterable(A.getSomes(digests));
});

const byKey = Order.mapInput(Order.String, ([key]: readonly [string, string]) => key);

const treeDigest = (digests: HashMap.HashMap<string, string>): string =>
  pipe(
    A.fromIterable(digests),
    A.sort(byKey),
    A.map(([key, digest]) => `${digest}  ${key}`),
    A.join("\n"),
    sha256
  );

// --- mutations ------------------------------------------------------------------

type Edit = (root: string) => Effect.Effect<void, ParityFailure, FileSystem.FileSystem | Path.Path>;

interface Mutation {
  readonly description: string;
  readonly edit: Edit;
  readonly mutation: string;
  readonly syncArgs: ReadonlyArray<string>;
}

const ReferenceList = S.Struct({ references: S.Array(S.Struct({ path: S.String })) });
const decodeReferenceList = decodeJsoncTextAs(ReferenceList);

const editFile = Effect.fn("TsconfigSyncParity.editFile")(function* (
  root: string,
  file: string,
  change: (content: string) => Effect.Effect<string, S.SchemaError>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolute = path.join(root, file);
  const content = yield* fs.readFileString(absolute).pipe(Effect.mapError(failWith));
  const next = yield* change(content).pipe(Effect.mapError(failWith));
  yield* fs.writeFileString(absolute, next).pipe(Effect.mapError(failWith));
});

const setJsonc =
  (file: string, jsonPath: ReadonlyArray<string | number>, value: unknown): Edit =>
  (root) =>
    editFile(root, file, (content) =>
      Effect.succeed(applyJsoncModification(JsoncModification.make({ content, path: jsonPath, value })))
    );

const editReferences =
  (
    file: string,
    change: (references: ReadonlyArray<{ readonly path: string }>) => ReadonlyArray<Record<string, unknown>>
  ): Edit =>
  (root) =>
    editFile(root, file, (content) =>
      Effect.map(decodeReferenceList(content), (document) =>
        applyJsoncModification(
          JsoncModification.make({ content, path: ["references"], value: change(document.references) })
        )
      )
    );

const sequence =
  (...edits: ReadonlyArray<Edit>): Edit =>
  (root) =>
    Effect.forEach(edits, (edit) => edit(root), { discard: true });

const KIT_PACKAGE = "packages/foundation/modeling/tsconfig";
const UTILS_PACKAGE = "packages/foundation/modeling/utils";

const MUTATIONS: ReadonlyArray<Mutation> = [
  {
    mutation: "unchanged",
    description: "The extracted inputs as committed (no drift expected).",
    edit: () => Effect.void,
    syncArgs: [],
  },
  {
    mutation: "root-reference-dropped",
    description: "tsconfig.packages.json loses its first reference.",
    edit: editReferences("tsconfig.packages.json", A.drop(1)),
    syncArgs: [],
  },
  {
    mutation: "root-references-reordered",
    description: "tsconfig.packages.json lists its references in reverse order.",
    edit: editReferences("tsconfig.packages.json", A.reverse),
    syncArgs: [],
  },
  {
    mutation: "root-reference-metadata",
    description: "One root reference carries an extra key beside `path` (passthrough, no drift).",
    edit: editReferences("tsconfig.packages.json", (references) =>
      A.map(references, (reference, index) => (index === 0 ? { ...reference, circular: true } : reference))
    ),
    syncArgs: [],
  },
  {
    mutation: "package-references-empty",
    description: "The @beep/tsconfig project tsconfig.json has an empty references array.",
    edit: setJsonc(`${KIT_PACKAGE}/tsconfig.json`, ["references"], []),
    syncArgs: [],
  },
  {
    mutation: "canonical-alias-stale",
    description: "The root @beep/tsconfig path alias points at a stale target.",
    edit: setJsonc("tsconfig.json", ["compilerOptions", "paths", "@beep/tsconfig"], [`./${KIT_PACKAGE}/lib/index.ts`]),
    syncArgs: [],
  },
  {
    mutation: "canonical-alias-missing",
    description: "The root @beep/tsconfig/* path alias is deleted.",
    edit: setJsonc("tsconfig.json", ["compilerOptions", "paths", "@beep/tsconfig/*"], undefined),
    syncArgs: [],
  },
  {
    mutation: "check-overlay-drift",
    description: "The @beep/tsconfig tsconfig.check.json overlay keeps only its first reference.",
    edit: editReferences(`${KIT_PACKAGE}/tsconfig.check.json`, A.take(1)),
    syncArgs: [],
  },
  {
    mutation: "lab-reference-hand-added",
    description: "tsconfig.packages.json gains a hand-added labs workspace reference.",
    edit: editReferences("tsconfig.packages.json", (references) => A.append(references, { path: "apps/labs/ciops" })),
    syncArgs: [],
  },
  {
    mutation: "vitest-alias-drift",
    description:
      "vitest.aliases.generated.json loses its @beep/tsconfig alias, so the mirror is rewritten from root tsconfig paths.",
    edit: setJsonc("vitest.aliases.generated.json", ["@beep/tsconfig"], undefined),
    syncArgs: [],
  },
  {
    mutation: "vitest-alias-follows-root",
    description:
      "The root @beep/tsconfig alias is stale and the mirror matches it, so one run rewrites both from the workspace.",
    edit: sequence(
      setJsonc("tsconfig.json", ["compilerOptions", "paths", "@beep/tsconfig"], [`./${KIT_PACKAGE}/lib/index.ts`]),
      setJsonc("vitest.aliases.generated.json", ["@beep/tsconfig"], [`./${KIT_PACKAGE}/lib/index.ts`])
    ),
    syncArgs: [],
  },
  {
    mutation: "docgen-field-drift",
    description: "The @beep/tsconfig docgen.json srcLink is stale.",
    edit: setJsonc(`${KIT_PACKAGE}/docgen.json`, ["srcLink"], "https://example.invalid/stale/"),
    syncArgs: [],
  },
  {
    mutation: "filter-run",
    description:
      "Two packages lose their references; the run is filtered to @beep/tsconfig, so @beep/utils stays drifted.",
    edit: sequence(
      setJsonc(`${KIT_PACKAGE}/tsconfig.json`, ["references"], []),
      setJsonc(`${UTILS_PACKAGE}/tsconfig.json`, ["references"], [])
    ),
    syncArgs: ["--filter", "@beep/tsconfig"],
  },
];

// --- runs -----------------------------------------------------------------------

const collectText = <E>(stream: Stream.Stream<Uint8Array, E>) => stream.pipe(Stream.decodeText(), Stream.mkString);

const normalize =
  (root: string) =>
  (text: string): string =>
    pipe(text, Str.replaceAll(root, "<root>"), Str.replaceAll(repoRoot, "<repo>/"));

const runSync = Effect.fn("TsconfigSyncParity.runSync")(function* (root: string, args: ReadonlyArray<string>) {
  const argv = ["tsconfig-sync", ...args];
  const result = yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make("bun", [cliEntry, ...argv], {
        cwd: root,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
      });
      return yield* Effect.all(
        { stdout: collectText(handle.stdout), stderr: collectText(handle.stderr), exitCode: handle.exitCode },
        { concurrency: "unbounded" }
      );
    })
  );
  return {
    argv,
    exitCode: Number(result.exitCode),
    stdout: normalize(root)(result.stdout),
    stderr: normalize(root)(result.stderr),
  };
});

const runMutation = Effect.fn("TsconfigSyncParity.runMutation")(function* (
  rev: string,
  inputs: ReadonlyArray<string>,
  input: HashMap.HashMap<string, string>,
  mutation: Mutation
) {
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const root = yield* extractInputs(rev, inputs);
      yield* mutation.edit(root);
      const dryRun = yield* runSync(root, ["--dry-run", "--verbose", ...mutation.syncArgs]);
      const write = yield* runSync(root, ["--write", ...mutation.syncArgs]);
      const after = yield* digestTree(root);
      const changed = R.fromEntries(
        A.filter(A.sort(A.fromIterable(after), byKey), ([key, digest]) => !O.contains(HashMap.get(input, key), digest))
      );
      yield* Console.log(
        `${mutation.mutation}: dry-run exit ${dryRun.exitCode}, write exit ${write.exitCode}, ${R.size(changed)} changed file(s)`
      );
      return {
        mutation: mutation.mutation,
        description: mutation.description,
        dryRun,
        write,
        files: HashMap.size(after),
        treeSha256: treeDigest(after),
        changed,
      } satisfies MutationRecord;
    })
  );
});

// --- corpus ---------------------------------------------------------------------

const decodeTsconfigJson = decodeJsoncTextAs(TsconfigJson);

const runCorpus = Effect.fn("TsconfigSyncParity.runCorpus")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const listing = yield* git(["ls-files", "-z"]);
  const paths = A.sort(A.filter(Str.split(listing, "\u0000"), isTsconfigFile), Order.String);
  const failures = yield* Effect.forEach(paths, (path) =>
    fs.readFileString(`${repoRoot}${path}`).pipe(
      Effect.flatMap(decodeTsconfigJson),
      Effect.match({
        onFailure: (error) => O.some({ path, message: Str.trim(String(error)) }),
        onSuccess: () => O.none(),
      })
    )
  );
  const rows = A.getSomes(failures);
  return {
    scope: "git ls-files whose basename matches tsconfig*.json, decoded with decodeJsoncTextAs(TsconfigJson)",
    files: A.length(paths),
    decoded: A.length(paths) - A.length(rows),
    failures: rows,
  };
});

// --- compare --------------------------------------------------------------------

const differencesOf = (
  baseline: ParityReport,
  head: Pick<ParityReport, "corpus" | "mutations">
): ReadonlyArray<typeof Difference.Type> => {
  const encode = (value: unknown): string => JSON.stringify(value);
  const corpus = pipe(
    ["files", "decoded", "failures"] as const,
    A.filter((field) => encode(baseline.corpus[field]) !== encode(head.corpus[field])),
    A.map((field) => ({ mutation: "corpus", field }))
  );
  const runs = A.flatMap(baseline.mutations, (before) =>
    O.match(
      A.findFirst(head.mutations, (after) => after.mutation === before.mutation),
      {
        onNone: () => [{ mutation: before.mutation, field: "missing at head" }],
        onSome: (after) =>
          pipe(
            ["dryRun", "write", "files", "treeSha256", "changed"] as const,
            A.filter((field) => encode(before[field]) !== encode(after[field])),
            A.map((field) => ({ mutation: before.mutation, field }))
          ),
      }
    )
  );
  return A.appendAll(corpus, runs);
};

// --- program --------------------------------------------------------------------

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const comparePath = flagValue("--compare");
  const baseline = yield* O.match(comparePath, {
    onNone: () => Effect.succeed(O.none<ParityReport>()),
    onSome: (path) => Effect.asSome(Effect.flatMap(fs.readFileString(path), decodeReport)),
  });
  const rev = O.match(baseline, {
    onNone: () => O.getOrElse(flagValue("--rev"), () => "HEAD"),
    onSome: (report) => report.rev,
  });
  const commit = yield* O.match(flagValue("--code-rev"), {
    onNone: () => Effect.map(git(["rev-parse", "HEAD"]), Str.trim),
    onSome: (codeRev) =>
      exec("git", ["diff", "--quiet", codeRev, "--", CLI_SOURCES], repoRoot).pipe(
        Effect.andThen(git(["rev-parse", codeRev])),
        Effect.map(Str.trim)
      ),
  });
  const inputRev = Str.trim(yield* git(["rev-parse", rev]));

  const corpus = yield* runCorpus();
  yield* Console.log(`corpus: ${corpus.decoded}/${corpus.files} tsconfig files decode through TsconfigJson`);

  const inputs = yield* listInputs(inputRev);
  const input = yield* Effect.scoped(Effect.flatMap(extractInputs(inputRev, inputs), digestTree));
  const mutations = yield* Effect.forEach(MUTATIONS, (mutation) => runMutation(inputRev, inputs, input, mutation));

  const differences = O.map(baseline, (report) => differencesOf(report, { corpus, mutations }));
  const json = yield* encodeReport({
    schemaVersion: 1,
    tool: TOOL,
    rev: inputRev,
    commit,
    inputs: A.length(inputs),
    inputsSha256: treeDigest(input),
    corpus,
    mutations,
    ...O.match(comparePath, { onNone: () => ({}), onSome: (path) => ({ comparedWith: path }) }),
    ...O.match(differences, { onNone: () => ({}), onSome: (rows) => ({ differences: rows }) }),
  });
  yield* O.match(flagValue("--out"), {
    onNone: () => Console.log(json),
    onSome: (path) => fs.writeFileString(path, `${json}\n`),
  });
  if (A.isReadonlyArrayNonEmpty(corpus.failures)) {
    return yield* ParityFailure.make({
      message: `${A.length(corpus.failures)} tracked tsconfig file(s) fail to decode through TsconfigJson.`,
    });
  }
  if (O.isSome(differences)) {
    yield* Console.log(`compare: ${A.length(differences.value)} difference(s) against ${rev}`);
    if (A.isReadonlyArrayNonEmpty(differences.value)) {
      return yield* ParityFailure.make({
        message: `${A.length(differences.value)} tsconfig-sync output difference(s); see the report.`,
      });
    }
  }
});

// The entry point builds the platform services once and runs the program in their context.
NodeRuntime.runMain(
  Layer.build(NodeServices.layer).pipe(
    Effect.flatMap((services) => program.pipe(Effect.provide(services))),
    Effect.scoped
  )
);
