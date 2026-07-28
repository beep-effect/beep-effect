import { EgressDenied } from "@beep/api-transport";
import { defaultPolicyRevision, EpistemicConfig, EpistemicServerConfig } from "@beep/epistemic-config/server";
import { fixtureAllowedDestination, testEpistemicConfig } from "@beep/epistemic-config/test";
import {
  GrantOperation,
  GrantPurpose,
  GrantResource,
  SinkDestination,
} from "@beep/epistemic-domain/values/ExecutionGrant";
import { destinationDigestOf, verifyExecutionDecisionChain } from "@beep/epistemic-domain/values/ExecutionRecord";
import { GovernedEgressOptions, makeGovernedEgressFetch } from "@beep/epistemic-server/GovernedEgress";
import { ExecutionLedger, ExecutionLedgerUnavailable } from "@beep/epistemic-use-cases/ExecutionLedger";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Duration, Effect, Ref } from "effect";
import type { ExecutionDecisionRecord, ExecutionOutcomeRecord } from "@beep/epistemic-domain/values/ExecutionRecord";

const egressOptions = GovernedEgressOptions.make({
  grantTtl: Duration.hours(12),
  operation: GrantOperation.make("http-egress"),
  purpose: GrantPurpose.make("ontology-provenance-publication"),
  resource: GrantResource.make("ontology-workspace"),
});

const allowedUrl = `${fixtureAllowedDestination}/v1/publish`;

interface Harness {
  // A plain array rather than a Ref: the recorder is written from inside a
  // promise-returning `fetch`, which has no fiber to run an Effect on.
  readonly attempted: ReadonlyArray<string>;
  readonly decisions: Ref.Ref<ReadonlyArray<ExecutionDecisionRecord>>;
  readonly fetch: typeof globalThis.fetch;
  readonly redirectModes: ReadonlyArray<string>;
}

// A test-local ledger stub for the same reason the gate suite has one: the
// ledger's real guarantees are the database's, and this exists only to observe
// what the boundary writes and to inject write failures.
const makeHarness = Effect.fnUntraced(function* (options?: {
  readonly config?: EpistemicServerConfig;
  readonly contendAppends?: boolean;
  readonly failDecisions?: boolean;
}) {
  const decisions = yield* Ref.make<ReadonlyArray<ExecutionDecisionRecord>>([]);
  const attempted: Array<string> = [];
  const stub = ExecutionLedger.of({
    appendDecision: Effect.fn("GovernedEgressTest.appendDecision")(function* (record) {
      if (options?.failDecisions === true) {
        return yield* ExecutionLedgerUnavailable.during("appendDecision", "injected decision failure");
      }
      if (options?.contendAppends === true) {
        // A yield point inside the append, not a timed sleep: `it.effect`
        // installs a TestClock, so a sleep would never advance. Yielding hands
        // the scheduler to the other in-flight authorizations, which is what
        // widens an unserialized read window into a visible fork.
        yield* Effect.yieldNow;
      }
      yield* Ref.update(decisions, A.append(record));
    }),
    appendOutcome: Effect.fn("GovernedEgressTest.appendOutcome")(function* () {}),
    readDecisions: Effect.fn("GovernedEgressTest.readDecisions")(function* (runKey) {
      return A.filter(yield* Ref.get(decisions), (record) => record.runKey === runKey);
    }),
    readOutcomes: Effect.fn("GovernedEgressTest.readOutcomes")(function* () {
      return [] as ReadonlyArray<ExecutionOutcomeRecord>;
    }),
    readUnsettledAllowed: Effect.fn("GovernedEgressTest.readUnsettledAllowed")(function* () {
      return [] as ReadonlyArray<ExecutionDecisionRecord>;
    }),
  });
  // The base fetch records what the boundary let through and never reaches the
  // network, so "allowed" is a positively observed fact rather than an absence
  // of errors.
  const redirectModes: Array<string> = [];
  const baseFetch = ((input: RequestInfo | URL, requestInit?: RequestInit) => {
    attempted.push(String(input));
    redirectModes.push(String(requestInit?.redirect));
    return Promise.resolve(new Response("delivered", { status: 200 }));
  }) as typeof globalThis.fetch;
  const fetch = yield* makeGovernedEgressFetch(egressOptions, baseFetch).pipe(
    Effect.provideService(ExecutionLedger, stub),
    Effect.provideService(EpistemicConfig, options?.config ?? testEpistemicConfig)
  );
  return { attempted, decisions, fetch, redirectModes } satisfies Harness;
});

