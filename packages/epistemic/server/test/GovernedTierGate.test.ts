import { EpistemicConfig } from "@beep/epistemic-config/server";
import { testEpistemicConfig } from "@beep/epistemic-config/test";
import {
  ExecutionSink,
  GrantOperation,
  GrantPurpose,
  GrantResource,
  SinkDestination,
} from "@beep/epistemic-domain/values/ExecutionGrant";
import {
  destinationDigestOf,
  ExecutionSettlement,
  operationDigestOf,
  verifyExecutionDecisionChain,
  verifyOutcomeBinding,
} from "@beep/epistemic-domain/values/ExecutionRecord";
import { DenialReason } from "@beep/epistemic-domain/values/ExecutionVerdict";
import {
  GovernedTierGateOptions,
  makeGovernedTierGate,
  refusalGuidance,
} from "@beep/epistemic-server/GovernedTierGate";
import { ExecutionLedger, ExecutionLedgerUnavailable } from "@beep/epistemic-use-cases/ExecutionLedger";
import { CurrentMcpCaller, dispatchWithTierGate, McpCallerIdentity, TierGate, TierGateSettlement } from "@beep/mcp-kit";
import { NonNegativeInt } from "@beep/schema";
import { A, O } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Deferred, Duration, Effect, Fiber, pipe, Ref } from "effect";
import * as Str from "effect/String";
import { Tool } from "effect/unstable/ai";
import type { ExecutionDecisionRecord, ExecutionOutcomeRecord } from "@beep/epistemic-domain/values/ExecutionRecord";
import type { TierGateShape } from "@beep/mcp-kit";

const workspaceDestination = SinkDestination.make("workspace://ontology");

const gateOptions = GovernedTierGateOptions.make({
  grantTtl: Duration.hours(12),
  operations: [GrantOperation.make("ontology_propose_change_batch")],
  purpose: GrantPurpose.make("ontology-workspace-mutation"),
  resource: GrantResource.make("ontology-workspace"),
  sink: ExecutionSink.make({
    audience: "local-workspace",
    destination: workspaceDestination,
    sinkClass: "mcp-write",
  }),
});

const grantedTool = Tool.make("ontology_propose_change_batch");
const ungrantedTool = Tool.make("ontology_unlisted_mutation");

// Real dispatches carry a session id; clientId varies per HTTP request, so a
// helper that pins the session while varying the client mirrors production.
const callerOf = (sessionId: string, clientId = 1) =>
  O.some(McpCallerIdentity.make({ clientId: NonNegativeInt.make(clientId), sessionId: O.some(sessionId) }));

interface Harness {
  readonly decisions: Ref.Ref<ReadonlyArray<ExecutionDecisionRecord>>;
  readonly events: Ref.Ref<ReadonlyArray<string>>;
  readonly gate: TierGateShape;
  readonly outcomes: Ref.Ref<ReadonlyArray<ExecutionOutcomeRecord>>;
}

// A test-local ledger stub, not a shipped in-memory adapter: the ledger's
// real guarantees are the database's, and this stub exists only to observe
// call ordering and inject write failures.
const makeHarness = Effect.fnUntraced(function* (options?: {
  readonly failDecisions?: boolean;
  readonly failOutcomes?: boolean;
}) {
  const decisions = yield* Ref.make<ReadonlyArray<ExecutionDecisionRecord>>([]);
  const outcomes = yield* Ref.make<ReadonlyArray<ExecutionOutcomeRecord>>([]);
  const events = yield* Ref.make<ReadonlyArray<string>>([]);
  const stub = ExecutionLedger.of({
    appendDecision: Effect.fn("GovernedTierGateTest.appendDecision")(function* (record) {
      if (options?.failDecisions === true) {
        return yield* ExecutionLedgerUnavailable.during("appendDecision", "injected decision failure");
      }
      yield* Ref.update(decisions, A.append(record));
      yield* Ref.update(events, A.append("decision"));
    }),
    appendOutcome: Effect.fn("GovernedTierGateTest.appendOutcome")(function* (record) {
      if (options?.failOutcomes === true) {
        return yield* ExecutionLedgerUnavailable.during("appendOutcome", "injected outcome failure");
      }
      yield* Ref.update(outcomes, A.append(record));
      yield* Ref.update(events, A.append("outcome"));
    }),
    readDecisions: Effect.fn("GovernedTierGateTest.readDecisions")(function* (runKey) {
      return A.filter(yield* Ref.get(decisions), (record) => record.runKey === runKey);
    }),
    readOutcomes: Effect.fn("GovernedTierGateTest.readOutcomes")(function* (runKey) {
      return A.filter(yield* Ref.get(outcomes), (record) => record.runKey === runKey);
    }),
    readUnsettledAllowed: Effect.fn("GovernedTierGateTest.readUnsettledAllowed")(function* (runKey) {
      const settled = A.map(yield* Ref.get(outcomes), (record) => record.decisionHash);
      return A.filter(
        yield* Ref.get(decisions),
        (record) => record.runKey === runKey && record.verdict === "allowed" && !A.contains(settled, record.hash)
      );
    }),
  });
  const gate = yield* makeGovernedTierGate(gateOptions).pipe(
    Effect.provideService(ExecutionLedger, stub),
    Effect.provideService(EpistemicConfig, testEpistemicConfig)
  );
  return { decisions, events, gate, outcomes } satisfies Harness;
});

