/**
 * The typed failure of catalog *assembly* — reading and validating whatever
 * declares a workspace's catalogs — defined here so the `CatalogResolver`
 * contract can name it in its error channel and every consumer can branch on
 * it without `_tag`-sniffing an untyped defect.
 *
 * **Details**
 *
 * It lives in its own module (rather than beside `CatalogResolver`) for the
 * same reason `DependencyResolutionError` lives in `WorkspaceResolver.ts`:
 * both resolver modules must be able to reference it without creating an
 * import cycle (`noImportCycles` is an error here).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $NpmSpecId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { flow } from "effect/Function";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $NpmSpecId.create("CatalogAssemblyError");

const nonBlankCauseMessage = (cause: unknown): string | undefined => {
  const text = cause instanceof Error ? cause.message : P.isString(cause) ? cause : undefined;
  return text === undefined || Str.trim(text) === "" ? undefined : text;
};

const CatalogAssemblySource = LiteralKit(["manifest", "catalog", "hooks"]).pipe(
  $I.annoteSchema("CatalogAssemblySource", { description: "The inputs that can fail catalog assembly." })
);

const CatalogHooksReason = LiteralKit([
  "notInstalled",
  "ambiguous",
  "fetchFailed",
  "integrityMismatch",
  "integrityUnavailable",
]).pipe(
  $I.annoteSchema("CatalogHooksReason", {
    description:
      "Why a config dependency could not be resolved. `notInstalled`: the declared version is in neither `node_modules/.pnpm-config` nor any pnpm store and the replaying layer does not fetch, typical of the base side of a diff across a config-dependency bump. `ambiguous`: one store holds the declared version more than once and nothing records which copy the declaration pinned. `fetchFailed`: the replaying layer tried to fetch the declared version and the fetch failed, including the package manager's own integrity check rejecting the download. `integrityMismatch`: the inline `configDependencies` integrity and the lockfile's recorded integrity disagree, so nothing was fetched. `integrityUnavailable`: a fetch was needed but the declaring side records no integrity to verify it against (no inline integrity and no readable lockfile entry), so nothing was fetched.",
  })
);

const CatalogAssemblyErrorPayload = S.Struct({
  source: CatalogAssemblySource.pipe(
    $I.annoteKey("CatalogAssemblyErrorPayload.source", {
      description:
        "Which input failed: `manifest` for a file-level or top-level shape problem, `catalog` for a malformed catalog block or the double-default duplication, `hooks` for a config-dependency `pnpmfile.cjs` load or replay failure.",
    })
  ),
  path: S.String.pipe(
    $I.annoteKey("CatalogAssemblyErrorPayload.path", {
      description: "The file, the catalog name, or the config dependency name.",
    })
  ),
  cause: S.Defect({ includeStack: true }).pipe(
    $I.annoteKey("CatalogAssemblyErrorPayload.cause", { description: "The originating failure." })
  ),
  reason: S.optionalKey(CatalogHooksReason).pipe(
    $I.annoteKey("CatalogAssemblyErrorPayload.reason", {
      description:
        "Why a `hooks`-source failure could not resolve a config dependency at its declared version, when that is what failed. Absent for every other failure, including a pnpmfile that resolved but failed to load or replay.",
    })
  ),
}).pipe(
  $I.annoteSchema("CatalogAssemblyErrorPayload", {
    description: "The compatible public catalog assembly error payload.",
  })
);

const CatalogAssemblyFailure = CatalogAssemblySource.mapMembers(
  ([manifest, catalog, hooks]) =>
    [
      S.Struct({
        source: manifest.pipe(
          $I.annoteKey("CatalogManifestFailure.source", {
            description: "A catalog declaration file or its top-level shape failed.",
          })
        ),
        path: CatalogAssemblyErrorPayload.fields.path,
        cause: CatalogAssemblyErrorPayload.fields.cause,
      }).pipe(
        $I.annoteSchema("CatalogManifestFailure", {
          description: "A catalog declaration file or its top-level shape failed.",
        })
      ),
      S.Struct({
        source: catalog.pipe(
          $I.annoteKey("CatalogBlockFailure.source", {
            description: "A catalog block or duplicated default catalog failed.",
          })
        ),
        path: CatalogAssemblyErrorPayload.fields.path,
        cause: CatalogAssemblyErrorPayload.fields.cause,
      }).pipe(
        $I.annoteSchema("CatalogBlockFailure", { description: "A catalog block or duplicated default catalog failed." })
      ),
      S.Struct({
        source: hooks.pipe(
          $I.annoteKey("CatalogHooksFailure.source", {
            description: "A config dependency could not be resolved, loaded, or replayed.",
          })
        ),
        path: CatalogAssemblyErrorPayload.fields.path,
        cause: CatalogAssemblyErrorPayload.fields.cause,
        reason: CatalogAssemblyErrorPayload.fields.reason,
      }).pipe(
        $I.annoteSchema("CatalogHooksFailure", {
          description: "A config dependency could not be resolved, loaded, or replayed.",
        })
      ),
    ] as const
).pipe(
  $I.annoteSchema("CatalogAssemblyFailure", {
    description: "Source-specific catalog assembly failures; only hooks have a resolution reason.",
  }),
  S.toTaggedUnion("source")
);

const CatalogAssemblyFailureFromPayload = CatalogAssemblyErrorPayload.pipe(
  S.toType,
  S.decodeTo(CatalogAssemblyFailure.pipe(S.toType)),
  $I.annoteSchema("CatalogAssemblyFailureFromPayload", {
    description: "Project the compatible payload into its source-specific case without encoding its cause.",
  })
);

const catalogAssemblyFailure = flow(S.decodeUnknownResult(CatalogAssemblyFailureFromPayload), Result.getOrThrow);

/**
 * **Details**
 *
 * A *missing* `pnpm-workspace.yaml`, an *absent* `workspaces` field, or one
 * explicitly `null` is not an error: there is simply nothing to misread, so
 * assembly yields the empty set. The reader is otherwise **hard-fail by design** —
 * a silently-empty catalog read is the "every dependency looks newly added" bug,
 * because catalog output is load-bearing for snapshot diffing.
 *
 * Defined next to the {@link CatalogResolver} contract that raises it, so a
 * consumer tells an assembly failure from a resolution failure by catching the
 * tag (`Effect.catchTag("CatalogAssemblyError", ...)`) rather than inspecting an
 * untyped defect `cause`.
 *

 * **Example** (Report an unreadable catalog source)
 *
 * ```ts
 * import { CatalogAssemblyError } from "@beep/npm-spec/CatalogAssemblyError";
 *
 * const error = CatalogAssemblyError.make({
 *   source: "manifest",
 *   path: "pnpm-workspace.yaml",
 *   cause: "invalid YAML",
 * });
 * console.log(error.message) // Failed to assemble catalogs from manifest pnpm-workspace.yaml: invalid YAML
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class CatalogAssemblyError extends S.TaggedError<CatalogAssemblyError, { readonly brand: unique symbol }>(
  $I`CatalogAssemblyError`
)(
  "CatalogAssemblyError",
  CatalogAssemblyErrorPayload,
  $I.annoteError<CatalogAssemblyError>("CatalogAssemblyError", {
    description:
      "Raised when a workspace's catalogs cannot be assembled — a `pnpm-workspace.yaml` that is unreadable or not valid YAML, a root `package.json` `workspaces` field whose shape or catalog blocks are malformed in a way pnpm itself rejects (including the default catalog declared twice), or a config dependency whose `pnpmfile.cjs` cannot be loaded or replayed.",
  })
) {
  /**
   * Projects the compatible public fields into the source-specific internal failure.
   *
   * **Details**
   *
   * Manifest and catalog failures omit hooks-only reasons. The public payload
   * keeps those fields for compatibility, and the projection preserves the cause.
   *
   * **Example** (Normalize a manifest failure)
   *
   * ```ts
   * import { CatalogAssemblyError } from "@beep/npm-spec/CatalogAssemblyError";
   *
   * const error = CatalogAssemblyError.make({ source: "manifest", path: "pnpm-workspace.yaml", cause: "invalid YAML", reason: "fetchFailed" });
   * error.failure.source // => "manifest"
   * error.reason // => "fetchFailed"
   * ```
   *
   * @internal
   * @category getters
   * @since 0.0.0
   */
  get failure(): typeof CatalogAssemblyFailure.Type {
    return catalogAssemblyFailure(this);
  }

  /**
  * Renders the failing source into a one-line summary, followed by the
  * cause's own message when the cause carries one.
  *
  * **Details**
  *
  * The cause is where the actionable detail lives — which version was
  * declared, what is installed, which stores were searched, the module a
  * pnpmfile could not import — so a consumer rendering only `message`, the
  * normal Effect path, must not lose it. A cause that is itself a
  * `CatalogAssemblyError` (a nested assembly error) already renders its own
  * summary, so its message is used as-is rather than prefixed a second time.

  * **Example** (Render the originating failure)
  *
  * ```ts
  * import { CatalogAssemblyError } from "@beep/npm-spec/CatalogAssemblyError";
  *
  * const error = CatalogAssemblyError.make({
  *   source: "manifest",
  *   path: "pnpm-workspace.yaml",
  *   cause: "invalid YAML",
  * });
  * console.log(error.message) // Failed to assemble catalogs from manifest pnpm-workspace.yaml: invalid YAML
  * ```
  *
  * @since 0.0.0
  */
  override get message(): string {
    const failure = this.failure;
    if (S.is(CatalogAssemblyError)(failure.cause)) return failure.cause.message;
    const summary = `Failed to assemble catalogs from ${failure.source} ${failure.path}`;
    const detail = nonBlankCauseMessage(failure.cause);
    return detail === undefined ? summary : `${summary}: ${detail}`;
  }
}
