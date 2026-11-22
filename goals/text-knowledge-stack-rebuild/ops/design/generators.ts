/**
 * Coherent claim-log arbitraries for the remaining L4 design. Annotation
 * document and containment generators now live in the annotation package tests.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ValidTime } from "@beep/epistemics/Claim";
import { $RepoCliId } from "@beep/identity/packages";
import { TermIri } from "@beep/identity/Term";
import { ActivityPin, ActivityStart, mintActivityIdResult } from "@beep/jsonc/ActivityStart";
import { mintContentHashResult } from "@beep/jsonc/Mint";
import { OccurrenceId, OccurrencePreimage } from "@beep/text/Occurrence";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import { identity } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { ChallengeKind, ClaimDomainTag, ClaimId, ClaimLogEntry, makeClaimCore } from "./L4.claims.ts";
import type { JsoncCanonicalizeError, JsoncDigest } from "@beep/jsonc/JsoncFingerprint";
import type { Anchored } from "@beep/text/Occurrence";

const $I = $RepoCliId.create("goals/text-knowledge-stack-rebuild/ops/design/generators");

const Pick = S.Int.check(S.isBetween({ minimum: 0, maximum: 1_000 }));
// Instants from a bounded epoch-millis leaf (1970 to 2100): drawn near the edge of the DateTime
// range, an Instant plus the generators' offsets would leave it and encode as NaN.
const EpochMillis = S.Int.check(S.isBetween({ minimum: 0, maximum: 4_102_444_800_000 }));
const instantArbitrary = Arbitrary.map(Arbitrary.schema(EpochMillis), (millis) => DateTime.makeUnsafe(millis));

const between = (minimum: number, maximum: number) => Arbitrary.schema(S.Int.check(S.isBetween({ minimum, maximum })));
const picks = (options: { readonly minLength?: number; readonly maxLength: number }) =>
  Arbitrary.array(Arbitrary.schema(Pick), options);

const at = <A>(values: A.NonEmptyReadonlyArray<A>, pick: number): A =>
  O.getOrElse(A.get(values, pick % values.length), () => A.headNonEmpty(values));

const cyclic = (values: ReadonlyArray<number>, index: number): number =>
  O.getOrElse(A.get(values, index % Math.max(values.length, 1)), () => 0);

const nonEmpty = <A>(values: ReadonlyArray<A>): Result.Result<A.NonEmptyReadonlyArray<A>, "empty"> =>
  A.isReadonlyArrayNonEmpty(values) ? Result.succeed(values) : Result.fail("empty");

const minters = (digest: JsoncDigest) => {
  const mint = mintContentHashResult(digest);
  return {
    occurrence: (anchored: Anchored) => Result.map(OccurrencePreimage.mintResult(digest)(anchored), OccurrenceId.make),
    activity: mintActivityIdResult(digest),
    claim: (encodedCore: unknown) => Result.map(mint(ClaimDomainTag, [encodedCore]), (hash) => ClaimId.make(hash)),
  };
};

const Holds = S.TaggedStruct("Holds", { subject: S.NonEmptyString }).pipe(
  $I.annoteSchema("Holds", { description: "Sample proposition for the claim-log generator." })
);
const MatterId = S.NonEmptyString.pipe(S.brand("MatterId"));
const ProposeOperation = TermIri.make("https://beep-effect.com/ns/operation/Propose");
const ScopePool: A.NonEmptyReadonlyArray<string> = ["matter:a", "matter:b"];
const SubjectPool: A.NonEmptyReadonlyArray<string> = ["subject-0", "subject-1"];

/** A sample claim binding the claim-log generator builds through. */
export const SampleClaims = makeClaimCore({
  proposition: Holds,
  ids: {
    logicalKey: (proposition) => `Holds|${proposition.subject}`,
    scope: MatterId,
    principal: S.NonEmptyString.pipe(S.brand("PrincipalId")),
    action: S.NonEmptyString.pipe(S.brand("ActionId")),
    revision: S.NonEmptyString.pipe(S.brand("RevisionId")),
  },
});

