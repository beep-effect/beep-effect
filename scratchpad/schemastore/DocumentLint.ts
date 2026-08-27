import { Schema } from "effect";
import { MAX_NESTING_DEPTH } from "./internal/limits.ts";
import { KeywordFamilies } from "./KeywordFamilies.ts";
import type { StoreDocument } from "./StoreDocument.ts";

/**
 * A structural lint finding over an assembled document: a value in a
 * report, never an error channel — a document with findings is still a
 * document, and the consumer decides what a finding gates.
 *
 * @public
 */
export class DocumentLintFinding extends Schema.Class<DocumentLintFinding>("DocumentLintFinding")({
	/** Which check fired. */
	check: Schema.Literals(["UnresolvedRef", "UnknownKeyword", "DescriptionWithoutUrl", "DepthExceeded"]),
	/** `"warning"` for structural defects, `"advisory"` for best practices. */
	severity: Schema.Literals(["warning", "advisory"]),
	/** JSON pointer into the flat document (`""` is the root schema). */
	path: Schema.String,
	/** Human-readable explanation. */
	message: Schema.String,
}) {}

// Draft-07 keywords, plus `$defs` (the Draft-07-valid alias the SchemaStore
// document shape keeps its pool under).
const DRAFT_07_KEYWORDS = new Set([
	"$comment",
	"$defs",
	"$id",
	"$ref",
	"$schema",
	"additionalItems",
	"additionalProperties",
	"allOf",
	"anyOf",
	"const",
	"contains",
	"contentEncoding",
	"contentMediaType",
	"default",
	"definitions",
	"dependencies",
	"description",
	"else",
	"enum",
	"examples",
	"exclusiveMaximum",
	"exclusiveMinimum",
	"format",
	"if",
	"items",
	"maxItems",
	"maxLength",
	"maxProperties",
	"maximum",
	"minItems",
	"minLength",
	"minProperties",
	"minimum",
	"multipleOf",
	"not",
	"oneOf",
	"pattern",
	"patternProperties",
	"properties",
	"propertyNames",
	"readOnly",
	"required",
	"then",
	"title",
	"type",
	"uniqueItems",
	"writeOnly",
]);

const URL_LINE = /^https?:\/\/\S+$/;

