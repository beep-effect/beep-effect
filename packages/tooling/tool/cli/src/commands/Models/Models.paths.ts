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
import { Str } from "@beep/utils";
import { Match } from "effect";
import * as S from "effect/Schema";
import { TargetRoot } from "./Models.manifest.schemas.ts";
import type { A, O } from "@beep/utils";

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

/**
 * Resolve a manifest-written path against the repo checkout or the operator
 * home.
 *
 * **Details**
 *
 * `home` is a parameter, never `os.homedir()` at a call site, which is exactly
 * why a manifest spells a home path `$HOME/…`: the literal prefix is replaced
 * with whatever home the caller passed.
 *
 * **Example** (Resolve both roots)
 *
 * ```ts
 * import { resolveTargetPath } from "@beep/repo-cli/commands/Models"
 *
 * console.log(resolveTargetPath({ root: "home", path: "$HOME/.zshrc", home: "/home/op", repo: "/repo" }))
 * console.log(resolveTargetPath({ root: "repo", path: "AGENTS.md", home: "/home/op", repo: "/repo" }))
 * ```
 *
 * @param location - The target root, its manifest-written path, and both trees.
 * @returns The absolute path on this box.
 * @category utilities
 * @since 0.0.0
 */
export const resolveTargetPath = (location: ModelsTargetLocation): string =>
  Match.value(location.root).pipe(
    Match.when("home", () =>
      Str.startsWith("$HOME/")(location.path)
        ? `${location.home}/${Str.slice(6)(location.path)}`
        : `${location.home}/${location.path}`
    ),
    Match.when("repo", () =>
      Str.startsWith("/")(location.path) ? location.path : `${location.repo}/${location.path}`
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
