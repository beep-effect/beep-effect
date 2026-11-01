/**
 * The change classifier of the verification route: a total map from a commit
 * range to a {@link ChangeSet} (`goals/verification-route`, slice 1).
 *
 * **Details**
 *
 * The core, {@link classifyChangedPaths}, reads nothing but the `readAt`
 * function it is handed, so tests drive it without git.
 * {@link ChangeClassifierLive} is the git-backed shell: it resolves both refs
 * to commits, lists the diff with `git diff --name-status -z --no-renames`,
 * and reads a file at a commit with `git ls-tree` plus `git cat-file blob`.
 *
 * Every `package.json` is read semantically: one atom per changed field
 * family. Every other path is placed by the first matching path rule, and a
 * path no rule places is `unknown`. Owners are resolved at the commit itself:
 * the deepest ancestor directory that matches the root `package.json`
 * `workspaces` globs at that commit and carries a named `package.json`, else
 * the root package. That is the longest-prefix ownership `WorkspaceDiscovery`
 * computes over a checkout, evaluated against a bare commit, which the
 * discovery service cannot read.
 *
 * @since 0.0.0
 */
import { GlobSet } from "@beep/glob/GlobSet";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import { dual, flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  gitTreeEntriesFromNulOutput,
  resolveGitCommit,
  runGitRawOutput,
  sortedUniquePaths,
} from "../../internal/repo-run/GitExec.ts";
import { sha256Hex } from "../Goals/PacketCore/PacketDigest.ts";
import { CHANGE_ATOM_KIND_VALUES, ChangeAtom, ChangeSet, RouteError } from "./Route.schemas.ts";
import { ChangeClassifier } from "./Route.service.ts";
import type * as Crypto from "effect/Crypto";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GitCommandErrorAdapter } from "../../internal/repo-run/GitExec.ts";
import type { ChangeAtomKind } from "./Route.schemas.ts";
import type { ClassifyInput } from "./Route.service.ts";

const $I = $RepoCliId.create("commands/Ci/RouteClassify");

