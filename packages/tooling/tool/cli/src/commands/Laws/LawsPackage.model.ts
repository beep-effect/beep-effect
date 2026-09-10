/**
 * Package-local law scan inputs and reports.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Laws/LawsPackage.model");
/**
 * Law identities in execution order.
 *
 * **Example** (List package laws)
 * ```ts
 * import { LawsPackageLaw } from "@beep/repo-cli/commands/Laws/LawsPackage.model"
 * console.log(LawsPackageLaw.Options)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LawsPackageLaw = LiteralKit([
  "terse-effect",
  "native-runtime",
  "frozen-grant-set",
  "effect-fn",
  "package-test-imports",
]).annotate($I.annote("LawsPackageLaw", { description: "Laws evaluated by the package worker." }));
/** Law identity decoded from the literal domain.
 * @category type-level
 * @since 0.0.0
 */
export type LawsPackageLaw = typeof LawsPackageLaw.Type;
/**
 * Explicit package boundary and the tsconfig overlay used for scanning.
 *
 * **Example** (Select a package overlay)
 * ```ts
 * import { LawsPackageScope, LawsPackageLaw } from "@beep/repo-cli/commands/Laws/LawsPackage.model"
 * console.log(LawsPackageScope.make({ packageDir: "packages/demo", repoRoot: "/repo", overlayPath: "packages/demo/tsconfig.test.json", laws: LawsPackageLaw.Options }).packageDir)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LawsPackageScope extends S.Class<LawsPackageScope>($I`LawsPackageScope`)(
  {
    packageDir: S.NonEmptyString,
    repoRoot: S.NonEmptyString,
    overlayPath: S.NonEmptyString,
    laws: S.Array(LawsPackageLaw),
  },
  $I.annote("LawsPackageScope", {
    description: "Repository-relative package and overlay with an explicit law inventory.",
  })
) {}
/**
 * Counts and diagnostic text for one law, with its advisory and failure policy.
 *
 * **Example** (Represent an advisory result)
 * ```ts
 * import { LawsPackageFinding } from "@beep/repo-cli/commands/Laws/LawsPackage.model"
 * console.log(LawsPackageFinding.make({ law: "terse-effect", findingCount: 0, advisory: true, strictFailure: false, diagnostics: [] }).advisory)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LawsPackageFinding extends S.Class<LawsPackageFinding>($I`LawsPackageFinding`)(
  {
    law: LawsPackageLaw,
    findingCount: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    advisory: S.Boolean,
    strictFailure: S.Boolean,
    diagnostics: S.Array(S.String),
  },
  $I.annote("LawsPackageFinding", { description: "Per-law counts, diagnostics and check policy." })
) {}
/**
 * Results from one package project, including its actual source-file count.
 *
 * **Example** (Represent an empty project)
 * ```ts
 * import { LawsPackageReport } from "@beep/repo-cli/commands/Laws/LawsPackage.model"
 * console.log(LawsPackageReport.make({ projectSourceFileCount: 0, findings: [] }).findings)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LawsPackageReport extends S.Class<LawsPackageReport>($I`LawsPackageReport`)(
  { projectSourceFileCount: S.Int.check(S.isGreaterThanOrEqualTo(0)), findings: S.Array(LawsPackageFinding) },
  $I.annote("LawsPackageReport", { description: "Package project size and per-law findings." })
) {}
