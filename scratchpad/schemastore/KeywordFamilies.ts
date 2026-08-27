/**
 * The one owner of the declared non-standard keyword families — the
 * language-server keyword sets SchemaStore's CONTRIBUTING enumerates as
 * legitimately consumed by editor toolchains, which ajv strict mode would
 * otherwise reject:
 *
 * - **vscode-json-languageservice** (exact names): `allowTrailingCommas`,
 *   `defaultSnippets`, `enumDescriptions`, `markdownDescription`,
 *   `markdownEnumDescriptions`.
 * - **taplo**: the `x-taplo` prefix (`x-taplo`, `x-taplo-info`, ...).
 * - **tombi**: the `x-tombi-` prefix (`x-tombi-toml-version`,
 *   `x-tombi-array-values-order`, `x-tombi-array-values-order-by`,
 *   `x-tombi-table-keys-order`, `x-tombi-string-formats`,
 *   `x-tombi-additional-key-label`).
 * - **IntelliJ**: the `x-intellij-` prefix (`x-intellij-language-injection`,
 *   `x-intellij-html-description`, `x-intellij-enum-metadata`).
 *
 * Both consumers of the registry route through {@link KeywordFamilies.isDeclared}:
 * `DocumentLint`'s `UnknownKeyword` check (a declared key is not flagged) and
 * `AnnotationCarriers` (only declared keys are re-grafted after the Draft-07
 * lowering). One predicate, so the lint and the carriers cannot drift.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

// The vscode-json-languageservice extension set (exact names).
const VSCODE_KEYWORDS = new Set([
	"allowTrailingCommas",
	"defaultSnippets",
	"enumDescriptions",
	"markdownDescription",
	"markdownEnumDescriptions",
]);

/**
 * The declared non-standard keyword families as one predicate: the
 * vscode-json-languageservice set by exact name, plus the `x-taplo`,
 * `x-tombi-` and `x-intellij-` prefixes.
 *
 * **Gotchas**
 *
 * Taplo matches `x-taplo` and any `x-taplo*` continuation (`x-taplofoo` is
 * admitted). Tombi and IntelliJ require the hyphenated prefix (`x-tombifoo`
 * is rejected; `x-tombi-foo` is admitted). vscode names are a closed exact
 * set — `markdownDescription` is declared, `markdownDescriptions` is not.
 *
 * **Example** (Admit declared families, reject custom keys)
 *
 * ```ts
 * import { KeywordFamilies } from "@beep/scratchpad/schemastore"
 *
 * console.log(KeywordFamilies.isDeclared("x-taplo"))
 * // => true
 * console.log(KeywordFamilies.isDeclared("markdownDescription"))
 * // => true
 * console.log(KeywordFamilies.isDeclared("x-custom"))
 * // => false
 * ```
 *
 * @see {@link DocumentLint} for the `UnknownKeyword` check that uses this predicate.
 * @see {@link AnnotationCarriers} for the post-lowering re-graft that copies only declared keys.
 * @public
 * @category predicates
 * @since 0.0.0
 */
export class KeywordFamilies {
	private constructor() {}

	/**
	 * Whether `key` belongs to a declared non-standard keyword family.
	 * Draft-07's own keywords are a separate vocabulary — this predicate
	 * answers only for the language-server extension families.
	 */
	static isDeclared(key: string): boolean {
		return (
			VSCODE_KEYWORDS.has(key) ||
			key.startsWith("x-taplo") ||
			key.startsWith("x-tombi-") ||
			key.startsWith("x-intellij-")
		);
	}
}