const emptyAllowlistConfig = EpistemicServerConfig.make({
  destinationAllowlist: [],
  policyRevision: defaultPolicyRevision,
});

const attemptEgress = (harness: Harness, url: string) =>
  Effect.promise(() =>
    harness.fetch(url, { method: "POST" }).then(
      (response) => ({ rejected: false, value: response as unknown }),
      (thrown: unknown) => ({ rejected: true, value: thrown })
    )
  );

// Scoped to the denied URL rather than asserting nothing was ever attempted,
// so it stays honest in a test that also makes allowed requests.
const expectDenied = Effect.fn("GovernedEgressTest.expectDenied")(function* (harness: Harness, url: string) {
  const outcome = yield* attemptEgress(harness, url);
  expect(outcome.rejected).toBe(true);
  expect(A.contains(harness.attempted, url)).toBe(false);
});

describe("GovernedEgress", () => {
  it.effect("delivers an allowlisted destination and records the allowed decision", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness();
      const response = yield* Effect.promise(() => harness.fetch(allowedUrl, { method: "POST" }));

      expect(response.status).toBe(200);
      // The positive sibling fact: the request actually reached the base fetch.
      expect(harness.attempted).toEqual([allowedUrl]);
      const decisions = yield* Ref.get(harness.decisions);
      expect(decisions).toHaveLength(1);
      expect(decisions[0]!.verdict).toBe("allowed");
      expect(decisions[0]!.sinkClass).toBe("network-egress");
      expect(decisions[0]!.audience).toBe("external-network");
      // The record names what was actually requested, not the allowlist entry
      // that covered it.
      expect(decisions[0]!.destinationDigest).toBe(destinationDigestOf(SinkDestination.make(allowedUrl)));
      // Redirects are not followed: authorizing the first hop would otherwise
      // authorize wherever that hop chose to send the request next.
      expect(harness.redirectModes).toEqual(["error"]);
    })
  );

  it.effect("denies every destination when the allowlist is empty", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness({ config: emptyAllowlistConfig });
      yield* expectDenied(harness, allowedUrl);

      const decisions = yield* Ref.get(harness.decisions);
      expect(decisions).toHaveLength(1);
      expect(decisions[0]!.verdict).toBe("denied");
      expect(decisions[0]!.verdict === "denied" && decisions[0]!.reason).toBe("operation-not-granted");
    })
  );

  it.effect("rejects with the reason-free EgressDenied error", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness();
      const error = yield* Effect.promise(() =>
        harness.fetch("https://not-allowed.example/publish", { method: "POST" }).then(
          () => undefined,
          (thrown: unknown) => thrown
        )
      );

      expect(EgressDenied.is(error)).toBe(true);
      // Field-free by construction: there is nothing on it for an agent to read.
      expect(Object.keys(error as object).filter((key) => key !== "_tag")).toEqual([]);
    })
  );

  it.effect("does not let a lookalike host borrow an allowlist entry's prefix", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness();
      // `https://registry.example.evil.test` starts with the allowed entry's
      // text. A prefix match without the `/` boundary would deliver it.
      yield* expectDenied(harness, "https://registry.example.evil.test/publish");
      // Userinfo that reads like the allowed host but resolves elsewhere.
      yield* expectDenied(harness, "https://registry.example@evil.test/publish");

      const decisions = yield* Ref.get(harness.decisions);
      expect(A.map(decisions, (record) => record.verdict)).toEqual(["denied", "denied"]);
      expect(decisions[0]!.destinationDigest).not.toBe(destinationDigestOf(fixtureAllowedDestination));
    })
  );

  it.effect("refuses the request when the decision write fails", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness({ failDecisions: true });
      // The destination is allowed; only the record is unavailable. No record,
      // no request.
      yield* expectDenied(harness, allowedUrl);
      expect(yield* Ref.get(harness.decisions)).toHaveLength(0);
    })
  );

  it.effect("chains its decisions into one verifiable run", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness();
      yield* Effect.promise(() => harness.fetch(allowedUrl, { method: "POST" }));
      yield* expectDenied(harness, "https://not-allowed.example/publish");
      yield* Effect.promise(() => harness.fetch(allowedUrl, { method: "POST" }));

      const decisions = yield* Ref.get(harness.decisions);
      expect(A.map(decisions, (record) => record.seq)).toEqual([0, 1, 2]);
      expect(A.map(decisions, (record) => record.verdict)).toEqual(["allowed", "denied", "allowed"]);
      const runKey = decisions[0]!.runKey;
      expect(A.every(decisions, (record) => record.runKey === runKey)).toBe(true);
      expect(verifyExecutionDecisionChain(decisions, runKey).result).toBe("chain-intact");
    })
  );

  it.effect("keeps the chain dense when many requests are authorized concurrently", () =>
    Effect.gen(function* () {
      // Each `fetch` call authorizes on its own detached fiber, so the ledger
      // append and the chain advance are only serialized by the boundary's
      // semaphore. A slow append widens any unserialized read window: without
      // the permit, two requests read the same `nextSeq` and the chain forks.
      const harness = yield* makeHarness({ contendAppends: true });
      const urls = A.map(A.range(0, 19), (index) =>
        index % 2 === 0 ? allowedUrl : `https://not-allowed-${index}.example/x`
      );
      yield* Effect.promise(() =>
        Promise.all(A.map(urls, (url) => harness.fetch(url, { method: "POST" }).catch(() => undefined)))
      );

      const decisions = yield* Ref.get(harness.decisions);
      expect(A.map(decisions, (record) => record.seq)).toEqual(A.map(A.range(0, 19), (index) => index));
      const runKey = decisions[0]!.runKey;
      expect(verifyExecutionDecisionChain(decisions, runKey).result).toBe("chain-intact");
      // Exactly the allowed half was delivered — the denials did not merely
      // fail to record, they failed to leave.
      expect(harness.attempted).toHaveLength(10);
    })
  );

  it.effect("distinguishes two allowed requests that differ only past the granted prefix", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness();
      // Both are covered by the same allowlist entry, so both are allowed. The
      // second is the exfiltration shape: a payload carried out in the query
      // string of an otherwise legitimate destination. If the row named the
      // covering entry, these two would be indistinguishable in the ledger and
      // the record would be useless for reconstructing what left the machine.
      yield* Effect.promise(() => harness.fetch(allowedUrl, { method: "POST" }));
      const exfiltrating = `${allowedUrl}?payload=privileged-text`;
      yield* Effect.promise(() => harness.fetch(exfiltrating, { method: "POST" }));

      const decisions = yield* Ref.get(harness.decisions);
      expect(A.map(decisions, (record) => record.verdict)).toEqual(["allowed", "allowed"]);
      expect(decisions[1]!.destinationDigest).not.toBe(decisions[0]!.destinationDigest);
      expect(decisions[1]!.destinationDigest).toBe(destinationDigestOf(SinkDestination.make(exfiltrating)));
      // The query does not widen coverage either — it is dropped before the
      // allowlist comparison, so it can neither buy nor lose authority.
      expect(harness.attempted).toEqual([allowedUrl, exfiltrating]);
    })
  );

  it.effect("drops an unparseable allowlist entry instead of granting it", () =>
    Effect.gen(function* () {
      const harness = yield* makeHarness({
        config: EpistemicServerConfig.make({
          destinationAllowlist: [SinkDestination.make("not a url"), fixtureAllowedDestination],
          policyRevision: defaultPolicyRevision,
        }),
      });
      yield* expectDenied(harness, "not a url");
      // The parseable sibling still works, so the drop is targeted rather than
      // a wholesale failure to build the grant set.
      const response = yield* Effect.promise(() => harness.fetch(allowedUrl, { method: "POST" }));
      expect(response.status).toBe(200);
    })
  );
});
