import { ExecutionAuthorityConfig } from "@beep/execution-authority-config/server";
import { testExecutionAuthorityConfig } from "@beep/execution-authority-config/test";
import {
  destinationDigestOf,
  ExecutionSettlement,
  operationDigestOf,
  verifyExecutionDecisionChain,
  verifyOutcomeBinding,
} from "@beep/execution-authority-domain/entities/ExecutionRecord";
import {
  ExecutionSink,
  GrantOperation,
  GrantPurpose,
  GrantResource,
  SinkDestination,
} from "@beep/execution-authority-domain/values/ExecutionGrant";
import { DenialReason } from "@beep/execution-authority-domain/values/ExecutionVerdict";
import {
  GovernedTierGateOptions,
  makeGovernedTierGate,
  refusalGuidance,
} from "@beep/execution-authority-server/GovernedTierGate";
import { ExecutionLedger, ExecutionLedgerUnavailable } from "@beep/execution-authority-use-cases/ExecutionLedger";
import { CurrentMcpCaller, dispatchWithTierGate, McpCallerIdentity, TierGate, TierGateSettlement } from "@beep/mcp-kit";
import { it } from "@beep/test-runner";
import { A, O } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertNone, assertTrue } from "@effect/vitest/utils";
import * as Tool from "effect/ai/Tool";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import { pipe } from "effect/Function";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type {
  ExecutionDecisionRecord,
  ExecutionOutcomeRecord,
} from "@beep/execution-authority-domain/entities/ExecutionRecord";
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

const sessionPinnedCaller = (sessionId: string, clientId = 1) =>
  McpCallerIdentity.makeOption({ clientId: S.Natural.make(clientId), sessionId: O.some(sessionId) });

interface Harness {
  readonly decisions: Ref.Ref<ReadonlyArray<ExecutionDecisionRecord>>;
  readonly events: Ref.Ref<ReadonlyArray<string>>;
  readonly gate: TierGateShape;
  readonly outcomes: Ref.Ref<ReadonlyArray<ExecutionOutcomeRecord>>;
}

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
      const got = yield* Ref.get(decisions);
      return A.filter(got, (record) => record.runKey === runKey);
    }),
    readOutcomes: Effect.fn("GovernedTierGateTest.readOutcomes")(function* (runKey) {
      const got1 = yield* Ref.get(outcomes);
      return A.filter(got1, (record) => record.runKey === runKey);
    }),
    readUnsettledAllowed: Effect.fn("GovernedTierGateTest.readUnsettledAllowed")(function* (runKey) {
      const got2 = yield* Ref.get(outcomes);
      const settled = A.map(got2, (record) => record.decisionHash);
      const got3 = yield* Ref.get(decisions);
      return A.filter(
        got3,
        (record) => record.runKey === runKey && record.verdict === "allowed" && !A.contains(settled, record.hash)
      );
    }),
  });
  const gate = yield* makeGovernedTierGate(gateOptions).pipe(
    Effect.provideService(ExecutionLedger, stub),
    Effect.provideService(ExecutionAuthorityConfig, testExecutionAuthorityConfig)
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
    Effect.provideService(CurrentMcpCaller, sessionPinnedCaller(session, clientId))
  );

