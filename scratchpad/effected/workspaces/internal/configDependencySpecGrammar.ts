// The ONE split of a `configDependencies` spec, `<version>[+<integrity>]`.
//
// Two policies sit on top of it and must never re-derive the split:
//
//   - `ConfigDependencySpec.parseResult` (public) validates both halves — a
//     strict SemVer version and an SRI integrity — and fails typed on either.
//   - The hook-replay ladder (`configDependencyResolution.ts`) takes only the
//     version text, unvalidated, because it matches that text against
//     installed manifests, store directory names and caller-supplied map keys:
//     an unparseable version simply finds nothing there and fails closed with
//     the ladder's own remediation. Validating it would make replay newly fail
//     on specs it has always accepted (a malformed integrity it never reads,
//     a map key that is not strict semver).
//
// The grammar rule both share: the FIRST `+` begins the integrity component,
// never semver build metadata. That is pnpm's own reading — the inline form is
// `<version>+<sri>`, and pnpm's SRI alphabet contains `+` itself, so only the
// first `+` can be the separator.

/**
 * A `configDependencies` spec split into its two textual halves, neither validated.
 *
 * @category models
 * @since 0.0.0
 */
export interface ConfigDependencySpecParts {
	/** The text before the first `+` (the whole spec when there is none). */
	readonly version: string;
	/** The text after the first `+`, or `undefined` when the spec has no `+`. */
	readonly integrity: string | undefined;
}

/**
 * Splits a spec on its first `+`: `0.9.0+sha512-…` → `{ version: "0.9.0", integrity: "sha512-…" }`.
 *
 * **Details**
 *
 * Neither textual half is validated. The first `+` begins the integrity
 * component, rather than SemVer build metadata; later `+` characters remain
 * part of the integrity.
 *
 * **Example** (Preserve integrity plus signs)
 *
 * ```ts
 * import { splitConfigDependencySpec } from "@beep/scratchpad/effected/workspaces/internal/configDependencySpecGrammar"
 *
 * const parts = splitConfigDependencySpec("0.9.0+sha512-a+b")
 * console.log(parts.version) // 0.9.0
 * console.log(parts.integrity) // sha512-a+b
 * console.log(splitConfigDependencySpec("0.9.0").integrity) // undefined
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const splitConfigDependencySpec = (spec: string): ConfigDependencySpecParts => {
	const plus = spec.indexOf("+");
	return plus === -1
		? { version: spec, integrity: undefined }
		: { version: spec.slice(0, plus), integrity: spec.slice(plus + 1) };
};
