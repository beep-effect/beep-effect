/**
 * Domain facts the knowledge doctor reads from one tree: goal packets, workspace packages and their
 * exports, and skills. Every fact is derived from tree bytes, never from the working filesystem, and
 * can be overlaid without one resolution witness for the counterfactual harness.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { Str } from "@beep/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { ts } from "ts-morph";
import { optionalProp } from "../../internal/cli/OptionRecord.ts";
import { capabilityPacketFindings, GoalExplorationPathState, goalPacketFindings } from "../Goals/Doctor.ts";
import { decodeGoalManifest } from "../Goals/Goals.schemas.ts";
import {
  GOALS_DIR,
  GoalPacketRecord,
  goalManifestPhaseIds,
  parseGoalManifestText,
  TEMPLATE_SLUG,
} from "../Goals/Inventory.ts";
import { SkillLockFile } from "../Skills/Skills.command.ts";
import { SkillsLockDocument } from "../Skills/SkillsLock.schemas.ts";
import { KnowledgeOperationalError } from "./Knowledge.errors.ts";
import { decodeKnowledgeUtf8, knowledgeLineMatches } from "./Knowledge.refs.ts";
import {
  KnowledgeFileExports,
  KnowledgePackageEntrypoint,
  KnowledgePacketFacts,
  KnowledgeSkillLockFacts,
  KnowledgeSkillsFacts,
  KnowledgeWorkspacePackage,
} from "./KnowledgeDoctor.schemas.ts";
import type { GoalDoctorFinding, GoalPacketReader } from "../Goals/Doctor.ts";
import type { KnowledgeTreeOracle } from "./Knowledge.refs.ts";
import type {
  ExportWitness,
  KnowledgePacketManifestState,
  LockEntryWitness,
  ManifestFieldWitness,
} from "./KnowledgeDoctor.schemas.ts";

const $I = $RepoCliId.create("commands/Knowledge/KnowledgeDoctor.domain");

/**
 * Repository path of the skills lock the skills evaluator reads.
 *
 * **Example** (Read the lock path)
 *
 * ```ts
 * import { KNOWLEDGE_SKILLS_LOCK_PATH } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.domain"
 *
 * console.log(KNOWLEDGE_SKILLS_LOCK_PATH) // "skills-lock.json"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_SKILLS_LOCK_PATH = "skills-lock.json";

/**
 * Directory whose `<name>/SKILL.md` children are the installed skills.
 *
 * **Example** (Read the installed-skills root)
 *
 * ```ts
 * import { KNOWLEDGE_SKILLS_DIR } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.domain"
 *
 * console.log(KNOWLEDGE_SKILLS_DIR) // ".claude/skills"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_SKILLS_DIR = ".claude/skills";

/**
 * Repository path of the root TypeScript config whose `paths` aliases resolve test subpaths.
 *
 * **Example** (Read the alias source)
 *
 * ```ts
 * import { KNOWLEDGE_TSCONFIG_PATH } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.domain"
 *
 * console.log(KNOWLEDGE_TSCONFIG_PATH) // "tsconfig.json"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_TSCONFIG_PATH = "tsconfig.json";

const SKILL_FILE = "SKILL.md";
const PACKAGE_MANIFEST = "package.json";
const WORKSPACE_SCOPE = "@beep/";

/**
 * The domain facts of one doctor tree, each a lookup over tree bytes.
 *
 * **Details**
 *
 * `packets` holds one entry per `goals/<slug>/` directory, `packages` the root package plus every
 * `@beep/*` package whose tracked `package.json` sits in a directory the root manifest's
 * `workspaces` globs name (every manifest when the root declares none), `pathAliases` the root `tsconfig.json` `paths` entries for `@beep/*` specifiers,
 * `fileExports` the declaration scan of one source file, and `skills` the normalized skills lock
 * plus the installed skill directories.
 *
 * @see {@link deriveKnowledgeDoctorDomain} for the uncached derivation.
 * @see {@link cacheKnowledgeDoctorDomain} for the memoized live form.
 * @category services
 * @since 0.0.0
 */
export interface KnowledgeDoctorDomain {
  readonly fileExports: (file: string) => Effect.Effect<KnowledgeFileExports, KnowledgeOperationalError>;
  readonly goalsDoctorFindings: Effect.Effect<ReadonlyArray<GoalDoctorFinding>, KnowledgeOperationalError>;
  readonly packages: Effect.Effect<ReadonlyArray<KnowledgeWorkspacePackage>, KnowledgeOperationalError>;
  readonly packets: Effect.Effect<ReadonlyArray<KnowledgePacketFacts>, KnowledgeOperationalError>;
  readonly pathAliases: Effect.Effect<ReadonlyArray<KnowledgePackageEntrypoint>, KnowledgeOperationalError>;
  readonly skills: Effect.Effect<KnowledgeSkillsFacts, KnowledgeOperationalError>;
}

/* -------------------------------------------------------------------------------------------------
 * Tree reads
 * ---------------------------------------------------------------------------------------------- */

const trackedPaths = (oracle: KnowledgeTreeOracle): HashSet.HashSet<string> =>
  HashSet.fromIterable(A.map(oracle.trackedEntries, (entry) => entry.path));

const isRegularBlob = (mode: string): boolean => mode === "100644" || mode === "100755";

const readText = (oracle: KnowledgeTreeOracle, repoPath: string) =>
  Effect.flatMap(oracle.readBytes(repoPath), (bytes) =>
    decodeKnowledgeUtf8(bytes, `Malformed UTF-8 in tracked file "${repoPath}".`)
  );

const readTextIfTracked = (oracle: KnowledgeTreeOracle, paths: HashSet.HashSet<string>, repoPath: string) =>
  HashSet.has(paths, repoPath) ? Effect.asSome(readText(oracle, repoPath)) : Effect.succeed(O.none<string>());