describe("GovernedTierGate", () => {
  it("keeps the settlement vocabulary member-equal with the domain's ExecutionSettlement", () => {
    expect(
      [...TierGateSettlement.literals],
      "mirrored without an import (foundation may not import slices); ExecutionRecord.model.ts homes this check here"
    ).toEqual([...ExecutionSettlement.literals]);
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
      const got4 = yield* Ref.get(harness.events);
      expect(got4, "write-ahead, then the wrapped effect, then the settlement, in order").toEqual([
        "decision",
        "effect",
        "outcome",
      ]);

      const decisions = yield* Ref.get(harness.decisions);
      expect(decisions).toHaveLength(1);
      const decision = decisions[0]!;
      expect(decision.verdict).toBe("allowed");
      expect(decision.seq).toBe(0);
      assertNone(decision.prevHash);
      expect(decision.sinkClass).toBe("mcp-write");
      expect(decision.audience).toBe("local-workspace");
      expect(decision.operationDigest).toBe(operationDigestOf(GrantOperation.make(grantedTool.name)));
      expect(decision.destinationDigest).toBe(destinationDigestOf(workspaceDestination));
      expect(decision.policyRevision).toBe(testExecutionAuthorityConfig.policyRevision);

      const outcomes = yield* Ref.get(harness.outcomes);
      expect(outcomes).toHaveLength(1);
      expect(outcomes[0]!.settlement).toBe("completed");
      pipe(verifyOutcomeBinding(outcomes[0]!, decision), assertTrue);
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
      pipe(
        A.every(decisions, (record) => record.runKey === runKey),
        assertTrue
      );
      pipe(
        A.every(decisions, (record) => record.grantSetDigest === decisions[0]!.grantSetDigest),
        assertTrue
      );
      expect(verifyExecutionDecisionChain(decisions, runKey).result).toBe("chain-intact");

      const outcomes = yield* Ref.get(harness.outcomes);
      expect(
        A.map(outcomes, (record) => record.decisionHash),
        "the denied middle decision never settles; both allowed ones do"
      ).toEqual([decisions[0]!.hash, decisions[2]!.hash]);
    })
  );

  it.effect(
    "refuses an ungranted operation as a value and records the denied decision",
    Effect.fnUntraced(function* () {
      const harness = yield* makeHarness();
      const result = yield* dispatchAs(harness, "s-1", ungrantedTool, Ref.update(harness.events, A.append("effect")));

      expect(result._tag).toBe("Refused");
      const got5 = yield* Ref.get(harness.events);
      expect(got5, "only the denied decision: the wrapped effect never ran and no outcome is written").toEqual([
        "decision",
      ]);
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
      const got6 = yield* Ref.get(harness.events);
      expect(got6, "no record, no action: the effect never ran and nothing was persisted").toEqual([]);
      const got7 = yield* Ref.get(harness.decisions);
      expect(got7).toHaveLength(0);
    })
  );

  it.effect(
    "refuses a caller-less dispatch without touching the ledger",
    Effect.fnUntraced(function* () {
      const harness = yield* makeHarness();
      const result = yield* dispatchWithTierGate(
        { tool: grantedTool, toolCallId: O.none() },
        Ref.update(harness.events, A.append("effect"))
      ).pipe(Effect.provideService(TierGate, harness.gate));

      expect(
        result._tag,
        "no CurrentMcpCaller defaults to none: the layer-build or health-probe shape, not an MCP session"
      ).toBe("Refused");
      const got8 = yield* Ref.get(harness.events);
      expect(got8).toEqual([]);
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
      expect(outcomes[0]!.settlement).toBe("failed");
      const decisions = yield* Ref.get(harness.decisions);
      pipe(verifyOutcomeBinding(outcomes[0]!, decisions[0]!), assertTrue);
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
      const got9 = yield* Ref.get(harness.decisions);
      expect(got9).toHaveLength(1);
      const got10 = yield* Ref.get(harness.outcomes);
      expect(
        got10,
        "the dropped outcome leaves the decision visibly unsettled in the derived-unknown view"
      ).toHaveLength(0);
    })
  );

  it.effect(
    "binds each settlement to its own dispatch when same-tool dispatches overlap",
    Effect.fnUntraced(function* () {
      const harness = yield* makeHarness();
      const slow = yield* Deferred.make<void>();
      const fast = yield* Deferred.make<void>();
      const firstStarted = yield* Deferred.make<void>();
      const secondStarted = yield* Deferred.make<void>();

      const first = yield* Effect.forkChild(
        dispatchAs(
          harness,
          "s-1",
          grantedTool,
          Deferred.succeed(firstStarted, undefined).pipe(Effect.andThen(Deferred.await(slow)))
        )
      );
      yield* Deferred.await(firstStarted);
      const second = yield* Effect.forkChild(
        dispatchAs(
          harness,
          "s-1",
          grantedTool,
          Deferred.succeed(secondStarted, undefined).pipe(
            Effect.andThen(Deferred.await(fast)),
            Effect.andThen(Effect.fail("second" as const))
          )
        )
      );
      yield* Deferred.await(secondStarted);

      const decisions = yield* Ref.get(harness.decisions);
      expect(decisions).toHaveLength(2);

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
      expect(
        settlementOf(decisions[1]!.hash),
        "correlation is by dispatch fiber: the second decision settles first and binds its own failure"
      ).toBe("failed");
    })
  );

  it.effect(
    "keys the run on the session, not on the per-request client id",
    Effect.fnUntraced(function* () {
      const harness = yield* makeHarness();
      yield* dispatchAs(harness, "s-1", grantedTool, Effect.void, 7);
      yield* dispatchAs(harness, "s-1", grantedTool, Effect.void, 8);
      yield* dispatchAs(harness, "s-1", grantedTool, Effect.void, 9);

      const decisions = yield* Ref.get(harness.decisions);
      expect(
        A.map(decisions, (record) => record.seq),
        "HTTP mints a fresh clientId per request: three client ids on one session chain into one run"
      ).toEqual([0, 1, 2]);
      pipe(
        A.every(decisions, (record) => record.runKey === decisions[0]!.runKey),
        assertTrue
      );
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

      const reasons = A.map([ungranted, callerLess, outage], (result) =>
        result._tag === "Refused" ? result.audit.reason : "dispatched"
      );
      expect(
        reasons,
        "policy denial, no session and ledger outage read alike: differential text would let an agent enumerate grants or spot an outage"
      ).toEqual([refusalGuidance, refusalGuidance, refusalGuidance]);
      pipe(
        A.some(DenialReason.literals, (reason) => Str.includes(reason)(refusalGuidance)),
        assertFalse
      );
    })
  );
});