/**
 * A git name-status letter for one changed path.
 *
 * **Details**
 *
 * The git shell asks for `--no-renames`, and the parser splits any rename it
 * still meets into a deletion of the source and an addition of the target
 * (a copy into an addition of the target), so only single-path letters
 * reach the classifier.
 *
 * **Example** (Guard a deletion)
 *
 * ```ts import.meta.vitest name="Guard a deletion"
 * import { ChangedPathStatus } from "@beep/repo-cli/commands/Ci/RouteClassify"
 *
 * ChangedPathStatus.is.D("D") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ChangedPathStatus = LiteralKit(["A", "D", "M", "T", "U", "X", "B"]).pipe(
  $I.annoteSchema("ChangedPathStatus", {
    description: "A single-path git name-status letter; renames and copies arrive split into D and A.",
  })
);

/**
 * Type of {@link ChangedPathStatus}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ChangedPathStatus = typeof ChangedPathStatus.Type;

/**
 * One repository-relative changed path and its git name-status letter.
 *
 * **Example** (A modified markdown file)
 *
 * ```ts import.meta.vitest name="A modified markdown file"
 * import { ChangedPathEntry } from "@beep/repo-cli/commands/Ci/RouteClassify"
 *
 * const entry = ChangedPathEntry.make({ path: "docs/guide.md", status: "M" })
 * entry.status // => "M"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ChangedPathEntry extends S.Opaque<ChangedPathEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.NonEmptyString,
    status: ChangedPathStatus,
  }).pipe(
    $I.annoteSchema("ChangedPathEntry", {
      description: "One repository-relative changed path and its git name-status letter.",
    })
  )
) {}

/**
 * The input of the pure classifier: the two commits of a diff, its
 * changed-path entries, and how many commits `head` adds over `base`.
 *
 * **Details**
 *
 * `commits` is `git rev-list --count <base>..<head>` and defaults to 0. A head
 * whose tree equals its base can still add commits (a merge of `main` into a
 * branch whose fix already landed), and commit-range lanes such as commitlint
 * read exactly those, so a positive count is a change of its own.
 *
 * **Example** (A diff that touches the lockfile)
 *
 * ```ts import.meta.vitest name="A diff that touches the lockfile"
 * import { ChangedPathEntry, ClassifyDiff } from "@beep/repo-cli/commands/Ci/RouteClassify"
 *
 * const diff = ClassifyDiff.make({
 *   base: "aaaa",
 *   head: "bbbb",
 *   entries: [ChangedPathEntry.make({ path: "bun.lock", status: "M" })],
 * })
 * diff.entries.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClassifyDiff extends S.Opaque<ClassifyDiff, { readonly brand: unique symbol }>()(
  S.Struct({
    base: S.NonEmptyString,
    head: S.NonEmptyString,
    entries: S.Array(ChangedPathEntry),
    commits: S.Natural.pipe(S.withConstructorDefault(Effect.succeed(0))),
  }).pipe(
    $I.annoteSchema("ClassifyDiff", {
      description: "The base and head commits of a diff, its changed-path entries and the commits head adds over base.",
    })
  )
) {}

/**
 * Reads a file at a ref: `Some` with its text when the ref has a blob at the
 * path, `None` when it has none. Only a failing read source is an error.
 *
 * **Example** (A read source over an empty tree)
 *
 * ```ts import.meta.vitest name="A read source over an empty tree"
 * import type { RouteReadAt } from "@beep/repo-cli/commands/Ci/RouteClassify"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const empty: RouteReadAt = () => Effect.succeed(O.none())
 * Effect.isEffect(empty("HEAD", "package.json")) // => true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type RouteReadAt<R = never> = (ref: string, path: string) => Effect.Effect<O.Option<string>, RouteError, R>;

const RenameStatus = S.String.check(S.isPattern(/^R[0-9]+$/u)).pipe(
  $I.annoteSchema("RenameStatus", { description: "A git rename name-status field such as R100." })
);
const CopyStatus = S.String.check(S.isPattern(/^C[0-9]+$/u)).pipe(
  $I.annoteSchema("CopyStatus", { description: "A git copy name-status field such as C075." })
);
const isRenameStatus = S.is(RenameStatus);
const isCopyStatus = S.is(CopyStatus);
const isChangedPathStatus = S.is(ChangedPathStatus);
const isNonEmptyString = S.is(S.NonEmptyString);

type NameStatusRecord = {
  readonly width: number;
  readonly entries: ReadonlyArray<ChangedPathEntry>;
};

const pathField = (fields: ReadonlyArray<string>, index: number): O.Option<string> =>
  O.filter(A.get(fields, index), isNonEmptyString);

// Boolean (not refining) predicates: a pattern check refines `string` to `string`, which would make
// `Match` treat the first case as exhaustive.
const renameField = (status: string): boolean => isRenameStatus(status);
const copyField = (status: string): boolean => isCopyStatus(status);

const nameStatusRecord = (
  fields: ReadonlyArray<string>,
  index: number
): ((status: string) => O.Option<NameStatusRecord>) => {
  const paths = O.all([pathField(fields, index + 1), pathField(fields, index + 2)]);
  return Match.type<string>().pipe(
    Match.when(renameField, () =>
      O.map(paths, ([source, target]) => ({
        width: 3,
        entries: [
          ChangedPathEntry.make({ path: source, status: "D" }),
          ChangedPathEntry.make({ path: target, status: "A" }),
        ],
      }))
    ),
    Match.when(copyField, () =>
      O.map(paths, ([, target]) => ({
        width: 3,
        entries: [ChangedPathEntry.make({ path: target, status: "A" })],
      }))
    ),
    Match.orElse((status) =>
      O.map(O.all([O.liftPredicate(status, isChangedPathStatus), pathField(fields, index + 1)]), ([letter, path]) => ({
        width: 2,
        entries: [ChangedPathEntry.make({ path, status: letter })],
      }))
    )
  );
};

/**
 * Parse `git diff --name-status -z` output into changed-path entries.
 *
 * **Details**
 *
 * Returns `None` on any malformed record (an unknown status, a missing path,
 * output not terminated by NUL) rather than guessing at the remainder. A
 * rename becomes a deletion of its source and an addition of its target; a
 * copy becomes an addition of its target.
 *
 * **Example** (Split a rename)
 *
 * ```ts import.meta.vitest name="Split a rename"
 * import { changedPathEntriesFromNameStatus } from "@beep/repo-cli/commands/Ci/RouteClassify"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 *
 * const entries = changedPathEntriesFromNameStatus("M\0bun.lock\0R100\0old.md\0new.md\0")
 * console.log(O.map(entries, A.map((entry) => `${entry.status} ${entry.path}`)))
 * // Some([ "M bun.lock", "D old.md", "A new.md" ])
 * ```
 *
 * @param output - Raw stdout of `git diff --name-status -z`.
 * @returns The entries in output order, or `None` when any record is malformed.
 * @category parsing
 * @since 0.0.0
 */
export const changedPathEntriesFromNameStatus = (output: string): O.Option<ReadonlyArray<ChangedPathEntry>> =>
  pipe(nulFields(output), O.flatMap(nameStatusEntries));

// NUL-terminated fields; `None` when non-empty output lacks the final terminator.
const nulFields = (output: string): O.Option<ReadonlyArray<string>> =>
  Str.isEmpty(output)
    ? O.some(A.empty<string>())
    : pipe(output, O.liftPredicate(Str.endsWith("\0")), O.map(flow(Str.split("\0"), A.dropRight(1))));

// Walk the fields record by record; one malformed record makes the whole listing `None`.
const nameStatusEntries = (fields: ReadonlyArray<string>): O.Option<ReadonlyArray<ChangedPathEntry>> =>
  pipe(
    A.unfold(O.some(0), (state: O.Option<number>) =>
      O.flatMap(state, (index) =>
        index >= A.length(fields)
          ? O.none()
          : O.map(A.get(fields, index), (status) => {
              const record = nameStatusRecord(fields, index)(status);
              return [record, O.map(record, (parsed) => index + parsed.width)] as const;
            })
      )
    ),
    O.all,
    O.map(A.flatMap((record) => record.entries))
  );

