// Explicit synthetic-only integration fixture. Invoke against a disposable loopback Phoenix.
import { PhoenixConfigInput } from "@beep/phoenix";
import { DeliveryLedgerConfig } from "@beep/repo-ai-metrics/delivery-ledger";
import {
  makeNativeDelivery,
  NativeDeliveryPolicy,
  NativeDeliveryRequest,
  nativeDeliveryTargetId,
} from "@beep/repo-ai-metrics/native-delivery";
import { makeNativeIntakeJournal } from "@beep/repo-ai-metrics/native-intake";
import { makeNativeReadback } from "@beep/repo-ai-metrics/native-readback";
import {
  IdempotentReplayPolicy,
  makeNativeDeliveryScheduler,
  NativeSchedulePolicy,
} from "@beep/repo-ai-metrics/native-schedule";
import { NativeTraceRequest, projectNativeTraceRequest } from "@beep/repo-ai-metrics/native-trace";
import { hashPrivateIdentifier, hashPublicTextSha256 } from "@beep/repo-ai-metrics/privacy";
import { makeTranscriptIntakeJournal, TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { readTranscriptPage, TranscriptPageInput } from "@beep/repo-ai-metrics/transcript-page";
import { Sha256Hex } from "@beep/schema";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import * as SqliteClient from "@effect/sql-sqlite-bun/SqliteClient";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";

const id = (char: string) => Sha256Hex.make(Str.repeat(64)(char));
const decodeUnionValue = S.decodeUnknownEffect(
  S.Union([
    S.Tuple([S.String, S.String, S.String]),
    S.Tuple([S.String, S.String, S.String, S.String]),
    S.Tuple([S.String, S.String, S.String, S.String, S.Literal("reconstructed")]),
    S.Tuple([S.String, S.String, S.String, S.String, S.Literals(["native", "reconstructed"]), Sha256Hex]),
  ])
);
const encodeJsonValue = S.encodeEffect(S.fromJsonString(S.Unknown));

const program = Effect.gen(function* () {
  const [databasePath, endpoint, output, exportEndpoint, reconstruction, qualificationDigest] = yield* decodeUnionValue(
    A.drop(process.argv, 2)
  );
  const address = yield* S.decodeEffect(S.URLFromString)(endpoint);
  if (address.protocol !== "http:" || address.hostname !== "127.0.0.1")
    return yield* Effect.die("Fixture requires disposable loopback HTTP");
  const fs = yield* FileSystem.FileSystem;
  const sql = yield* SqliteClient.make({ filename: databasePath });
  const salt = "synthetic-phoenix-proof-salt";
  const intake = TranscriptIntakeConfig.make({
    hostId: id("a"),
    namespaceId: yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(salt)),
    maxPages: 16,
    maxPayloadBytes: 1_048_576,
    maxDatabasePages: 256,
  });
  const policy = NativeDeliveryPolicy.make({
    endpoint: Redacted.make(O.getOrElse(O.fromUndefinedOr(exportEndpoint), () => endpoint)),
    readbackOrigin: O.some(Redacted.make(address.origin)),
    project: "foundation-synthetic-proof",
    timeoutMillis: 10000,
  });
  const config = DeliveryLedgerConfig.make({
    targetId: yield* nativeDeliveryTargetId(policy),
    maxEvents: 16,
    maxAttempts: 16,
    maxAttemptsPerEvent: 8,
  });
  const native = yield* makeNativeIntakeJournal(intake).pipe(Effect.provideService(SqlClient.SqlClient, sql));
  const worker = yield* makeNativeDelivery(intake, config, policy).pipe(
    Effect.provideService(SqlClient.SqlClient, sql)
  );
  const reconciler = yield* makeNativeReadback(
    intake,
    config,
    policy,
    PhoenixConfigInput.make({ baseUrl: address.origin })
  ).pipe(Effect.provideService(SqlClient.SqlClient, sql));
  const scheduler = yield* makeNativeDeliveryScheduler(
    intake,
    config,
    NativeSchedulePolicy.make({
      maxEvents: 8,
      retryDelayMillis: 100,
      maxRetryDelayMillis: 400,
      reconcileDelayMillis: 100,
      tickTimeoutMillis: 10000,
      idempotentReplay: O.map(O.fromUndefinedOr(qualificationDigest), (digest) =>
        IdempotentReplayPolicy.make({
          targetId: config.targetId,
          qualificationDigest: digest,
          minimumDelayMillis: 3000,
        })
      ),
    }),
    worker,
    reconciler
  ).pipe(Effect.provideService(SqlClient.SqlClient, sql));
  const observations = yield* Effect.forEach(
    ["claude-complete", "openinference-complete", "claude-incomplete"],
    (scenario, index) =>
      Effect.gen(function* () {
        const digit = `${index + 1}`;
        const fixtureSurface = index === 1 ? "desktop" : "cli";
        const oi = scenario === "openinference-complete";
        const incomplete = scenario === "claude-incomplete";
        const usage = oi
          ? [
              { key: "openinference.span.kind", value: { stringValue: "LLM" } },
              { key: "llm.token_count.prompt", value: { intValue: "130" } },
              { key: "llm.token_count.completion", value: { intValue: "5" } },
              { key: "llm.token_count.prompt_details.cache_read", value: { intValue: "100" } },
              { key: "llm.token_count.prompt_details.cache_write", value: { intValue: "20" } },
            ]
          : [
              { key: "input_tokens", value: { intValue: "10" } },
              { key: "output_tokens", value: { intValue: "5" } },
              ...(!incomplete
                ? [
                    { key: "cache_read_tokens", value: { intValue: "100" } },
                    { key: "cache_creation_tokens", value: { intValue: "20" } },
                  ]
                : []),
            ];
        const body = yield* encodeJsonValue({
          resourceSpans: [
            {
              schemaUrl: "https://synthetic-private-resource.invalid",
              resource: {
                attributes: [{ key: "process.command_line", value: { stringValue: "synthetic-private-command" } }],
              },
              scopeSpans: [
                {
                  schemaUrl: "https://synthetic-private-scope.invalid",
                  scope: { name: "synthetic-private-scope-name", version: "synthetic-private-scope-version" },
                  spans: [
                    {
                      traceId: Str.repeat(32)(digit),
                      spanId: Str.repeat(16)(digit),
                      name: "claude_code.llm_request",
                      traceState: "private=synthetic-private-trace-state",
                      status: { code: 1, message: "synthetic-private-status" },
                      events: [
                        {
                          name: "synthetic-private-event",
                          attributes: [
                            { key: "exception.message", value: { stringValue: "synthetic-private-exception" } },
                          ],
                        },
                      ],
                      links: [
                        {
                          traceId: Str.repeat(32)("9"),
                          spanId: Str.repeat(16)("9"),
                          traceState: "private=synthetic-private-link",
                          attributes: [{ key: "private", value: { stringValue: "synthetic-private-link-attribute" } }],
                        },
                      ],
                      startTimeUnixNano: "1793000000000000870",
                      endTimeUnixNano: "1793000000100000870",
                      attributes: [
                        { key: "beep.fixture.surface", value: { stringValue: fixtureSurface } },
                        { key: "session.id", value: { stringValue: `synthetic-private-session-${digit}` } },
                        { key: "llm.model_name", value: { stringValue: "synthetic-approved-model" } },
                        { key: "input.value", value: { stringValue: "synthetic-private-prompt-canary" } },
                        { key: "output.value", value: { stringValue: "synthetic-private-response" } },
                        { key: "tool.parameters", value: { stringValue: "synthetic-private-tool" } },
                        ...usage,
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        });
        const batch = yield* projectNativeTraceRequest(
          NativeTraceRequest.make({
            routeId: id(digit),
            hashSalt: Redacted.make(salt),
            contentType: "application/json",
            body: new TextEncoder().encode(body),
            approvedModels: ["synthetic-approved-model"],
            usageConvention: oi ? "openinference" : "claude-code",
            syntheticFixtureMetadata: O.some(true),
          })
        );
        const span = batch.spans[0];
        if (span === undefined || batch.rejections.length !== 0) return yield* Effect.die("Invalid synthetic fixture");
        const receipt = yield* native.acceptBatch(batch);
        const scheduled = yield* scheduler.tick;
        if (scheduled._tag !== "Complete") return yield* Effect.die("Synthetic scheduler exceeded send deadline");
        const selected = A.findFirst(
          scheduled.outcomes,
          (outcome) => outcome._tag === "Sent" && outcome.eventId === span.eventId
        );
        if (O.isNone(selected) || selected.value._tag !== "Sent")
          return yield* Effect.die("Scheduler did not select new event");
        let result = selected.value.result;
        const initialState = O.getOrNull(yield* worker.ledger.state(span.eventId));
        const interruptedAttemptId = result.attemptId;
        const qualifiedRecovery = qualificationDigest !== undefined && index === 1;
        if (qualifiedRecovery) {
          if (result._tag !== "Recorded" || result.outcome._tag !== "Unknown" || initialState?.state !== "unresolved")
            return yield* Effect.die("Synthetic dropped request must remain unresolved");
          yield* Effect.sleep(3100);
          // Recreate the scheduler over the same durable profile and ledger.
          const recovered = yield* makeNativeDeliveryScheduler(
            intake,
            config,
            NativeSchedulePolicy.make({
              maxEvents: 8,
              retryDelayMillis: 100,
              maxRetryDelayMillis: 400,
              reconcileDelayMillis: 100,
              tickTimeoutMillis: 10000,
              idempotentReplay: O.some(
                IdempotentReplayPolicy.make({
                  targetId: config.targetId,
                  qualificationDigest,
                  minimumDelayMillis: 3000,
                })
              ),
            }),
            worker,
            reconciler
          ).pipe(Effect.provideService(SqlClient.SqlClient, sql));
          const tick = yield* recovered.tick;
          if (tick._tag !== "Complete") return yield* Effect.die("Recovery scheduler deadline");
          const retry = A.findFirst(
            tick.outcomes,
            (outcome) => outcome._tag === "Sent" && outcome.eventId === span.eventId
          );
          if (O.isNone(retry) || retry.value._tag !== "Sent")
            return yield* Effect.die("Qualified recovery did not retry");
          result = retry.value.result;
          const original = yield* worker.ledger.attempt(interruptedAttemptId);
          const repeated = yield* worker.ledger.attempt(result.attemptId);
          if (
            O.isNone(original) ||
            O.isNone(repeated) ||
            original.value.payloadDigest !== repeated.value.payloadDigest ||
            result.attemptId === interruptedAttemptId
          )
            return yield* Effect.die("Recovery must preserve bytes under a fresh attempt");
        }
        if (result._tag !== "Recorded" || result.outcome._tag !== "Accepted")
          return yield* Effect.die("Fixture delivery did not receive complete acknowledgment");
        const attemptId = result.attemptId;
        const acceptanceState = O.getOrNull(yield* worker.ledger.state(span.eventId));
        let visible = false;
        let readbackPasses = 0;
        for (let query = 0; query < 20; query++) {
          yield* Effect.sleep(250);
          const tick = yield* scheduler.tick;
          readbackPasses++;
          if (tick._tag !== "Complete") return yield* Effect.die("Synthetic scheduler exceeded read-back deadline");
          if (A.some(tick.outcomes, (outcome) => outcome._tag === "Reconciled" && outcome.result._tag === "Mismatch"))
            return yield* Effect.die("Stored synthetic metadata mismatch");
          const state = yield* worker.ledger.state(span.eventId);
          if (O.isSome(state) && state.value.state === "visible") {
            visible = true;
            break;
          }
        }
        if (!visible) return yield* Effect.die("Synthetic backend visibility deadline exceeded");
        // Qualify the pinned backend's duplicate handling before granting any
        // future ambiguous-replay policy. This is explicit synthetic traffic.
        const repeatedAttemptId = yield* hashPublicTextSha256(`synthetic-explicit-replay:${span.eventId}`);
        const repeated = yield* worker.send(
          NativeDeliveryRequest.make({
            receiptId: receipt.page.receiptId,
            attemptId: repeatedAttemptId,
            offset: 0,
            limit: 1,
          })
        );
        if (repeated._tag !== "Recorded" || repeated.outcome._tag !== "Accepted")
          return yield* Effect.die("Synthetic duplicate was not acknowledged");
        const firstAttempt = yield* worker.ledger.attempt(attemptId);
        const repeatedAttempt = yield* worker.ledger.attempt(repeatedAttemptId);
        if (
          O.isNone(firstAttempt) ||
          O.isNone(repeatedAttempt) ||
          firstAttempt.value.payloadDigest !== repeatedAttempt.value.payloadDigest
        )
          return yield* Effect.die("Synthetic replay changed the original bytes");
        return {
          scenario,
          fixtureSurface,
          qualifiedRecovery,
          initialState,
          interruptedAttemptId,
          automaticScheduling: true,
          readbackPasses,
          acceptanceState,
          result,
          repeatedAttemptId,
          identicalReplayPayload: true,
          spanId: span.spanId,
          traceId: span.traceId,
          eventId: span.eventId,
          sessionId: O.getOrNull(span.sessionHash),
          state: O.getOrNull(yield* worker.ledger.state(span.eventId)),
          attempt: O.getOrNull(yield* worker.ledger.attempt(attemptId)),
        };
      })
  );
  const reconstruct = Effect.fn("NativePhoenixProof.reconstruct")(function* () {
    const transcript = yield* makeTranscriptIntakeJournal(intake).pipe(Effect.provideService(SqlClient.SqlClient, sql));
    const directory = yield* fs.makeTempDirectoryScoped();
    const encode = encodeJsonValue;
    const message = yield* encode({
      type: "assistant",
      timestamp: "2026-10-26T09:33:20.000000001+02:00",
      sessionId: "synthetic-private-session-1",
      message: {
        id: "synthetic-private-message",
        model: "synthetic-private-model",
        content: "synthetic-private-prompt",
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          cache_read_input_tokens: 100,
          cache_creation_input_tokens: 20,
        },
      },
    });
    const session = yield* encode({
      type: "session_meta",
      timestamp: "2026-10-26T07:33:20.000000001Z",
      payload: { id: "synthetic-private-session-2", cwd: "/synthetic-private/worktree" },
    });
    const token = (basis: "last_token_usage" | "total_token_usage") =>
      encode({
        type: "event_msg",
        timestamp: "2026-10-26T02:33:20.000000001-05:00",
        payload: {
          type: "token_count",
          info: { [basis]: { input_tokens: 130, output_tokens: 5, cached_input_tokens: 100 } },
        },
      });
    const declarations = [
      { name: "claude-repeat", source: "claude", text: `${message}\n${message}\n` },
      { name: "codex-last", source: "codex", text: `${session}\n${yield* token("last_token_usage")}\n` },
      { name: "codex-cumulative", source: "codex", text: `${session}\n${yield* token("total_token_usage")}\n` },
    ] satisfies ReadonlyArray<{ name: string; source: "claude" | "codex"; text: string }>;
    const expected = yield* Effect.forEach(declarations, (declaration) =>
      Effect.gen(function* () {
        const path = `${directory}/${declaration.name}.jsonl`;
        yield* fs.writeFileString(path, declaration.text, { mode: 0o600 });
        const page = yield* readTranscriptPage(
          TranscriptPageInput.make({
            path,
            source: declaration.source,
            hashSalt: Redacted.make(salt),
            cursor: O.none(),
            maxBytes: 8192,
            maxLineBytes: 2048,
            maxFrames: 8,
          })
        );
        if (page.frames.length !== 2 || A.some(page.frames, (f) => f._tag !== "Accepted"))
          return yield* Effect.die("Invalid reconstructed source fixture");
        yield* transcript.acceptPage(page, O.none());
        return yield* Effect.forEach(
          A.filter(page.frames, (f) => f._tag === "Accepted"),
          (frame) =>
            Effect.gen(function* () {
              const m = frame.metadata;
              return {
                scenario: declaration.name,
                eventId: frame.occurrenceId,
                traceId: Str.slice(
                  0,
                  32
                )(
                  yield* hashPublicTextSha256(
                    `reconstructed-trace/v1:${intake.hostId}:${intake.namespaceId}:${frame.occurrenceId}`
                  )
                ),
                spanId: Str.slice(
                  0,
                  16
                )(
                  yield* hashPublicTextSha256(
                    `reconstructed-span/v1:${intake.hostId}:${intake.namespaceId}:${frame.occurrenceId}`
                  )
                ),
                sessionId: O.getOrNull(m.session.id),
                kind: m.kind,
                source: declaration.source,
                usage: O.getOrNull(m.usage),
              };
            })
        );
      })
    );
    const rows = A.flatten(expected);
    const sent = yield* scheduler.tick;
    if (sent._tag !== "Complete") return yield* Effect.die("Reconstructed send deadline");
    for (const row of rows) {
      const state = yield* worker.ledger.state(row.eventId);
      if (O.isNone(state) || state.value.state !== "accepted-unverified")
        return yield* Effect.die("Reconstructed acceptance boundary mismatch");
    }
    let readbackPasses = 0;
    for (let attempt = 0; attempt < 20; attempt++) {
      yield* Effect.sleep(250);
      const tick = yield* scheduler.tick;
      readbackPasses++;
      if (
        tick._tag !== "Complete" ||
        A.some(tick.outcomes, (o) => o._tag === "Reconciled" && o.result._tag === "Mismatch")
      )
        return yield* Effect.die("Reconstructed read-back mismatch/deadline");
      const states = yield* Effect.forEach(rows, (row) => worker.ledger.state(row.eventId));
      if (A.every(states, (state) => O.isSome(state) && state.value.state === "visible"))
        return yield* Effect.forEach(rows, (row) =>
          Effect.gen(function* () {
            return {
              ...row,
              automaticScheduling: true,
              readbackPasses,
              priorAcceptanceState: "accepted-unverified",
              state: O.getOrNull(yield* worker.ledger.state(row.eventId)),
            };
          })
        );
    }
    return yield* Effect.die("Reconstructed visibility deadline exceeded");
  });
  const reconstructedObservations = reconstruction === "reconstructed" ? yield* reconstruct() : [];
  yield* fs.writeFileString(
    output,
    yield* encodeJsonValue({
      project: policy.project,
      observations,
      reconstructedObservations,
    }),
    { mode: 0o600 }
  );
});
NodeRuntime.runMain(
  Layer.mergeAll(NodeServices.layer, Reactivity.layer, NodeHttpClient.layerNodeHttp).pipe(
    Layer.build,
    Effect.flatMap((context) => Effect.provide(program, context)),
    Effect.scoped
  )
);
