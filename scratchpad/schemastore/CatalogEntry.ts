/**
 * SchemaStore `catalog.json` entries as a class schema.
 *
 * Decoding an existing catalog row and encoding one for submission are the
 * same artifact, including both unversioned (`url` only) and versioned
 * (`versions` map plus latest-pointing `url`) modes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Schema } from "effect";
import type { CatalogUrls, SchemaVersion } from "./SchemaVersioning.ts";
import { SchemaVersioning } from "./SchemaVersioning.ts";

const $I = $ScratchpadId.create("schemastore/CatalogEntry");

/**
 * A fileMatch hygiene finding: a value in a lint report, not an error —
 * SchemaStore reviewers reject entries over these, so surfacing them
 * locally is the point, but a warned entry is still a valid entry.
 *
 * **Example** (Construct a generic-fileMatch finding)
 *
 * ```ts
 * import { CatalogLintFinding } from "@beep/scratchpad/schemastore"
 *
 * const finding = CatalogLintFinding.make({
 *   check: "GenericFileMatch",
 *   pattern: "*.json",
 *   message: "\"*.json\" claims every .json file; SchemaStore rejects generic patterns",
 * })
 *
 * console.log(finding.check)
 * // => "GenericFileMatch"
 * ```
 *
 * @see {@link CatalogEntry.lint} for the glob-shape analysis that produces these findings.
 * @public
 * @category models
 * @since 0.0.0
 */
export class CatalogLintFinding extends Schema.Class<CatalogLintFinding>($I`CatalogLintFinding`)(
	{
		/** Which hygiene check fired. */
		check: Schema.Literals(["GenericFileMatch", "ComplexFileMatch"]),
		/** The `fileMatch` pattern the finding is about. */
		pattern: Schema.String,
		/** Human-readable explanation with the SchemaStore rationale. */
		message: Schema.String,
	},
	$I.annote("CatalogLintFinding", {
		description:
			"A catalog fileMatch hygiene finding: a report value, never an error channel, for generic or complex glob patterns SchemaStore rejects.",
	}),
) {}

// File extensions whose bare `*.<ext>` (or `**/*.<ext>`) patterns claim every
// file of a common config format — the "generic pattern" SchemaStore rejects.
const CONFIG_EXTENSIONS = new Set([
	"cfg",
	"conf",
	"env",
	"ini",
	"json",
	"json5",
	"jsonc",
	"properties",
	"toml",
	"xml",
	"yaml",
	"yml",
]);

// Base names so generic that claiming one claims another tool's config file
// (the Hugo `config.toml` rejection example from SchemaStore's CONTRIBUTING).
const GENERIC_BASENAMES = new Set(["conf", "config", "configuration", "options", "settings"]);