const dirname = (repoPath: string): string => A.join(A.dropRight(Str.split("/")(repoPath), 1), "/");

// Joins a relative spelling onto a repository directory, resolving `.` and `..` segments. A path
// that climbs above the repository root is not a repository path.
const joinRepoPath = (base: string, relative: string): O.Option<string> =>
  pipe(
    A.appendAll(Str.isEmpty(base) ? A.empty<string>() : Str.split("/")(base), Str.split("/")(relative)),
    A.reduce(O.some(A.empty<string>()), (state, segment) =>
      O.flatMap(state, (segments) =>
        segment === "" || segment === "."
          ? O.some(segments)
          : segment === ".."
            ? A.isReadonlyArrayNonEmpty(segments)
              ? O.some(A.dropRight(segments, 1))
              : O.none()
            : O.some(A.append(segments, segment))
      )
    ),
    O.map(A.join("/"))
  );

/* -------------------------------------------------------------------------------------------------
 * Goal packets
 * ---------------------------------------------------------------------------------------------- */

const packetSlug = (repoPath: string): O.Option<string> => {
  const segments = Str.split("/")(repoPath);
  return A.length(segments) >= 3 && segments[0] === GOALS_DIR
    ? O.filter(A.get(segments, 1), (slug) => slug !== TEMPLATE_SLUG && !Str.startsWith(".")(slug))
    : O.none();
};

/**
 * Reads every goal packet of a tree as a {@link GoalPacketRecord}, the goals packet core's input.
 *
 * **Details**
 *
 * This is the tree-reader twin of `listGoalPackets`: one record per `goals/<slug>/` directory that
 * tracks at least one file, `_template` and dot directories excluded, with the manifest, README,
 * and `GOAL.md` read from tree bytes. Records are sorted by slug, and the packet paths are
 * repository-relative.
 *
 * **Example** (Read the packets of an empty tree)
 *
 * ```ts
 * import { readKnowledgeGoalPacketRecords } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.domain"
 * import * as Effect from "effect/Effect"
 *
 * const records = readKnowledgeGoalPacketRecords({
 *   commit: "HEAD",
 *   treeish: "HEAD",
 *   trackedEntries: [],
 *   readBytes: () => Effect.succeed(new Uint8Array()),
 * })
 *
 * console.log(Effect.isEffect(records)) // true
 * ```
 *
 * @param oracle - Tree to read.
 * @returns Every packet record, sorted by slug.
 * @category queries
 * @since 0.0.0
 */
export const readKnowledgeGoalPacketRecords = Effect.fn("KnowledgeDoctorDomain.goalPacketRecords")(function* (
  oracle: KnowledgeTreeOracle
) {
  const paths = trackedPaths(oracle);
  const slugs = A.sort(
    A.dedupe(A.getSomes(A.map(oracle.trackedEntries, (entry) => packetSlug(entry.path)))),
    Order.String
  );
  return yield* Effect.forEach(slugs, (slug) => {
    const packetPath = `${GOALS_DIR}/${slug}`;
    const manifestPath = `${packetPath}/ops/manifest.json`;
    const readmePath = `${packetPath}/README.md`;
    return Effect.map(
      Effect.all({
        manifestText: readTextIfTracked(oracle, paths, manifestPath),
        readmeText: readTextIfTracked(oracle, paths, readmePath),
        goalMd: readTextIfTracked(oracle, paths, `${packetPath}/GOAL.md`),
      }),
      ({ manifestText, readmeText, goalMd }) =>
        GoalPacketRecord.make({
          slug,
          packetPath,
          manifestPath,
          readmePath,
          ...optionalProp("manifestText", manifestText),
          ...optionalProp("readmeText", readmeText),
          ...optionalProp("goalMdChars", O.map(goalMd, Str.length)),
        })
    );
  });
});

const packetFacts = (
  record: GoalPacketRecord,
  manifest: KnowledgePacketManifestState,
  decoded: O.Option<{ readonly status: KnowledgePacketFacts["status"]; readonly phaseIds: ReadonlyArray<string> }>
): KnowledgePacketFacts =>
  KnowledgePacketFacts.make({
    slug: record.slug,
    manifestPath: record.manifestPath,
    manifest,
    status: O.flatMap(decoded, (value) => value.status),
    phaseIds: O.getOrElse(
      O.map(decoded, (value) => value.phaseIds),
      A.empty<string>
    ),
  });

const recordFacts = Effect.fn("KnowledgeDoctorDomain.recordFacts")(function* (record: GoalPacketRecord) {
  if (P.isUndefined(record.manifestText)) {
    return packetFacts(record, "missing", O.none());
  }
  const parsed = parseGoalManifestText(record.manifestText);
  if (O.isNone(parsed)) {
    return packetFacts(record, "invalid", O.none());
  }
  const decoded = yield* decodeGoalManifest(parsed.value).pipe(Effect.option);
  return O.match(decoded, {
    onNone: () => packetFacts(record, "invalid", O.none()),
    onSome: (manifest) =>
      packetFacts(
        record,
        "decoded",
        O.some({
          status: O.some(manifest.initiative.status),
          phaseIds: goalManifestPhaseIds(manifest),
        })
      ),
  });
});

const derivePackets = (oracle: KnowledgeTreeOracle) =>
  Effect.flatMap(readKnowledgeGoalPacketRecords(oracle), (records) => Effect.forEach(records, recordFacts));

const REFLECTIONS_DIR = "history/reflections";

const ancestorDirectories = (paths: HashSet.HashSet<string>): HashSet.HashSet<string> =>
  HashSet.fromIterable(
    A.flatMap(A.fromIterable(paths), (repoPath) =>
      A.drop(
        A.scan(A.dropRight(Str.split("/")(repoPath), 1), "", (prefix, segment) =>
          Str.isEmpty(prefix) ? segment : `${prefix}/${segment}`
        ),
        1
      )
    )
  );

