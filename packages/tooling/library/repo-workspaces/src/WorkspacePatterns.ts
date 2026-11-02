/**
 * The workspace `packages:` pattern list, read from a workspace root or taken
 * from an already-parsed configuration document.
 *
 * **Details**
 *
 * pnpm records the list in `pnpm-workspace.yaml`; npm, yarn and bun record it
 * in the root `package.json` `workspaces` field (array form, or the legacy
 * `{ packages: [...] }` object form). The reader prefers a non-empty
 * `pnpm-workspace.yaml` list and falls back to the manifest, which is the
 * precedence `WorkspaceDiscovery`, `WorkspacesSync` and `WorkspaceSnapshots`
 * share. Repo tooling that only needs the pattern list (and not the member
 * enumeration behind it) reads it here instead of carrying its own copy.
 *
 * **Example** (Read a workspace's patterns)
 *
 * ```ts
 * import { WorkspacePatterns } from "@beep/repo-workspaces/WorkspacePatterns";
 * import * as Effect from "effect/Effect";
 *
 * const program = WorkspacePatterns.read("/repo");
 * console.log(Effect.isEffect(program)); // true
 * ```
 *
 * @since 0.0.0
 */
import { $RepoWorkspacesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { Yaml } from "@beep/yaml";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoWorkspacesId.create("WorkspacePatterns");

/**
 * The caller-visible reasons reading workspace patterns can fail.
 *
 * **Example** (Recognize a workspace configuration failure kind)
 *
 * ```ts
 * import { WorkspacePatternReadFailureKind } from "@beep/repo-workspaces/WorkspacePatterns";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(WorkspacePatternReadFailureKind)("invalidYaml")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const WorkspacePatternReadFailureKind = LiteralKit(["read", "invalidYaml", "invalidJson"]).pipe(
  $I.annoteSchema("WorkspacePatternReadFailureKind", {
    description: "The caller-visible reasons reading workspace patterns can fail.",
  })
);
/**
 * The failure-kind literals accepted by the workspace pattern reader.
 *
 * @category type-level
 * @since 0.0.0
 */
export type WorkspacePatternReadFailureKind = typeof WorkspacePatternReadFailureKind.Type;

/**
 * Raised when an existing workspace configuration cannot be read or parsed:
 * the file is unreadable, `pnpm-workspace.yaml` is not YAML, or the root
 * `package.json` is not JSON.
 *
 * **Details**
 *
 * An absent configuration is not a failure (a standalone package declares no
 * patterns); only a file that exists and cannot be read as declared fails.
 * `kind` is the discriminant a caller branches on; `cause` preserves the
 * originating failure rather than flattening it into a sentence.
 *
 * **Example** (Report an unreadable workspace manifest)
 *
 * ```ts
 * import { WorkspacePatternReadError } from "@beep/repo-workspaces/WorkspacePatterns";
 *
 * const error = WorkspacePatternReadError.make({ path: "/repo/package.json", kind: "invalidJson", cause: undefined });
 * console.log(error.message) // Workspace patterns could not be read from /repo/package.json (invalidJson)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WorkspacePatternReadError extends S.TaggedError<
  WorkspacePatternReadError,
  { readonly brand: unique symbol }
>($I`WorkspacePatternReadError`)(
  "WorkspacePatternReadError",
  {
    /** The workspace configuration file whose read or parse failed. */
    path: S.String.pipe(
      $I.annoteKey("WorkspacePatternReadError.path", {
        description: "The workspace configuration file whose read or parse failed.",
      })
    ),
    /** What went wrong with it. */
    kind: WorkspacePatternReadFailureKind.pipe(
      $I.annoteKey("WorkspacePatternReadError.kind", { description: "What went wrong with it." })
    ),
    /** The originating failure, if there was one. */
    cause: S.Defect({ includeStack: true }).pipe(
      $I.annoteKey("WorkspacePatternReadError.cause", { description: "The originating failure, if there was one." })
    ),
  },
  $I.annoteError<WorkspacePatternReadError>("WorkspacePatternReadError", {
    description:
      "Raised when an existing workspace configuration cannot be read or parsed: the file is unreadable, `pnpm-workspace.yaml` is not YAML, or the root `package.json` is not JSON.",
  })
) {
  /**
   * Renders the failing file and kind into a one-line message.
   *
   * **Example** (Render the failure message)
   *
   * ```ts
   * import { WorkspacePatternReadError } from "@beep/repo-workspaces/WorkspacePatterns";
   *
   * const error = WorkspacePatternReadError.make({ path: "/repo/pnpm-workspace.yaml", kind: "invalidYaml", cause: undefined });
   * console.log(error.message) // Workspace patterns could not be read from /repo/pnpm-workspace.yaml (invalidYaml)
   * ```
   *
   * @returns The one-line sentence a log or a thrown error shows.
   * @category formatting
   * @since 0.0.0
   */
  override get message(): string {
    return `Workspace patterns could not be read from ${this.path} (${this.kind})`;
  }
}

