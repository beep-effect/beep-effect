/**
 * Schemas and data for the tracked shell allowlist law.
 *
 * **Details**
 *
 * Shell is allowed only where no repo toolchain exists yet (the agent hook
 * directories and the cloud bootstrap) and in the reviewed exceptions of the
 * `goals/scripts-to-beep-cli` Exception Ledger (decision
 * 2026-11-07-tracked-shell-allowlist-scope). The allowlist is three exact
 * literal domains, roots, files and transitional files, with no glob patterns.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { ArrayKeyDefaultEmpty } from "@beep/schema/SchemaUtils/withKeyDefaults";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Laws/TrackedShellAllowlist.model");

/**
 * Repository roots whose tracked `.sh` files the law allows.
 *
 * **Details**
 *
 * Each root is a repository-relative directory prefix ending in `/`. The hook
 * directories run inside the agent harness before any toolchain; `goals/` and
 * `explorations/` hold packet evidence; `infra/` stays until
 * `infra-alchemy-rebuild` retires it.
 *
 * **Example** (Check an allowed root)
 *
 * ```ts
 * import { TrackedShellAllowedRoot } from "@beep/repo-cli/commands/Laws/TrackedShellAllowlist.model"
 *
 * console.log(TrackedShellAllowedRoot.is[".claude/"](".claude/")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TrackedShellAllowedRoot = LiteralKit([
  ".claude/",
  ".codex/",
  ".cursor/",
  "goals/",
  "explorations/",
  "infra/",
]).pipe(
  $I.annoteSchema("TrackedShellAllowedRoot", {
    description: "Repository-relative directory prefix whose tracked shell scripts the law allows.",
  })
);

/**
 * Type-level member of {@link TrackedShellAllowedRoot}.
 *
 * @category models
 * @since 0.0.0
 */
export type TrackedShellAllowedRoot = typeof TrackedShellAllowedRoot.Type;

/**
 * Exact tracked `.sh` files the law allows outside the allowed roots.
 *
 * **Details**
 *
 * `scripts/cloud/bootstrap.sh` installs the toolchain the compiled CI binary
 * needs; the two fixtures are test inputs of `@beep/repo-cli` and
 * `@beep/docgen`.
 *
 * **Example** (Check an allowed file)
 *
 * ```ts
 * import { TrackedShellAllowedFile } from "@beep/repo-cli/commands/Laws/TrackedShellAllowlist.model"
 *
 * console.log(TrackedShellAllowedFile.is["scripts/cloud/bootstrap.sh"]("scripts/cloud/bootstrap.sh")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TrackedShellAllowedFile = LiteralKit([
  "scripts/cloud/bootstrap.sh",
  "packages/tooling/tool/cli/test/fixtures/models/locators.sh",
  "packages/tooling/tool/docgen/test/fixtures/section-example/tsc-wrapper.sh",
]).pipe(
  $I.annoteSchema("TrackedShellAllowedFile", {
    description: "Exact repository-relative shell script the law allows outside the allowed roots.",
  })
);

/**
 * Type-level member of {@link TrackedShellAllowedFile}.
 *
 * @category models
 * @since 0.0.0
 */
export type TrackedShellAllowedFile = typeof TrackedShellAllowedFile.Type;

