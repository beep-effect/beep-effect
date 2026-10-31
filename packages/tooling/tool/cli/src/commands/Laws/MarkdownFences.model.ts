/**
 * Schemas for the Markdown TypeScript fence typecheck law.
 *
 * **Details**
 *
 * A {@link TypecheckFence} is one TypeScript fence of a guidance Markdown file.
 * The law typechecks every `checked` fence against the workspace's real
 * packages and records one {@link MarkdownFenceVerdict} per fence. A fence
 * whose info string carries docgen's `skip-type-checking` token is a reviewed
 * opt-out; a fence inside a docgen-generated API reference region is proven by
 * docgen's own example typecheck and is not compiled again.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { ArrayKeyDefaultEmpty } from "@beep/schema/SchemaUtils/withKeyDefaults";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Laws/MarkdownFences.model");

/**
 * TypeScript language word that opens a typechecked fence.
 *
 * **Example** (Recognize a tsx fence)
 *
 * ```ts
 * import { MarkdownFenceLanguage } from "@beep/repo-cli/commands/Laws/MarkdownFences.model"
 *
 * console.log(MarkdownFenceLanguage.is.tsx("tsx")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MarkdownFenceLanguage = LiteralKit(["ts", "tsx", "typescript", "mts", "cts"]).pipe(
  $I.annoteSchema("MarkdownFenceLanguage", {
    description: "TypeScript language word that opens a typechecked Markdown fence.",
  })
);

/**
 * Type-level member of {@link MarkdownFenceLanguage}.
 *
 * @category models
 * @since 0.0.0
 */
export type MarkdownFenceLanguage = typeof MarkdownFenceLanguage.Type;

/**
 * How the law treats one fence.
 *
 * **Details**
 *
 * `checked` fences are compiled. `opt-out` fences carry the
 * `skip-type-checking` info-string token and are reviewed exceptions.
 * `generated` fences sit inside a `docgen:api-reference` region that docgen
 * renders from source JSDoc it already typechecks.
 *
 * **Example** (Recognize an opt-out)
 *
 * ```ts
 * import { MarkdownFenceDisposition } from "@beep/repo-cli/commands/Laws/MarkdownFences.model"
 *
 * console.log(MarkdownFenceDisposition.is["opt-out"]("opt-out")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MarkdownFenceDisposition = LiteralKit(["checked", "opt-out", "generated"]).pipe(
  $I.annoteSchema("MarkdownFenceDisposition", {
    description: "Whether a Markdown TypeScript fence is compiled, opted out, or docgen-generated.",
  })
);

/**
 * Type-level member of {@link MarkdownFenceDisposition}.
 *
 * @category models
 * @since 0.0.0
 */
export type MarkdownFenceDisposition = typeof MarkdownFenceDisposition.Type;

