/**
 * Structural and hygiene checks over an assembled {@link StoreDocument}.
 *
 * **Details**
 *
 * This is the engine-free half of validation: `$ref` resolution against
 * `$defs`, unknown-keyword detection, and SchemaStore's description-URL
 * convention. A real-engine gate stays at {@link SchemaValidator}.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { HashSet, Schema } from "effect";
import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import { MAX_NESTING_DEPTH } from "./internal/limits.ts";
import { KeywordFamilies } from "./KeywordFamilies.ts";
import type { StoreDocument } from "./StoreDocument.ts";

const $I = $ScratchpadId.create("schemastore/DocumentLint");

/**
 * A structural lint finding over an assembled document: a value in a
 * report, never an error channel — a document with findings is still a
 * document, and the consumer decides what a finding gates.
 *
 * **Example** (Construct an advisory finding)
 *
 * ```ts
 * import { DocumentLintFinding } from "@beep/scratchpad/schemastore"
 *
 * const finding = DocumentLintFinding.make({
 *   check: "DescriptionWithoutUrl",
 *   severity: "advisory",
 *   path: "/description",
 *   message: "SchemaStore's description convention ends with a documentation URL",
 * })
 *
 * console.log(finding.check)
 * // => "DescriptionWithoutUrl"
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class DocumentLintFinding extends Schema.Class<DocumentLintFinding>($I`DocumentLintFinding`)(
  {
    /** Which check fired. */
    check: Schema.Literals(["UnresolvedRef", "UnknownKeyword", "DescriptionWithoutUrl", "DepthExceeded"]),
    /** `"warning"` for structural defects, `"advisory"` for best practices. */
    severity: Schema.Literals(["warning", "advisory"]),
    /** JSON pointer into the flat document (`""` is the root schema). */
    path: Schema.String,
    /** Human-readable explanation. */
    message: Schema.String,
  },
  $I.annote("DocumentLintFinding", {
    description: "A structural or hygiene lint finding over a StoreDocument: a report value, never an error channel.",
  })
) {}

// Draft-07 keywords, plus `$defs` (the Draft-07-valid alias the SchemaStore
// document shape keeps its pool under).
const DRAFT_07_KEYWORDS = HashSet.make(
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
  "writeOnly"
);

const SCHEMA_MAP_KEYWORDS = HashSet.make("properties", "patternProperties", "$defs", "definitions");
const SCHEMA_VALUE_KEYWORDS = HashSet.make(
  "additionalItems",
  "additionalProperties",
  "propertyNames",
  "contains",
  "if",
  "then",
  "else",
  "not"
);
const SCHEMA_ARRAY_KEYWORDS = HashSet.make("allOf", "anyOf", "oneOf");

const URL_LINE = /^https?:\/\/\S+$/;

