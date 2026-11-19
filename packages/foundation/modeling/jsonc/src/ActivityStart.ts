/**
 * The facts of a `prov:Activity` run known when it starts, and the
 * `activity/v1` preimage that mints its {@link ActivityId} from exactly those
 * facts.
 *
 * **Details**
 *
 * What the run generated and when it ended stay outside the id, so the run's
 * outputs can name the activity that produced them (decision
 * `2026-11-19-p0-activity-id-minted-at-start` of the text-knowledge stack
 * rebuild).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { IRI } from "@beep/identity/Iri";
import { $JsoncId } from "@beep/identity/packages";
import { CanonicalHashSet } from "@beep/schema/CanonicalHashSet";
import { ActivityId, ContentHash, DomainTag } from "@beep/schema/ContentHash";
import { Sha256PrefixedDigest } from "@beep/schema/Sha256";
import { WellFormedText } from "@beep/schema/WellFormedText";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { definePreimage } from "./Mint.ts";
import type * as Digest from "effect/crypto/Digest";
import type { JsoncDigest } from "./JsoncFingerprint.ts";
import type { PreimageMintError } from "./Mint.ts";

const $I = $JsoncId.create("ActivityStart");

/**
 * The agent or engine a run was associated with: a model and its version, or
 * an engine and its edition.
 *
 * **Example** (Pin a model run)
 *
 * ```ts
 * import { ActivityPin } from "@beep/jsonc/ActivityStart"
 *
 * const pin = ActivityPin.cases.Model.make({ model: "claude-opus-5-5", version: "2026-11-01" })
 *
 * console.log(pin._tag) // "Model"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ActivityPin = S.TaggedUnion({
  Engine: { engine: WellFormedText, edition: WellFormedText },
  Model: { model: WellFormedText, version: WellFormedText },
}).pipe(
  $I.annoteSchema("ActivityPin", {
    description: "The model pin or engine edition an activity run was associated with.",
  })
);

/**
 * Decoded type of {@link ActivityPin}.
 *
 * @category models
 * @since 0.0.0
 */
export type ActivityPin = typeof ActivityPin.Type;