const isEscapingSpelling = (exploration: string): boolean =>
  Str.startsWith("/")(exploration) || Str.startsWith("\\\\")(exploration);

/**
 * Builds the goal-packet reader over one tree, the knowledge doctor's twin of the goals doctor's
 * filesystem reader.
 *
 * **Details**
 *
 * Reflection files are the tracked files directly under `<packet>/history/reflections`, read from
 * tree bytes (malformed UTF-8 fails closed). An exploration back-link is `escapes` when it is
 * absolute or climbs above the repository root, and otherwise `present` exactly when the tree
 * tracks it as a file or a directory.
 *
 * **Example** (Read the reflections of an empty tree)
 *
 * ```ts
 * import { makeKnowledgeGoalPacketReader } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.domain"
 * import * as Effect from "effect/Effect"
 *
 * const reader = makeKnowledgeGoalPacketReader({
 *   commit: "HEAD",
 *   treeish: "HEAD",
 *   trackedEntries: [],
 *   readBytes: () => Effect.succeed(new Uint8Array()),
 * })
 *
 * console.log(Effect.isEffect(reader.reflectionFiles("goals/demo"))) // true
 * ```
 *
 * @param oracle - Tree to read.
 * @returns A goal-packet reader that never touches the working filesystem.
 * @category constructors
 * @since 0.0.0
 */
export const makeKnowledgeGoalPacketReader = (
  oracle: KnowledgeTreeOracle
): GoalPacketReader<KnowledgeOperationalError, never> => {
  const paths = trackedPaths(oracle);
  const directories = ancestorDirectories(paths);
  return {
    reflectionFiles: (packetPath) => {
      const prefix = `${packetPath}/${REFLECTIONS_DIR}/`;
      return Effect.succeed(
        A.getSomes(
          A.map(oracle.trackedEntries, (entry) =>
            pipe(
              O.liftPredicate(entry.path, Str.startsWith(prefix)),
              O.map(Str.slice(Str.length(prefix))),
              O.filter((name) => !pipe(name, Str.includes("/")))
            )
          )
        )
      );
    },
    readReflection: (packetPath, file) => readText(oracle, `${packetPath}/${REFLECTIONS_DIR}/${file}`),
    explorationPath: (exploration) =>
      Effect.succeed(
        pipe(
          O.liftPredicate(exploration, (value) => !isEscapingSpelling(value)),
          O.flatMap((value) => joinRepoPath("", value)),
          O.match({
            onNone: () => GoalExplorationPathState.Enum.escapes,
            onSome: (repoPath) =>
              Str.isEmpty(repoPath) || HashSet.has(paths, repoPath) || HashSet.has(directories, repoPath)
                ? GoalExplorationPathState.Enum.present
                : GoalExplorationPathState.Enum.absent,
          })
        )
      ),
  };
};

/**
 * Lists the goals-doctor findings of one tree that are a function of its bytes alone.
 *
 * **Details**
 *
 * The goals packet core ({@link goalPacketFindings}) runs over every packet record with the tree
 * reader, followed by the cross-packet capability findings. The goals doctor's Git-history advisories
 * (`stale-active`, `active-after-merge`, `completion-gate-unsatisfied`) read wall-clock windows and
 * merge subjects rather than the tree, so they are never derived here.
 *
 * **Example** (List the findings of an empty tree)
 *
 * ```ts
 * import { readKnowledgeGoalsDoctorFindings } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.domain"
 * import * as Effect from "effect/Effect"
 *
 * const findings = readKnowledgeGoalsDoctorFindings({
 *   commit: "HEAD",
 *   treeish: "HEAD",
 *   trackedEntries: [],
 *   readBytes: () => Effect.succeed(new Uint8Array()),
 * })
 *
 * console.log(Effect.isEffect(findings)) // true
 * ```
 *
 * @param oracle - Tree to read.
 * @returns Packet findings in slug order, then capability findings.
 * @category queries
 * @since 0.0.0
 */
export const readKnowledgeGoalsDoctorFindings = Effect.fn("KnowledgeDoctorDomain.goalsDoctorFindings")(function* (
  oracle: KnowledgeTreeOracle
) {
  const records = yield* readKnowledgeGoalPacketRecords(oracle);
  const reader = makeKnowledgeGoalPacketReader(oracle);
  const results = yield* Effect.forEach(records, (record) => goalPacketFindings(record, reader));
  const capability = capabilityPacketFindings(
    A.zipWith(records, results, (record, result) => ({ slug: record.slug, manifest: result.manifest }))
  );
  return A.appendAll(
    A.flatMap(results, (result) => result.findings),
    capability
  );
});

/* -------------------------------------------------------------------------------------------------
 * Workspace packages and exports
 * ---------------------------------------------------------------------------------------------- */

class PackageManifestJson extends S.Class<PackageManifestJson>($I`PackageManifestJson`)(
  {
    name: S.optionalKey(S.String),
    exports: S.optionalKey(S.Unknown),
    workspaces: S.optionalKey(S.Unknown),
  },
  $I.annote("PackageManifestJson", {
    description: "The package.json fields the symbols evaluator reads: name, exports map, and workspace globs.",
  })
) {}

class TsconfigPathsJson extends S.Class<TsconfigPathsJson>($I`TsconfigPathsJson`)(
  {
    compilerOptions: S.optionalKey(
      S.Struct({ paths: S.optionalKey(S.Record(S.String, S.Array(S.String))) }).annotate({
        description: "The compilerOptions block, read only for its paths aliases.",
      })
    ),
  },
  $I.annote("TsconfigPathsJson", {
    description: "The root tsconfig.json fields the symbols evaluator reads: compilerOptions.paths.",
  })
) {}

