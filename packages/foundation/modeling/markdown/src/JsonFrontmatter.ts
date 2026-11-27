/**
 * The json frontmatter codec module over `@beep/jsonc`.
 *
 * **Details**
 *
 * Importing this module is what loads the json engine; a consumer who
 * never touches json frontmatter never loads it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Jsonc } from "@beep/jsonc/Jsonc";
import * as A from "effect/Array";
import { flow } from "effect/Function";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import { FrontmatterCodec, FrontmatterKeyError } from "./Frontmatter.ts";
import type { JsoncParseError } from "@beep/jsonc/Jsonc";
import type { JsoncNode } from "@beep/jsonc/JsoncNode";

const childrenOf = (node: JsoncNode): ReadonlyArray<JsoncNode> => node.children ?? A.empty();

const firstDuplicateKey = (node: JsoncNode): O.Option<JsoncNode> =>
  node.type === "object" ? firstDuplicateInObject(childrenOf(node)) : A.findFirst(childrenOf(node), firstDuplicateKey);

const firstDuplicateInObject = (properties: ReadonlyArray<JsoncNode>): O.Option<JsoncNode> => {
  const seen = MutableHashSet.empty<unknown>();
  return A.findFirst(properties, (property) =>
    O.flatMap(A.head(childrenOf(property)), (key) => {
      if (MutableHashSet.has(seen, key.value)) return O.some(key);
      MutableHashSet.add(seen, key.value);
      return A.findFirst(A.drop(childrenOf(property), 1), firstDuplicateKey);
    })
  );
};

const duplicateKeyError = (key: JsoncNode): FrontmatterKeyError =>
  FrontmatterKeyError.make({ reason: "DuplicateKey", offset: key.offset, length: key.length });

const rejectDuplicateKeys = (text: string): Result.Result<void, JsoncParseError | FrontmatterKeyError> =>
  Result.flatMap(
    Jsonc.parseTreeResult(text),
    flow(
      O.flatMap(firstDuplicateKey),
      O.match({ onNone: () => Result.void, onSome: flow(duplicateKeyError, Result.fail) })
    )
  );

/**
 * The json frontmatter codec, over `@beep/jsonc`.
 *
 * **Details**
 *
 * Decodes a `---json`-fenced capture's raw value with `Jsonc.parse`, so the
 * jsonc engine's nesting depth cap fails through the typed channel: a hostile
 * frontmatter block surfaces as a {@link FrontmatterDecodeError} carrying the
 * `JsoncParseError` structurally, never a defect. JSONC being a JSON
 * superset, comments and trailing commas in a json capture decode rather than
 * fail — deliberate leniency, matching the kit's one JSON-family engine. An
 * empty capture fails typed: unlike yaml and toml, JSON has no
 * empty-document value.
 *
 * A duplicate key in any object fails typed, as it does for the yaml and
 * toml codecs, rather than resolving last-wins: the
 * {@link FrontmatterDecodeError} carries a {@link FrontmatterKeyError} with
 * reason `"DuplicateKey"` locating the repeated key. Keys compare by decoded
 * value, so `"b"` and `"\u0062"` collide. `Jsonc.parse` itself still
 * resolves duplicates last-wins for its other consumers.
 *
 * Encodes with `Jsonc.stringify` — plain 2-space JSON emission, never
 * comments; a circular reference, a `bigint` or a top-level unrepresentable
 * value fails as a {@link FrontmatterEncodeError} carrying the
 * `JsoncStringifyError` structurally. An empty object encodes to `{}`.
 *
 * `@beep/jsonc` is an optional peer — importing this module is what
 * requires it; a consumer who never touches json frontmatter never loads the
 * jsonc engine.
 *
 * **Example** (Decode a JSON capture and encode an empty object)
 *
 * ```ts
 * import { JsonFrontmatter } from "@beep/markdown/JsonFrontmatter";
 * import { Frontmatter } from "@beep/markdown/MarkdownNode";
 * import * as Effect from "effect/Effect";
 *
 * const node = Frontmatter.make({ format: "json", value: "{\"title\":\"Hi\"}" });
 * const data = Effect.runSync(JsonFrontmatter.decode(node));
 * console.log(JSON.stringify(data)); // {"title":"Hi"}
 * console.log(Effect.runSync(JsonFrontmatter.encode({}))); // {}
 * ```
 *
 * @public
 * @category codecs
 * @since 0.0.0
 */
export const JsonFrontmatter: FrontmatterCodec = FrontmatterCodec.make(
  "json",
  (text) => Result.flatMap(Jsonc.parseResult(text), (data) => Result.map(rejectDuplicateKeys(text), () => data)),
  (data) => Jsonc.stringifyResult(data)
);