const ClaimCoreJson = S.toCodecJson(SampleClaims.ClaimCore);
const encodeCore = S.encodeUnknownResult(ClaimCoreJson);

/** One generated log record: its minted id, its core, the checker's projection and its chain. */
export class GeneratedClaimRecord extends S.Opaque<GeneratedClaimRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    id: ClaimId,
    core: SampleClaims.ClaimCore,
    entry: ClaimLogEntry,
    chain: S.NonEmptyString,
  }).pipe($I.annoteSchema("GeneratedClaimRecord", { description: "A generated claim log record." }))
) {}

/** A generated claim log with its retractions and challenges. */
export class GeneratedClaimLog extends S.Opaque<GeneratedClaimLog, { readonly brand: unique symbol }>()(
  S.Struct({
    records: S.Array(GeneratedClaimRecord),
    retracted: S.HashSet(ClaimId),
    challenges: S.Array(SampleClaims.Challenge),
  }).pipe($I.annoteSchema("GeneratedClaimLog", { description: "A generated claim log for L4-1, L4-3 and L4-4." }))
) {}

type ClaimLogBuildError = S.SchemaError | JsoncCanonicalizeError | "invalid-core" | "invalid-log";

/**
 * Generated claim logs for L4-1, L4-3 and L4-4, built through the claim
 * minting preimage: partitions drawn from small scope and subject pools (so
 * one logicalKey appears under two scopes), supersession chains with
 * Unknown, closed and open-ended valid times inside disjoint per-chain slots,
 * derivedFrom drawn as 0-3 earlier ids (roots and diamonds, acyclic by
 * construction), partial and full retraction, and challenges that may cycle.
 * `checkClaimLog` reports nothing on every generated log.
 */