const decodePackageManifest = decodeJsoncTextAs(PackageManifestJson);
const decodeTsconfigPaths = decodeJsoncTextAs(TsconfigPathsJson);

const CONDITION_ORDER = ["bun", "import", "default", "types", "require", "node"] as const;

// Resolves one exports-map value to its target spelling: a string is the target, `null` blocks the
// key, an array falls through to its first resolvable member, and a condition object prefers the
// runtime conditions in `CONDITION_ORDER` before any other key.
const exportTarget = (value: unknown): O.Option<string> => {
  if (P.isString(value)) {
    return O.some(value);
  }
  if (A.isArray(value)) {
    return A.findFirst(value, exportTarget);
  }
  if (P.isObject(value)) {
    const record: Readonly<Record<string, unknown>> = value;
    const keys = A.appendAll(
      A.filter(CONDITION_ORDER, (key) => R.has(record, key)),
      A.filter(R.keys(record), (key) => !A.contains(CONDITION_ORDER, key))
    );
    return A.findFirst(keys, (key) => O.flatMap(R.get(record, key), exportTarget));
  }
  return O.none();
};

const entrypoint = (root: string, key: string, value: unknown): KnowledgePackageEntrypoint =>
  KnowledgePackageEntrypoint.make({
    key,
    target: O.flatMap(exportTarget(value), (target) => joinRepoPath(root, target)),
  });

const packageEntrypoints = (root: string, exportsValue: unknown): ReadonlyArray<KnowledgePackageEntrypoint> => {
  if (P.isUndefined(exportsValue)) {
    return A.empty();
  }
  if (P.isObject(exportsValue) && !A.isArray(exportsValue)) {
    const record: Readonly<Record<string, unknown>> = exportsValue;
    const subpathKeys = A.filter(R.keys(record), Str.startsWith("."));
    return A.isReadonlyArrayNonEmpty(subpathKeys)
      ? A.map(subpathKeys, (key) => entrypoint(root, key, record[key]))
      : [entrypoint(root, ".", exportsValue)];
  }
  return [entrypoint(root, ".", exportsValue)];
};

const isPackageManifestEntry = (repoPath: string): boolean =>
  repoPath === PACKAGE_MANIFEST || Str.endsWith(`/${PACKAGE_MANIFEST}`)(repoPath);

const readWorkspacePackage = (oracle: KnowledgeTreeOracle, manifestPath: string) =>
  readText(oracle, manifestPath).pipe(
    Effect.flatMap((text) => decodePackageManifest(text).pipe(Effect.option)),
    Effect.map((manifest) =>
      pipe(
        O.flatMap(manifest, (value) => O.fromUndefinedOr(value.name)),
        O.filter(Str.startsWith(WORKSPACE_SCOPE)),
        O.map((name) => {
          const root = dirname(manifestPath);
          return KnowledgeWorkspacePackage.make({
            name,
            manifestPath,
            root,
            entrypoints: packageEntrypoints(
              root,
              O.getOrUndefined(O.flatMap(manifest, (value) => O.fromUndefinedOr(value.exports)))
            ),
          });
        })
      )
    )
  );

// The root manifest's workspace globs, in either the array or the `{ packages }` spelling.
const workspaceGlobs = (value: unknown): ReadonlyArray<string> => {
  const list = P.isObject(value) && !A.isArray(value) ? O.getOrUndefined(R.get(value, "packages")) : value;
  return A.isArray(list) ? A.filter(list, P.isString) : A.empty();
};