const escapePointerSegment = (segment: string): string => segment.replace(/~/g, "~0").replace(/\//g, "~1");

const unescapePointerSegment = (segment: string): string => segment.replace(/~1/g, "/").replace(/~0/g, "~");

interface LintContext {
  readonly defs: Readonly<Record<string, unknown>>;
  readonly findings: Array<DocumentLintFinding>;
}

const isSchemaObject = (node: unknown): node is Record<string, unknown> => P.isObjectKeyword(node) && !A.isArray(node);

const checkRef = (value: unknown, path: string, context: LintContext): void => {
  if (!P.isString(value)) {
    return;
  }
  if (value === "#") {
    return;
  }
  const match = /^#\/\$defs\/([^/]+)/.exec(value);
  if (match !== null && R.has(context.defs, unescapePointerSegment(match[1] as string))) {
    return;
  }
  context.findings.push(
    DocumentLintFinding.make({
      check: "UnresolvedRef",
      severity: "warning",
      path,
      message: `$ref "${value}" does not resolve against the document's $defs pool`,
    })
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
      })
    );
    return;
  }
  for (const [key, value] of R.toEntries(node)) {
    const keyPath = `${path}/${escapePointerSegment(key)}`;
    if (!HashSet.has(DRAFT_07_KEYWORDS, key) && !KeywordFamilies.isDeclared(key)) {
      context.findings.push(
        DocumentLintFinding.make({
          check: "UnknownKeyword",
          severity: "warning",
          path: keyPath,
          message: `"${key}" is not a Draft-07 keyword or a declared non-standard family (x-taplo*, x-tombi-*, x-intellij-*, vscode); ajv strict mode rejects it`,
        })
      );
      continue;
    }
    if (key === "$ref") {
      checkRef(value, keyPath, context);
    } else if (HashSet.has(SCHEMA_MAP_KEYWORDS, key)) {
      if (isSchemaObject(value)) {
        for (const [name, subschema] of R.toEntries(value)) {
          lintSchema(subschema, `${keyPath}/${escapePointerSegment(name)}`, depth + 1, context);
        }
      }
    } else if (key === "dependencies") {
      // Values are either schemas or arrays of property names.
      if (isSchemaObject(value)) {
        for (const [name, dependency] of R.toEntries(value)) {
          if (!A.isArray(dependency)) {
            lintSchema(dependency, `${keyPath}/${escapePointerSegment(name)}`, depth + 1, context);
          }
        }
      }
    } else if (key === "items") {
      if (A.isArray(value)) {
        value.forEach((subschema, index) => {
          lintSchema(subschema, `${keyPath}/${index}`, depth + 1, context);
        });
      } else {
        lintSchema(value, keyPath, depth + 1, context);
      }
    } else if (HashSet.has(SCHEMA_VALUE_KEYWORDS, key)) {
      lintSchema(value, keyPath, depth + 1, context);
    } else if (HashSet.has(SCHEMA_ARRAY_KEYWORDS, key)) {
      if (A.isArray(value)) {
        value.forEach((subschema, index) => {
          lintSchema(subschema, `${keyPath}/${index}`, depth + 1, context);
        });
      }
    }
  }
};

/**
 * Owned structural checks over an assembled {@link StoreDocument} — the
 * always-available half of the validation story (a real-engine gate like
 * ajv strict mode stays at the consumer's edge):
 *
 * **Details**
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
 * **Gotchas**
 *
 * Findings are never an error channel — a document with findings is still a
 * document. Hostile nesting becomes `DepthExceeded` rather than a throw. A
 * surviving `#/definitions/...` `$ref` is `UnresolvedRef` because the
 * publication pool is `$defs`. Boolean schemas are legal leaves.
 * `DescriptionWithoutUrl` is advisory, not a warning.
 *
 * **Example** (Lint a document whose description has no docs URL)
 *
 * ```ts
 * import { DocumentLint, StoreDocument } from "@beep/scratchpad/schemastore"
 *
 * const document = StoreDocument.draft07({
 *   $id: "https://example.com/config.schema.json",
 *   root: { type: "object", description: "Build configuration" },
 * })
 * const findings = DocumentLint.lint(document)
 *
 * console.log(findings.map((finding) => finding.check))
 * // => ["DescriptionWithoutUrl"]
 * ```
 *
 * @see {@link SchemaValidator} for the real-engine half of the validation story.
 * @see {@link KeywordFamilies.isDeclared} for the admission predicate `UnknownKeyword` consults.
 * @see {@link StoreDocument} for the assembled document this lint walks.
 * @public
 * @category diagnostics
 * @since 0.0.0
 */
export class DocumentLint {
  private constructor() {}

  /**
   * Runs every check; total — hostile nesting degrades to a
   * `DepthExceeded` finding rather than an error.
   *
   * **Example** (Advisory when the description has no docs URL)
   *
   * ```ts
   * import { DocumentLint, StoreDocument } from "@beep/scratchpad/schemastore"
   *
   * const findings = DocumentLint.lint(
   *   StoreDocument.draft07({
   *     $id: "https://example.com/config.schema.json",
   *     root: { type: "object", description: "Build configuration" },
   *   }),
   * )
   * console.log(findings.map((finding) => finding.check))
   * // => ["DescriptionWithoutUrl"]
   * ```
   *
   * @since 0.0.0
   */
  static lint(document: StoreDocument): ReadonlyArray<DocumentLintFinding> {
    const context: LintContext = { defs: document.defs, findings: [] };
    lintSchema(document.root, "", 0, context);
    for (const [name, definition] of R.toEntries(document.defs)) {
      lintSchema(definition, `/$defs/${escapePointerSegment(name)}`, 1, context);
    }
    const description = document.root.description;
    if (P.isString(description)) {
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
          })
        );
      }
    }
    return context.findings;
  }
}
