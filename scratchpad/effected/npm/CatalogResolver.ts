// The `CatalogResolver` service contract for resolving pnpm `catalog:`
// specifiers, plus its no-op default layer.
//
// Both errors it can raise live in sibling modules and are imported
// type-only here (`DependencyResolutionError` in `WorkspaceResolver.ts`,
// `CatalogAssemblyError` in its own module), so the only runtime edge runs
// `CatalogResolver -> WorkspaceResolver`, keeping `noImportCycles` satisfied.

import { $ScratchpadId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import type { CatalogAssemblyError } from "./CatalogAssemblyError.ts";
import type { DependencyResolutionError } from "./WorkspaceResolver.ts";

const $I = $ScratchpadId.create("effected/npm/CatalogResolver");

/**
 * Contract for resolving pnpm `catalog:` dependency specifiers to concrete
 * version ranges.
 *
 * **Details**
 *
 * `rangeOf` takes a package name and an optional catalog name
 * (`Option.none()` selects the default catalog) and returns the configured
 * range as `Option.some`, or `Option.none()` when the specifier is absent
 * from the catalog. By convention the error channel is reserved for a
 * failure in the resolution mechanism itself — an unmatched package or
 * catalog name is an `Option.none()` success, never an error. A failure to
 * *assemble* the catalogs (an unreadable or malformed catalog source)
 * surfaces typed as a {@link CatalogAssemblyError}; any other mechanism
 * failure is a {@link DependencyResolutionError}.
 *
 * This is a contract-only service: {@link CatalogResolver.noop} is the sole
 * implementation this package ships, and it resolves nothing. Real consumers
 * (e.g. `@effected/workspaces`) provide a working implementation at the
 * application boundary.
 *
 * **Example** (Resolve a default catalog with the no-op resolver)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 * import { CatalogResolver } from "@beep/scratchpad/effected/npm/CatalogResolver";
 *
 * const program = Effect.gen(function* () {
 *   const resolver = yield* CatalogResolver;
 *   return yield* resolver.rangeOf("effect", O.none());
 * });
 *
 * const result = Effect.runSync(Effect.provide(program, CatalogResolver.noop));
 * console.log(O.isNone(result)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class CatalogResolver extends Context.Service<
	CatalogResolver,
	{
		readonly rangeOf: (
			packageName: string,
			catalog: O.Option<string>,
		) => Effect.Effect<O.Option<string>, CatalogAssemblyError | DependencyResolutionError>;
	}
>()($I`CatalogResolver`) {
	/**
	 * No-op default: `rangeOf` always succeeds with `Option.none()`, never
	 * consulting an actual catalog. A pure `Layer.succeed`, bound to a const
	 * so it memoizes by reference — the layer is built once, not once per
	 * reference to `CatalogResolver.noop`.

	 * **Example** (Leave named catalogs unresolved)
	 *
	 * ```ts
	 * import { CatalogResolver } from "@beep/scratchpad/effected/npm/CatalogResolver";
	 * import * as Effect from "effect/Effect";
	 * import * as O from "effect/Option";
	 *
	 * const program = Effect.flatMap(CatalogResolver, (resolver) =>
	 *   resolver.rangeOf("effect", O.some("build")),
	 * );
	 * const result = Effect.runSync(Effect.provide(program, CatalogResolver.noop));
	 * console.log(O.isNone(result)) // true
	 * ```
	 *
	 * @category layers
	 * @since 0.0.0
	 */
	static readonly noop: Layer.Layer<CatalogResolver> = Layer.succeed(CatalogResolver, {
		rangeOf: Effect.fn("CatalogResolver.rangeOf")(() => Effect.succeedNone),
	});
}