const matchesWorkspaceGlob = (directory: string, glob: string): boolean => {
  const segments = Str.split("/")(directory);
  const pattern = Str.split("/")(Str.replace(/^\.\//u, "")(glob));
  return (
    A.length(segments) === A.length(pattern) &&
    A.every(A.zip(segments, pattern), ([segment, part]) => part === "*" || part === segment)
  );
};

const readWorkspaceGlobs = (oracle: KnowledgeTreeOracle, paths: HashSet.HashSet<string>) =>
  readTextIfTracked(oracle, paths, PACKAGE_MANIFEST).pipe(
    Effect.flatMap((text) =>
      O.match(text, {
        onNone: () => Effect.succeedNone,
        onSome: (value) => decodePackageManifest(value).pipe(Effect.option),
      })
    ),
    Effect.map((manifest) =>
      O.filter(
        O.map(
          O.flatMap(manifest, (value) => O.fromUndefinedOr(value.workspaces)),
          workspaceGlobs
        ),
        A.isReadonlyArrayNonEmpty
      )
    )
  );

const isWorkspaceManifest = (globs: O.Option<ReadonlyArray<string>>, manifestPath: string): boolean =>
  manifestPath === PACKAGE_MANIFEST ||
  O.match(globs, {
    onNone: () => true,
    onSome: A.some((glob) => matchesWorkspaceGlob(dirname(manifestPath), glob)),
  });

const derivePackages = Effect.fn("KnowledgeDoctorDomain.packages")(function* (
  oracle: KnowledgeTreeOracle,
  paths: HashSet.HashSet<string>
) {
  const globs = yield* readWorkspaceGlobs(oracle, paths);
  const manifests = A.filter(
    oracle.trackedEntries,
    (entry) => isRegularBlob(entry.mode) && isPackageManifestEntry(entry.path) && isWorkspaceManifest(globs, entry.path)
  );
  return A.getSomes(yield* Effect.forEach(manifests, (entry) => readWorkspacePackage(oracle, entry.path)));
});

const derivePathAliases = (oracle: KnowledgeTreeOracle, paths: HashSet.HashSet<string>) =>
  readTextIfTracked(oracle, paths, KNOWLEDGE_TSCONFIG_PATH).pipe(
    Effect.flatMap((text) =>
      O.match(text, {
        onNone: () => Effect.succeed(O.none<TsconfigPathsJson>()),
        onSome: (value) => decodeTsconfigPaths(value).pipe(Effect.option),
      })
    ),
    Effect.map((tsconfig) =>
      pipe(
        O.flatMap(tsconfig, (value) => O.fromUndefinedOr(value.compilerOptions?.paths)),
        O.map((aliases) =>
          A.map(
            A.filter(R.toEntries(aliases), ([key]) => Str.startsWith(WORKSPACE_SCOPE)(key)),
            ([key, targets]) =>
              KnowledgePackageEntrypoint.make({
                key,
                target: O.flatMap(A.head(targets), (target) => joinRepoPath("", target)),
              })
          )
        ),
        O.getOrElse(A.empty<KnowledgePackageEntrypoint>)
      )
    )
  );

const DECLARATION_PATTERN =
  /^export\s+(?:declare\s+)?(?:default\s+)?(?:abstract\s+)?(?:async\s+)?(?:const|let|var|function\*?|class|interface|type|enum|namespace|module)\s+([A-Za-z_$][\w$]*)/gmu;
const EXPORT_LIST_PATTERN = /^export\s+(?:type\s+)?\{([^}]*)\}/gmu;
const EXPORT_NAMESPACE_PATTERN = /^export\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s/gmu;
const EXPORT_STAR_PATTERN = /^export\s+\*\s+from\s+["']([^"']+)["']/gmu;
const EXPORT_LIST_ITEM_PATTERN = /^(?:type\s+)?[A-Za-z_$][\w$]*(?:\s+as\s+([A-Za-z_$][\w$]*))?$/u;

const captured = (pattern: RegExp, text: string): ReadonlyArray<string> =>
  A.getSomes(A.map(knowledgeLineMatches(pattern, text), (match) => O.fromUndefinedOr(match[1])));

const listItemName = (item: string): O.Option<string> => {
  const trimmed = Str.trim(item);
  return pipe(
    O.fromNullishOr(EXPORT_LIST_ITEM_PATTERN.exec(trimmed)),
    O.map((match) => O.getOrElse(O.fromUndefinedOr(match[1]), () => Str.trim(Str.replace(/^type\s+/u, "")(trimmed))))
  );
};

const STAR_CANDIDATE_SUFFIXES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"] as const;

const resolveStar = (paths: HashSet.HashSet<string>, file: string, specifier: string): O.Option<string> =>
  Str.startsWith(".")(specifier)
    ? pipe(
        joinRepoPath(dirname(file), Str.replace(/\.js$/u, ".ts")(specifier)),
        O.flatMap((base) =>
          A.findFirst(STAR_CANDIDATE_SUFFIXES, (suffix) =>
            HashSet.has(paths, `${base}${suffix}`) ? O.some(`${base}${suffix}`) : O.none()
          )
        )
      )
    : O.none();

// A line-leading `export` inside a `/* … */` block is commentary, not a declaration. Blanking
// the comment (newlines kept) leaves every real line where it was.
// Block comments are found with TypeScript's own scanner, so a `/*` inside a string,
// a template, a `//` comment, or a regex literal is never mistaken for an opener (#1702).
// A `/` starts a regex literal unless the previous token ends an operand; listing the operand
// enders instead of regex contexts covers every binary operator (`a+/re/`) and keyword operator.
const OPERAND_ENDERS = HashSet.make(
  ts.SyntaxKind.Identifier,
  ts.SyntaxKind.PrivateIdentifier,
  ts.SyntaxKind.NumericLiteral,
  ts.SyntaxKind.BigIntLiteral,
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.RegularExpressionLiteral,
  ts.SyntaxKind.CloseParenToken,
  ts.SyntaxKind.CloseBracketToken,
  ts.SyntaxKind.PlusPlusToken,
  ts.SyntaxKind.MinusMinusToken,
  ts.SyntaxKind.ThisKeyword,
  ts.SyntaxKind.SuperKeyword,
  ts.SyntaxKind.TrueKeyword,
  ts.SyntaxKind.FalseKeyword,
  ts.SyntaxKind.NullKeyword
);
const isSlash = (kind: ts.SyntaxKind): boolean =>
  kind === ts.SyntaxKind.SlashToken || kind === ts.SyntaxKind.SlashEqualsToken;
const isTrivia = (kind: ts.SyntaxKind): boolean =>
  kind >= ts.SyntaxKind.FirstTriviaToken && kind <= ts.SyntaxKind.LastTriviaToken;

const blockCommentRanges = (text: string): ReadonlyArray<readonly [number, number]> => {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, text);
  const ranges: Array<readonly [number, number]> = [];
  let previous: ts.SyntaxKind = ts.SyntaxKind.Unknown;
  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) {
    const token: ts.SyntaxKind =
      isSlash(kind) && !HashSet.has(OPERAND_ENDERS, previous) ? scanner.reScanSlashToken() : kind;
    if (token === ts.SyntaxKind.MultiLineCommentTrivia) {
      ranges.push([scanner.getTokenStart(), scanner.getTokenEnd()]);
    }
    previous = isTrivia(token) ? previous : token;
  }
  return ranges;
};

const blankCommentText = Str.replace(/[^\n]/gu, " ");
const blankBlockComments = (text: string): string =>
  A.reduce(
    blockCommentRanges(text),
    text,
    (current, [start, end]) =>
      `${Str.slice(0, start)(current)}${blankCommentText(Str.slice(start, end)(current))}${Str.slice(end)(current)}`
  );

