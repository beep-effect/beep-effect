/**
 * Durable metadata-only observations of managed launch lifecycle.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { ObservationHarness, ObservationIdentity, ObservationRootBinding } from "./observation-inventory.ts";
import { hashPublicTextSha256 } from "./privacy.ts";
import { makeTranscriptIntakeJournal } from "./transcript-intake.ts";
import type { TranscriptIntakeConfig } from "./transcript-intake.ts";

const $I = $RepoAiMetricsId.create("observation-launch-facts");
/**
 * Controller-evidenced launch attribution; identity components remain separate.
 * **Example** (Inspect the attribution boundary)
 * ```ts
 * import { ObservationLaunchIdentity } from "@beep/repo-ai-metrics/observation-launch-facts"
 * console.log(typeof ObservationLaunchIdentity.make)
 * ```
 * **Details** No command, environment, prompt, path or task title is accepted. Verified identities require producer evidence; an objective-content hash is not an execution ID. The collector's checkout never supplies these values by default.
 * @category models
 * @since 0.0.0
 */
export class ObservationLaunchIdentity extends S.Opaque<ObservationLaunchIdentity, { readonly brand: unique symbol }>()(
  S.Struct({
    routeId: Sha256Hex,
    harness: ObservationHarness,
    surface: S.Literals(["cli", "desktop", "ide", "worker", "unknown"]),
    root: ObservationRootBinding,
    repository: ObservationIdentity,
    clone: ObservationIdentity,
    worktree: ObservationIdentity,
    task: ObservationIdentity,
    attempt: ObservationIdentity,
    evidenceId: Sha256Hex,
  }).pipe(
    $I.annoteSchema("ObservationLaunchIdentity", {
      description: "Explicit controller attribution, independent of source session and event identities.",
    })
  )
) {}
/**
 * Immutable lifecycle facts observed by an owning launcher.
 * **Example** (Inspect allowed lifecycle phases)
 * ```ts
 * import { ObservationLaunchFact } from "@beep/repo-ai-metrics/observation-launch-facts"
 * console.log(typeof ObservationLaunchFact.cases.Prepared.make)
 * ```
 * **Details** Prepared does not establish a started process. SessionBound is reserved for a verified runtime session; Finished is a process result, never task-quality evaluation. Abandonment can close uncertain work explicitly as unknown.
 * @category models
 * @since 0.0.0
 */
export const ObservationLaunchFact = S.TaggedUnion({
  Prepared: { launchId: Sha256Hex, identity: ObservationLaunchIdentity },
  Started: { launchId: Sha256Hex, processInstanceId: Sha256Hex },
  SessionBound: { launchId: Sha256Hex, sourceSessionId: Sha256Hex },
  Finished: { launchId: Sha256Hex, outcome: S.Literals(["succeeded", "failed", "cancelled", "unknown"]) },
}).pipe(
  $I.annoteSchema("ObservationLaunchFact", {
    description: "Positive lifecycle observations without inferred completion or launch.",
  })
);
/**
 * Runtime type of {@link ObservationLaunchFact}.
 * **Example** (Refer to a lifecycle fact)
 * ```ts
 * import type { ObservationLaunchFact } from "@beep/repo-ai-metrics/observation-launch-facts"
 * const fact: ObservationLaunchFact | undefined = undefined
 * console.log(fact)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type ObservationLaunchFact = typeof ObservationLaunchFact.Type;
/**
 * Locally committed launch observation with an explicit evidence epoch.
 * **Example** (Inspect a receipt)
 * ```ts
 * import { ObservationLaunchReceipt } from "@beep/repo-ai-metrics/observation-launch-facts"
 * console.log(typeof ObservationLaunchReceipt.make)
 * ```
 * **Details** recordedAt is local observation time, not an invented process-start timestamp. Receipt identity binds host, hash namespace, epoch and the exact fact. It proves local durability only.
 * @category models
 * @since 0.0.0
 */