/**
 * The fields of an activity known when it starts. An activity record that
 * carries more, such as its outputs and end time, spreads these fields so the
 * id hashes exactly the same facts.
 *
 * **Example** (Extend the start fields)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ActivityStartFields } from "@beep/jsonc/ActivityStart"
 *
 * const Activity = S.Struct({ ...ActivityStartFields, ended: S.DateTimeUtcFromMillis })
 *
 * console.log(Object.keys(Activity.fields).length) // 6
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ActivityStartFields = {
  operation: IRI.annotateKey({ description: "The IRI of the registry term naming the operation." }),
  pin: ActivityPin,
  promptDigest: Sha256PrefixedDigest.pipe(
    S.annotateKey({ description: "Digest of the prompt, when the run is a model call." }),
    S.OptionFromOptionalKey
  ),
  used: CanonicalHashSet(ContentHash).annotateKey({ description: "Entities the run read." }),
  started: S.DateTimeUtcFromMillis.annotateKey({ description: "When the run started, in epoch milliseconds." }),
};

/**
 * What is known when one activity run starts.
 *
 * **Example** (Record a run start)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 * import { IRI } from "@beep/identity/Iri"
 * import { ActivityPin, ActivityStart } from "@beep/jsonc/ActivityStart"
 *
 * const start = ActivityStart.make({
 *   operation: IRI.make("https://beep-effect.com/ns/ops/extract"),
 *   pin: ActivityPin.cases.Engine.make({ engine: "langextract", edition: "1.0.0" }),
 *   promptDigest: O.none(),
 *   used: HashSet.empty(),
 *   started: DateTime.makeUnsafe(0),
 * })
 *
 * console.log(start.pin._tag) // "Engine"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ActivityStart extends S.Opaque<ActivityStart, { readonly brand: unique symbol }>()(
  S.Struct(ActivityStartFields).pipe(
    $I.annoteSchema("ActivityStart", { description: "The start-time facts of one activity run." })
  )
) {}

/**
 * The start-time fields of any record that carries them: an
 * {@link ActivityStart}, or an activity record that spreads
 * {@link ActivityStartFields}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ActivityStartView = S.Struct.Type<typeof ActivityStartFields>;

/**
 * The `activity/v1` preimage after the domain tag: operation, pin, prompt
 * digest or `null`, the used ids in ascending order, and the start time in
 * epoch milliseconds.
 *
 * **Details**
 *
 * The committed golden pins the bytes. Changing an element, its encoding or
 * the order bumps the tag to `activity/v2`.
 *
 * **Example** (Read the domain tag)
 *
 * ```ts
 * import { ActivityPreimage } from "@beep/jsonc/ActivityStart"
 *
 * console.log(ActivityPreimage.domainTag) // "activity/v1"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const ActivityPreimage = definePreimage({
  domainTag: DomainTag.make("activity/v1"),
  schema: S.Tuple([
    IRI,
    ActivityPin,
    S.OptionFromNullOr(Sha256PrefixedDigest),
    CanonicalHashSet(ContentHash),
    S.DateTimeUtcFromMillis,
  ]),
  golden: {
    preimage: [
      "https://beep-effect.com/ns/ops/extract",
      { _tag: "Model", model: "claude-opus-5-5", version: "2026-11-01" },
      "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      [
        "sha256:2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
        "sha256:fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9",
      ],
      1_763_510_400_000,
    ],
    hash: ContentHash.make("sha256:f6571ee38ca8346f37be976229c20f0c6b032fa9f2fa1f7bbc6f997582c07918"),
  },
});

const toPreimage = (start: ActivityStartView): typeof ActivityPreimage.schema.Type => [
  start.operation,
  start.pin,
  start.promptDigest,
  start.used,
  start.started,
];

/**
 * Mint the id of a native activity run from its start-time facts.
 *
 * **Example** (Mint an activity id)
 *
 * ```ts
 * import * as Digest from "effect/crypto/Digest"
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 * import { IRI } from "@beep/identity/Iri"
 * import { ActivityPin, ActivityStart, mintActivityId } from "@beep/jsonc/ActivityStart"
 *
 * const start = ActivityStart.make({
 *   operation: IRI.make("https://beep-effect.com/ns/ops/extract"),
 *   pin: ActivityPin.cases.Engine.make({ engine: "langextract", edition: "1.0.0" }),
 *   promptDigest: O.none(),
 *   used: HashSet.empty(),
 *   started: DateTime.makeUnsafe(0),
 * })
 *
 * Effect.runPromise(mintActivityId(start).pipe(Effect.provide(Digest.layerWebCrypto))).then(console.log)
 * ```
 *
 * @param start - The start-time facts.
 * @category constructors
 * @since 0.0.0
 */
export const mintActivityId = Effect.fn("ActivityStart.mintActivityId")(function* (
  start: ActivityStartView
): Effect.fn.Return<ActivityId, PreimageMintError, Digest.Digest> {
  const hash = yield* ActivityPreimage.mint(toPreimage(start));
  return ActivityId.make(hash);
});

/**
 * {@link mintActivityId} over a caller-supplied synchronous SHA-256.
 *
 * **Example** (Mint an activity id synchronously)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 * import * as Result from "effect/Result"
 * import { IRI } from "@beep/identity/Iri"
 * import { ActivityPin, ActivityStart, mintActivityIdResult } from "@beep/jsonc/ActivityStart"
 *
 * const start = ActivityStart.make({
 *   operation: IRI.make("https://beep-effect.com/ns/ops/extract"),
 *   pin: ActivityPin.cases.Engine.make({ engine: "langextract", edition: "1.0.0" }),
 *   promptDigest: O.none(),
 *   used: HashSet.empty(),
 *   started: DateTime.makeUnsafe(0),
 * })
 * const digest = (bytes: Uint8Array): Uint8Array => new Uint8Array(32).fill(bytes.length)
 *
 * console.log(Result.isSuccess(mintActivityIdResult(digest)(start))) // true
 * ```
 *
 * @param digest - The consumer's SHA-256 implementation.
 * @returns A minting function over that digest.
 * @category constructors
 * @since 0.0.0
 */
export const mintActivityIdResult =
  (digest: JsoncDigest) =>
  (start: ActivityStartView): Result.Result<ActivityId, PreimageMintError> =>
    Result.map(ActivityPreimage.mintResult(digest)(toPreimage(start)), ActivityId.make);
