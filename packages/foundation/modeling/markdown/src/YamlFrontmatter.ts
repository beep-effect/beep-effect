/**
 * The yaml frontmatter codec module over `@beep/yaml`.
 *
 * **Details**
 *
 * Importing this module is what loads the yaml engine; a consumer who
 * never touches yaml frontmatter never loads it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Yaml } from "@beep/yaml/Yaml";
import { YamlDocument } from "@beep/yaml/YamlDocument";
import * as A from "effect/Array";
import { flow } from "effect/Function";
import * as Match from "effect/Match";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FrontmatterCodec, FrontmatterKeyError } from "./Frontmatter.ts";
import type { YamlMap, YamlNode, YamlPair, YamlSeq } from "@beep/yaml/YamlNode";
import type { FrontmatterKeyIssue } from "./Frontmatter.ts";

const isSetTag = S.is(S.Literals(["!!set", "!<tag:yaml.org,2002:set>"]));

const decodeDocument = S.decodeResult(YamlDocument.schema());

type LatestAnchors = MutableHashMap.MutableHashMap<string, YamlNode>;

const keyError = (reason: FrontmatterKeyIssue, node: YamlNode): FrontmatterKeyError =>
  FrontmatterKeyError.make({ reason, offset: node.offset, length: node.length });

const isCollection = (node: YamlNode): node is YamlMap | YamlSeq => node._tag === "YamlMap" || node._tag === "YamlSeq";

const register = (anchors: LatestAnchors, node: YamlNode): void => {
  if (node._tag !== "YamlAlias" && node.anchor !== undefined) MutableHashMap.set(anchors, node.anchor, node);
};

const isComplexKey = (anchors: LatestAnchors, key: YamlNode): boolean =>
  key._tag === "YamlAlias" ? O.exists(MutableHashMap.get(anchors, key.name), isCollection) : isCollection(key);

const projectedKey = (anchors: LatestAnchors, key: YamlNode): string => String(key.toValue(anchors) ?? "");

const pairIssue = (
  anchors: LatestAnchors,
  seen: MutableHashSet.MutableHashSet<string>,
  pair: YamlPair
): O.Option<FrontmatterKeyError> => {
  if (isComplexKey(anchors, pair.key)) return O.some(keyError("ComplexKey", pair.key));
  const key = projectedKey(anchors, pair.key);
  if (MutableHashSet.has(seen, key)) return O.some(keyError("DuplicateKey", pair.key));
  MutableHashSet.add(seen, key);
  register(anchors, pair.key);
  return O.flatMap(O.fromNullOr(pair.value), (value) => firstKeyIssue(anchors, value));
};

const mapIssue = (anchors: LatestAnchors, map: YamlMap): O.Option<FrontmatterKeyError> => {
  const seen = MutableHashSet.empty<string>();
  return A.findFirst(map.items, (pair) => pairIssue(anchors, seen, pair));
};

const collectionIssue = (anchors: LatestAnchors, node: YamlMap | YamlSeq): O.Option<FrontmatterKeyError> =>
  node.tag !== undefined && isSetTag(node.tag)
    ? O.some(keyError("SetCollection", node))
    : node._tag === "YamlMap"
      ? mapIssue(anchors, node)
      : A.findFirst(node.items, (item) => firstKeyIssue(anchors, item));

const firstKeyIssue = (anchors: LatestAnchors, node: YamlNode): O.Option<FrontmatterKeyError> => {
  register(anchors, node);
  return Match.value(node).pipe(
    Match.tags({ YamlMap: (map) => collectionIssue(anchors, map), YamlSeq: (seq) => collectionIssue(anchors, seq) }),
    Match.orElse(() => O.none())
  );
};

const rejectNonJsonKeys = (text: string): Result.Result<void, S.SchemaError | FrontmatterKeyError> =>
  Result.flatMap(
    decodeDocument(text),
    flow(
      (document) => O.flatMap(O.fromNullOr(document.contents), (root) => firstKeyIssue(MutableHashMap.empty(), root)),
      O.match({ onNone: () => Result.void, onSome: Result.fail })
    )
  );

/**
 * The yaml frontmatter codec, over `@beep/yaml`.
 *
 * **Details**
 *
 * Decodes a `---`-fenced capture's raw value with `Yaml.parse`, so the yaml
 * engine's input hardening — the alias-expansion budget and the nesting depth
 * cap — fails through the typed channel: a hostile frontmatter block surfaces
 * as a {@link FrontmatterDecodeError} carrying the `YamlParseError`
 * structurally, never a defect. An empty capture decodes to `null`, yaml's
 * empty-document value.
 *
 * A frontmatter value is a JSON-compatible object, so yaml that has no
 * faithful JSON reading fails typed instead of being rewritten: a
 * collection mapping key (`? [a, b]`), an alias key whose anchor is a
 * collection, and a `!!set` collection each surface as a
 * {@link FrontmatterDecodeError} carrying a {@link FrontmatterKeyError}
 * (`"ComplexKey"` or `"SetCollection"`) at the offending node. Two keys of
 * one mapping that project to the same string key — `1` and `"1"`, `true`
 * and `"true"`, a null key and `""`, or an alias key and the key its anchor
 * names — fail as `"DuplicateKey"` at the second key, where the engine's own
 * typed duplicate check would let them merge last-wins. Scalar keys,
 * scalar alias keys and `<<` keys still decode; a `!!set` spelled through a
 * custom `%TAG` handle is not recognized. `Yaml.parse` itself keeps its
 * projection for its other consumers.
 *
 * Encodes with `Yaml.stringify`; an unserializable value fails as a
 * {@link FrontmatterEncodeError} carrying the `YamlStringifyError`
 * structurally. An empty object encodes to the flow mapping `{}` —
 * deliberately not an empty body, which would round-trip as `null` — so
 * `set`-then-decode recovers `{}` exactly.
 *
 * `@beep/yaml` is an optional peer — importing this module is what
 * requires it; a consumer who never touches yaml frontmatter never loads the
 * yaml engine.
 *
 * **Example** (Encode an empty frontmatter object)
 *
 * ```ts
 * import { YamlFrontmatter } from "@beep/markdown/YamlFrontmatter"
 * import * as Effect from "effect/Effect"
 *
 * const encoded = Effect.runSync(YamlFrontmatter.encode({}))
 * console.log(JSON.stringify(encoded)) // "{}\n"
 * ```
 *
 * @public
 * @category codecs
 * @since 0.0.0
 */
export const YamlFrontmatter: FrontmatterCodec = FrontmatterCodec.make(
  "yaml",
  (text) => Result.flatMap(Yaml.parseResult(text), (data) => Result.map(rejectNonJsonKeys(text), () => data)),
  (data) => Yaml.stringifyResult(data)
);