export class ObservationLaunchReceipt extends S.Opaque<ObservationLaunchReceipt, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("observation-launch-receipt/v1"),
    receiptId: Sha256Hex,
    hostId: Sha256Hex,
    namespaceId: Sha256Hex,
    evidenceEpoch: S.Natural,
    recordedAt: S.Natural,
    fact: ObservationLaunchFact,
  }).pipe(
    $I.annoteSchema("ObservationLaunchReceipt", {
      description: "Immutable launch observation and its local acknowledgment boundary.",
    })
  )
) {}
/**
 * Payload-free launch-journal refusal.
 * **Example** (Inspect a refusal)
 * ```ts
 * import { ObservationLaunchFactsError } from "@beep/repo-ai-metrics/observation-launch-facts"
 * console.log(ObservationLaunchFactsError.make({ reason: "conflict" }).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class ObservationLaunchFactsError extends S.TaggedError<
  ObservationLaunchFactsError,
  { readonly brand: unique symbol }
>($I`ObservationLaunchFactsError`)(
  "ObservationLaunchFactsError",
  { reason: S.Literals(["capacity", "conflict", "retired", "storage", "clock"]) },
  $I.annote("ObservationLaunchFactsError", { description: "Safe launch fact refusal with no source payload." })
) {}
const failure = (reason: ObservationLaunchFactsError["reason"]) => ObservationLaunchFactsError.make({ reason });
const safe = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.mapError((error) => (S.is(ObservationLaunchFactsError)(error) ? error : failure("storage"))));
const phase = ObservationLaunchFact.match({
  Prepared: () => 0,
  Started: () => 1,
  SessionBound: () => 2,
  Finished: () => 3,
});
const Count = S.Tuple([S.Struct({ n: S.Natural })]);
const encodeFact = S.encodeEffect(S.fromJsonString(ObservationLaunchFact));
const encodeReceipt = S.encodeEffect(S.fromJsonString(ObservationLaunchReceipt));
const decodeReceipt = S.decodeEffect(S.fromJsonString(ObservationLaunchReceipt), { onExcessProperty: "error" });

/**
 * Derive the receipt identity for one exact launch fact and destination window.
 * **Example** (Inspect the shared identity function)
 * ```ts
 * import { observationLaunchReceiptId } from "@beep/repo-ai-metrics/observation-launch-facts"
 * console.log(typeof observationLaunchReceiptId)
 * ```
 * **Details** Shared by the journal and its client. This digest binds metadata but is not a signature or proof of process execution.
 * @category utilities
 * @since 0.0.0
 */
export const observationLaunchReceiptId = Effect.fn("AiMetrics.observationLaunchReceiptId")(
  (hostId: Sha256Hex, namespaceId: Sha256Hex, epoch: number, fact: ObservationLaunchFact) =>
    encodeFact(fact).pipe(
      Effect.flatMap((payload) =>
        hashPublicTextSha256(`observation-launch-receipt/v1:${hostId}:${namespaceId}:${epoch}:${payload}`)
      )
    )
);

/**
 * Open bounded immutable launch observations inside the existing owned journal.
 * **Example** (Inspect the factory)
 * ```ts
 * import { makeObservationLaunchFacts } from "@beep/repo-ai-metrics/observation-launch-facts"
 * console.log(typeof makeObservationLaunchFacts)
 * ```
 * **Details** At most maxPages launches, four facts per launch, and 8192 bytes per fact. Preparing a launch reserves 32768 bytes for all four bounded facts, so ordinary intake cannot consume its completion budget. Actual launch bytes and unused reservations share maxPayloadBytes with retained source pages; all tables remain under the physical journal ceiling. Exact retries return the original receipt even at capacity. Writes require the current epoch and the worker's ownership/admission boundary. Retirement preserves summaries and a reversible recovery generation; earlier detail is not known absent. This service does not start an agent or establish unobserved launch coverage.
 * @category services
 * @since 0.0.0
 */
