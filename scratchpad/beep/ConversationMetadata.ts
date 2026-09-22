/**
 * Keyword lists stored beside a conversation for vector metadata.
 *
 * **Details**
 *
 * A Conversation is the persisted session record upstream of memory. These
 * lists are session metadata, not a memory layer.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as S from "effect/Schema";
import { isRecord, jsonList, Model } from "./Port.ts";

const $I = $ScratchpadId.create("beep/ConversationMetadata");

/**
 * Field names shared by {@link ConversationMetadata} and vector metadata maps.
 *
 * **Example** (Read the people key)
 *
 * ```ts
 * import { ConversationMetadataKeys } from "./ConversationMetadata.ts"
 *
 * console.log(ConversationMetadataKeys.people) // "people"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ConversationMetadataKeys: {
  readonly people: "people";
  readonly topics: "topics";
  readonly entities: "entities";
  readonly dates: "dates";
} = {
  people: "people",
  topics: "topics",
  entities: "entities",
  dates: "dates",
};

/**
 * People, topics, entities, and dates extracted from a conversation.
 *
 * **Details**
 *
 * Dates stay strings. They are not datetimes. Unknown keys are ignored, matching
 * the pydantic default.
 *
 * **Example** (Construct empty lists)
 *
 * ```ts
 * import { ConversationMetadata } from "./ConversationMetadata.ts"
 *
 * console.log(ConversationMetadata.make({}).topics.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConversationMetadata extends Model<ConversationMetadata>("ConversationMetadata")(
  {
    people: jsonList(S.String, "people"),
    topics: jsonList(S.String, "topics"),
    entities: jsonList(S.String, "entities"),
    dates: jsonList(S.String, "dates"),
  },
  $I.annote("ConversationMetadata", {
    description: "Keyword lists attached to a conversation for vector metadata. Dates are strings.",
  }),
) {}

/**
 * Encoded form of {@link ConversationMetadata}.
 *
 * @see {@link ConversationMetadata} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConversationMetadata {
  export type Encoded = S.Codec.Encoded<typeof ConversationMetadata>;
}

/**
 * Copies the four keyword lists into a string-keyed map.
 *
 * **Example** (Read topics back out)
 *
 * ```ts
 * import { ConversationMetadata, toVectorMetadata } from "./ConversationMetadata.ts"
 *
 * const metadata = toVectorMetadata(ConversationMetadata.make({ topics: ["shipping"] }))
 * console.log(metadata.topics[0]) // "shipping"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const toVectorMetadata = (
  metadata: ConversationMetadata,
): {
  readonly people: ReadonlyArray<string>;
  readonly topics: ReadonlyArray<string>;
  readonly entities: ReadonlyArray<string>;
  readonly dates: ReadonlyArray<string>;
} => ({
  people: metadata.people,
  topics: metadata.topics,
  entities: metadata.entities,
  dates: metadata.dates,
});

const stringsFromList = (value: ReadonlyArray<unknown>): ReadonlyArray<string> => {
  const result: Array<string> = [];
  for (const item of value) result.push(typeof item === "string" ? item : globalThis.String(item));
  return result;
};

/**
 * Reads one metadata list, stringifying tuple entries and ignoring other shapes.
 *
 * **Details**
 *
 * Python returns a list unchanged and stringifies a tuple. JSON has only arrays,
 * so an array is returned with non-strings stringified. A missing key, a
 * non-list, and a non-tuple become `[]`.
 *
 * **Gotchas**
 *
 * Python's list arm casts without checking elements. This port stringifies
 * non-strings so the result really is a list of strings.
 *
 * **Example** (Read topics and ignore a string)
 *
 * ```ts
 * import { metadataList } from "./ConversationMetadata.ts"
 *
 * console.log(metadataList({ topics: ["shipping"] }, "topics").length) // 1
 * console.log(metadataList({ topics: "shipping" }, "topics").length) // 0
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Metadata and key are co-primary inputs, and neither is a pipeable value.
export const metadataList = (metadata: unknown, key: string): ReadonlyArray<string> => {
  if (!isRecord(metadata) || !Object.hasOwn(metadata, key)) return [];
  const value = metadata[key];
  if (Array.isArray(value)) return stringsFromList(value);
  return [];
};
