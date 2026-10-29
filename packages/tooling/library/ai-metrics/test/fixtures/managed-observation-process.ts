// Synthetic native peer only; this fixture never launches a provider executable.
import { AiProviderCliSession, ManagedLaunchProfile, ManagedSessionError } from "@beep/ai-provider-cli";
import {
  initializeObservationClaims,
  makeObservationClaims,
  ObservationClaimAnchor,
  ObservationClaimPolicy,
} from "@beep/repo-ai-metrics/observation-launch-claims";
import {
  makeObservationLaunchClient,
  ObservationLaunchClientError,
  ObservationLaunchClientPolicy,
} from "@beep/repo-ai-metrics/observation-launch-client";
import {
  ObservationLaunchFact,
  ObservationLaunchIdentity,
  ObservationLaunchReceipt,
} from "@beep/repo-ai-metrics/observation-launch-facts";
import { ObservationLaunchSubmission } from "@beep/repo-ai-metrics/observation-launch-http";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { Sha256Hex } from "@beep/schema";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { syntheticLaunchSalt } from "./observation-launch-config.ts";
import type { ManagedSessionIdentity, ManagedSessionProcess } from "@beep/ai-provider-cli";

const program = Effect.gen(function* () {
  const [directory, hostId, namespaceId, peer, claimDirectory, claimMode] = yield* S.decodeUnknownEffect(
    S.Tuple([S.String, Sha256Hex, Sha256Hex, S.String, S.String, S.Literals(["initialize", "retry"])])
  )(A.drop(process.argv, 2));
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const workspace = path.join(directory, "synthetic-agent-workspace");
  const home = path.join(directory, "synthetic-agent-home");
  const client = yield* makeObservationLaunchClient(
    ObservationLaunchClientPolicy.make({ directory, hostId, namespaceId, timeoutMillis: 2000 }),
    process.geteuid?.() ?? -1
  );
  const context = yield* client.context;
  if (!context.accepting) return yield* Effect.die("Synthetic worker is paused");
  const launchId = Sha256Hex.make(Str.repeat(64)("5"));
  const receipts = yield* Ref.make<ReadonlyArray<ObservationLaunchReceipt>>([]);
  const prepared = ObservationLaunchFact.cases.Prepared.make({
    launchId,
    identity: ObservationLaunchIdentity.make({
      routeId: Sha256Hex.make(Str.repeat(64)("c")),
      harness: "codex-cli",
      surface: "cli",
      root: { _tag: "Unknown" },
      repository: { _tag: "Unknown" },
      clone: { _tag: "Unknown" },
      worktree: { _tag: "Unknown" },
      task: { _tag: "Unknown" },
      attempt: { _tag: "Unknown" },
      evidenceId: launchId,
    }),
  });
  const uid = process.geteuid?.() ?? -1;
  const policy = ObservationClaimPolicy.make({
    directory: claimDirectory,
    journalDirectory: directory,
    anchor: ObservationClaimAnchor.make({
      fenceId: Sha256Hex.make(Str.repeat(64)("6")),
      hostId,
      namespaceId,
      maxClaims: 4,
    }),
  });
  if (claimMode === "initialize") yield* initializeObservationClaims(policy, uid);
  const claims = yield* makeObservationClaims(policy, uid);
  const lostAck = yield* Ref.make(false);
  const submit = Effect.fn("ManagedObservationFixture.submit")(function* (fact: ObservationLaunchFact) {
    yield* claims.appendObservation(
      ObservationLaunchSubmission.make({ hostId, namespaceId, evidenceEpoch: context.evidenceEpoch, fact })
    );
    yield* claims.reconcile(launchId, (submission) =>
      Effect.gen(function* () {
        const receipt = yield* client.submit(submission);
        yield* Ref.update(receipts, (rows) =>
          A.append(
            A.filter(rows, (row) => row.fact._tag !== receipt.fact._tag),
            receipt
          )
        );
        // Deliberately lose only the final observation acknowledgment after the real worker commits it.
        if (fact._tag === "Finished" && submission.fact._tag === "Finished") {
          yield* Ref.set(lostAck, true);
          return yield* ObservationLaunchClientError.make({ reason: "ambiguous" });
        }
        return receipt;
      })
    );
  });
  yield* claims
    .runOnce(
      ObservationLaunchSubmission.make({ hostId, namespaceId, evidenceEpoch: context.evidenceEpoch, fact: prepared }),
      () =>
        Effect.gen(function* () {
          // The claim must commit before even the disposable workspace is created.
          yield* fs.makeDirectory(workspace, { mode: 0o700 });
          yield* submit(prepared);
          const observeFailure = () =>
            ManagedSessionError.make({
              reason: "transport",
              operation: "synthetic-observation",
              message: "Synthetic observation failed",
            });
          const session = yield* (yield* AiProviderCliSession).open(
            ManagedLaunchProfile.make({
              provider: "codex",
              executable: process.execPath,
              prefixArgs: [peer],
              workspace,
              profileRoot: home,
              env: { HOME: home, CODEX_HOME: path.join(home, ".codex"), PATH: "/usr/bin:/bin" },
              authLane: "existing-subscription",
              tools: [],
            }),
            {
              started: Effect.fn("ManagedObservationFixture.started")(function* (child: ManagedSessionProcess) {
                const processInstanceId = yield* hashPrivateIdentifier(
                  `synthetic-managed-process/v1:${launchId}:${child.pid}`,
                  O.some(syntheticLaunchSalt)
                );
                yield* submit(ObservationLaunchFact.cases.Started.make({ launchId, processInstanceId }));
              }, Effect.mapError(observeFailure)),
              bound: Effect.fn("ManagedObservationFixture.bound")(function* (identity: ManagedSessionIdentity) {
                // Exactly the same source-session hashing contract as native/transcript intake.
                const sourceSessionId = yield* hashPrivateIdentifier(identity.sessionId, O.some(syntheticLaunchSalt));
                yield* submit(ObservationLaunchFact.cases.SessionBound.make({ launchId, sourceSessionId }));
              }, Effect.mapError(observeFailure)),
            }
          );
          yield* session.close;
          if (yield* session.process.isRunning) return yield* Effect.die("Synthetic child survived close");
          yield* submit(ObservationLaunchFact.cases.Finished.make({ launchId, outcome: "cancelled" })).pipe(
            Effect.catchTag("ObservationLaunchClientError", (error) =>
              error.reason === "ambiguous" ? Effect.void : Effect.fail(error)
            )
          );
          if (!(yield* Ref.get(lostAck))) return yield* Effect.die("Synthetic lost acknowledgment was not exercised");
          const outbox = yield* claims.readOutbox(launchId);
          yield* Console.log(
            yield* S.encodeEffect(
              S.fromJsonString(
                S.Struct({
                  receipts: S.Array(ObservationLaunchReceipt),
                  childStopped: S.Boolean,
                  syntheticOnly: S.Boolean,
                  lostAcknowledgment: S.Boolean,
                  outboxReceipts: S.Natural,
                })
              )
            )({
              receipts: yield* Ref.get(receipts),
              childStopped: true,
              syntheticOnly: true,
              lostAcknowledgment: true,
              outboxReceipts: outbox.receipts.length,
            })
          );
        })
    )
    .pipe(
      Effect.catchTag("ObservationClaimError", (error) =>
        error.reason === "claimed"
          ? Effect.gen(function* () {
              const recovered = yield* claims.reconcile(launchId, client.submit);
              const state = yield* claims.readOutbox(launchId);
              yield* Console.log(
                yield* S.encodeEffect(
                  S.fromJsonString(
                    S.Struct({
                      refused: S.Literal("claimed"),
                      receipts: S.Array(ObservationLaunchReceipt),
                      outboxReceipts: S.Natural,
                    })
                  )
                )({ refused: "claimed", receipts: recovered, outboxReceipts: state.receipts.length })
              );
            })
          : Effect.fail(error)
      )
    );
});
NodeRuntime.runMain(
  Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, AiProviderCliSession.layer).pipe(
    Layer.build,
    Effect.flatMap((context) => Effect.provide(program, context)),
    Effect.scoped
  ),
  { disableErrorReporting: true }
);