export const claimLogResultArbitrary = (digest: JsoncDigest) => {
  const mint = minters(digest);
  const leaves = Arbitrary.all({
    base: instantArbitrary,
    pin: Arbitrary.schema(ActivityPin),
    partitions: Arbitrary.array(
      Arbitrary.all({
        scope: between(0, 1),
        subject: between(0, 1),
        chains: Arbitrary.array(between(1, 3), { minLength: 1, maxLength: 3 }),
      }),
      { minLength: 2, maxLength: 4 }
    ),
    derivePicks: Arbitrary.array(picks({ maxLength: 3 }), { minLength: 1, maxLength: 12 }),
    validPicks: picks({ minLength: 1, maxLength: 12 }),
    retractPicks: picks({ minLength: 1, maxLength: 12 }),
    challengePicks: Arbitrary.array(
      Arbitrary.all({
        fromPick: Arbitrary.schema(Pick),
        toPick: Arbitrary.schema(Pick),
        kind: Arbitrary.schema(ChallengeKind),
      }),
      { maxLength: 3 }
    ),
  });
  return Arbitrary.map(leaves, ({ base, pin, partitions, derivePicks, validPicks, retractPicks, challengePicks }) => {
    const distinct = A.dedupeWith(
      partitions,
      (left, right) => left.scope === right.scope && left.subject === right.subject
    );
    const specs = A.flatMap(distinct, (partition, partitionIndex) =>
      A.flatMap(partition.chains, (length, chain) =>
        A.makeBy(length, (step) => ({
          partition,
          partitionIndex,
          chain,
          step,
          lastChain: chain === partition.chains.length - 1,
        }))
      )
    );
    const build = (
      records: ReadonlyArray<GeneratedClaimRecord>,
      spec: (typeof specs)[number],
      index: number
    ): Result.Result<GeneratedClaimRecord, ClaimLogBuildError> =>
      Result.gen(function* () {
        const chain = `${spec.partitionIndex}/${spec.chain}`;
        // knowledgeStart follows the append index, so the log is in knowledge-time order and every
        // parent (drawn from earlier records) starts no later than its child; valid-time slots are per chain.
        const knowledgeStart = DateTime.add(base, { milliseconds: 10_000 + index });
        const slot = DateTime.add(base, { milliseconds: 1_000 * spec.chain });
        const validPick = cyclic(validPicks, index);
        const valid =
          validPick % 3 === 0
            ? ValidTime.cases.Unknown.make({})
            : ValidTime.cases.Interval.make({
                validFrom: DateTime.add(slot, { milliseconds: validPick % 400 }),
                validTo:
                  validPick % 3 === 2 && spec.lastChain ? O.none() : O.some(DateTime.add(slot, { milliseconds: 999 })),
              });
        const supersedes = O.map(
          A.findLast(records, (record) => record.chain === chain),
          (record) => record.id
        );
        const parents = O.getOrElse(A.get(derivePicks, index % derivePicks.length), A.empty<number>);
        const derivedFrom = HashSet.fromIterable(
          A.isReadonlyArrayNonEmpty(records) ? A.map(parents, (pick) => at(records, pick).id) : A.empty<ClaimId>()
        );
        const generatedBy = yield* mint.activity(
          ActivityStart.make({
            operation: ProposeOperation,
            pin,
            promptDigest: O.none(),
            used: HashSet.empty(),
            started: knowledgeStart,
          })
        );
        const scope = MatterId.make(at(ScopePool, spec.partition.scope));
        const proposition = Holds.make({ subject: at(SubjectPool, spec.partition.subject) });
        const logicalKey = `Holds|${proposition.subject}`;
        const core = yield* Result.fromOption(
          SampleClaims.ClaimCore.makeOption({
            proposition,
            logicalKey,
            supportAtCreation: HashSet.empty(),
            derivedFrom,
            supersedes,
            generatedBy,
            assertedBy: SampleClaims.AgentRef.cases.SoftwareAgent.make({ name: "claim-log-generator", pin }),
            valid,
            knowledgeStart,
            scope,
          }),
          (): ClaimLogBuildError => "invalid-core"
        );
        const encoded = yield* encodeCore(core);
        const id = yield* mint.claim(encoded);
        return GeneratedClaimRecord.make({
          id,
          core,
          chain,
          entry: ClaimLogEntry.make({
            claim: id,
            scope,
            logicalKey,
            supersedes,
            derivedFrom,
            knowledgeStart,
            generatedAt: knowledgeStart,
            valid,
          }),
        });
      });
    const initial: Result.Result<ReadonlyArray<GeneratedClaimRecord>, ClaimLogBuildError> = Result.succeed(A.empty());
    const built = A.reduce(specs, initial, (accumulated, spec, index) =>
      Result.flatMap(accumulated, (records) =>
        Result.map(build(records, spec, index), (record) => A.append(records, record))
      )
    );
    return Result.flatMap(built, (records) =>
      Result.flatMap(nonEmpty(records), (nonEmptyRecords) => {
        const retracted = HashSet.fromIterable(
          A.filterMap(records, (record, index) =>
            cyclic(retractPicks, index) % 3 === 0 ? Result.succeed(record.id) : Result.fail(index)
          )
        );
        const challenges = A.flatMap(challengePicks, ({ fromPick, toPick, kind }, index) => {
          const from = at(nonEmptyRecords, fromPick);
          const to = at(nonEmptyRecords, toPick);
          const forward = SampleClaims.Challenge.cases.ByActivity.make({
            from: from.id,
            to: to.id,
            kind,
            generatedBy: to.core.generatedBy,
          });
          // The first challenge is answered back when its pick is even: a challenge cycle (L4-3 allows it).
          return index === 0 && fromPick % 2 === 0
            ? [
                forward,
                SampleClaims.Challenge.cases.ByActivity.make({
                  from: to.id,
                  to: from.id,
                  kind,
                  generatedBy: from.core.generatedBy,
                }),
              ]
            : [forward];
        });
        return Result.fromOption(
          GeneratedClaimLog.makeOption({ records, retracted, challenges }),
          (): ClaimLogBuildError => "invalid-log"
        );
      })
    );
  });
};

/** Generated claim logs; `digest` is a pure SHA-256 from the test harness. */
export const claimLogArbitrary = (digest: JsoncDigest): Arbitrary.Arbitrary<GeneratedClaimLog> =>
  Arbitrary.filterMap(claimLogResultArbitrary(digest), identity);