/**
 * Scans one source file's export declarations without the compiler.
 *
 * **Details**
 *
 * Declarations are read only at the start of a line, so JSDoc example text indented under `*` is never
 * read as an export. `export * from` re-exports with a relative specifier that resolves in the tree
 * become `stars`; package specifiers are not followed.
 *
 * **Example** (Scan declarations and re-exports)
 *
 * ```ts
 * import { scanKnowledgeFileExports } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.domain"
 * import * as HashSet from "effect/HashSet"
 *
 * const scan = scanKnowledgeFileExports(
 *   "src/index.ts",
 *   "export const a = 1\nexport { b as c, type D }\nexport * from \"./e.ts\"",
 *   HashSet.make("src/e.ts")
 * )
 *
 * console.log(scan.names) // [ "a", "c", "D" ]
 * console.log(scan.stars) // [ "src/e.ts" ]
 * ```
 *
 * @param file - Repository path of the scanned file.
 * @param text - Decoded file text.
 * @param paths - Tracked repository paths, for resolving star re-exports.
 * @returns The file's own export names and resolved star targets.
 * @category parsing
 * @since 0.0.0
 */
export const scanKnowledgeFileExports: {
  (text: string, paths: HashSet.HashSet<string>): (file: string) => KnowledgeFileExports;
  (file: string, text: string, paths: HashSet.HashSet<string>): KnowledgeFileExports;
} = dual(3, (file: string, source: string, paths: HashSet.HashSet<string>): KnowledgeFileExports => {
  const text = blankBlockComments(source);
  const listed = A.flatMap(captured(EXPORT_LIST_PATTERN, text), (list) =>
    A.getSomes(A.map(A.filter(Str.split(",")(list), Str.isNonEmpty), listItemName))
  );
  return KnowledgeFileExports.make({
    file,
    names: A.dedupe(
      A.appendAll(A.appendAll(captured(DECLARATION_PATTERN, text), listed), captured(EXPORT_NAMESPACE_PATTERN, text))
    ),
    stars: A.dedupe(
      A.getSomes(A.map(captured(EXPORT_STAR_PATTERN, text), (specifier) => resolveStar(paths, file, specifier)))
    ),
  });
});

const deriveFileExports = (oracle: KnowledgeTreeOracle, paths: HashSet.HashSet<string>, file: string) =>
  Effect.map(readTextIfTracked(oracle, paths, file), (text) =>
    O.match(text, {
      onNone: () => KnowledgeFileExports.make({ file, names: [], stars: [] }),
      onSome: (value) => scanKnowledgeFileExports(file, value, paths),
    })
  );

/* -------------------------------------------------------------------------------------------------
 * Skills
 * ---------------------------------------------------------------------------------------------- */

const decodeLockV2 = S.decodeUnknownEffect(S.fromJsonString(SkillsLockDocument));
const decodeLockV1 = S.decodeUnknownEffect(S.fromJsonString(SkillLockFile));

const installedSkill = (repoPath: string): O.Option<string> => {
  const segments = Str.split("/")(repoPath);
  return A.length(segments) === 4 && Str.startsWith(`${KNOWLEDGE_SKILLS_DIR}/`)(repoPath) && segments[3] === SKILL_FILE
    ? A.get(segments, 2)
    : O.none();
};

const lockLine = (lockText: string, skill: string) =>
  pipe(
    A.findFirstIndex(Str.split("\n")(lockText), (line) => Str.startsWith(`"${skill}":`)(Str.trim(line))),
    O.map((index) => S.Natural.make(index + 1))
  );

const defaultTargets = (skill: string): ReadonlyArray<string> => [`${KNOWLEDGE_SKILLS_DIR}/${skill}`];

const v1Facts = (lock: SkillLockFile, lockText: string): ReadonlyArray<KnowledgeSkillLockFacts> =>
  A.map(R.toEntries(lock.skills), ([skill, entry]) =>
    KnowledgeSkillLockFacts.make({
      skill,
      sourceType: entry.sourceType,
      source: entry.sourceType === "local" ? O.none() : O.some(entry.source),
      revision: O.fromUndefinedOr(entry.ref),
      licensed: false,
      installedTargets: defaultTargets(skill),
      line: lockLine(lockText, skill),
    })
  );

const v2Facts = (lock: SkillsLockDocument, lockText: string): ReadonlyArray<KnowledgeSkillLockFacts> =>
  A.map(R.toEntries(lock.skills), ([skill, entry]) =>
    P.isTagged(entry, "vendored")
      ? KnowledgeSkillLockFacts.make({
          skill,
          sourceType: entry.sourceType,
          source: O.some(entry.upstream.repository),
          revision: O.some(entry.upstream.sourceRevision),
          licensed: true,
          installedTargets: entry.effective.installedTargets,
          line: lockLine(lockText, skill),
        })
      : KnowledgeSkillLockFacts.make({
          skill,
          sourceType: "local",
          source: O.none(),
          revision: O.none(),
          licensed: false,
          installedTargets: entry.installedTargets,
          line: lockLine(lockText, skill),
        })
  );

const DECLARES_LOCK_V1 = /"version"\s*:\s*1\b/u;

const decodeLockFacts = (lockText: string) =>
  decodeLockV2(lockText).pipe(
    Effect.map((lock) => ({ version: 2 as const, entries: v2Facts(lock, lockText) })),
    // A lock that does not declare version 1 is a broken v2 lock: report the v2 error,
    // not the v1 fallback's (#1702).
    Effect.catch((v2Error) =>
      Effect.map(decodeLockV1(lockText), (lock) => ({ version: 1 as const, entries: v1Facts(lock, lockText) })).pipe(
        Effect.mapError((v1Error) => (DECLARES_LOCK_V1.test(lockText) ? v1Error : v2Error))
      )
    ),
    KnowledgeOperationalError.mapError(
      `${KNOWLEDGE_SKILLS_LOCK_PATH} decodes as neither skills-lock v2 nor the v1 lock file.`
    )
  );

