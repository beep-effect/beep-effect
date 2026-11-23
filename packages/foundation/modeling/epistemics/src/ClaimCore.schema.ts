/**
 * Immutable claim ingredients with caller-owned proposition and identifier codecs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicsId } from "@beep/identity/packages";
import { ActivityPin } from "@beep/jsonc/ActivityStart";
import { CanonicalHashSet } from "@beep/schema/CanonicalHashSet";
import { ActivityId, ContentHash } from "@beep/schema/ContentHash";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { OccurrenceId } from "@beep/text/Occurrence";
import * as S from "effect/Schema";
import { ValidTime } from "./Claim/index.ts";
import type { FieldSchema, IdCodec, SchemaIdentity } from "./Factory/index.ts";

const $I = $EpistemicsId.create("ClaimCore.schema");

/**
 * The content address of an immutable claim core.
 *
 * **Example** (Check a content address)
 *
 * ```ts
 * import { ClaimId } from "@beep/epistemics/ClaimCore.schema"
 * import * as S from "effect/Schema"
 * console.log(S.is(ClaimId)("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"))
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ClaimId = ContentHash.pipe(
  S.brand("ClaimId"),
  $I.annoteSchema("ClaimId", {
    description: "The claim/v1 content address of the whole canonical encoded core.",
  })
);

/**
 * Decoded content address.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type ClaimId = typeof ClaimId.Type;

/**
 * Stance selected from separate events, never stored in an immutable core.
 *
 * **Example** (List stances)
 *
 * ```ts
 * import { Stance } from "@beep/epistemics/ClaimCore.schema"
 * console.log(Stance.literals)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Stance = LiteralKit(["verbatim", "proposed", "admitted"]).pipe(
  $I.annoteSchema("Stance", {
    description: "Verbatim and proposed events, or admitted through verified admission.",
  })
);

/**
 * Decoded selected stance.
 *
 * @category models
 * @since 0.0.0
 */
export type Stance = typeof Stance.Type;

/**
 * The three argumentation attack kinds; attacks may cycle.
 *
 * **Example** (Identify a rebuttal)
 *
 * ```ts
 * import { ChallengeKind } from "@beep/epistemics/ClaimCore.schema"
 * console.log(ChallengeKind.is.rebut("rebut"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ChallengeKind = LiteralKit(["rebut", "undercut", "undermine"]).pipe(
  $I.annoteSchema("ChallengeKind", {
    description: "Attack on a conclusion, inference or premise.",
  })
);

/**
 * Decoded attack kind.
 *
 * @category models
 * @since 0.0.0
 */
export type ChallengeKind = typeof ChallengeKind.Type;

