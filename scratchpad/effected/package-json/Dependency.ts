// The single `Dependency` model — one class carrying a `kind` field
// (`prod` / `dev` / `peer` / `optional`) rather than one class per map. The
// protocol getters are written once, delegating to
// `@effected/npm`'s `DependencySpecifier`; `kind` types against `@effected/npm`'s
// `DependencyKind`, the kit-wide dependency-section vocabulary.

import { $ScratchpadId } from "@beep/identity/packages";
import type { DependencyProtocol } from "../npm/index.ts";
import { DependencyKind, DependencySpecifier } from "../npm/index.ts";
import type { Range } from "../semver/index.ts";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/package-json/Dependency");

/**
 * A resolved dependency entry pairing a package name with its version
 * specifier and the `kind` of map it came from (`@effected/npm`'s
 * `DependencyKind`). The protocol predicates delegate to `DependencySpecifier`.
 *
 * **Example** (Inspect a production dependency)
 *
 * ```ts
 * import { Dependency } from "@beep/scratchpad/effected/package-json/Dependency";
 *
 * const dependency = Dependency.make({ name: "effect", specifier: "^4.0.0", kind: "prod" });
 * console.log(dependency.isRange) // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Dependency extends S.Class<Dependency>($I`Dependency`)({
	/**
	 * The package name.
	 *
	 * **Example** (Read the package name)
	 *
	 * ```ts
	 * import { Dependency } from "@beep/scratchpad/effected/package-json/Dependency";
	 *
	 * const dependency = Dependency.make({ name: "effect", specifier: "^4.0.0", kind: "prod" });
	 * console.log(dependency.name) // "effect"
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	name: S.String.annotateKey({ description: "The package name." }),
	/**
	 * The raw version specifier.
	 *
	 * **Example** (Read the original specifier)
	 *
	 * ```ts
	 * import { Dependency } from "@beep/scratchpad/effected/package-json/Dependency";
	 *
	 * const dependency = Dependency.make({ name: "effect", specifier: "^4.0.0", kind: "prod" });
	 * console.log(dependency.specifier) // "^4.0.0"
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	specifier: S.String.annotateKey({ description: "The raw version specifier." }),
	/**
	 * Which dependency map this entry came from.
	 *
	 * **Example** (Read the dependency section)
	 *
	 * ```ts
	 * import { Dependency } from "@beep/scratchpad/effected/package-json/Dependency";
	 *
	 * const dependency = Dependency.make({ name: "effect", specifier: "^4.0.0", kind: "dev" });
	 * console.log(dependency.kind) // "dev"
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	kind: DependencyKind.annotateKey({ description: "Which dependency map this entry came from." }),
	/**
	 * For `peer` dependencies, whether the peer is optional (from `peerDependenciesMeta`).
	 *
	 * **Example** (Inspect an optional peer)
	 *
	 * ```ts
	 * import { Dependency } from "@beep/scratchpad/effected/package-json/Dependency";
	 *
	 * const dependency = Dependency.make({ name: "effect", specifier: "^4.0.0", kind: "peer", isOptional: true });
	 * console.log(dependency.isOptional) // true
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	isOptional: S.optionalKey(S.Boolean).annotateKey({ description: "For `peer` dependencies, whether the peer is optional (from `peerDependenciesMeta`)." }),
}, $I.annote("Dependency", { description: "A resolved dependency entry pairing a package name with its version specifier and the `kind` of map it came from (`@effected/npm`'s `DependencyKind`). The protocol predicates delegate to `DependencySpecifier`." })) {
	/**
	 * The classified protocol, or `None` for an empty specifier.
	 *
	 * **Example** (Classify a range and an empty specifier)
	 *
	 * ```ts
	 * import { Dependency } from "@beep/scratchpad/effected/package-json/Dependency";
	 * import * as O from "effect/Option";
	 *
	 * const dependency = Dependency.make({ name: "effect", specifier: "^4.0.0", kind: "prod" });
	 * console.log(O.getOrElse(dependency.protocol, () => "none")) // "range"
	 * console.log(O.isNone(Dependency.make({ name: "effect", specifier: "", kind: "prod" }).protocol)) // true
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	get protocol(): O.Option<DependencyProtocol> {
		return this.specifier.length === 0 ? O.none() : O.some(DependencySpecifier.protocolOf(this.specifier));
	}
	/**
	 * Parse the specifier as a semver `Range`, `None` when it is not a range.
	 *
	 * **Example** (Distinguish ranges from workspace references)
	 *
	 * ```ts
	 * import { Dependency } from "@beep/scratchpad/effected/package-json/Dependency";
	 * import * as O from "effect/Option";
	 *
	 * const dependency = Dependency.make({ name: "effect", specifier: "^4.0.0", kind: "prod" });
	 * console.log(O.isSome(dependency.range)) // true
	 * console.log(O.isNone(Dependency.make({ name: "effect", specifier: "workspace:^", kind: "prod" }).range)) // true
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	get range(): O.Option<Range> {
		return DependencySpecifier.parseRange(this.specifier);
	}
	/**
	 * Whether the specifier points to a local path.
	 *
	 * **Example** (Detect a local file dependency)
	 *
	 * ```ts
	 * import { Dependency } from "@beep/scratchpad/effected/package-json/Dependency";
	 *
	 * const dependency = Dependency.make({ name: "effect", specifier: "file:../effect", kind: "prod" });
	 * console.log(dependency.isLocal) // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	get isLocal(): boolean {
		return DependencySpecifier.isLocal(this.specifier);
	}
	/**
	 * Whether the specifier uses the `link:` protocol.
	 *
	 * **Example** (Detect a linked dependency)
	 *
	 * ```ts
	 * import { Dependency } from "@beep/scratchpad/effected/package-json/Dependency";
	 *
	 * const dependency = Dependency.make({ name: "effect", specifier: "link:../effect", kind: "prod" });
	 * console.log(dependency.isLink) // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	get isLink(): boolean {
		return DependencySpecifier.isLink(this.specifier);
	}
	/**
	 * Whether the specifier uses the `portal:` protocol.
	 *
	 * **Example** (Detect a portal dependency)
	 *
	 * ```ts
	 * import { Dependency } from "@beep/scratchpad/effected/package-json/Dependency";
	 *
	 * const dependency = Dependency.make({ name: "effect", specifier: "portal:../effect", kind: "prod" });
	 * console.log(dependency.isPortal) // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	get isPortal(): boolean {
		return DependencySpecifier.isPortal(this.specifier);
	}
	/**
	 * Whether the specifier uses the `catalog:` protocol.
	 *
	 * **Example** (Detect a catalog reference)
	 *
	 * ```ts
	 * import { Dependency } from "@beep/scratchpad/effected/package-json/Dependency";
	 *
	 * const dependency = Dependency.make({ name: "effect", specifier: "catalog:", kind: "prod" });
	 * console.log(dependency.isCatalog) // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	get isCatalog(): boolean {
		return DependencySpecifier.isCatalog(this.specifier);
	}
	/**
	 * Whether the specifier uses the `workspace:` protocol.
	 *
	 * **Example** (Detect a workspace reference)
	 *
	 * ```ts
	 * import { Dependency } from "@beep/scratchpad/effected/package-json/Dependency";
	 *
	 * const dependency = Dependency.make({ name: "effect", specifier: "workspace:^", kind: "prod" });
	 * console.log(dependency.isWorkspace) // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	get isWorkspace(): boolean {
		return DependencySpecifier.isWorkspace(this.specifier);
	}
	/**
	 * Whether the specifier is an unresolved `catalog:` or `workspace:` protocol.
	 *
	 * **Example** (Detect an unresolved workspace reference)
	 *
	 * ```ts
	 * import { Dependency } from "@beep/scratchpad/effected/package-json/Dependency";
	 *
	 * const dependency = Dependency.make({ name: "effect", specifier: "workspace:^", kind: "prod" });
	 * console.log(dependency.isUnresolved) // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	get isUnresolved(): boolean {
		return this.isCatalog || this.isWorkspace;
	}
	/**
	 * Whether the specifier resolves to a git source.
	 *
	 * **Example** (Detect a Git dependency)
	 *
	 * ```ts
	 * import { Dependency } from "@beep/scratchpad/effected/package-json/Dependency";
	 *
	 * const dependency = Dependency.make({ name: "effect", specifier: "git+https://github.com/Effect-TS/effect.git", kind: "prod" });
	 * console.log(dependency.isGit) // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	get isGit(): boolean {
		return DependencySpecifier.isGit(this.specifier);
	}
	/**
	 * Whether the specifier is a parseable semver range.
	 *
	 * **Example** (Detect a semantic version range)
	 *
	 * ```ts
	 * import { Dependency } from "@beep/scratchpad/effected/package-json/Dependency";
	 *
	 * const dependency = Dependency.make({ name: "effect", specifier: "^4.0.0", kind: "prod" });
	 * console.log(dependency.isRange) // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	get isRange(): boolean {
		return DependencySpecifier.isRange(this.specifier);
	}
	/**
	 * Whether the specifier is a dist-tag.
	 *
	 * **Example** (Detect a distribution tag)
	 *
	 * ```ts
	 * import { Dependency } from "@beep/scratchpad/effected/package-json/Dependency";
	 *
	 * const dependency = Dependency.make({ name: "effect", specifier: "latest", kind: "prod" });
	 * console.log(dependency.isTag) // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	get isTag(): boolean {
		return DependencySpecifier.isTag(this.specifier);
	}
}

/**
 * A {@link Dependency} whose specifier is an unresolved `catalog:` or
 * `workspace:` protocol.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type UnresolvedDependency = Dependency & { readonly isUnresolved: true };

/**
 * Narrows a dependency-like value to
 * {@link UnresolvedDependency}, preserving the concrete type.
 *
 * **Example** (Recognize an unresolved dependency)
 *
 * ```ts
 * import { Dependency, isUnresolvedDependency } from "@beep/scratchpad/effected/package-json/Dependency";
 *
 * const dependency = Dependency.make({ name: "effect", specifier: "catalog:", kind: "prod" });
 * console.log(isUnresolvedDependency(dependency)) // true
 * console.log(isUnresolvedDependency(Dependency.make({ name: "effect", specifier: "^4.0.0", kind: "prod" }))) // false
 * ```
 *
 * @public
 * @category guards
 * @since 0.0.0
 */
export const isUnresolvedDependency = <T extends { readonly isUnresolved: boolean }>(
	dependency: T,
): dependency is T & { readonly isUnresolved: true } => dependency.isUnresolved === true;