const deriveSkills = Effect.fn("KnowledgeDoctorDomain.skills")(function* (
  oracle: KnowledgeTreeOracle,
  paths: HashSet.HashSet<string>
) {
  const installed = A.sort(
    A.dedupe(A.getSomes(A.map(oracle.trackedEntries, (entry) => installedSkill(entry.path)))),
    Order.String
  );
  const lockText = yield* readTextIfTracked(oracle, paths, KNOWLEDGE_SKILLS_LOCK_PATH);
  if (O.isNone(lockText)) {
    return KnowledgeSkillsFacts.make({ lockVersion: O.none(), entries: [], installed });
  }
  const lock = yield* decodeLockFacts(lockText.value);
  return KnowledgeSkillsFacts.make({ lockVersion: O.some(lock.version), entries: lock.entries, installed });
});

/* -------------------------------------------------------------------------------------------------
 * Domain construction, caching, and overlay
 * ---------------------------------------------------------------------------------------------- */

/**
 * Derives the domain facts of one tree, uncached.
 *
 * **Details**
 *
 * Every lookup reads tree bytes on each run, which keeps a derivation over an overlaid tree honest:
 * a hidden entry is simply absent. Live trees wrap this with {@link cacheKnowledgeDoctorDomain}.
 *
 * **Example** (Derive the facts of an empty tree)
 *
 * ```ts
 * import { deriveKnowledgeDoctorDomain } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.domain"
 * import * as Effect from "effect/Effect"
 *
 * const domain = deriveKnowledgeDoctorDomain({
 *   commit: "HEAD",
 *   treeish: "HEAD",
 *   trackedEntries: [],
 *   readBytes: () => Effect.succeed(new Uint8Array()),
 * })
 *
 * console.log(Effect.isEffect(domain.packets)) // true
 * ```
 *
 * @param oracle - Tree whose bytes the facts come from.
 * @returns Lookups for packets, packages, path aliases, file exports, goals-doctor findings, and skills.
 * @category constructors
 * @since 0.0.0
 */
export const deriveKnowledgeDoctorDomain = (oracle: KnowledgeTreeOracle): KnowledgeDoctorDomain => {
  const paths = trackedPaths(oracle);
  return {
    packets: derivePackets(oracle),
    packages: derivePackages(oracle, paths),
    pathAliases: derivePathAliases(oracle, paths),
    fileExports: (file) => deriveFileExports(oracle, paths, file),
    goalsDoctorFindings: readKnowledgeGoalsDoctorFindings(oracle),
    skills: deriveSkills(oracle, paths),
  };
};

/**
 * Memoizes every lookup of a domain for the lifetime of one scan.
 *
 * **Example** (Cache the facts of an empty tree)
 *
 * ```ts
 * import {
 *   cacheKnowledgeDoctorDomain,
 *   deriveKnowledgeDoctorDomain,
 * } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.domain"
 * import * as Effect from "effect/Effect"
 *
 * const cached = cacheKnowledgeDoctorDomain(
 *   deriveKnowledgeDoctorDomain({
 *     commit: "HEAD",
 *     treeish: "HEAD",
 *     trackedEntries: [],
 *     readBytes: () => Effect.succeed(new Uint8Array()),
 *   })
 * )
 *
 * console.log(Effect.isEffect(cached)) // true
 * ```
 *
 * @param domain - Uncached lookups.
 * @returns The same lookups, each run at most once per key.
 * @category constructors
 * @since 0.0.0
 */
export const cacheKnowledgeDoctorDomain = Effect.fn("KnowledgeDoctorDomain.cache")(function* (
  domain: KnowledgeDoctorDomain
) {
  const exportsByFile = MutableHashMap.empty<string, KnowledgeFileExports>();
  return {
    packets: yield* Effect.cached(domain.packets),
    packages: yield* Effect.cached(domain.packages),
    pathAliases: yield* Effect.cached(domain.pathAliases),
    skills: yield* Effect.cached(domain.skills),
    goalsDoctorFindings: yield* Effect.cached(domain.goalsDoctorFindings),
    fileExports: (file: string) =>
      O.match(MutableHashMap.get(exportsByFile, file), {
        onSome: Effect.succeed,
        onNone: () =>
          Effect.tap(domain.fileExports(file), (scan) =>
            Effect.sync(() => MutableHashMap.set(exportsByFile, file, scan))
          ),
      }),
  } satisfies KnowledgeDoctorDomain;
});

/**
 * Any witness whose fact lives in the domain rather than in the tree's entries or command surface.
 *
 * @category models
 * @since 0.0.0
 */
export type KnowledgeDomainWitness = ManifestFieldWitness | ExportWitness | LockEntryWitness;

const STATUS_FIELD = "initiative.status";
const PHASE_FIELD_PREFIX = "phases.";

const withoutManifestField = (facts: KnowledgePacketFacts, field: string): KnowledgePacketFacts =>
  field === STATUS_FIELD
    ? KnowledgePacketFacts.make({ ...facts, status: O.none() })
    : KnowledgePacketFacts.make({
        ...facts,
        phaseIds: A.filter(facts.phaseIds, (id) => `${PHASE_FIELD_PREFIX}${id}` !== field),
      });

const withoutExport = (domain: KnowledgeDoctorDomain, witness: ExportWitness): KnowledgeDoctorDomain => ({
  ...domain,
  packages: Effect.map(
    domain.packages,
    A.map((pkg) =>
      pkg.manifestPath === witness.file
        ? KnowledgeWorkspacePackage.make({
            ...pkg,
            entrypoints: A.filter(pkg.entrypoints, (entry) => entry.key !== witness.exportName),
          })
        : pkg
    )
  ),
  pathAliases:
    witness.file === KNOWLEDGE_TSCONFIG_PATH
      ? Effect.map(
          domain.pathAliases,
          A.filter((alias) => alias.key !== witness.exportName)
        )
      : domain.pathAliases,
  fileExports: (file) =>
    file === witness.file
      ? Effect.map(domain.fileExports(file), (scan) =>
          KnowledgeFileExports.make({ ...scan, names: A.filter(scan.names, (name) => name !== witness.exportName) })
        )
      : domain.fileExports(file),
});