const JsonValue = S.fromJsonString(S.Unknown);

// The string entries of `value` when it is an array, else none.
const stringsOf = (value: unknown): O.Option<ReadonlyArray<string>> =>
  A.isArray(value) ? O.some(A.filter(value, P.isString)) : O.none();

// `stringsOf`, with a non-array read as no strings.
const stringsOrEmpty = (value: unknown): ReadonlyArray<string> => O.getOrElse(stringsOf(value), () => []);

/**
 * A pattern body without its leading `./` segments and its trailing slashes.
 *
 * @param body - The pattern text after any `!`.
 * @returns The body as the enumerators match it.
 */
const normalizedBody = (body: string): string => Str.replace(/\/+$/, "")(Str.replace(/^(?:\.\/+)+/, "")(body));

/**
 * The directory a trailing `/**` descends from.
 *
 * @param body - A normalized pattern body.
 * @returns The base directory, or `""` when the body has no such suffix or no base.
 */
const globstarBaseOf = (body: string): string => (Str.endsWith("/**")(body) ? Str.slice(0, -3)(body) : "");

/**
 * One declared pattern as the enumerators match it.
 *
 * **Details**
 *
 * The `!` of an exclusion is kept and the body after it is normalized. A
 * `X/**` body is followed by `X`, so the base directory is selected (or
 * excluded) too. A body that normalizes to nothing keeps the declared text.
 *
 * @param pattern - One declared workspace pattern, `!` included.
 * @returns The one or two patterns the enumerators match in its place.
 */
const forMatchingOne = (pattern: string): ReadonlyArray<string> => {
  const negation = Str.startsWith("!")(pattern) ? "!" : "";
  const body = normalizedBody(Str.slice(negation.length)(pattern));
  if (Str.isEmpty(body)) return [pattern];
  const base = globstarBaseOf(body);
  return Str.isEmpty(base) ? [`${negation}${body}`] : [`${negation}${body}`, `${negation}${base}`];
};

// Reads `path` and fails with a typed `read` failure instead of the platform error.
const readConfigText = Effect.fnUntraced(function* (path: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs
    .readFileString(path)
    .pipe(Effect.mapError((cause) => WorkspacePatternReadError.make({ path, kind: "read", cause })));
});

