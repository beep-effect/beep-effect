import { Jsonc } from "../jsonc/index.ts";
import { Effect } from "effect";
import type { FrontmatterCodec } from "./Frontmatter.ts";
import { FrontmatterDecodeError, FrontmatterEncodeError, FrontmatterFormatMismatchError } from "./Frontmatter.ts";

/**
 * The json frontmatter codec, over `@effected/jsonc`.
 *
 * @remarks
 * Decodes a `---json`-fenced capture's raw value with `Jsonc.parse`, so the
 * jsonc engine's nesting depth cap fails through the typed channel: a hostile
 * frontmatter block surfaces as a {@link FrontmatterDecodeError} carrying the
 * `JsoncParseError` structurally, never a defect. JSONC being a JSON
 * superset, comments and trailing commas in a json capture decode rather than
 * fail — deliberate leniency, matching the kit's one JSON-family engine. An
 * empty capture fails typed: unlike yaml and toml, JSON has no
 * empty-document value.
 *
 * Encodes with `Jsonc.stringify` — plain 2-space JSON emission, never
 * comments; a circular reference, a `bigint` or a top-level unrepresentable
 * value fails as a {@link FrontmatterEncodeError} carrying the
 * `JsoncStringifyError` structurally. An empty object encodes to `{}`.
 *
 * `@effected/jsonc` is an optional peer — importing this module is what
 * requires it; a consumer who never touches json frontmatter never loads the
 * jsonc engine.
 *
 * @public
 */
export const JsonFrontmatter: FrontmatterCodec = {
	format: "json",
	decode: (node) =>
		node.format !== "json"
			? Effect.fail(FrontmatterFormatMismatchError.make({ expected: "json", actual: node.format }))
			: Jsonc.parse(node.value).pipe(Effect.mapError((cause) => FrontmatterDecodeError.make({ format: "json", cause }))),
	encode: (data) =>
		Jsonc.stringify(data).pipe(Effect.mapError((cause) => FrontmatterEncodeError.make({ format: "json", cause }))),
};
