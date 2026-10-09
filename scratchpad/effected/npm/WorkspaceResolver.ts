// The `WorkspaceResolver` service contract for resolving pnpm `workspace:`
// specifiers, plus the shared `DependencyResolutionError` both resolver
// contracts raise.
//
// `DependencyResolutionError` is co-located here (rather than in a third
// file) because both `WorkspaceResolver` and `CatalogResolver` reference it
// in their error channel; `CatalogResolver.ts` imports it type-only, so the
// dependency edge runs `CatalogResolver -> WorkspaceResolver` one way and
// `noImportCycles` stays satisfied.

import { $ScratchpadId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/npm/WorkspaceResolver");

/**
 * Raised when a `catalog:` or `workspace:` specifier cannot be resolved
 * because the resolution mechanism itself failed — not for an ordinary
 * unmatched specifier, which resolves to `Option.none()` instead. Both
 * {@link CatalogResolver} and {@link WorkspaceResolver} fail with it.
 *
 * **Details**
 *
 * One case sits outside that "mechanism only" reading and belongs here
 * deliberately: a `workspace:` specifier naming a **known member that declares
 * no `version`**. It is not an unmatched specifier — the member exists — so
 * `Option.none()` would tell the caller "not a workspace member", which is
 * false and sends the resolution down a registry path. It fails here instead,
 * naming the specifier.
 *
 * `reason` tells the two apart without string-matching: `"mechanism"` (the
 * default) when the resolution mechanism failed, `"no-version"` for the
 * version-less member. `cause` preserves the originating failure on a
 * structured `Schema.Defect` field rather than folding it into a string, so
 * callers can branch on the original value (an `Error`, a parsed diagnostic,
 * anything); a `"no-version"` failure is raised from structured data and
 * carries no `cause`. `specifier` records the specifier string that failed to
 * resolve.
 *
 * **Example** (Handle workspace members without a version)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { DependencyResolutionError, WorkspaceResolver } from "@beep/scratchpad/effected/npm/WorkspaceResolver";
 *
 * const program = Effect.gen(function* () {
 *   const resolver = yield* WorkspaceResolver;
 *   return yield* resolver.versionOf("@x/private-tool");
 * }).pipe(
 *   Effect.catchTag("DependencyResolutionError", (error: DependencyResolutionError) =>
 *     error.reason === "no-version" ? Effect.succeed(undefined) : Effect.fail(error),
 *   ),
 * );
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class DependencyResolutionError extends S.TaggedError<DependencyResolutionError>($I`DependencyResolutionError`)(
	"DependencyResolutionError",
	{
		specifier: S.String.annotateKey({ description: "The dependency specifier that could not be resolved" }),
		/**
		 * Why the specifier could not be resolved.
		 *
		 * **Details**
		 *
		 * - `"mechanism"` — the resolution mechanism itself failed (reading or
		 *   assembling the workspace or its catalogs); `cause` carries the failure.
		 * - `"no-version"` — a `workspace:` specifier names a known member whose
		 *   manifest declares no `version`; there is no `cause`.
		 *
		 * Defaults to `"mechanism"` when omitted, at construction and when decoding
		 * an error encoded before the field existed.
		 *
		 * @since 0.0.0
		 */
		reason: S.Literals(["mechanism", "no-version"]).pipe(
			S.withDecodingDefaultKey(Effect.succeed("mechanism" as const)),
			S.withConstructorDefault(Effect.succeed("mechanism" as const)),
		).annotateKey({ description: "Why the specifier could not be resolved." }),
		cause: S.Defect({ includeStack: true }).annotateKey({ description: "The originating resolution failure, preserved structurally; absent when a known workspace member declares no version" }),
	}, $I.annote("DependencyResolutionError", { description: "Raised when a `catalog:` or `workspace:` specifier cannot be resolved because the resolution mechanism itself failed — not for an ordinary unmatched specifier, which resolves to `Option.none()` instead. Both CatalogResolver and WorkspaceResolver fail with it." }),
) {
	/**
	 * Renders `specifier` and `reason` into a one-line failure message.
	 *
	 * **Example** (Render a missing-version failure)
	 *
	 * ```ts
	 * import { DependencyResolutionError } from "@beep/scratchpad/effected/npm/WorkspaceResolver";
	 *
	 * const error = new DependencyResolutionError({
	 *   specifier: "workspace:*",
	 *   reason: "no-version",
	 *   cause: undefined,
	 * });
	 * console.log(error.message) // Failed to resolve dependency specifier "workspace:*": the workspace member declares no version
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	override get message(): string {
		return this.reason === "no-version"
			? `Failed to resolve dependency specifier "${this.specifier}": the workspace member declares no version`
			: `Failed to resolve dependency specifier "${this.specifier}"`;
	}
}

/**
 * Contract for resolving pnpm `workspace:` dependency specifiers to concrete
 * versions.
 *
 * **Details**
 *
 * `versionOf` takes a workspace package name and has three outcomes:
 * `Option.some(version)` with the member's concrete version (the range
 * modifier stripped); `Option.none()` when the name is **not** a known
 * workspace member; and a typed {@link DependencyResolutionError} when the
 * name **is** a member but its manifest declares no `version`. That third
 * outcome is why the second cannot absorb it — a version-less member is a
 * member, and answering `none` for it would read downstream as "resolve this
 * from the registry instead".
 *
 * This is a contract-only service: {@link WorkspaceResolver.noop} is the
 * sole implementation this package ships, and it resolves nothing. Real
 * consumers (e.g. `@effected/workspaces`) provide a working implementation
 * at the application boundary.
 *
 * **Example** (Resolve a workspace version with the no-op resolver)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 * import { WorkspaceResolver } from "@beep/scratchpad/effected/npm/WorkspaceResolver";
 *
 * const program = Effect.gen(function* () {
 *   const resolver = yield* WorkspaceResolver;
 *   return yield* resolver.versionOf("@effected/semver");
 * });
 *
 * const result = Effect.runSync(Effect.provide(program, WorkspaceResolver.noop));
 * console.log(O.isNone(result)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class WorkspaceResolver extends Context.Service<
	WorkspaceResolver,
	{
		readonly versionOf: (packageName: string) => Effect.Effect<O.Option<string>, DependencyResolutionError>;
	}
>()($I`WorkspaceResolver`) {
	/**
	 * No-op default: `versionOf` always succeeds with `Option.none()`, never
	 * consulting an actual workspace. A pure `Layer.succeed`, bound to a
	 * const so it memoizes by reference.
	 *
	 * **Example** (Provide the no-op workspace layer)
	 *
	 * ```ts
	 * import * as Effect from "effect/Effect";
	 * import * as O from "effect/Option";
	 * import { WorkspaceResolver } from "@beep/scratchpad/effected/npm/WorkspaceResolver";
	 *
	 * const program = Effect.flatMap(WorkspaceResolver, (resolver) => resolver.versionOf("@scope/pkg"));
	 * const result = Effect.runSync(Effect.provide(program, WorkspaceResolver.noop));
	 * console.log(O.isNone(result)) // true
	 * ```
	 *
	 * @category layers
	 * @since 0.0.0
	 */
	static readonly noop: Layer.Layer<WorkspaceResolver> = Layer.succeed(WorkspaceResolver, {
		versionOf: Effect.fn("WorkspaceResolver.versionOf")(() => Effect.succeedNone),
	});
}
