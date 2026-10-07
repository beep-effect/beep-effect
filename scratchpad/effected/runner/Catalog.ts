/**
 * The module inventory of the port (goal section 4): waves, kit dependencies,
 * expected third-party dependencies, and provisional beep homes.
 *
 * **Details**
 *
 * Subpath entries and dependency specifiers are read from the upstream
 * `package.json` at copy time; this table is the allowlist the runner checks
 * those readings against, so an unexpected upstream dependency fails loudly
 * instead of slipping into `scratchpad/package.json`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { MODULE_NAMES, ModuleName, ProvisionalHome } from "./Ledger.schema.ts";

const $I = $ScratchpadId.create("effected/runner/Catalog");

/**
 * One row of the section-4 inventory.
 *
 * **Example** (Describe a module)
 *
 * ```ts
 * import { CatalogEntry } from "@beep/scratchpad/effected/runner/Catalog"
 *
 * const entry = CatalogEntry.make({
 *   module: "glob",
 *   wave: 1,
 *   position: 4,
 *   kitDeps: [],
 *   runtimeDeps: [],
 *   oracleDeps: ["minimatch"],
 *   provisionalHome: "foundation/modeling",
 * })
 * console.log(entry.wave) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CatalogEntry extends S.Class<CatalogEntry>($I`CatalogEntry`)(
  {
    module: ModuleName,
    wave: S.Int,
    position: S.Int,
    kitDeps: S.Array(ModuleName),
    runtimeDeps: S.Array(S.String),
    oracleDeps: S.Array(S.String),
    provisionalHome: ProvisionalHome,
  },
  $I.annote("CatalogEntry", { description: "Wave, dependencies and provisional home of one module." })
) {}

const entry = (
  module: ModuleName,
  wave: number,
  position: number,
  provisionalHome: ProvisionalHome,
  options: {
    readonly kitDeps?: ReadonlyArray<ModuleName>;
    readonly runtimeDeps?: ReadonlyArray<string>;
    readonly oracleDeps?: ReadonlyArray<string>;
  } = {}
): CatalogEntry =>
  CatalogEntry.make({
    module,
    wave,
    position,
    kitDeps: options.kitDeps ?? [],
    runtimeDeps: options.runtimeDeps ?? [],
    oracleDeps: options.oracleDeps ?? [],
    provisionalHome,
  });

/**
 * The section-4 inventory in ledger order.
 *
 * **Example** (Read the first wave-1 module)
 *
 * ```ts
 * import { MODULE_CATALOG } from "@beep/scratchpad/effected/runner/Catalog"
 *
 * console.log(MODULE_CATALOG[2]?.module) // "memfs"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MODULE_CATALOG: ReadonlyArray<CatalogEntry> = [
  entry("jsonl", 0, 1, "foundation/modeling"),
  entry("jsonc", 0, 2, "foundation/modeling"),
  entry("memfs", 1, 1, "tooling/test-kit"),
  entry("yaml", 1, 2, "foundation/modeling", { oracleDeps: ["yaml"] }),
  entry("toml", 1, 3, "foundation/modeling", { oracleDeps: ["smol-toml"] }),
  entry("glob", 1, 4, "foundation/modeling", { oracleDeps: ["minimatch"] }),
  entry("semver", 1, 5, "foundation/modeling"),
  entry("spdx", 1, 6, "foundation/modeling", {
    oracleDeps: ["spdx-exceptions", "spdx-expression-parse", "spdx-license-ids", "oxc-parser"],
  }),
  entry("schema-org", 1, 7, "foundation/modeling", { oracleDeps: ["oxc-parser"] }),
  entry("github-references", 1, 8, "foundation/modeling"),
  entry("github-commands", 1, 9, "foundation/modeling"),
  entry("commands", 1, 10, "drivers"),
  entry("templates", 1, 11, "tooling/library"),
  entry("env", 1, 12, "tooling/library"),
  entry("engine", 1, 13, "tooling/library"),
  entry("git", 1, 14, "drivers"),
  entry("walker", 2, 1, "tooling/library", { kitDeps: ["glob"] }),
  entry("npm", 2, 2, "drivers", { kitDeps: ["commands", "semver"] }),
  entry("markdown", 2, 3, "foundation/modeling", { kitDeps: ["jsonc", "toml", "yaml"], oracleDeps: ["commonmark"] }),
  entry("github", 2, 4, "drivers", {
    kitDeps: ["github-references", "semver"],
    runtimeDeps: [
      "@octokit/core",
      "@octokit/plugin-paginate-rest",
      "@octokit/types",
      "blakejs",
      "tweetnacl",
      "universal-github-app-jwt",
    ],
  }),
  entry("lockfiles", 3, 1, "foundation/modeling", { kitDeps: ["jsonc", "npm", "semver", "yaml"] }),
  entry("tsconfig-json", 3, 2, "foundation/modeling", { kitDeps: ["glob", "jsonc", "walker"] }),
  entry("config-file", 3, 3, "tooling/library", { kitDeps: ["glob", "jsonc", "toml", "walker", "yaml"] }),
  entry("package-json", 3, 4, "foundation/modeling", { kitDeps: ["jsonc", "npm", "semver", "spdx"] }),
  entry("xdg", 4, 1, "tooling/library", { kitDeps: ["config-file", "glob", "jsonc", "toml", "walker", "yaml"] }),
  entry("sbom", 4, 2, "drivers", { kitDeps: ["package-json", "spdx"], runtimeDeps: ["@sigstore/bundle", "@sigstore/sign"] }),
  entry("workspaces", 4, 3, "tooling/library", {
    kitDeps: ["commands", "git", "glob", "jsonc", "lockfiles", "npm", "package-json", "semver", "walker", "yaml"],
    runtimeDeps: [
      "@pnpm/catalogs.config",
      "@pnpm/catalogs.protocol-parser",
      "@pnpm/catalogs.resolver",
      "@pnpm/catalogs.types",
    ],
  }),
  entry("cli", 4, 4, "tooling/library", {
    kitDeps: ["github-commands", "config-file", "env", "glob", "walker"],
    runtimeDeps: ["ink", "react"],
    oracleDeps: ["string-width"],
  }),
  entry("github-actions", 5, 1, "drivers", {
    kitDeps: ["github", "github-commands", "glob", "markdown", "npm", "sbom", "semver", "templates", "walker"],
    runtimeDeps: ["@azure/storage-blob"],
  }),
];

/**
 * The inventory row for a module.
 *
 * **Example** (Look up a module)
 *
 * ```ts
 * import { catalogEntry } from "@beep/scratchpad/effected/runner/Catalog"
 * import * as O from "effect/Option"
 *
 * console.log(O.map(catalogEntry("yaml"), (e) => e.provisionalHome)) // some("foundation/modeling")
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const catalogEntry = (module: ModuleName): O.Option<CatalogEntry> =>
  A.findFirst(MODULE_CATALOG, (candidate) => candidate.module === module);

/**
 * Upstream dependency names the port never carries: build tooling, the Effect
 * peers, and the test runner, all of which the lab already supplies.
 *
 * **Example** (Check an ignored dependency)
 *
 * ```ts
 * import { isIgnoredUpstreamDep } from "@beep/scratchpad/effected/runner/Catalog"
 *
 * console.log(isIgnoredUpstreamDep("typescript")) // true
 * console.log(isIgnoredUpstreamDep("minimatch")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isIgnoredUpstreamDep = (name: string): boolean =>
  name === "effect" ||
  name === "typescript" ||
  name === "vitest" ||
  name === "@savvy-web/bundler" ||
  name === "@types/node" ||
  name === "@types/react" ||
  name.startsWith("@effect/") ||
  name.startsWith("@vitest/");

/**
 * The ledger row id for a module, `w<wave>-<module>`.
 *
 * **Example** (Derive a row id)
 *
 * ```ts
 * import { rowId } from "@beep/scratchpad/effected/runner/Catalog"
 *
 * console.log(rowId(1, "yaml")) // "w1-yaml"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const rowId = (wave: number, module: ModuleName): string => `w${wave}-${module}`;

/**
 * Every module name the inventory covers, in ledger order; equal to
 * `MODULE_NAMES` by construction and checked by the runner's tests.
 *
 * **Example** (Compare the orders)
 *
 * ```ts
 * import { CATALOG_ORDER } from "@beep/scratchpad/effected/runner/Catalog"
 * import { MODULE_NAMES } from "@beep/scratchpad/effected/runner/Ledger.schema"
 *
 * console.log(CATALOG_ORDER.length === MODULE_NAMES.length) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CATALOG_ORDER: ReadonlyArray<ModuleName> = A.map(MODULE_CATALOG, (candidate) => candidate.module);

/**
 * Whether the inventory lists every module exactly once in `MODULE_NAMES` order.
 *
 * **Example** (Assert inventory integrity)
 *
 * ```ts
 * import { catalogMatchesRoster } from "@beep/scratchpad/effected/runner/Catalog"
 *
 * console.log(catalogMatchesRoster()) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const catalogMatchesRoster = (): boolean =>
  CATALOG_ORDER.length === MODULE_NAMES.length && A.every(A.zip(CATALOG_ORDER, MODULE_NAMES), ([a, b]) => a === b);