const dispatchAs = <A2, E, R>(
  harness: Harness,
  session: string,
  tool: Tool.Any,
  onApproved: Effect.Effect<A2, E, R>,
  clientId = 1
) =>
  dispatchWithTierGate({ tool, toolCallId: O.none() }, onApproved).pipe(
    Effect.provideService(TierGate, harness.gate),
    Effect.provideService(CurrentMcpCaller, callerOf(session, clientId))
  );

describe("GovernedTierGate", () => {
  it("keeps the settlement vocabulary member-equal with the domain's ExecutionSettlement", () => {
    // The literals are deliberately mirrored without an import — foundation
    // may not import slices — and the domain designates this package as the
    // home of the member-equality assertion (ExecutionRecord.model.ts).
    expect([...TierGateSettlement.Options]).toEqual([...ExecutionSettlement.Options]);
  });

  it.effect(
    "writes the allowed decision ahead of the effect and settles it after",
    Effect.fnUntraced(function* () {
      const harness = yield* makeHarness();
      const result = yield* dispatchAs(harness, "s-1", grantedTool, Ref.update(harness.events, A.append("effect")));

      expect(result._tag).toBe("Dispatched");
      if (result._tag === "Dispatched") {
        expect(result.audit.reason).toBe("Approved by a grant in the session's frozen grant set.");
      }
      // Write-ahead, then the wrapped effect, then the settlement — in order.
      expect(yield* Ref.get(harness.events)).toEqual(["decision", "effect", "outcome"]);

      const decisions = yield* Ref.get(harness.decisions);
      expect(decisions).toHaveLength(1);
      const decision = decisions[0]!;
      expect(decision.verdict).toBe("allowed");
      expect(decision.seq).toBe(0);
      expect(O.isNone(decision.prevHash)).toBe(true);
      expect(decision.sinkClass).toBe("mcp-write");
      expect(decision.audience).toBe("local-workspace");
      expect(decision.operationDigest).toBe(operationDigestOf(GrantOperation.make(grantedTool.name)));
      expect(decision.destinationDigest).toBe(destinationDigestOf(workspaceDestination));
      expect(decision.policyRevision).toBe(testEpistemicConfig.policyRevision);

      const outcomes = yield* Ref.get(harness.outcomes);
      expect(outcomes).toHaveLength(1);
      expect(outcomes[0]!.settlement).toBe("completed");
      expect(verifyOutcomeBinding(outcomes[0]!, decision)).toBe(true);
    })
  );

  it.effect(
    "chains consecutive decisions of one session into one verified run",
    Effect.fnUntraced(function* () {
      const harness = yield* makeHarness();
      yield* dispatchAs(harness, "s-1", grantedTool, Effect.void);
      yield* dispatchAs(harness, "s-1", ungrantedTool, Effect.void);
      yield* dispatchAs(harness, "s-1", grantedTool, Effect.void);

      const decisions = yield* Ref.get(harness.decisions);
      expect(A.map(decisions, (record) => record.seq)).toEqual([0, 1, 2]);
      expect(A.map(decisions, (record) => record.verdict)).toEqual(["allowed", "denied", "allowed"]);
      const runKey = decisions[0]!.runKey;
      expect(A.every(decisions, (record) => record.runKey === runKey)).toBe(true);
      expect(A.every(decisions, (record) => record.grantSetDigest === decisions[0]!.grantSetDigest)).toBe(true);
      expect(verifyExecutionDecisionChain(decisions, runKey).result).toBe("chain-intact");

      // The denied middle decision never settles; both allowed ones do.
      const outcomes = yield* Ref.get(harness.outcomes);
      expect(A.map(outcomes, (record) => record.decisionHash)).toEqual([decisions[0]!.hash, decisions[2]!.hash]);
    })
  );

  it.effect(
    "refuses an ungranted operation as a value and records the denied decision",
    Effect.fnUntraced(function* () {
      const harness = yield* makeHarness();
      const result = yield* dispatchAs(harness, "s-1", ungrantedTool, Ref.update(harness.events, A.append("effect")));

      expect(result._tag).toBe("Refused");
      // Exactly one ledger event — the denied decision. The wrapped effect
      // never ran and no outcome is written or expected.
      expect(yield* Ref.get(harness.events)).toEqual(["decision"]);
      const decisions = yield* Ref.get(harness.decisions);
      expect(decisions).toHaveLength(1);
      expect(decisions[0]!.verdict).toBe("denied");
      expect(decisions[0]!.verdict === "denied" && decisions[0]!.reason).toBe("operation-not-granted");
    })
  );

  it.effect(
    "refuses fail-closed when the write-ahead decision cannot be written",
    Effect.fnUntraced(function* () {
      const harness = yield* makeHarness({ failDecisions: true });
      const result = yield* dispatchAs(harness, "s-1", grantedTool, Ref.update(harness.events, A.append("effect")));

      expect(result._tag).toBe("Refused");
      // No record, no action: the effect never ran and nothing was persisted.
      expect(yield* Ref.get(harness.events)).toEqual([]);
      expect(yield* Ref.get(harness.decisions)).toHaveLength(0);
    })
  );

  it.effect(
    "refuses a caller-less dispatch without touching the ledger",
    Effect.fnUntraced(function* () {
      const harness = yield* makeHarness();
      // No CurrentMcpCaller provided: the reference defaults to none, which is
      // the layer-build / health-probe shape, not an MCP session.
      const result = yield* dispatchWithTierGate(
        { tool: grantedTool, toolCallId: O.none() },
        Ref.update(harness.events, A.append("effect"))
      ).pipe(Effect.provideService(TierGate, harness.gate));

      expect(result._tag).toBe("Refused");
      expect(yield* Ref.get(harness.events)).toEqual([]);
    })
  );

  it.effect(
    "persists a failed settlement without altering the dispatch error channel",
    Effect.fnUntraced(function* () {
      const harness = yield* makeHarness();
      const failure = yield* dispatchAs(harness, "s-1", grantedTool, Effect.fail("boom" as const)).pipe(Effect.flip);

      expect(failure).toBe("boom");
      const outcomes = yield* Ref.get(harness.outcomes);
      expect(outcomes).toHaveLength(1);
      // settlementOf's full classification (completed/failed/interrupted) is
      // proven in mcp-kit; here what matters is that the bounded literal is
      // persisted against the write-ahead decision.
      expect(outcomes[0]!.settlement).toBe("failed");
      const decisions = yield* Ref.get(harness.decisions);
      expect(verifyOutcomeBinding(outcomes[0]!, decisions[0]!)).toBe(true);
    })
  );

  it.effect(
    "freezes distinct runs for distinct clients",
    Effect.fnUntraced(function* () {
      const harness = yield* makeHarness();
      yield* dispatchAs(harness, "s-1", grantedTool, Effect.void);
      yield* dispatchAs(harness, "s-2", grantedTool, Effect.void);

      const decisions = yield* Ref.get(harness.decisions);
      expect(decisions).toHaveLength(2);
      expect(A.map(decisions, (record) => record.seq)).toEqual([0, 0]);
      expect(decisions[0]!.runKey).not.toBe(decisions[1]!.runKey);
    })
  );

  it.effect(
    "swallows a failed outcome write so the dispatch result stands",
    Effect.fnUntraced(function* () {
      const harness = yield* makeHarness({ failOutcomes: true });
      const result = yield* dispatchAs(harness, "s-1", grantedTool, Effect.succeed("done"));

      expect(result._tag).toBe("Dispatched");
      // The decision persisted, the outcome write failed and was dropped —
      // the decision stays visibly unsettled in the derived-unknown view.
      expect(yield* Ref.get(harness.decisions)).toHaveLength(1);
      expect(yield* Ref.get(harness.outcomes)).toHaveLength(0);
    })
  );

  it.effect(
    "binds each settlement to its own dispatch when same-tool dispatches overlap",
    Effect.fnUntraced(function* () {
      const harness = yield* makeHarness();
      const slow = yield* Deferred.make<void>();
      const fast = yield* Deferred.make<void>();

      // Two concurrent dispatches of ONE tool on ONE session, finishing in the
      // reverse of their decision order. Correlation is by dispatch fiber, so
      // each settlement must bind to its own decision rather than to whichever
      // decision was written first.
      const first = yield* Effect.forkChild(dispatchAs(harness, "s-1", grantedTool, Deferred.await(slow)));
      yield* Effect.yieldNow;
      const second = yield* Effect.forkChild(
        dispatchAs(
          harness,
          "s-1",
          grantedTool,
          Deferred.await(fast).pipe(Effect.andThen(Effect.fail("second" as const)))
        )
      );
      yield* Effect.yieldNow;

      const decisions = yield* Ref.get(harness.decisions);
      expect(decisions).toHaveLength(2);

      // The SECOND decision settles first, and fails.
      yield* Deferred.succeed(fast, undefined);
      yield* Fiber.await(second);
      yield* Deferred.succeed(slow, undefined);
      yield* Fiber.await(first);

      const outcomes = yield* Ref.get(harness.outcomes);
      expect(outcomes).toHaveLength(2);
      const settlementOf = (hash: string) =>
        pipe(
          A.findFirst(outcomes, (record) => record.decisionHash === hash),
          O.map((record) => record.settlement),
          O.getOrElse(() => "missing")
        );
      expect(settlementOf(decisions[0]!.hash)).toBe("completed");
      expect(settlementOf(decisions[1]!.hash)).toBe("failed");
    })
  );

  it.effect(
    "keys the run on the session, not on the per-request client id",
    Effect.fnUntraced(function* () {
      const harness = yield* makeHarness();
      // One MCP session, three dispatches, three different client ids — which
      // is what the HTTP protocol actually produces (a fresh clientId per
      // request). All three must chain into ONE run.
      yield* dispatchAs(harness, "s-1", grantedTool, Effect.void, 7);
      yield* dispatchAs(harness, "s-1", grantedTool, Effect.void, 8);
      yield* dispatchAs(harness, "s-1", grantedTool, Effect.void, 9);

      const decisions = yield* Ref.get(harness.decisions);
      expect(A.map(decisions, (record) => record.seq)).toEqual([0, 1, 2]);
      expect(A.every(decisions, (record) => record.runKey === decisions[0]!.runKey)).toBe(true);
      expect(verifyExecutionDecisionChain(decisions, decisions[0]!.runKey).result).toBe("chain-intact");
    })
  );

  it.effect(
    "never returns a differential refusal reason to the caller",
    Effect.fnUntraced(function* () {
      const harness = yield* makeHarness();
      const ungranted = yield* dispatchAs(harness, "s-1", ungrantedTool, Effect.void);
      const callerLess = yield* dispatchWithTierGate({ tool: grantedTool, toolCallId: O.none() }, Effect.void).pipe(
        Effect.provideService(TierGate, harness.gate)
      );
      const outage = yield* makeHarness({ failDecisions: true }).pipe(
        Effect.flatMap((failing) => dispatchAs(failing, "s-1", grantedTool, Effect.void))
      );

      // Three refusals with three different bounded reasons — an ordinary
      // policy denial, no session in scope, and a ledger outage — are
      // indistinguishable to the caller. Differential text would let an agent
      // enumerate the grant set and detect an infrastructure outage.
      const reasons = A.map([ungranted, callerLess, outage], (result) =>
        result._tag === "Refused" ? result.audit.reason : "dispatched"
      );
      expect(reasons).toEqual([refusalGuidance, refusalGuidance, refusalGuidance]);
      // And the constant carries none of the bounded vocabulary.
      expect(A.some(DenialReason.Options, (reason) => Str.includes(reason)(refusalGuidance))).toBe(false);
    })
  );
});
