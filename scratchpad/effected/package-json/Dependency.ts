// The single `Dependency` model — one class carrying a `kind` field
// (`prod` / `dev` / `peer` / `optional`) rather than one class per map. The
// protocol getters are written once, delegating to
// `@effected/npm`'s `DependencySpecifier`; `kind` types against `@effected/npm`'s
// `DependencyKind`, the kit-wide dependency-section vocabulary.

import type { DependencyProtocol } from "../npm/index.ts";
import { DependencyKind, DependencySpecifier } from "../npm/index.ts";
import type { Range } from "../semver/index.ts";
import { Option, Schema } from "effect";

/**
 * A resolved dependency entry pairing a package name with its version
 * specifier and the `kind` of map it came from (`@effected/npm`'s
 * `DependencyKind`). The protocol predicates delegate to `DependencySpecifier`.
 *
 * @public
 */
export class Dependency extends Schema.Class<Dependency>("Dependency")({
	/** The package name. */
	name: Schema.String,
	/** The raw version specifier. */
	specifier: Schema.String,
	/** Which dependency map this entry came from. */
	kind: DependencyKind,
	/** For `peer` dependencies, whether the peer is optional (from `peerDependenciesMeta`). */
	isOptional: Schema.optionalKey(Schema.Boolean),
}) {
	/** The classified protocol, or `None` for an empty specifier. */
	get protocol(): Option.Option<DependencyProtocol> {
		return this.specifier.length === 0 ? Option.none() : Option.some(DependencySpecifier.protocolOf(this.specifier));
	}
	/** Parse the specifier as a semver `Range`, `None` when it is not a range. */
	get range(): Option.Option<Range> {
		return DependencySpecifier.parseRange(this.specifier);
	}
	/** Whether the specifier points to a local path. */
	get isLocal(): boolean {
		return DependencySpecifier.isLocal(this.specifier);
	}
	/** Whether the specifier uses the `link:` protocol. */
	get isLink(): boolean {
		return DependencySpecifier.isLink(this.specifier);
	}
	/** Whether the specifier uses the `portal:` protocol. */
	get isPortal(): boolean {
		return DependencySpecifier.isPortal(this.specifier);
	}
	/** Whether the specifier uses the `catalog:` protocol. */
	get isCatalog(): boolean {
		return DependencySpecifier.isCatalog(this.specifier);
	}
	/** Whether the specifier uses the `workspace:` protocol. */
	get isWorkspace(): boolean {
		return DependencySpecifier.isWorkspace(this.specifier);
	}
	/** Whether the specifier is an unresolved `catalog:` or `workspace:` protocol. */
	get isUnresolved(): boolean {
		return this.isCatalog || this.isWorkspace;
	}
	/** Whether the specifier resolves to a git source. */
	get isGit(): boolean {
		return DependencySpecifier.isGit(this.specifier);
	}
	/** Whether the specifier is a parseable semver range. */
	get isRange(): boolean {
		return DependencySpecifier.isRange(this.specifier);
	}
	/** Whether the specifier is a dist-tag. */
	get isTag(): boolean {
		return DependencySpecifier.isTag(this.specifier);
	}
}

/**
 * A {@link Dependency} whose specifier is an unresolved `catalog:` or
 * `workspace:` protocol.
 *
 * @public
 */
export type UnresolvedDependency = Dependency & { readonly isUnresolved: true };

/**
 * Type guard narrowing any dependency-like value to
 * {@link UnresolvedDependency}, preserving the concrete type.
 *
 * @public
 */
export const isUnresolvedDependency = <T extends { readonly isUnresolved: boolean }>(
	dependency: T,
): dependency is T & { readonly isUnresolved: true } => dependency.isUnresolved === true;