/**
 * The same domain with one domain witness removed.
 *
 * **Details**
 *
 * A manifest-field witness drops that field from its packet's facts (`initiative.status` clears the
 * status, `phases.<id>` removes the phase). An export witness drops the exports-map key, path alias,
 * or identifier from exactly the witnessed file. A lock-entry witness removes the skill's lock entry
 * and leaves the installed tree alone.
 *
 * **Example** (Remove a lock entry)
 *
 * ```ts
 * import { LockEntryWitness } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import {
 *   deriveKnowledgeDoctorDomain,
 *   knowledgeDomainWithout,
 * } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.domain"
 * import * as Effect from "effect/Effect"
 *
 * const domain = deriveKnowledgeDoctorDomain({
 *   commit: "HEAD",
 *   treeish: "HEAD",
 *   trackedEntries: [],
 *   readBytes: () => Effect.succeed(new Uint8Array()),
 * })
 * const without = knowledgeDomainWithout(domain, LockEntryWitness.make({ skill: "yeet" }))
 *
 * console.log(Effect.isEffect(without.skills)) // true
 * ```
 *
 * @param domain - Domain the witness held in.
 * @param witness - Domain witness to remove.
 * @returns The overlaid domain.
 * @category combinators
 * @since 0.0.0
 */
export const knowledgeDomainWithout: {
  (witness: KnowledgeDomainWitness): (domain: KnowledgeDoctorDomain) => KnowledgeDoctorDomain;
  (domain: KnowledgeDoctorDomain, witness: KnowledgeDomainWitness): KnowledgeDoctorDomain;
} = dual(
  2,
  (domain: KnowledgeDoctorDomain, witness: KnowledgeDomainWitness): KnowledgeDoctorDomain =>
    Match.type<KnowledgeDomainWitness>().pipe(
      Match.tagsExhaustive({
        ExportWitness: (exported) => withoutExport(domain, exported),
        LockEntryWitness: (locked) => ({
          ...domain,
          skills: Effect.map(domain.skills, (facts) =>
            KnowledgeSkillsFacts.make({
              ...facts,
              entries: A.filter(facts.entries, (entry) => entry.skill !== locked.skill),
            })
          ),
        }),
        ManifestFieldWitness: (field) => ({
          ...domain,
          packets: Effect.map(
            domain.packets,
            A.map((facts) => (facts.slug === field.slug ? withoutManifestField(facts, field.field) : facts))
          ),
        }),
      })
    )(witness)
);

const manifestFieldHolds = (facts: KnowledgePacketFacts, field: string): boolean =>
  field === STATUS_FIELD
    ? O.isSome(facts.status)
    : A.some(facts.phaseIds, (id) => `${PHASE_FIELD_PREFIX}${id}` === field);

const exportHolds = Effect.fn("KnowledgeDoctorDomain.exportHolds")(function* (
  domain: KnowledgeDoctorDomain,
  witness: ExportWitness
) {
  const packages = yield* domain.packages;
  if (A.some(packages, (pkg) => pkg.manifestPath === witness.file)) {
    return A.some(
      packages,
      (pkg) =>
        pkg.manifestPath === witness.file &&
        pkg.name === witness.packageName &&
        A.some(pkg.entrypoints, (entry) => entry.key === witness.exportName)
    );
  }
  if (witness.file === KNOWLEDGE_TSCONFIG_PATH) {
    return A.some(yield* domain.pathAliases, (alias) => alias.key === witness.exportName);
  }
  return A.contains((yield* domain.fileExports(witness.file)).names, witness.exportName);
});

/**
 * Whether a domain witness holds in a domain, before any overlay.
 *
 * **Example** (A lock entry the domain does not hold)
 *
 * ```ts
 * import { LockEntryWitness } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import {
 *   deriveKnowledgeDoctorDomain,
 *   knowledgeDomainWitnessHolds,
 * } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.domain"
 * import * as Effect from "effect/Effect"
 *
 * const domain = deriveKnowledgeDoctorDomain({
 *   commit: "HEAD",
 *   treeish: "HEAD",
 *   trackedEntries: [],
 *   readBytes: () => Effect.succeed(new Uint8Array()),
 * })
 *
 * console.log(Effect.isEffect(knowledgeDomainWitnessHolds(domain, LockEntryWitness.make({ skill: "yeet" })))) // true
 * ```
 *
 * @param domain - Domain to check.
 * @param witness - Domain witness an evaluator cited.
 * @returns Whether the witnessed fact is present.
 * @category predicates
 * @since 0.0.0
 */
export const knowledgeDomainWitnessHolds: {
  (
    witness: KnowledgeDomainWitness
  ): (domain: KnowledgeDoctorDomain) => Effect.Effect<boolean, KnowledgeOperationalError>;
  (domain: KnowledgeDoctorDomain, witness: KnowledgeDomainWitness): Effect.Effect<boolean, KnowledgeOperationalError>;
} = dual(
  2,
  (domain: KnowledgeDoctorDomain, witness: KnowledgeDomainWitness): Effect.Effect<boolean, KnowledgeOperationalError> =>
    Match.type<KnowledgeDomainWitness>().pipe(
      Match.tagsExhaustive({
        ExportWitness: (exported) => exportHolds(domain, exported),
        LockEntryWitness: (locked) =>
          Effect.map(domain.skills, (facts) => A.some(facts.entries, (entry) => entry.skill === locked.skill)),
        ManifestFieldWitness: (field) =>
          Effect.map(
            domain.packets,
            A.some((facts) => facts.slug === field.slug && manifestFieldHolds(facts, field.field))
          ),
      })
    )(witness)
);