/**
 * Bind immutable cores and separate claim-local events to an owner's codecs.
 *
 * **Details**
 * The returned structs are ingredients. Concrete bindings wrap their data records
 * in their own uniquely branded Opaque classes. Identity and provenance have no defaults.
 *
 * **Example** (Bind a claim vocabulary)
 *
 * ```ts
 * import { makeClaimCore } from "@beep/epistemics/ClaimCore.schema"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 * const Claims = makeClaimCore({
 *   $I: $ScratchpadId.create("Claims"), proposition: S.NonEmptyString,
 *   ids: { logicalKey: (text) => text, scope: S.NonEmptyString,
 *     principal: S.NonEmptyString, action: S.NonEmptyString, revision: S.NonEmptyString },
 * })
 * console.log(Claims.ClaimCore.fields.logicalKey)
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const makeClaimCore = <
  P extends FieldSchema<unknown, unknown>,
  Scope extends IdCodec & FieldSchema<string | number, unknown>,
  Principal extends IdCodec & FieldSchema<string | number, unknown>,
  Action extends IdCodec & FieldSchema<string | number, unknown>,
  Revision extends IdCodec & FieldSchema<string | number, unknown>,
>(options: {
  readonly $I: SchemaIdentity;
  readonly proposition: P;
  readonly ids: {
    readonly logicalKey: (proposition: P["Type"]) => string;
    readonly scope: Scope;
    readonly principal: Principal;
    readonly action: Action;
    readonly revision: Revision;
  };
}) => {
  const { $I, ids } = options;
  const proposition: FieldSchema<P["Type"], P["Encoded"]> = options.proposition;
  const scope: FieldSchema<Scope["Type"], Scope["Encoded"]> = ids.scope;
  const principal: FieldSchema<Principal["Type"], Principal["Encoded"]> = ids.principal;
  const AgentRef = S.TaggedUnion({
    Person: { principal },
    Organization: { organization: principal },
    SoftwareAgent: { name: S.NonEmptyString, pin: ActivityPin },
  }).pipe($I.annoteSchema("AgentRef", { description: "The explicit asserting agent and its attribution." }));
  const CoreFields = S.Struct({
    proposition,
    logicalKey: S.NonEmptyString,
    supportAtCreation: CanonicalHashSet(OccurrenceId),
    derivedFrom: CanonicalHashSet(ClaimId),
    supersedes: S.OptionFromOptionalKey(ClaimId),
    generatedBy: ActivityId,
    assertedBy: AgentRef,
    valid: ValidTime,
    knowledgeStart: S.DateTimeUtcFromMillis,
    scope,
  }).pipe($I.annoteSchema("ClaimCore", { description: "Creation facts only; all fields participate in claim/v1." }));
  const ClaimCore = CoreFields.check(
    S.makeFilter(
      (core: typeof CoreFields.Type) => core.logicalKey === ids.logicalKey(core.proposition),
      $I.annote("ClaimCoreLogicalKey", {
        title: "Claim logical key",
        description: "The owner key function agrees with the proposition.",
      })
    )
  );
  const { ClaimRecord, ProposedClaimRecord } = makeClaimRecords({ $I, core: ClaimCore });
  const Challenge = S.TaggedUnion({
    ByPerson: { from: ClaimId, to: ClaimId, kind: ChallengeKind, actor: principal, at: S.DateTimeUtcFromMillis },
    ByActivity: { from: ClaimId, to: ClaimId, kind: ChallengeKind, generatedBy: ActivityId },
  }).pipe($I.annoteSchema("Challenge", { description: "Separate claim attack events; cycles are permitted." }));
  const Retraction = S.Struct({
    claim: ClaimId,
    actor: principal,
    reason: S.NonEmptyString,
    at: S.DateTimeUtcFromMillis,
  }).pipe(
    $I.annoteSchema("Retraction", {
      description: "An explicit direct retraction; the immutable claim remains unchanged.",
    })
  );
  const StanceRecord = S.TaggedUnion({
    Verbatim: { claim: ClaimId, stance: S.tag("verbatim"), generatedBy: ActivityId, at: S.DateTimeUtcFromMillis },
    Proposed: { claim: ClaimId, stance: S.tag("proposed"), generatedBy: ActivityId, at: S.DateTimeUtcFromMillis },
  }).pipe(
    $I.annoteSchema("StanceRecord", {
      description: "Writable non-authoritative stance events; admitted is not an input case.",
    })
  );
  return {
    $I,
    AgentRef,
    ClaimCore,
    ClaimRecord,
    ProposedClaimRecord,
    Challenge,
    Retraction,
    StanceRecord,
    logicalKey: ids.logicalKey,
  };
};

/**
 * Share the exact claim-record ingredients between the vocabulary and checked arrows.
 *
 * **Example** (Inspect checked record fields)
 *
 * ```ts
 * import { makeClaimRecords } from "@beep/epistemics/ClaimCore.schema"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 * const records = makeClaimRecords({ $I: $ScratchpadId.create("Records"), core: S.NonEmptyString })
 * console.log(records.ClaimRecord.fields.core)
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const makeClaimRecords = <
  Core extends S.Top & { readonly DecodingServices: never; readonly EncodingServices: never },
>(options: {
  readonly $I: SchemaIdentity;
  readonly core: Core;
}) => {
  const core: FieldSchema<Core["Type"], Core["Encoded"], Core["~type.make.in"]> = options.core;
  const ClaimRecord = S.Struct({ claim: ClaimId, core }).pipe(
    options.$I.annoteSchema("ClaimRecord", {
      description: "An immutable claim key and its core; decoding alone grants no checked integrity.",
    })
  );
  const ProposedClaimRecord = S.Struct({ claim: ClaimId, core, stance: S.tag("proposed") }).pipe(
    options.$I.annoteSchema("ProposedClaimRecord", {
      description: "A proposed claim, without admission authority.",
    })
  );
  return { ClaimRecord, ProposedClaimRecord };
};