/**
 * The workspace pattern reader: the `packages:` list a package manager would
 * read for a root, plus the pure projections over each configuration document.
 *
 * **Details**
 *
 * `read` needs `FileSystem` and `Path`; the projections are total on any value.
 * A `workspaces` field or `packages:` list that is not a string array reads as
 * the string entries it does carry (none, for a non-array), the way
 * `WorkspaceDiscovery` has always read it: the manager-facing shape question
 * belongs to a manifest decoder, not to the pattern list.
 *
 * **Example** (Project the two manifest shapes)
 *
 * ```ts
 * import { WorkspacePatterns } from "@beep/repo-workspaces/WorkspacePatterns";
 *
 * console.log(WorkspacePatterns.fromManifest({ workspaces: ["packages/*"] }).join(",")); // packages/*
 * console.log(WorkspacePatterns.fromManifest({ workspaces: { packages: ["apps/*"] } }).join(",")); // apps/*
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export class WorkspacePatterns {
  /**
   * The string entries of `value` when it is an array, else none.
   *
   * **Example** (Filter a mixed pattern array)
   *
   * ```ts
   * import { WorkspacePatterns } from "@beep/repo-workspaces/WorkspacePatterns";
   * import * as O from "effect/Option";
   *
   * console.log(O.getOrElse(WorkspacePatterns.stringsOf(["packages/*", 42]), () => []).join(",")); // packages/*
   * console.log(O.isNone(WorkspacePatterns.stringsOf({ packages: [] }))); // true
   * ```
   *
   * @param value - Any parsed configuration value.
   * @returns The string entries of an array, or none for anything else.
   * @category filtering
   * @since 0.0.0
   */
  static readonly stringsOf = stringsOf;

  /**
   * Extracts the `packages:` list of a parsed `pnpm-workspace.yaml` document.
   *
   * **Example** (Read patterns from a parsed pnpm document)
   *
   * ```ts
   * import { WorkspacePatterns } from "@beep/repo-workspaces/WorkspacePatterns";
   *
   * console.log(WorkspacePatterns.fromPnpmWorkspace({ packages: ["packages/*", 42] }).join(",")); // packages/*
   * console.log(WorkspacePatterns.fromPnpmWorkspace(null).length); // 0
   * ```
   *
   * @param document - The parsed YAML document.
   * @returns The string entries of its `packages:` list, empty when there is none.
   * @category parsing
   * @since 0.0.0
   */
  static readonly fromPnpmWorkspace = (document: unknown): ReadonlyArray<string> => {
    if (!P.isObjectOrArray(document)) return [];
    return stringsOrEmpty("packages" in document ? document.packages : undefined);
  };

  /**
   * Extracts the `workspaces` field of a parsed root `package.json`, in either supported shape.
   *
   * **Example** (Read both manifest workspace shapes)
   *
   * ```ts
   * import { WorkspacePatterns } from "@beep/repo-workspaces/WorkspacePatterns";
   *
   * console.log(WorkspacePatterns.fromManifest({ workspaces: ["packages/*"] }).join(",")); // packages/*
   * console.log(WorkspacePatterns.fromManifest({ workspaces: { packages: ["apps/*"] } }).join(",")); // apps/*
   * console.log(WorkspacePatterns.fromManifest({ workspaces: { catalog: {} } }).length); // 0
   * ```
   *
   * @param manifest - The parsed manifest.
   * @returns The declared patterns, empty when the field is absent or carries no string entries.
   * @category parsing
   * @since 0.0.0
   */
  static readonly fromManifest = (manifest: unknown): ReadonlyArray<string> => {
    if (!P.isObjectOrArray(manifest)) return [];
    const workspaces = "workspaces" in manifest ? manifest.workspaces : undefined;
    return O.getOrElse(stringsOf(workspaces), () =>
      P.isObjectKeyword(workspaces) && !P.isFunction(workspaces) && "packages" in workspaces
        ? stringsOrEmpty(workspaces.packages)
        : []
    );
  };

  /**
   * The patterns as the enumerators match them: each without its leading
   * `./` segments and trailing slashes, and each trailing `/**` followed by
   * its base directory.
   *
   * **Details**
   *
   * A package manager appends `/package.json` to each pattern and globs that,
   * so `packages/*` followed by a slash reads as `packages/*`, `./packages/core`
   * as `packages/core`, and `packages/core/**` also selects
   * `packages/core/package.json` (the `**` matches zero directories). A
   * directory matcher does none of that, so the compiled declared text would
   * miss members, report slashed paths, and let `!./packages/core` exclude
   * nothing. An exclusion is normalized after its `!`, and `!X/**` is
   * followed by `!X`. Every kit reader compiles this form;
   * {@link WorkspacePatterns.read} and the projections still return the
   * declared text verbatim. A pattern that normalizes to nothing (only
   * slashes, or `./`) keeps its declared text, so it is still matched (or
   * refused) as written.
   *
   * **Example** (Normalize declared patterns for matching)
   *
   * ```ts
   * import { WorkspacePatterns } from "@beep/repo-workspaces/WorkspacePatterns";
   *
   * console.log(WorkspacePatterns.forMatching(["packages/core/", "!./packages/legacy//", "tools/cli"]).join(","));
   * // packages/core,!packages/legacy,tools/cli
   * console.log(WorkspacePatterns.forMatching(["./apps/**"]).join(","));
   * // apps/**,apps
   * ```
   *
   * @param patterns - The declared patterns.
   * @returns The normalized patterns in declaration order, a `/**` pattern followed by its base.
   * @category parsing
   * @since 0.0.0
   */
  static readonly forMatching = (patterns: ReadonlyArray<string>): ReadonlyArray<string> =>
    A.flatMap(patterns, forMatchingOne);

  /**
   * Reads the workspace `packages:` patterns for `root`, preferring `pnpm-workspace.yaml` over the root `package.json` `workspaces` field.
   *
   * **Details**
   *
   * An absent config is a standalone package, not an error: it yields an empty list.
   * When the pnpm document yields no patterns, the reader falls back to the manifest.
   *
   * **Gotchas**
   *
   * An existing configuration that cannot be read or parsed fails with its path and
   * failure kind rather than silently yielding an empty list. `FileSystem` and `Path`
   * are required to execute the reader.
   *
   * **Example** (Construct a workspace pattern read)
   *
   * ```ts
   * import { WorkspacePatterns } from "@beep/repo-workspaces/WorkspacePatterns";
   * import * as Effect from "effect/Effect";
   *
   * const program = WorkspacePatterns.read("/repo");
   * console.log(Effect.isEffect(program)); // true
   * ```
   *
   * @param root - The workspace root directory.
   * @returns The declared patterns, verbatim and in declaration order.
   * @category parsing
   * @since 0.0.0
   */
  static readonly read = Effect.fn("WorkspacePatterns.read")(function* (
    root: string
  ): Effect.fn.Return<ReadonlyArray<string>, WorkspacePatternReadError, FileSystem.FileSystem | Path.Path> {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    // A config file that EXISTS but cannot be read is not a config file that
    // declares no patterns. Substituting "" / "{}" made those two outcomes
    // literally identical, so the failure was invisible by construction — the
    // same silent-degradation family as absorbing a `readDirectory` error into
    // an empty directory listing. An ABSENT file is still fine: that is a real,
    // distinguishable condition meaning "no config here".
    const pnpmWorkspacePath = path.join(root, "pnpm-workspace.yaml");
    const hasPnpmWorkspace = yield* fs.exists(pnpmWorkspacePath).pipe(Effect.orElseSucceed(() => false));
    if (hasPnpmWorkspace) {
      const content = yield* readConfigText(pnpmWorkspacePath);
      const document = yield* Yaml.parse(content).pipe(
        Effect.mapError((cause) =>
          WorkspacePatternReadError.make({ path: pnpmWorkspacePath, kind: "invalidYaml", cause })
        )
      );
      const patterns = WorkspacePatterns.fromPnpmWorkspace(document);
      if (patterns.length > 0) return patterns;
    }

    const manifestPath = path.join(root, "package.json");
    const hasManifest = yield* fs.exists(manifestPath).pipe(Effect.orElseSucceed(() => false));
    if (!hasManifest) return [];

    const content = yield* readConfigText(manifestPath);
    const manifest = yield* S.decodeEffect(JsonValue)(content).pipe(
      Effect.mapError((cause) => WorkspacePatternReadError.make({ path: manifestPath, kind: "invalidJson", cause }))
    );
    return WorkspacePatterns.fromManifest(manifest);
  });
}
