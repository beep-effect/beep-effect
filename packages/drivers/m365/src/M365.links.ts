/**
 * Outlook web links and raw item ids, decoded into Graph item references.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $M365Id } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaIssue from "effect/SchemaIssue";
import * as Str from "effect/String";
import { GraphPathSegment } from "./M365.service.ts";

const $I = $M365Id.create("M365.links");

/**
 * A Graph mail item named by a pasted Outlook link or id.
 *
 * **Details**
 *
 * Unless the input named the kind (`message:<id>` / `conversation:<id>`),
 * the tag is a hint taken from the id prefix: `AAQk` ids are conversation
 * ids, everything else is treated as a message id. A host should still fall
 * back to the other kind when Graph does not find the item. The id is in
 * Graph's REST alphabet (`-` and `_` instead of `/` and `+`).
 *
 * **Example** (A message reference)
 *
 * ```ts
 * import { OutlookItemRef } from "@beep/m365"
 *
 * const ref = OutlookItemRef.cases.message.make({ id: "AAMkAGI2" })
 * console.log(ref._tag) // "message"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OutlookItemRef = S.Union([
  S.TaggedStruct("message", {
    id: GraphPathSegment.annotateKey({ description: "Graph message id (REST alphabet)." }),
  }),
  S.TaggedStruct("conversation", {
    id: GraphPathSegment.annotateKey({ description: "Graph conversation id (REST alphabet)." }),
  }),
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("OutlookItemRef", {
    description: "A Graph message or conversation id decoded from a pasted Outlook link or raw id.",
  })
);

/**
 * Type for {@link OutlookItemRef}.
 *
 * **Example** (Type a reference)
 *
 * ```ts
 * import { OutlookItemRef } from "@beep/m365"
 * import type { OutlookItemRef as Ref } from "@beep/m365"
 *
 * const ref: Ref = OutlookItemRef.cases.conversation.make({ id: "AAQkAGI2" })
 * console.log(ref.id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OutlookItemRef = typeof OutlookItemRef.Type;

const OUTLOOK_HOSTS = HashSet.make("outlook.cloud.microsoft", "outlook.office.com", "outlook.office365.com");
const CONVERSATION_PREFIX = "AAQk";
const ITEM_ID_QUERY_KEY = "itemid=";
const REST_ID_PATTERN = /^[A-Za-z0-9_=-]+$/;
const KIND_SEPARATOR = ":";
const TAGGED_INPUT_PATTERN = /^([a-z]+):(.*)$/s;

const OutlookItemKind = LiteralKit(["message", "conversation"]);
type OutlookItemKind = typeof OutlookItemKind.Type;

const issue = (message: string) => new SchemaIssue.InvalidValue({ message });

const percentDecode = (raw: string): Result.Result<string, SchemaIssue.Issue> =>
  Result.try({
    try: () => decodeURIComponent(raw),
    catch: () => issue("The item id is not valid percent-encoding."),
  });

// Exchange's EWS ids use standard base64; Graph's REST ids swap `/` for `-` and `+` for `_`.
const toRestAlphabet = flow(Str.replaceAll("/", "-"), Str.replaceAll("+", "_"));

const pathItemId = (url: URL): O.Option<string> => {
  const segments = Str.split("/")(url.pathname);
  return pipe(
    A.findLastIndex(segments, (segment) => segment === "id"),
    O.flatMap((index) => A.get(segments, index + 1)),
    O.filter(Str.isNonEmpty)
  );
};

// Read `ItemID` raw so a literal `+` is not turned into a space by form decoding.
const queryItemId = (url: URL): O.Option<string> =>
  pipe(
    Str.split("&")(Str.slice(1)(url.search)),
    A.findFirst((pair) => Str.startsWith(ITEM_ID_QUERY_KEY)(Str.toLowerCase(pair))),
    O.map(Str.slice(ITEM_ID_QUERY_KEY.length)),
    O.filter(Str.isNonEmpty)
  );

const linkItemId = (url: URL): Result.Result<string, SchemaIssue.Issue> =>
  HashSet.has(OUTLOOK_HOSTS, Str.toLowerCase(url.hostname))
    ? pipe(
        pathItemId(url),
        O.orElse(() => queryItemId(url)),
        O.match({
          onNone: () => Result.fail(issue("The Outlook link carries no item id.")),
          onSome: percentDecode,
        })
      )
    : Result.fail(issue(`"${url.hostname}" is not an Outlook web host.`));

const parseLink = (input: string): O.Option<URL> =>
  /^https?:\/\//i.test(input) ? Result.getSuccess(Result.try(() => new URL(input))) : O.none();

const rawItemId = (input: string): Result.Result<string, SchemaIssue.Issue> =>
  Str.includes("%")(input) ? percentDecode(input) : Result.succeed(input);

// `message:<id>` / `conversation:<id>` names the kind outright; ids never contain `:`, so the form is unambiguous.
const explicitKind = (input: string): O.Option<readonly [OutlookItemKind, string]> =>
  pipe(
    Str.match(TAGGED_INPUT_PATTERN)(input),
    O.flatMap((found) => {
      const kind = found[1];
      return S.is(OutlookItemKind)(kind) ? O.some([kind, Str.slice(kind.length + 1)(input)] as const) : O.none();
    })
  );

const hintedKind = (id: string): OutlookItemKind =>
  Str.startsWith(CONVERSATION_PREFIX)(id) ? "conversation" : "message";

const classify =
  (kind: O.Option<OutlookItemKind>) =>
  (id: string): Result.Result<OutlookItemRef, SchemaIssue.Issue> =>
    REST_ID_PATTERN.test(id) && S.is(GraphPathSegment)(id)
      ? Result.succeed(OutlookItemRef.cases[O.getOrElse(kind, () => hintedKind(id))].make({ id }))
      : Result.fail(issue("Expected an Outlook web link or a Graph message or conversation id."));

const decodeInput = (input: string): Effect.Effect<OutlookItemRef, SchemaIssue.Issue> => {
  const trimmed = Str.trim(input);
  const explicit = explicitKind(trimmed);
  const raw = O.match(explicit, {
    onNone: () => pipe(parseLink(trimmed), O.match({ onNone: () => rawItemId(trimmed), onSome: linkItemId })),
    onSome: ([, id]) => rawItemId(Str.trim(id)),
  });
  return Effect.fromResult(
    pipe(raw, Result.map(toRestAlphabet), Result.flatMap(classify(O.map(explicit, ([kind]) => kind))))
  );
};

/**
 * Decode a pasted Outlook web link or raw id into an {@link OutlookItemRef}.
 *
 * **Details**
 *
 * Accepts `https://outlook.cloud.microsoft/mail/.../id/<id>` and the
 * `outlook.office.com` / `outlook.office365.com` forms, including the classic
 * `?ItemID=<id>` query, a bare id, and the tagged `message:<id>` /
 * `conversation:<id>` form that names the kind instead of taking it from the
 * id prefix. The id is percent-decoded and mapped to Graph's REST alphabet.
 * Encoding returns the tagged form, so decoding an encoded reference gives
 * the reference back, whatever its id looks like.
 *
 * **Example** (Decode a conversation link)
 *
 * ```ts
 * import { OutlookItemRefFromInput } from "@beep/m365"
 * import * as S from "effect/Schema"
 *
 * const ref = S.decodeUnknownSync(OutlookItemRefFromInput)(
 *   "https://outlook.cloud.microsoft/mail/inbox/id/AAQkAGI2%2FAb%2Bc%3D"
 * )
 * console.log(ref._tag, ref.id) // "conversation" "AAQkAGI2-Ab_c="
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OutlookItemRefFromInput = S.String.pipe(
  S.decodeTo(OutlookItemRef, {
    decode: SchemaGetter.transformEffect(decodeInput),
    encode: SchemaGetter.transform((ref: OutlookItemRef) => `${ref._tag}${KIND_SEPARATOR}${ref.id}`),
  }),
  $I.annoteSchema("OutlookItemRefFromInput", {
    description: "Codec from a pasted Outlook web link or raw id to a Graph message or conversation reference.",
  })
);

/**
 * Type for {@link OutlookItemRefFromInput}.
 *
 * **Example** (Annotate a decoded Outlook item reference)
 *
 * ```ts
 * import type { OutlookItemRefFromInput } from "@beep/m365"
 *
 * const value: OutlookItemRefFromInput | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OutlookItemRefFromInput = typeof OutlookItemRefFromInput.Type;