/**
 * One TypeScript fence of a guidance Markdown file.
 *
 * **Details**
 *
 * `line` is the 1-based line of the opening fence, so body line `n` is
 * Markdown line `line + n`.
 *
 * **Example** (Describe a checked fence)
 *
 * ```ts
 * import { TypecheckFence } from "@beep/repo-cli/commands/Laws/MarkdownFences.model"
 *
 * const fence = TypecheckFence.make({
 *   path: "docs/README.md",
 *   line: 4,
 *   infoString: "ts",
 *   language: "ts",
 *   body: "const value: number = 1",
 *   disposition: "checked",
 * })
 *
 * console.log(fence.disposition) // "checked"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TypecheckFence extends S.Opaque<TypecheckFence, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.String,
    line: S.Int,
    infoString: S.String,
    language: MarkdownFenceLanguage,
    body: S.String,
    disposition: MarkdownFenceDisposition,
  }).pipe(
    $I.annoteSchema("TypecheckFence", {
      description: "One TypeScript fence of a guidance Markdown file with its location and disposition.",
    })
  )
) {}

/**
 * One compiler diagnostic mapped back to its Markdown location.
 *
 * **Example** (Describe a missing-name diagnostic)
 *
 * ```ts
 * import { MarkdownFenceDiagnostic } from "@beep/repo-cli/commands/Laws/MarkdownFences.model"
 *
 * const diagnostic = MarkdownFenceDiagnostic.make({
 *   path: "docs/README.md",
 *   line: 5,
 *   column: 1,
 *   code: "TS2304",
 *   message: "Cannot find name 'Effect'.",
 * })
 *
 * console.log(diagnostic.code) // "TS2304"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MarkdownFenceDiagnostic extends S.Opaque<MarkdownFenceDiagnostic, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.String,
    line: S.Int,
    column: S.Int,
    code: S.String,
    message: S.String,
  }).pipe(
    $I.annoteSchema("MarkdownFenceDiagnostic", {
      description: "One TypeScript compiler diagnostic mapped back to its Markdown file and line.",
    })
  )
) {}

/**
 * Check verdict for one fence.
 *
 * **Details**
 *
 * `passed` and `failed` verdicts belong to `checked` fences; `skipped`
 * verdicts belong to `opt-out` and `generated` fences.
 *
 * **Example** (Build a skipped verdict)
 *
 * ```ts
 * import { TypecheckFence, MarkdownFenceVerdict } from "@beep/repo-cli/commands/Laws/MarkdownFences.model"
 * import * as S from "effect/Schema"
 *
 * const fence = TypecheckFence.make({
 *   path: "docs/README.md",
 *   line: 1,
 *   infoString: "ts skip-type-checking",
 *   language: "ts",
 *   body: "declare const partial: unknown",
 *   disposition: "opt-out",
 * })
 *
 * console.log(S.is(MarkdownFenceVerdict)({ _tag: "skipped", fence })) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MarkdownFenceVerdict = S.TaggedUnion({
  passed: { fence: TypecheckFence },
  failed: { fence: TypecheckFence, diagnostics: S.Array(MarkdownFenceDiagnostic) },
  skipped: { fence: TypecheckFence },
}).pipe(
  $I.annoteSchema("MarkdownFenceVerdict", {
    description: "Passed, failed, or skipped check verdict for one Markdown TypeScript fence.",
  })
);

/**
 * Type-level member of {@link MarkdownFenceVerdict}.
 *
 * @category models
 * @since 0.0.0
 */
export type MarkdownFenceVerdict = typeof MarkdownFenceVerdict.Type;

/**
 * Runner options for the Markdown fence typecheck law.
 *
 * **Details**
 *
 * `pathPrefix` narrows the run to surface files whose repository-relative
 * path starts with it; the empty default checks the whole surface.
 *
 * **Example** (Build strict options)
 *
 * ```ts
 * import { MarkdownFencesOptions } from "@beep/repo-cli/commands/Laws/MarkdownFences.model"
 *
 * console.log(MarkdownFencesOptions.make({ cwd: process.cwd(), strictCheck: true }).strictCheck) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MarkdownFencesOptions extends S.Opaque<MarkdownFencesOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    cwd: S.String,
    strictCheck: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
    pathPrefix: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefaultKey(Effect.succeed(""))
    ),
  }).pipe(
    $I.annoteSchema("MarkdownFencesOptions", {
      description: "Repository location and strictness for the Markdown fence typecheck law.",
    })
  )
) {}

/**
 * Result of one Markdown fence typecheck run.
 *
 * **Details**
 *
 * `fences` counts every TypeScript fence on the guidance surface; it equals
 * `checkedFences + optOutFences + generatedFences`. `failures` holds the
 * failed verdicts in path and line order. `unreadable` holds one
 * `markdown-parse` diagnostic per file the CommonMark parser refused (its
 * fences could not be read); a strict run fails on either.
 *
 * **Example** (Read an empty summary)
 *
 * ```ts
 * import { MarkdownFencesSummary } from "@beep/repo-cli/commands/Laws/MarkdownFences.model"
 *
 * const summary = MarkdownFencesSummary.make({
 *   scannedFiles: 0,
 *   fenceFiles: 0,
 *   fences: 0,
 *   checkedFences: 0,
 *   optOutFences: 0,
 *   generatedFences: 0,
 *   strictFailure: false,
 * })
 *
 * console.log(summary.failures.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MarkdownFencesSummary extends S.Opaque<MarkdownFencesSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    scannedFiles: S.Natural,
    fenceFiles: S.Natural,
    fences: S.Natural,
    checkedFences: S.Natural,
    optOutFences: S.Natural,
    generatedFences: S.Natural,
    failures: ArrayKeyDefaultEmpty(MarkdownFenceVerdict.cases.failed),
    unreadable: ArrayKeyDefaultEmpty(MarkdownFenceDiagnostic),
    strictFailure: S.Boolean,
  }).pipe(
    $I.annoteSchema("MarkdownFencesSummary", {
      description:
        "Fence counts by disposition, the failed verdicts and the files the parser refused (one markdown-parse diagnostic each) of one Markdown fence typecheck run.",
    })
  )
) {}
