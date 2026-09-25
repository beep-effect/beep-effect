/**
 * Paths, path-shaped constants, and the file/text access every `beep models`
 * service shares.
 *
 * **Details**
 *
 * The group's three service modules each resolve an operator-written path and
 * read a file off disk; keeping that in one place is what lets `home` stay a
 * parameter everywhere instead of an `os.homedir()` call at a call site.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { A, O, pipe, Str } from "@beep/utils";
import { Match } from "effect";
import * as S from "effect/Schema";
import { TargetRoot } from "./Models.manifest.schemas.ts";

const $I = $RepoCliId.create("commands/Models/Models.paths");

// ── Constants ───────────────────────────────────────────────────────────────

/**
 * Where the upstream model manifest is published, primary then mirror.
 *
 * **Example** (Read the primary catalog URL)
 *
 * ```ts
 * import { upstreamCatalogUrls } from "@beep/repo-cli/commands/Models"
 *
 * console.log(upstreamCatalogUrls[0]) // "https://models.router-for.me/models.json"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const upstreamCatalogUrls: A.NonEmptyReadonlyArray<string> = [
  "https://models.router-for.me/models.json",
  "https://raw.githubusercontent.com/router-for-me/models/main/models.json",
];

/**
 * The local proxy base URL a `check` run consults for admitted credentials.
 *
 * **Example** (Read the default proxy base URL)
 *
 * ```ts
 * import { defaultProxyBaseUrl } from "@beep/repo-cli/commands/Models"
 *
 * console.log(defaultProxyBaseUrl) // "http://127.0.0.1:8317"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const defaultProxyBaseUrl = "http://127.0.0.1:8317";

/**
 * Manifest path, relative to the operator home, that `init` seeds.
 *
 * **Example** (Build the default manifest path)
 *
 * ```ts
 * import { defaultManifestRelativePath } from "@beep/repo-cli/commands/Models"
 *
 * console.log(defaultManifestRelativePath) // ".config/beep/models.yaml"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const defaultManifestRelativePath = ".config/beep/models.yaml";

// ── Shared helpers ──────────────────────────────────────────────────────────

/**
 * Decode JSON text into an untyped value, or `None` when it does not parse.
 *
 * **Details**
 *
 * Both the catalog overlays and the `json-key` locator reader have to treat a
 * malformed file as "no value" rather than as a failure, so the one permissive
 * JSON entry point lives here instead of being spelled twice.
 *
 * **Example** (Parse and reject)
 *
 * ```ts
 * import { parseJsonText } from "@beep/repo-cli/commands/Models"
 * import * as O from "effect/Option"
 *
 * console.log(O.isSome(parseJsonText('{"a":1}'))) // true
 * console.log(O.isNone(parseJsonText("not json"))) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const parseJsonText: (input: unknown) => O.Option<unknown> = S.decodeUnknownOption(UnknownFromJsonString);

/**
 * Where a projection target's path resolves on this box.
 *
 * **Example** (Name one target location)
 *
 * ```ts
 * import { ModelsTargetLocation } from "@beep/repo-cli/commands/Models"
 *
 * const location = ModelsTargetLocation.make({
 *   root: "home",
 *   path: "$HOME/.zshrc",
 *   home: "/home/op",
 *   repo: "/repo"
 * })
 * console.log(location.root) // "home"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ModelsTargetLocation extends S.Class<ModelsTargetLocation>($I`ModelsTargetLocation`)(
  {
    root: TargetRoot,
    path: S.NonEmptyString,
    home: S.NonEmptyString,
    repo: S.NonEmptyString,
  },
  $I.annote("ModelsTargetLocation", {
    description: "A projection target's root, its manifest-written path, and both trees it resolves against.",
  })
) {}

// A manifest is operator-written text, so a path in it can point anywhere —
// including out of the tree it names. Containment is decided on normalized
// segments rather than on the joined string so `a/../../b` and `a/./b` are
// judged by where they land, not by how they are spelled.
const pathSegments = (path: string): ReadonlyArray<string> =>
  A.filter(Str.split(path, "/"), (segment) => !Str.isEmpty(segment) && segment !== ".");

const normalizeSegments = (segments: ReadonlyArray<string>): O.Option<ReadonlyArray<string>> =>
  A.reduce(segments, O.some<ReadonlyArray<string>>([]), (resolved, segment) =>
    O.flatMap(resolved, (kept) =>
      segment === ".."
        ? A.matchRight(kept, {
            onEmpty: O.none<ReadonlyArray<string>>,
            onNonEmpty: O.some<ReadonlyArray<string>>,
          })
        : O.some(A.append(kept, segment))
    )
  );

const absolutePathOf = (segments: ReadonlyArray<string>): string => `/${A.join(segments, "/")}`;

const resolveWithin = (root: string, relative: string): O.Option<string> => {
  const rootPath = absolutePathOf(pathSegments(root));
  return pipe(
    normalizeSegments(A.appendAll(pathSegments(root), pathSegments(relative))),
    O.map(absolutePathOf),
    O.filter((resolved) => resolved === rootPath || pipe(resolved, Str.startsWith(`${rootPath}/`)))
  );
};

/**
 * Resolve a manifest-written path against the repo checkout or the operator
 * home, or `None` when it escapes that root.
 *
 * **Details**
 *
 * `home` is a parameter, never `os.homedir()` at a call site, which is exactly
 * why a manifest spells a home path `$HOME/…`: the literal prefix is replaced
 * with whatever home the caller passed.
 *
 * The joined path is normalized and then required to stay under the root it
 * names, so a manifest cannot reach `/etc/passwd` by spelling
 * `$HOME/../../etc/passwd`.
 *
 * **Gotchas**
 *
 * A `repo` path is relative to the checkout and nothing else: an absolute one
 * is rejected outright rather than silently read from wherever it points. An
 * escaping path is `None`, and `ModelsCheck` turns that into a `missing-file`
 * finding for every locator on the target — including an `optional` one,
 * because an unreachable root is a manifest defect rather than an absent file.
 *
 * **Example** (Resolve both roots, reject an escape)
 *
 * ```ts
 * import { ModelsTargetLocation, resolveTargetPath } from "@beep/repo-cli/commands/Models"
 * import * as O from "effect/Option"
 *
 * const at = (root: "home" | "repo", path: string) =>
 *   ModelsTargetLocation.make({ root, path, home: "/home/op", repo: "/repo" })
 *
 * console.log(O.getOrNull(resolveTargetPath(at("home", "$HOME/.zshrc")))) // "/home/op/.zshrc"
 * console.log(O.getOrNull(resolveTargetPath(at("repo", "AGENTS.md")))) // "/repo/AGENTS.md"
 * console.log(O.isNone(resolveTargetPath(at("home", "$HOME/../etc/passwd")))) // true
 * ```
 *
 * @param location - The target root, its manifest-written path, and both trees.
 * @returns The absolute path on this box, or `None` when it leaves its root.
 * @category utilities
 * @since 0.0.0
 */
