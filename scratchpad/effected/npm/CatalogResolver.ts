// The `CatalogResolver` service contract for resolving pnpm `catalog:`
// specifiers, plus its no-op default layer.
//
// Both errors it can raise live in sibling modules and are imported
// type-only here (`DependencyResolutionError` in `WorkspaceResolver.ts`,
// `CatalogAssemblyError` in its own module), so the only runtime edge runs
// `CatalogResolver -> WorkspaceResolver`, keeping `noImportCycles` satisfied.

import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import type { CatalogAssemblyError } from "./CatalogAssemblyError.ts";
import type { DependencyResolutionError } from "./WorkspaceResolver.ts";

/**
 * Contract for resolving pnpm `catalog:` dependency specifiers to concrete
 * version ranges.
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
 * @example
 * ```ts
 * import { Effect, Option } from "effect";
 * import { CatalogResolver } from "./index.ts";
 *
 * const program = Effect.gen(function* () {
 *   const resolver = yield* CatalogResolver;
 *   return yield* resolver.rangeOf("effect", Option.none());
 * });
 *
 * Effect.runPromise(Effect.provide(program, CatalogResolver.noop));
 * // => Option.none()
 * ```
 *
 * @public
 */
export class CatalogResolver extends Context.Service<
	CatalogResolver,
	{
		readonly rangeOf: (
			packageName: string,
			catalog: O.Option<string>,
		) => Effect.Effect<O.Option<string>, CatalogAssemblyError | DependencyResolutionError>;
	}
>()("@beep/scratchpad/effected/npm/CatalogResolver") {
	/**
	 * No-op default: `rangeOf` always succeeds with `Option.none()`, never
	 * consulting an actual catalog. A pure `Layer.succeed`, bound to a const
	 * so it memoizes by reference — the layer is built once, not once per
	 * reference to `CatalogResolver.noop`.
	 */
	static readonly noop: Layer.Layer<CatalogResolver> = Layer.succeed(CatalogResolver, {
		rangeOf: Effect.fn("CatalogResolver.rangeOf")(() => Effect.succeedNone),
	});
}
