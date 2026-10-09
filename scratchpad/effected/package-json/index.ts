/**
 * package.json parsing, editing, validation and file IO as Effect schemas.
 *
 * **Details**
 *
 * The {@link Package} class is the schema: typed known fields plus a `rest`
 * catch-all for round-trip fidelity, computed getters, dual-signature mutation
 * statics, and {@link Package.resolve} over the `@effected/npm` resolver
 * contracts. Leaf concepts (`PackageName`, `DependencySpecifier`,
 * `SpdxLicense`, {@link PackageManager}, {@link Person}, {@link DevEngine},
 * {@link Dependency}) carry their own statics and errors and compose into
 * `Package`'s fields. `Package` and {@link Person} are the two object-shaped
 * models, and both carry the `rest` catch-all; the remaining leaves model a
 * single scalar or a closed shape and so have no unknown keys to preserve.
 * {@link PackageJsonFile} is the only IO surface, over core `FileSystem` /
 * `Path`; {@link PackageValidator} runs rule-based validation over a decoded
 * `Package`; {@link PackageJsonFormat} sorts and formats without decoding, for
 * hosts that must accept manifests `Package.decode` rejects.
 *
 * {@link PackageManifest} is the presence-lenient model — `name` / `version`
 * optional, `packageManager` accepting the range spelling as
 * {@link PackageManagerRange} — for the private workspace-root shape the
 * strict `Package` rejects; {@link LenientManifest} is the shape-lenient
 * discovery tier below it, degrading malformed fields to absence (preserved
 * in `rest`, reported on `issues`) instead of failing the document; and
 * `PackageJsonFormat.modify` / `PackageJsonFile.modify` are the surgical,
 * byte-preserving field edits for tools that mutate other people's manifests.
 *
 * @packageDocumentation
 */

export { JsoncEdit, type JsoncPath } from "../jsonc/index.ts";
export {
	type DependencyKind,
	type DependencyProtocol,
	DependencySpecifier,
	type DependencySpecifierBrand,
	InvalidDependencySpecifierError,
	isValidDependencySpecifier,
} from "../npm/index.ts";
export { Dependency, type UnresolvedDependency, isUnresolvedDependency } from "./Dependency.ts";
export { DevEngine, DevEngineOrArray, type DevEngines, DevEnginesSchema } from "./DevEngines.ts";
export {
	type EntryPointManifest,
	type ResolveEntryPointOptions,
	UnresolvedEntryPointError,
	resolveEntryPoint,
} from "./EntryPoint.ts";
export { Funding } from "./Funding.ts";
export { LenientFieldIssue, LenientManifest } from "./LenientManifest.ts";
export { InvalidSpdxLicenseError, SpdxLicense, isValidSpdx, licenseExpressionOf } from "./License.ts";
export {
	BinField,
	DependencyMapField,
	ExportsField,
	Package,
	PackageDecodeError,
	type PackageFormatOptions,
	type PackageIndent,
	type PackagePatch,
	PeerDependenciesMetaField,
	PublishConfigField,
	RepositoryField,
	StringMapField,
} from "./Package.ts";
export {
	type PackageFieldEdit,
	PackageJsonFile,
	type PackageJsonFileShape,
	PackageJsonNotFoundError,
	PackageJsonParseError,
	PackageJsonReadError,
	PackageJsonWriteError,
} from "./PackageJsonFile.ts";
export {
	type PackageFormatTextOptions,
	PackageJsonFormat,
	PackageJsonModifyError,
	PackageJsonSyntaxError,
} from "./PackageJsonFormat.ts";
export { PackageManager } from "./PackageManager.ts";
export type { DevEnginePackageManagerEntry } from "./PackageManagerRange.ts";
export { InvalidPackageManagerRangeError, PackageManagerRange } from "./PackageManagerRange.ts";
export { PackageManifest } from "./PackageManifest.ts";
export {
	InvalidPackageNameError,
	PackageName,
	ScopedPackageName,
	UnscopedPackageName,
} from "./PackageName.ts";
export {
	PackageValidationError,
	PackageValidator,
	RuleFailure,
	type ValidationRule,
	defaultRules,
	noLocalDepsRule,
	noUnresolvedDepsRule,
} from "./PackageValidator.ts";
export { Person } from "./Person.ts";
export { Bugs, Repository } from "./Repository.ts";