type PathFacts = {
  readonly path: string;
  readonly name: string;
  readonly directories: ReadonlyArray<string>;
  readonly extension: string;
  readonly ownerDirectory: O.Option<string>;
};

const ROOT_TOOLCHAIN_PINS = [".bun-version", ".nvmrc", "mise.toml", ".tool-versions"];
const BIOME_CONFIG_NAMES = ["biome.json", "biome.jsonc"];
const TEST_FILE_SUFFIXES = [".test.ts", ".test.tsx", ".spec.ts"];
const MARKDOWN_EXTENSIONS = [".md", ".mdx"];
const PACKET_ROOTS = ["goals/", "explorations/", "research/", "docs/_internal/"];
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"];
const ASSET_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".woff", ".woff2", ".ttf", ".pdf", ".mp4"];
const MANIFEST_NAME = "package.json";

const baseName = (path: string): string => O.getOrElse(A.last(Str.split("/")(path)), () => path);

const extensionOf = (name: string): string =>
  pipe(
    Str.lastIndexOf(".")(name),
    O.filter((index) => index > 0),
    O.map((index) => Str.toLowerCase(Str.slice(index)(name))),
    O.getOrElse(() => "")
  );

const sourceRoot = (directory: string): string => (Str.isEmpty(directory) ? "src/" : `${directory}/src/`);

const isUnder =
  (prefix: string) =>
  (facts: PathFacts): boolean =>
    Str.startsWith(prefix)(facts.path);

const isMarkdown = (facts: PathFacts): boolean => A.contains(MARKDOWN_EXTENSIONS, facts.extension);

const PATH_RULES: ReadonlyArray<readonly [ChangeAtomKind, P.Predicate<PathFacts>]> = [
  ["unknown", (facts) => facts.name === MANIFEST_NAME],
  ["lockfile", (facts) => facts.path === "bun.lock"],
  ["toolchain-pin", (facts) => A.contains(ROOT_TOOLCHAIN_PINS, facts.path)],
  ["env", (facts) => facts.name === ".env" || Str.startsWith(".env.")(facts.name)],
  ["cfg:workflow", isUnder(".github/workflows/")],
  ["cfg:turbo", (facts) => facts.name === "turbo.json"],
  ["cfg:tsconfig", (facts) => Str.startsWith("tsconfig")(facts.name) && Str.endsWith(".json")(facts.name)],
  ["cfg:biome", (facts) => A.contains(BIOME_CONFIG_NAMES, facts.name) || Str.startsWith(".oxlintrc")(facts.name)],
  ["cfg:lint-rules", isUnder("packages/tooling/policy-pack/lint-rules/")],
  [
    "cfg:vitest",
    (facts) =>
      facts.name === "vitest.aliases.generated.json" ||
      (Str.startsWith("vite")(facts.name) && Str.endsWith(".ts")(facts.name)),
  ],
  [
    "src:generated",
    P.or(P.or(isUnder("docs/generated/"), isUnder("graft/")), (facts) => pipe(facts.name, Str.includes(".generated."))),
  ],
  ["src:story", (facts) => Str.endsWith(".stories.tsx")(facts.name)],
  [
    "src:test",
    (facts) =>
      A.contains(facts.directories, "test") || A.some(TEST_FILE_SUFFIXES, (suffix) => Str.endsWith(suffix)(facts.name)),
  ],
  ["packet", P.and(isMarkdown, (facts) => A.some(PACKET_ROOTS, (root) => Str.startsWith(root)(facts.path)))],
  ["docs:markdown", isMarkdown],
  [
    "src:module",
    (facts) =>
      A.contains(SOURCE_EXTENSIONS, facts.extension) &&
      O.exists(facts.ownerDirectory, (directory) => Str.startsWith(sourceRoot(directory))(facts.path)),
  ],
  ["asset", (facts) => A.contains(ASSET_EXTENSIONS, facts.extension)],
];