/**
 * Removal condition shared by every {@link TrackedShellTransitionalFile}.
 *
 * **Example** (Read the removal condition)
 *
 * ```ts
 * import { trackedShellTransitionalRemovalCondition } from "@beep/repo-cli/commands/Laws/TrackedShellAllowlist.model"
 *
 * console.log(trackedShellTransitionalRemovalCondition)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const trackedShellTransitionalRemovalCondition =
  "deleted by PR 3 after #2906's heavy.yml is heavy.yml@main" as const;

/**
 * Transitional tracked `.sh` files the law allows until their removal condition holds.
 *
 * **Details**
 *
 * `check.yml` calls `heavy.yml@main`, so a pull request's own `heavy.yml`
 * takes effect only after it merges. These exact files are the scripts the
 * pre-binary `heavy.yml@main` still calls; nothing else in the repository runs
 * them. Each entry is removed under
 * {@link trackedShellTransitionalRemovalCondition} (decision
 * 2026-11-07-heavy-at-main-three-prs).
 *
 * **Example** (Check a transitional file)
 *
 * ```ts
 * import { TrackedShellTransitionalFile } from "@beep/repo-cli/commands/Laws/TrackedShellAllowlist.model"
 *
 * console.log(TrackedShellTransitionalFile.is["scripts/ci-change-profile.sh"]("scripts/ci-change-profile.sh")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TrackedShellTransitionalFile = LiteralKit([
  "scripts/ci-cache-native-sandbox.sh",
  "scripts/ci-cache-pilot-cleanup.sh",
  "scripts/ci-cache-pilot-inputs.sh",
  "scripts/ci-change-profile.sh",
  "scripts/ci-prune-apt-sources.sh",
  "scripts/ci-runner-resources.sh",
]).pipe(
  $I.annoteSchema("TrackedShellTransitionalFile", {
    description:
      "Transitional shell script that heavy.yml@main still calls; deleted by PR 3 after #2906's heavy.yml is heavy.yml@main.",
  })
);

/**
 * Type-level member of {@link TrackedShellTransitionalFile}.
 *
 * @category models
 * @since 0.0.0
 */
export type TrackedShellTransitionalFile = typeof TrackedShellTransitionalFile.Type;

/**
 * One tracked shell script outside the allowlist.
 *
 * **Example** (Describe a finding)
 *
 * ```ts
 * import { TrackedShellFinding } from "@beep/repo-cli/commands/Laws/TrackedShellAllowlist.model"
 *
 * const finding = TrackedShellFinding.make({ file: "scripts/release.sh" })
 *
 * console.log(finding.file) // "scripts/release.sh"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TrackedShellFinding extends S.Opaque<TrackedShellFinding, { readonly brand: unique symbol }>()(
  S.Struct({
    file: S.String,
  }).pipe(
    $I.annoteSchema("TrackedShellFinding", {
      description: "One git-tracked shell script outside the tracked shell allowlist.",
    })
  )
) {}

/**
 * Runtime options for the tracked shell allowlist law.
 *
 * **Example** (Configure a strict scan)
 *
 * ```ts
 * import { TrackedShellAllowlistOptions } from "@beep/repo-cli/commands/Laws/TrackedShellAllowlist.model"
 *
 * const options = TrackedShellAllowlistOptions.make({ cwd: process.cwd(), strictCheck: true })
 *
 * console.log(options.strictCheck) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TrackedShellAllowlistOptions extends S.Opaque<
  TrackedShellAllowlistOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    cwd: S.String,
    strictCheck: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
  }).pipe(
    $I.annoteSchema("TrackedShellAllowlistOptions", {
      description: "Runtime options for the tracked shell allowlist law.",
    })
  )
) {}

/**
 * Result of one tracked shell allowlist law run.
 *
 * **Example** (Construct a clean summary)
 *
 * ```ts
 * import { TrackedShellAllowlistSummary } from "@beep/repo-cli/commands/Laws/TrackedShellAllowlist.model"
 *
 * const summary = TrackedShellAllowlistSummary.make({ trackedShellFiles: 3, allowedFiles: 3, strictFailure: false })
 *
 * console.log(summary.findings.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TrackedShellAllowlistSummary extends S.Opaque<
  TrackedShellAllowlistSummary,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    trackedShellFiles: S.Int,
    allowedFiles: S.Int,
    strictFailure: S.Boolean,
    findings: ArrayKeyDefaultEmpty(TrackedShellFinding),
  }).pipe(
    $I.annoteSchema("TrackedShellAllowlistSummary", {
      description: "Result of one tracked shell allowlist law run over the git index.",
    })
  )
) {}