const escapePointerSegment = (segment: string): string => segment.replace(/~/g, "~0").replace(/\//g, "~1");

const unescapePointerSegment = (segment: string): string => segment.replace(/~1/g, "/").replace(/~0/g, "~");

interface LintContext {
	readonly defs: Readonly<Record<string, unknown>>;
	readonly findings: Array<DocumentLintFinding>;
}

const isSchemaObject = (node: unknown): node is Record<string, unknown> =>
	typeof node === "object" && node !== null && !Array.isArray(node);

const checkRef = (value: unknown, path: string, context: LintContext): void => {
	if (typeof value !== "string") {
		return;
	}
	if (value === "#") {
		return;
	}
	const match = /^#\/\$defs\/([^/]+)/.exec(value);
	if (match !== null && Object.hasOwn(context.defs, unescapePointerSegment(match[1] as string))) {
		return;
	}
	context.findings.push(
		DocumentLintFinding.make({
			check: "UnresolvedRef",
			severity: "warning",
			path,
			message: `$ref "${value}" does not resolve against the document's $defs pool`,
		}),
	);
};

// Walks one schema node, keyword-position aware: descends only into
// positions the Draft-07 grammar defines as schemas (or schema maps /
// schema arrays), so property NAMES and data-position values (`enum`,
// `const`, `default`, `examples`) are never mistaken for keywords.
const lintSchema = (node: unknown, path: string, depth: number, context: LintContext): void => {
	if (!isSchemaObject(node)) {
		// Draft-07 boolean schemas (`true`/`false`) are legal leaves.
		return;
	}
	if (depth >= MAX_NESTING_DEPTH) {
		context.findings.push(
			DocumentLintFinding.make({
				check: "DepthExceeded",
				severity: "warning",
				path,
				message: `schema nests deeper than ${MAX_NESTING_DEPTH} levels; lint did not descend further`,
			}),
		);
		return;
	}
	for (const [key, value] of Object.entries(node)) {
		const keyPath = `${path}/${escapePointerSegment(key)}`;
		if (!DRAFT_07_KEYWORDS.has(key) && !KeywordFamilies.isDeclared(key)) {
			context.findings.push(
				DocumentLintFinding.make({
					check: "UnknownKeyword",
					severity: "warning",
					path: keyPath,
					message: `"${key}" is not a Draft-07 keyword or a declared non-standard family (x-taplo*, x-tombi-*, x-intellij-*, vscode); ajv strict mode rejects it`,
				}),
			);
			continue;
		}
		switch (key) {
			case "$ref":
				checkRef(value, keyPath, context);
				break;
			case "properties":
			case "patternProperties":
			case "$defs":
			case "definitions": {
				if (isSchemaObject(value)) {
					for (const [name, subschema] of Object.entries(value)) {
						lintSchema(subschema, `${keyPath}/${escapePointerSegment(name)}`, depth + 1, context);
					}
				}
				break;
			}
			case "dependencies": {
				// Values are either schemas or arrays of property names.
				if (isSchemaObject(value)) {
					for (const [name, dependency] of Object.entries(value)) {
						if (!Array.isArray(dependency)) {
							lintSchema(dependency, `${keyPath}/${escapePointerSegment(name)}`, depth + 1, context);
						}
					}
				}
				break;
			}
			case "items": {
				if (Array.isArray(value)) {
					value.forEach((subschema, index) => {
						lintSchema(subschema, `${keyPath}/${index}`, depth + 1, context);
					});
				} else {
					lintSchema(value, keyPath, depth + 1, context);
				}
				break;
			}
			case "additionalItems":
			case "additionalProperties":
			case "propertyNames":
			case "contains":
			case "if":
			case "then":
			case "else":
			case "not":
				lintSchema(value, keyPath, depth + 1, context);
				break;
			case "allOf":
			case "anyOf":
			case "oneOf": {
				if (Array.isArray(value)) {
					value.forEach((subschema, index) => {
						lintSchema(subschema, `${keyPath}/${index}`, depth + 1, context);
					});
				}
				break;
			}
			default:
				// Leaf keywords (`enum`, `const`, `default`, `examples`,
				// `type`, ...) carry data, not schemas: never descended.
				break;
		}
	}
};

/**
 * Owned structural checks over an assembled {@link StoreDocument} — the
 * always-available half of the validation story (a real-engine gate like
 * ajv strict mode stays at the consumer's edge):
 *
 * - `UnresolvedRef` — every `$ref` resolves against the `$defs` pool
 *   (`#` self-refs allowed; anything else, including a surviving
 *   `#/definitions/...` pointer, is a warning).
 * - `UnknownKeyword` — no keyword outside Draft-07 plus the declared
 *   non-standard families ({@link KeywordFamilies}: `x-taplo*`, `x-tombi-*`,
 *   `x-intellij-*` and the vscode set), which ajv strict mode would reject.
 * - `DescriptionWithoutUrl` — advisory: SchemaStore's description
 *   convention ends the root description with a docs URL line.
 *
 * Tractable because the input is bounded `toJsonSchemaDocument` output;
 * this is not a general JSON Schema validator.
 *
 * @public
 */
export class DocumentLint {
	private constructor() {}

	/**
	 * Runs every check; total — hostile nesting degrades to a
	 * `DepthExceeded` finding rather than an error.
	 */
	static lint(document: StoreDocument): ReadonlyArray<DocumentLintFinding> {
		const context: LintContext = { defs: document.defs, findings: [] };
		lintSchema(document.root, "", 0, context);
		for (const [name, definition] of Object.entries(document.defs)) {
			lintSchema(definition, `/$defs/${escapePointerSegment(name)}`, 1, context);
		}
		const description = document.root.description;
		if (typeof description === "string") {
			const lines = description.split("\n");
			const last = lines[lines.length - 1] ?? "";
			if (!URL_LINE.test(last.trim())) {
				context.findings.push(
					DocumentLintFinding.make({
						check: "DescriptionWithoutUrl",
						severity: "advisory",
						path: "/description",
						message:
							"SchemaStore's description convention ends with a documentation URL on its own line (<description>\\n<docs-url>)",
					}),
				);
			}
		}
		return context.findings;
	}
}