/**
 * Place one path by the path rules alone, given the directory of its owning
 * workspace package (`""` for the root package).
 *
 * **Details**
 *
 * The first matching rule wins, in this order: root `bun.lock`, root
 * toolchain pins, `.env*`, `.github/workflows/**`, `turbo.json`,
 * `tsconfig*.json`, Biome and oxlint configs, the lint-rules package,
 * Vite/Vitest configs, generated files, stories, tests, packet markdown, other
 * markdown, sources under the owner's `src/`, and media. Anything else is
 * `unknown`.
 *
 * **Gotchas**
 *
 * A `package.json` is `unknown` here: it is read semantically by
 * {@link classifyChangedPaths}, never by path. Config rules precede the test
 * rule, so a `tsconfig.json` copy under `test/fixtures/` is `cfg:tsconfig`.
 *
 * **Example** (Place a source module and a packet document)
 *
 * ```ts import.meta.vitest name="Place a source module and a packet document"
 * import { pathAtomKind } from "@beep/repo-cli/commands/Ci/RouteClassify"
 * import * as O from "effect/Option"
 *
 * pathAtomKind("packages/app/src/index.ts", O.some("packages/app")) // => "src:module"
 * pathAtomKind("goals/route/SPEC.md", O.none()) // => "packet"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const pathAtomKind: {
  (ownerDirectory: O.Option<string>): (path: string) => ChangeAtomKind;
  (path: string, ownerDirectory: O.Option<string>): ChangeAtomKind;
} = dual(2, (path: string, ownerDirectory: O.Option<string>): ChangeAtomKind => {
  const name = baseName(path);
  const facts: PathFacts = {
    path,
    name,
    directories: A.dropRight(Str.split("/")(path), 1),
    extension: extensionOf(name),
    ownerDirectory,
  };
  return pipe(
    A.findFirst(PATH_RULES, ([, matches]) => matches(facts)),
    O.map(([kind]) => kind),
    O.getOrElse((): ChangeAtomKind => "unknown")
  );
});

const ManifestObject = S.Record(S.String, S.Unknown).pipe(
  $I.annoteSchema("ManifestObject", { description: "A package.json document or one of its object fields." })
);
type ManifestObject = typeof ManifestObject.Type;
const isManifestObject = S.is(ManifestObject);
const decodeManifestText = S.decodeUnknownOption(S.fromJsonString(ManifestObject));
const decodePackageName = S.decodeUnknownOption(S.NonEmptyString);
const decodeWorkspacePatterns = S.decodeUnknownOption(S.Array(S.String));

const KeyedChangeType = LiteralKit(["added", "removed", "changed"]).pipe(
  $I.annoteSchema("KeyedChangeType", { description: "How one key of a package.json object changed." })
);
type KeyedChangeType = typeof KeyedChangeType.Type;

type KeyedChange = {
  readonly key: string;
  readonly type: KeyedChangeType;
  readonly before: O.Option<unknown>;
  readonly after: O.Option<unknown>;
};

type ManifestChange = {
  readonly kind: ChangeAtomKind;
  readonly family: string;
  readonly line: string;
};

type AtomSpec = {
  readonly kind: ChangeAtomKind;
  readonly detail: O.Option<string>;
};

const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];

const changeType = (before: O.Option<unknown>, after: O.Option<unknown>): KeyedChangeType =>
  O.match(before, {
    onNone: () => KeyedChangeType.Enum.added,
    onSome: () => (O.isNone(after) ? KeyedChangeType.Enum.removed : KeyedChangeType.Enum.changed),
  });

const keyedChange = (key: string, before: O.Option<unknown>, after: O.Option<unknown>): O.Option<KeyedChange> =>
  Equal.equals(before, after) ? O.none() : O.some({ key, type: changeType(before, after), before, after });

const keyedChanges = (before: ManifestObject, after: ManifestObject): ReadonlyArray<KeyedChange> =>
  pipe(
    A.appendAll(R.keys(before), R.keys(after)),
    A.dedupe,
    A.sort(Order.String),
    A.flatMap((key) => O.toArray(keyedChange(key, R.get(before, key), R.get(after, key))))
  );

const textOf = (value: O.Option<unknown>): O.Option<string> => O.filter(value, P.isString);

const withValue = (text: string, value: O.Option<string>): string =>
  O.match(value, { onNone: () => text, onSome: (shown) => `${text} ${shown}` });

const describeChange = (subject: string, change: KeyedChange, showValues: boolean): string =>
  KeyedChangeType.match(change.type, {
    added: () =>
      withValue(
        `${subject} added`,
        O.filter(textOf(change.after), () => showValues)
      ),
    removed: () =>
      withValue(
        `${subject} removed`,
        O.filter(textOf(change.before), () => showValues)
      ),
    changed: () =>
      pipe(
        O.all([textOf(change.before), textOf(change.after)]),
        O.filter(() => showValues),
        O.match({
          onNone: () => `${subject} changed`,
          onSome: ([before, after]) => `${subject} ${before} -> ${after}`,
        })
      ),
  });

// One side of a keyed field family: a missing field reads as `{}`, a present non-object as `None`.
const familyObject = (value: O.Option<unknown>): O.Option<ManifestObject> =>
  O.match(value, {
    onNone: () => O.some(R.empty<string, unknown>()),
    onSome: O.liftPredicate(isManifestObject),
  });

const familySides = (change: KeyedChange): O.Option<readonly [ManifestObject, ManifestObject]> =>
  O.all([familyObject(change.before), familyObject(change.after)]);

// A field that only appears or disappears as `{}` has no keyed entries, yet the
// presence itself is the change (an empty `exports` map blocks every entry point).
const entriesOrField = <A>(entries: ReadonlyArray<A>, field: () => A): ReadonlyArray<A> =>
  A.isReadonlyArrayNonEmpty(entries) ? entries : [field()];

const entryLines = (label: string, change: KeyedChange, showValues: boolean): ReadonlyArray<string> =>
  pipe(
    familySides(change),
    O.map(([before, after]) =>
      entriesOrField(
        A.map(keyedChanges(before, after), (entry) => describeChange(`${label} ${entry.key}`, entry, showValues)),
        () => describeChange(label, change, false)
      )
    ),
    O.getOrElse(() => [describeChange(label, change, false)])
  );

const manifestChange =
  (kind: ChangeAtomKind, family: string) =>
  (line: string): ManifestChange => ({ kind, family, line });

const keyedFamily =
  (kind: ChangeAtomKind, showValues: boolean) =>
  (change: KeyedChange): ReadonlyArray<ManifestChange> =>
    A.map(entryLines(change.key, change, showValues), manifestChange(kind, change.key));

const catalogsFamily = (change: KeyedChange): ReadonlyArray<ManifestChange> =>
  pipe(
    familySides(change),
    O.map(([before, after]) =>
      entriesOrField(
        A.flatMap(keyedChanges(before, after), (named) => entryLines(`${change.key}.${named.key}`, named, true)),
        () => describeChange(change.key, change, false)
      )
    ),
    O.getOrElse(() => [describeChange(change.key, change, false)]),
    A.map(manifestChange("pkg:catalog", change.key))
  );

const dependencyKind = KeyedChangeType.match({
  added: (): ChangeAtomKind => "pkg:dep-added",
  removed: (): ChangeAtomKind => "pkg:dep-removed",
  changed: (): ChangeAtomKind => "pkg:dep-version",
});

const dependencyFamily = (change: KeyedChange): ReadonlyArray<ManifestChange> =>
  pipe(
    familySides(change),
    O.map(([before, after]) =>
      entriesOrField(
        A.map(keyedChanges(before, after), (entry) =>
          manifestChange(
            dependencyKind(entry.type),
            change.key
          )(describeChange(`${change.key} ${entry.key}`, entry, true))
        ),
        () => manifestChange(dependencyKind(change.type), change.key)(describeChange(change.key, change, false))
      )
    ),
    O.getOrElse(() => [manifestChange("unknown", change.key)(`${change.key} is not an object`)])
  );

const workspacesMember = (value: O.Option<unknown>, key: string): O.Option<unknown> =>
  pipe(value, O.filter(isManifestObject), O.flatMap(R.get(key)));

const withoutCatalogs = (value: O.Option<unknown>): O.Option<unknown> =>
  O.map(value, (workspaces) =>
    isManifestObject(workspaces) ? R.remove(R.remove(workspaces, "catalog"), "catalogs") : workspaces
  );

const workspacesFamily = (change: KeyedChange): ReadonlyArray<ManifestChange> =>
  A.flatten([
    pipe(
      keyedChange(
        "workspaces.catalog",
        workspacesMember(change.before, "catalog"),
        workspacesMember(change.after, "catalog")
      ),
      O.map(keyedFamily("pkg:catalog", true)),
      O.getOrElse(A.empty<ManifestChange>)
    ),
    pipe(
      keyedChange(
        "workspaces.catalogs",
        workspacesMember(change.before, "catalogs"),
        workspacesMember(change.after, "catalogs")
      ),
      O.map(catalogsFamily),
      O.getOrElse(A.empty<ManifestChange>)
    ),
    pipe(
      keyedChange("workspaces", withoutCatalogs(change.before), withoutCatalogs(change.after)),
      O.map(keyedFamily("pkg:manifest-other", false)),
      O.getOrElse(A.empty<ManifestChange>)
    ),
  ]);

const otherField = (change: KeyedChange): ReadonlyArray<ManifestChange> => [
  manifestChange("pkg:manifest-other", change.key)(describeChange(change.key, change, true)),
];

const fieldChanges: (change: KeyedChange) => ReadonlyArray<ManifestChange> = Match.type<KeyedChange>().pipe(
  Match.when({ key: "scripts" }, keyedFamily("pkg:script", false)),
  Match.when({ key: "exports" }, keyedFamily("pkg:exports", false)),
  Match.when({ key: "catalog" }, keyedFamily("pkg:catalog", true)),
  Match.when({ key: "catalogs" }, catalogsFamily),
  Match.when({ key: "workspaces" }, workspacesFamily),
  Match.when({ key: (key: string) => A.contains(DEPENDENCY_FIELDS, key) }, dependencyFamily),
  Match.orElse(otherField)
);

const unknownSpec = (detail: string): AtomSpec => ({ kind: "unknown", detail: O.some(detail) });

const familySpecs = (changes: A.NonEmptyReadonlyArray<ManifestChange>): ReadonlyArray<AtomSpec> =>
  pipe(
    A.groupBy(changes, (change) => `${change.kind}\u0000${change.family}`),
    R.values,
    A.map(
      (group): AtomSpec => ({
        kind: A.headNonEmpty(group).kind,
        detail: O.some(
          A.join(
            A.map(group, (change) => change.line),
            "; "
          )
        ),
      })
    )
  );

const manifestDiffSpecs = (
  before: O.Option<ManifestObject>,
  after: O.Option<ManifestObject>
): ReadonlyArray<AtomSpec> =>
  pipe(
    O.all([before, after]),
    O.match({
      onNone: () => {
        const sides = pipe(
          [
            ["base", before],
            ["head", after],
          ] as const,
          A.filter(([, document]) => O.isNone(document)),
          A.map(([side]) => side),
          A.join(" and ")
        );
        return [unknownSpec(`package.json does not parse as a JSON object at ${sides}`)];
      },
      onSome: ([base, head]) =>
        A.match(A.flatMap(keyedChanges(base, head), fieldChanges), {
          onEmpty: () => [unknownSpec("package.json changed without a field change")],
          onNonEmpty: familySpecs,
        }),
    })
  );

const manifestAtomSpecs = <R>(
  read: RouteReadAt<R>,
  diff: ClassifyDiff,
  entry: ChangedPathEntry
): Effect.Effect<ReadonlyArray<AtomSpec>, RouteError, R> =>
  ChangedPathStatus.matchOrElse(
    entry.status,
    {
      A: () => Effect.succeed([unknownSpec("package.json added")]),
      D: () => Effect.succeed([unknownSpec("package.json deleted")]),
    },
    () =>
      Effect.zipWith(read(diff.base, entry.path), read(diff.head, entry.path), (before, after) =>
        manifestDiffSpecs(O.flatMap(before, decodeManifestText), O.flatMap(after, decodeManifestText))
      )
  );

type WorkspaceOwner = {
  readonly directory: string;
  readonly name: string;
};

type RefWorkspace = {
  readonly ref: string;
  readonly globs: O.Option<GlobSet>;
  readonly root: O.Option<WorkspaceOwner>;
};

const workspacePatterns = (manifest: ManifestObject): ReadonlyArray<string> =>
  pipe(
    R.get(manifest, "workspaces"),
    O.flatMap((workspaces) => (isManifestObject(workspaces) ? R.get(workspaces, "packages") : O.some(workspaces))),
    O.flatMap(decodeWorkspacePatterns),
    O.getOrElse(A.empty<string>)
  );

const packageNameOf = (manifest: ManifestObject): O.Option<string> =>
  O.flatMap(R.get(manifest, "name"), decodePackageName);

const readWorkspace = Effect.fnUntraced(function* <R>(
  read: RouteReadAt<R>,
  ref: string
): Effect.fn.Return<RefWorkspace, RouteError, R> {
  const manifest = O.flatMap(yield* read(ref, MANIFEST_NAME), decodeManifestText);
  return {
    ref,
    globs: pipe(manifest, O.map(workspacePatterns), O.flatMap(flow(GlobSet.compileResult, Result.getSuccess))),
    root: pipe(
      manifest,
      O.flatMap(packageNameOf),
      O.map((name): WorkspaceOwner => ({ directory: "", name }))
    ),
  };
});

// Ancestor directories of a path, deepest first, excluding the repository root.
const ancestorDirectories = (path: string): ReadonlyArray<string> =>
  pipe(
    A.dropRight(Str.split("/")(path), 1),
    A.scan("", (prefix: string, segment: string) => (Str.isEmpty(prefix) ? segment : `${prefix}/${segment}`)),
    A.drop(1),
    A.reverse
  );

const ownerOf = Effect.fnUntraced(function* <R>(
  read: RouteReadAt<R>,
  workspace: RefWorkspace,
  path: string
): Effect.fn.Return<O.Option<WorkspaceOwner>, RouteError, R> {
  const candidates = A.filter(ancestorDirectories(path), (directory) =>
    O.exists(workspace.globs, (globs) => globs.matches(directory))
  );
  const members = yield* Effect.forEach(candidates, (directory) =>
    read(workspace.ref, `${directory}/${MANIFEST_NAME}`).pipe(
      Effect.map(
        flow(
          O.flatMap(decodeManifestText),
          O.flatMap(packageNameOf),
          O.map((name): WorkspaceOwner => ({ directory, name }))
        )
      )
    )
  );
  return pipe(
    A.getSomes(members),
    A.head,
    O.orElse(() => workspace.root)
  );
});

const makeAtom = Effect.fnUntraced(function* (path: string, pkg: O.Option<string>, spec: AtomSpec) {
  const detail = O.getOrElse(spec.detail, () => "");
  const digest = yield* sha256Hex(`${spec.kind}\u0000${path}\u0000${detail}`).pipe(
    Effect.mapError(RouteError.mapError("classify", `Failed to digest the ${spec.kind} atom of ${path}.`))
  );
  return ChangeAtom.make({ kind: spec.kind, path, pkg, detail: spec.detail, digest });
});

const classifyEntry = Effect.fnUntraced(function* <R>(
  read: RouteReadAt<R>,
  diff: ClassifyDiff,
  workspace: RefWorkspace,
  entry: ChangedPathEntry
): Effect.fn.Return<ReadonlyArray<ChangeAtom>, RouteError, Crypto.Crypto | R> {
  const owner = yield* ownerOf(read, workspace, entry.path);
  const specs =
    baseName(entry.path) === MANIFEST_NAME
      ? yield* manifestAtomSpecs(read, diff, entry)
      : [
          {
            kind: pathAtomKind(
              entry.path,
              O.map(owner, (found) => found.directory)
            ),
            detail: O.none<string>(),
          },
        ];
  return yield* Effect.forEach(specs, (spec) =>
    makeAtom(
      entry.path,
      O.map(owner, (found) => found.name),
      spec
    )
  );
});

// Memoize a read source for one classification, so a manifest read for ownership is not re-read for its diff.
const memoizeReadAt = Effect.fnUntraced(function* <R>(readAt: RouteReadAt<R>) {
  const cache = yield* Ref.make(HashMap.empty<string, O.Option<string>>());
  const read: RouteReadAt<R> = (ref, path) => {
    const key = `${ref}\u0000${path}`;
    return Ref.get(cache).pipe(
      Effect.flatMap((entries) =>
        O.match(HashMap.get(entries, key), {
          onSome: Effect.succeed,
          onNone: () => readAt(ref, path).pipe(Effect.tap((text) => Ref.update(cache, HashMap.set(key, text)))),
        })
      )
    );
  };
  return read;
});

const kindRank = (kind: ChangeAtomKind): number =>
  O.getOrElse(
    A.findFirstIndex(CHANGE_ATOM_KIND_VALUES, (value) => value === kind),
    () => A.length(CHANGE_ATOM_KIND_VALUES)
  );

const atomOrder: Order.Order<ChangeAtom> = Order.combine(
  Order.mapInput(Order.String, (atom: ChangeAtom) => atom.path),
  Order.combine(
    Order.mapInput(Order.Number, (atom: ChangeAtom) => kindRank(atom.kind)),
    Order.mapInput(Order.String, (atom: ChangeAtom) => O.getOrElse(atom.detail, () => ""))
  )
);

const CLASSIFY_CONCURRENCY = 8;

// The pseudo-path of the one atom that stands for the commits a head adds over its base.
const COMMITS_PATH = "<commits>";
const isPositive = (count: number): boolean => count > 0;
const shortSha = Str.slice(0, 12);

/**
 * Classify a diff into a {@link ChangeSet}, reading file contents only
 * through `readAt`.
 *
 * **Details**
 *
 * Total: every entry yields at least one atom, and only a failing `readAt` is
 * an error. A `package.json` that is added, deleted, unparseable on either
 * side, or changed without a field change yields one `unknown` atom; otherwise
 * it yields one atom per changed field family (`scripts`, `exports`,
 * `catalog`/`catalogs`/`workspaces.catalog`, each dependency field split into
 * version, added and removed, then each other top-level field), whose detail
 * lists the changed entries in key order. Every other path yields exactly one
 * atom from {@link pathAtomKind}. When `diff.commits` is positive, one
 * `commits` atom (path `<commits>`, no `pkg`, detail
 * `<n> commit(s) <base12>..<head12>`) follows the path atoms, so a head whose
 * tree equals its base still selects the commit-range lanes.
 *
 * `pkg` is the owning workspace package at `head`, or at `base` for a deleted
 * path. `digest` is the sha256 hex of `kind`, `path` and `detail` (empty when
 * absent) joined by NUL. Path atoms are sorted by path, then census kind
 * order, then detail; the `commits` atom is always last.
 *
 * **Example** (Classify a docs edit without git)
 *
 * ```ts import.meta.vitest name="Classify a docs edit without git"
 * import { ChangedPathEntry, ClassifyDiff, classifyChangedPaths } from "@beep/repo-cli/commands/Ci/RouteClassify"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const diff = ClassifyDiff.make({
 *   base: "base",
 *   head: "head",
 *   entries: [ChangedPathEntry.make({ path: "docs/guide.md", status: "M" })],
 * })
 * const program = classifyChangedPaths(diff, () => Effect.succeed(O.none()))
 * Effect.isEffect(program) // => true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const classifyChangedPaths = Effect.fn("RouteClassify.classifyChangedPaths")(function* <R>(
  diff: ClassifyDiff,
  readAt: RouteReadAt<R>
): Effect.fn.Return<ChangeSet, RouteError, Crypto.Crypto | R> {
  const read = yield* memoizeReadAt(readAt);
  const base = yield* readWorkspace(read, diff.base);
  const head = yield* readWorkspace(read, diff.head);
  const atoms = yield* Effect.forEach(
    diff.entries,
    (entry) => classifyEntry(read, diff, ChangedPathStatus.is.D(entry.status) ? base : head, entry),
    { concurrency: CLASSIFY_CONCURRENCY }
  );
  const commitAtoms = yield* Effect.forEach(O.toArray(O.liftPredicate(diff.commits, isPositive)), (count) =>
    makeAtom(COMMITS_PATH, O.none(), {
      kind: "commits",
      detail: O.some(`${count} commit(s) ${shortSha(diff.base)}..${shortSha(diff.head)}`),
    })
  );
  const changeSet = ChangeSet.make({
    base: diff.base,
    head: diff.head,
    changedPaths: sortedUniquePaths(A.map(diff.entries, (entry) => entry.path)),
    atoms: A.appendAll(A.sort(A.flatten(atoms), atomOrder), commitAtoms),
  });
  yield* Effect.annotateCurrentSpan({
    changedPaths: A.length(changeSet.changedPaths),
    atoms: A.length(changeSet.atoms),
  });
  return changeSet;
});

const routeGitErrors: GitCommandErrorAdapter<RouteError> = {
  onSpawnFailure: (commandLine) => RouteError.mapError("git", `Failed to run ${commandLine}.`),
  onNonZeroExit: ({ commandLine, exitCode, output }) =>
    RouteError.new("git", `${commandLine} exited ${exitCode}: ${Str.trim(output)}`),
  onTruncated: O.some((commandLine: string) => RouteError.new("git", `${commandLine} printed truncated output.`)),
};

// Read a blob at a commit: `ls-tree` decides presence (an absent path is not a git failure), `cat-file` reads it.
const gitReadAt =
  (repoRoot: string): RouteReadAt<Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> =>
  (ref, path) =>
    Effect.gen(function* () {
      const listing = yield* runGitRawOutput(
        repoRoot,
        ["ls-tree", "-z", "--full-tree", ref, "--", `:(literal)${path}`],
        routeGitErrors
      );
      const entries = yield* Effect.fromOption(gitTreeEntriesFromNulOutput(listing), () =>
        RouteError.new("git", `git ls-tree ${ref} -- ${path} printed output that does not parse.`)
      );
      const blob = A.findFirst(entries, (entry) => entry.path === path && entry.objectType === "blob");
      if (O.isNone(blob)) {
        return O.none<string>();
      }
      return O.some(yield* runGitRawOutput(repoRoot, ["cat-file", "blob", blob.value.objectId], routeGitErrors));
    }).pipe(Effect.withSpan("RouteClassify.gitReadAt", { attributes: { ref, path } }));

const decodeCommitCount = S.decodeUnknownOption(S.FiniteFromString.pipe(S.decodeTo(S.Natural)));

const classifyCommitRange = Effect.fn("RouteClassify.classifyCommitRange")(function* (input: ClassifyInput) {
  const base = yield* resolveGitCommit(input.repoRoot, input.base, routeGitErrors);
  const head = yield* resolveGitCommit(input.repoRoot, input.head, routeGitErrors);
  const output = yield* runGitRawOutput(
    input.repoRoot,
    ["diff", "--name-status", "-z", "--no-renames", base, head, "--"],
    routeGitErrors
  );
  const entries = yield* Effect.fromOption(changedPathEntriesFromNameStatus(output), () =>
    RouteError.new("git", `git diff --name-status -z ${base} ${head} printed output that does not parse.`)
  );
  const counted = yield* runGitRawOutput(input.repoRoot, ["rev-list", "--count", `${base}..${head}`], routeGitErrors);
  const commits = yield* Effect.fromOption(decodeCommitCount(Str.trim(counted)), () =>
    RouteError.new("git", `git rev-list --count ${base}..${head} printed a count that does not parse.`)
  );
  return yield* classifyChangedPaths(ClassifyDiff.make({ base, head, entries, commits }), gitReadAt(input.repoRoot));
});

/**
 * The git-backed {@link ChangeClassifier}.
 *
 * **Details**
 *
 * `classify` resolves `base` and `head` to commits (the returned
 * {@link ChangeSet} carries the resolved shas), lists the diff with
 * `git diff --name-status -z --no-renames`, counts the added commits with
 * `git rev-list --count <base>..<head>`, and reads files at either commit
 * with `git ls-tree` and `git cat-file blob`. Only a failing git command is
 * an error (`RouteError` reason `git`).
 *
 * **Example** (Provide the live classifier)
 *
 * ```ts import.meta.vitest name="Provide the live classifier"
 * import { ChangeClassifierLive } from "@beep/repo-cli/commands/Ci/RouteClassify"
 * import * as Layer from "effect/Layer"
 *
 * Layer.isLayer(ChangeClassifierLive) // => true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ChangeClassifierLive: Layer.Layer<
  ChangeClassifier,
  never,
  Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
> = Layer.effect(
  ChangeClassifier,
  Effect.gen(function* () {
    const context = yield* Effect.context<Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner>();
    return ChangeClassifier.of({
      classify: Effect.fn("ChangeClassifier.classify")((input: ClassifyInput) =>
        classifyCommitRange(input).pipe(Effect.provide(context))
      ),
    });
  })
);