// Glob constructs SchemaStore asks contributors to avoid: brace alternation
// (expand into multiple simple patterns instead), extglob groups, character
// classes and negation.
const COMPLEX_GLOB = /[{}[\]]|[?*+@!]\(|^!/;

const lintPattern = (pattern: string): ReadonlyArray<CatalogLintFinding> => {
	const findings: Array<CatalogLintFinding> = [];
	const basename = pattern.slice(pattern.lastIndexOf("/") + 1);
	const dot = basename.lastIndexOf(".");
	const stem = dot === -1 ? basename : basename.slice(0, dot);
	const extension = dot === -1 ? "" : basename.slice(dot + 1).toLowerCase();
	if (stem === "*" && CONFIG_EXTENSIONS.has(extension)) {
		findings.push(
			CatalogLintFinding.make({
				check: "GenericFileMatch",
				pattern,
				message: `"${pattern}" claims every .${extension} file; SchemaStore rejects generic patterns — match the specific file name(s) the schema owns`,
			}),
		);
	} else if (GENERIC_BASENAMES.has(stem.toLowerCase()) && CONFIG_EXTENSIONS.has(extension)) {
		findings.push(
			CatalogLintFinding.make({
				check: "GenericFileMatch",
				pattern,
				message: `"${pattern}" matches the generic name "${basename}", which other tools also use; SchemaStore rejects generic patterns — qualify it with a tool-specific name or directory`,
			}),
		);
	}
	if (COMPLEX_GLOB.test(pattern)) {
		findings.push(
			CatalogLintFinding.make({
				check: "ComplexFileMatch",
				pattern,
				message: `"${pattern}" uses complex glob constructs; SchemaStore asks for simple patterns — expand alternations into multiple entries`,
			}),
		);
	}
	return findings;
};

/**
 * A SchemaStore `catalog.json` entry: the class is the schema, so decoding
 * an existing entry and encoding one for submission are the same artifact.
 * `versions` is present only for versioned catalogs
 * ({@link SchemaVersioning.catalogUrls} assembles both modes).
 *
 * **Gotchas**
 *
 * `lint()` findings are values, not a typed error channel — a warned entry
 * is still a valid {@link CatalogEntry}. `versions` key order is not a
 * contract after JSON round-trip; derive ordering from the labels via
 * {@link SchemaVersioning}. `lint` is pure glob-shape analysis, not a glob
 * engine.
 *
 * **Example** (Assemble unversioned and lint a generic pattern)
 *
 * ```ts
 * import { CatalogEntry } from "@beep/scratchpad/schemastore"
 *
 * const entry = CatalogEntry.assemble({
 *   name: "config",
 *   description: "Build configuration",
 *   fileMatch: ["*.json"],
 *   baseUrl: "https://example.com/schemas",
 * })
 * const findings = entry.lint()
 *
 * console.log(entry.url)
 * // => "https://example.com/schemas/config.json"
 * console.log(findings.map((finding) => finding.check))
 * // => ["GenericFileMatch"]
 * ```
 *
 * @see {@link SchemaVersioning.catalogUrls} for the URL assembly `assemble` delegates to.
 * @see {@link CatalogLintFinding} for the finding values `lint` returns.
 * @public
 * @category models
 * @since 0.0.0
 */
export class CatalogEntry extends Schema.Class<CatalogEntry>($I`CatalogEntry`)(
	{
		/** The schema's display name in the catalog. */
		name: Schema.String,
		/** The catalog description. */
		description: Schema.String,
		/** Glob patterns editors match files against. */
		fileMatch: Schema.Array(Schema.String),
		/** The schema URL — the unversioned file, or the latest version. */
		url: Schema.String,
		/**
		 * Versioned mode only: label → schema URL. Inserted ascending, but key
		 * order is not a contract — bare-major labels enumerate first (see
		 * `SchemaVersioning.catalogUrls`); derive ordering from the labels.
		 */
		versions: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
	},
	$I.annote("CatalogEntry", {
		description:
			"A SchemaStore catalog.json entry: name, description, fileMatch patterns, url, and optional versioned URL map.",
	}),
) {
	/**
	 * Assembles an entry from a catalog identity plus
	 * {@link SchemaVersioning.catalogUrls}' inputs: pass `versions` for the
	 * versioned mode (the `versions` map and latest-pointing `url` are
	 * derived), omit it for the unversioned mode.
	 */
	static assemble(options: {
		readonly name: string;
		readonly description: string;
		readonly fileMatch: ReadonlyArray<string>;
		readonly baseUrl: string;
		readonly fileBaseName?: string;
		readonly versions?: ReadonlyArray<SchemaVersion>;
	}): CatalogEntry {
		const urls: CatalogUrls = SchemaVersioning.catalogUrls({
			baseUrl: options.baseUrl,
			name: options.fileBaseName ?? options.name,
			...(options.versions !== undefined ? { versions: options.versions } : {}),
		});
		return CatalogEntry.make({
			name: options.name,
			description: options.description,
			fileMatch: options.fileMatch,
			url: urls.url,
			...(urls.versions !== undefined ? { versions: urls.versions } : {}),
		});
	}

	/**
	 * The fileMatch hygiene lint over this entry's patterns — pure shape
	 * analysis (no glob engine): generic patterns SchemaStore rejects and
	 * complex constructs it asks contributors to expand.
	 */
	lint(): ReadonlyArray<CatalogLintFinding> {
		return CatalogEntry.lintFileMatch(this.fileMatch);
	}

	/**
	 * {@link CatalogEntry.lint} over a bare pattern list, for callers
	 * checking patterns before an entry exists.
	 */
	static lintFileMatch(patterns: ReadonlyArray<string>): ReadonlyArray<CatalogLintFinding> {
		return patterns.flatMap(lintPattern);
	}
}