export const resolveTargetPath = (location: ModelsTargetLocation): O.Option<string> =>
  Match.value(location.root).pipe(
    Match.when("home", () =>
      resolveWithin(
        location.home,
        Str.startsWith("$HOME/")(location.path) ? Str.slice(6)(location.path) : location.path
      )
    ),
    Match.when("repo", () =>
      Str.startsWith("/")(location.path) ? O.none<string>() : resolveWithin(location.repo, location.path)
    ),
    Match.exhaustive
  );

/**
 * A target file plus the resolved path it was read from.
 *
 * **Example** (Hand one file to a reader)
 *
 * ```ts
 * import { ModelsTargetFile } from "@beep/repo-cli/commands/Models"
 *
 * const file = ModelsTargetFile.make({
 *   root: "repo",
 *   absolutePath: "/repo/AGENTS.md",
 *   content: "# Agent Guide\n"
 * })
 * console.log(file.root) // "repo"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ModelsTargetFile extends S.Class<ModelsTargetFile>($I`ModelsTargetFile`)(
  {
    root: TargetRoot,
    absolutePath: S.NonEmptyString,
    content: S.String,
  },
  $I.annote("ModelsTargetFile", {
    description: "One projection target's resolved path and text, as a locator reader sees it.",
  })
) {}
