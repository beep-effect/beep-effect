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
 * @public
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