export const makeObservationLaunchFacts = Effect.fn("AiMetrics.makeObservationLaunchFacts")(function* (
  config: TranscriptIntakeConfig
) {
  const base = yield* makeTranscriptIntakeJournal(config);
  const sql = yield* SqlClient.SqlClient;
  const identity = (fact: ObservationLaunchFact, epoch: number) =>
    observationLaunchReceiptId(config.hostId, config.namespaceId, epoch, fact);
  const read = Effect.fn("AiMetrics.launchFacts.read")((launchId: Sha256Hex, epoch: number) =>
    safe(
      Effect.gen(function* () {
        if ((yield* base.evidenceWindow).epoch !== epoch) return yield* failure("retired");
        const rows =
          yield* sql`SELECT phase,substr(payload,1,8193) AS payload,digest,recorded_at AS "recordedAt",evidence_epoch AS epoch,payload_bytes AS bytes FROM observation_launch_facts WHERE launch_id=${launchId} ORDER BY phase LIMIT 5`.pipe(
            Effect.flatMap(
              S.decodeUnknownEffect(
                S.Array(
                  S.Struct({
                    phase: S.Natural,
                    payload: S.String,
                    digest: Sha256Hex,
                    recordedAt: S.Natural,
                    epoch: S.Natural,
                    bytes: S.Natural,
                  })
                )
              )
            )
          );
        if (rows.length > 4) return yield* failure("storage");
        const receipts = yield* Effect.forEach(rows, (row) =>
          Effect.gen(function* () {
            if (
              row.payload.length > 8192 ||
              new TextEncoder().encode(row.payload).byteLength !== row.bytes ||
              row.epoch !== epoch ||
              (yield* hashPublicTextSha256(row.payload)) !== row.digest
            )
              return yield* failure("storage");
            const value = yield* decodeReceipt(row.payload);
            if (
              value.hostId !== config.hostId ||
              value.namespaceId !== config.namespaceId ||
              value.evidenceEpoch !== epoch ||
              value.fact.launchId !== launchId ||
              phase(value.fact) !== row.phase ||
              value.recordedAt !== row.recordedAt ||
              (yield* identity(value.fact, epoch)) !== value.receiptId
            )
              return yield* failure("storage");
            return value;
          })
        );
        if (receipts.length > 0) {
          const started = A.some(receipts, (value) => value.fact._tag === "Started");
          if (
            receipts[0]?.fact._tag !== "Prepared" ||
            A.some(
              receipts,
              (value, index) =>
                (index > 0 && value.recordedAt < (receipts[index - 1]?.recordedAt ?? 0)) ||
                (value.fact._tag === "SessionBound" && !started) ||
                (value.fact._tag === "Finished" && value.fact.outcome === "succeeded" && !started)
            )
          )
            return yield* failure("storage");
        }
        return receipts;
      })
    )
  );
  const record = Effect.fn("AiMetrics.launchFacts.record")((fact: ObservationLaunchFact, epoch: number) =>
    safe(
      sql.withTransaction(
        Effect.gen(function* () {
          const facts = yield* read(fact.launchId, epoch);
          const receiptId = yield* identity(fact, epoch);
          const existing = A.findFirst(facts, (receipt) => phase(receipt.fact) === phase(fact));
          if (O.isSome(existing)) {
            if (existing.value.receiptId !== receiptId) return yield* failure("conflict");
            return existing.value;
          }
          const started = A.some(facts, (receipt) => receipt.fact._tag === "Started");
          const closed = A.some(facts, (receipt) => receipt.fact._tag === "Finished");
          if (
            closed ||
            (fact._tag === "Prepared" ? facts.length !== 0 : facts.length === 0) ||
            (fact._tag === "SessionBound" && !started) ||
            (fact._tag === "Finished" && fact.outcome === "succeeded" && !started)
          )
            return yield* failure("conflict");
          const launches = yield* sql`SELECT count(*) AS n FROM observation_launch_facts WHERE phase=0`.pipe(
            Effect.flatMap(S.decodeUnknownEffect(Count))
          );
          if (fact._tag === "Prepared" && launches[0].n >= config.maxPages) return yield* failure("capacity");
          const recordedAt = yield* Clock.currentTimeMillis;
          if (A.some(facts, (receipt) => receipt.recordedAt > recordedAt)) return yield* failure("clock");
          const receipt = ObservationLaunchReceipt.make({
            receiptId,
            hostId: config.hostId,
            namespaceId: config.namespaceId,
            evidenceEpoch: epoch,
            recordedAt,
            fact,
          });
          const payload = yield* encodeReceipt(receipt);
          const bytes = new TextEncoder().encode(payload).byteLength;
          if (
            bytes > 8192 ||
            (fact._tag === "Prepared" &&
              (yield* base.stats).payloadBytes + (yield* base.reservedLaunchBytes) + 32768 > config.maxPayloadBytes)
          )
            return yield* failure("capacity");
          const digest = yield* hashPublicTextSha256(payload);
          yield* sql`INSERT INTO observation_launch_facts(launch_id,phase,payload,payload_bytes,digest,recorded_at,evidence_epoch) VALUES(${fact.launchId},${phase(fact)},${payload},${bytes},${digest},${recordedAt},${epoch})`;
          return receipt;
        })
      )
    )
  );
  return { record, read };
});
