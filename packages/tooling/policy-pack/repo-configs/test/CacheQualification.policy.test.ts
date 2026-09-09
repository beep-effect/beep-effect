import {
  auditCachePolicy,
  CacheActivationProjection,
  CacheClientChannel,
  CacheClientPin,
  CacheEvidenceKind,
  CacheEvidenceReference,
  CachePolicyAuditRequest,
  CachePolicyBaseline,
  CachePolicyNode,
  CachePolicyProjection,
  CachePolicySource,
  CacheQualificationEntry,
  CacheQualificationEvent,
  CacheQualificationKey,
  CacheQualificationObservation,
  CacheQualificationPins,
  CacheQualificationState,
  CacheQualificationStore,
  CacheReviewDecision,
  CacheTaskConfiguration,
  CacheTaskContract,
  cacheLedgerFailures,
  cachePromotionFailures,
  isCacheTransitionAllowed,
} from "@beep/repo-configs/cache";
import { NonNegativeInt, Sha256Hex } from "@beep/schema";
import { PosInt } from "@beep/schema/Int";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";

const digest = (n: number) => Sha256Hex.make(Str.padStart(64, "0")(`${n}`));
const key = CacheQualificationKey.make({
  computation: "@beep/identity#lint",
  layer: "turbo-task-result",
  profile: "local-linux-x64-bun1.4.1",
  epoch: "fixture-v1",
});
const pins = CacheQualificationPins.make({
  contract: digest(1),
  configuration: digest(2),
  toolchain: digest(3),
  fixtures: digest(4),
  backend: digest(5),
});
const contract = CacheTaskContract.make({
  key,
  pins,
  commands: ["bun run beep:lint", "biome check ."],
  commandDigest: digest(6),
  dependencies: [],
  clients: {
    stable: CacheClientPin.make({ version: "2.10.12", sha256: digest(7), namespace: "fixture-stable" }),
    canary: CacheClientPin.make({ version: "2.10.13-canary.1", sha256: digest(8), namespace: "fixture-canary" }),
  },
  semanticInputClasses: ["files", "environment", "toolchain"],
  orchestrationInputClasses: ["admission"],
  negativeCases: ["missing-script", "child-config", "unsafe-logs"],
  crossRoot: true,
  configuration: CacheTaskConfiguration.make({
    cache: true,
    inputs: ["$TURBO_DEFAULT$"],
    env: [],
    passThroughEnv: [],
    outputs: [],
    dependsOn: [],
    persistent: false,
    interactive: false,
    interruptible: false,
    outputLogs: "full",
  }),
});

const completeObservations = () => {
  let n = 10;
  const row = (channel: CacheClientChannel, kind: CacheEvidenceKind, subjects: ReadonlyArray<string> = []) => {
    n += 1;
    return CacheQualificationObservation.make({
      key,
      pins,
      kind,
      channel,
      client: contract.clients[channel],
      run: `fixture-${n}`,
      roots: [`root-${n}-a`, `root-${n}-b`],
      subjects,
      passed: true,
      receipt: CacheEvidenceReference.make({ path: `receipts/${n}.json`, sha256: digest(n) }),
    });
  };
  return A.flatMap(CacheClientChannel.Options, (channel) => [
    ...A.map(A.range(1, 3), () => row(channel, "fresh-fresh")),
    ...A.map(A.range(1, 3), () => row(channel, "fresh-remote-hit")),
    ...A.map(A.range(1, 10), () => row(channel, "shadow")),
    ...A.map(contract.semanticInputClasses, (subject) => row(channel, "semantic-invalidation", [subject])),
    row(channel, "orchestration-invariance", ["admission"]),
    ...A.map(contract.negativeCases, (subject) => row(channel, "negative-case", [subject])),
    ...A.map(
      CacheEvidenceKind.pickOptions(["cross-root", "concurrency", "capture-safety", "conformance", "trust"]),
      (kind) => row(channel, kind)
    ),
  ]);
};

describe("cache qualification policy", () => {
  it.effect(
    "accepts package names containing s and rejects whitespace independently",
    Effect.fnUntraced(function* () {
      for (const computation of ["@beep/schema#check", "@beep/types#lint"]) {
        expect(yield* S.decodeEffect(CacheQualificationKey)({ ...key, computation }).pipe(Effect.isSuccess)).toBe(true);
      }
      for (const computation of ["pkg #lint", "pkg#li nt", "pkg\t#lint"]) {
        expect(yield* S.decodeEffect(CacheQualificationKey)({ ...key, computation }).pipe(Effect.isFailure)).toBe(true);
      }
    })
  );

  it("preserves the complete qualification tuple through schema serialization", () => {
    const equivalent = S.toEquivalence(CacheQualificationKey);
    fc.assert(
      fc.property(S.toArbitrary(CacheQualificationKey)(fc), (value) => {
        const encoded = Result.getOrThrow(S.encodeResult(CacheQualificationKey)(value));
        const decoded = Result.getOrThrow(S.decodeResult(CacheQualificationKey)(encoded));
        expect(equivalent(value, decoded)).toBe(true);
      }),
      fcRuns(40)
    );
  });

  it("requires the documented lifecycle edges including requalification", () => {
    const expected = [
      "unassessed:excluded",
      "unassessed:candidate",
      "excluded:candidate",
      "candidate:shadow",
      "candidate:excluded",
      "shadow:qualified",
      "shadow:excluded",
      "shadow:suspended",
      "qualified:suspended",
      "qualified:candidate",
      "suspended:candidate",
    ];
    for (const from of CacheQualificationState.Options) {
      for (const to of CacheQualificationState.Options) {
        expect(isCacheTransitionAllowed(from, to)).toBe(A.contains(expected, `${from}:${to}`));
        expect(isCacheTransitionAllowed(to)(from)).toBe(isCacheTransitionAllowed(from, to));
      }
    }
  });

  it("accepts a complete matrix only after the operational receipt verifier supplies its facts", () => {
    expect(cachePromotionFailures(contract, completeObservations())).toEqual([]);
  });

  it("keeps stable and canary evidence separate", () => {
    const onlyStable = A.filter(completeObservations(), (row) => row.channel === "stable");
    expect(cachePromotionFailures(contract, onlyStable)).toContain("canary:missing-isolated-fresh-remote-hit");
  });

  it("requires independently observed activation invariance for both clients and an enabled target", () => {
    const activation = CacheActivationProjection.make({
      path: "packages/fixture/turbo.json",
      before: CacheEvidenceReference.make({ path: "review/before.json", sha256: digest(801) }),
      after: CacheEvidenceReference.make({ path: "review/after.json", sha256: digest(802) }),
      sourceConfiguration: digest(803),
    });
    const activated = CacheTaskContract.make({ ...contract, activation: O.some(activation) });
    const rows = completeObservations();
    expect(cachePromotionFailures(activated, rows)).toEqual([
      "stable:missing-orchestration-invariance:activation-projection",
      "canary:missing-orchestration-invariance:activation-projection",
    ]);
    const extra = A.map(
      A.filter(rows, (row) => row.kind === "orchestration-invariance"),
      (row, index) =>
        CacheQualificationObservation.make({
          ...row,
          subjects: ["activation-projection"],
          run: `activation-${index}`,
          receipt: CacheEvidenceReference.make({
            path: `receipts/activation-${index}.json`,
            sha256: digest(900 + index),
          }),
        })
    );
    expect(cachePromotionFailures(activated, A.appendAll(rows, extra))).toEqual([]);
    const disabled = CacheTaskContract.make({
      ...contract,
      configuration: CacheTaskConfiguration.make({ ...contract.configuration, cache: false }),
    });
    expect(cachePromotionFailures(disabled, rows)).toContain("reuse-disabled-contract");
  });

  it("rejects changed client bytes and overlapping stable/canary namespaces", () => {
    const rows = completeObservations();
    const mismatched = CacheTaskContract.make({
      ...contract,
      clients: {
        ...contract.clients,
        stable: CacheClientPin.make({ ...contract.clients.stable, sha256: digest(99) }),
      },
    });
    expect(cachePromotionFailures(mismatched, rows)).toContain("client-profile-drift");
    const overlapping = CacheTaskContract.make({
      ...contract,
      clients: {
        ...contract.clients,
        canary: CacheClientPin.make({ ...contract.clients.canary, namespace: contract.clients.stable.namespace }),
      },
    });
    expect(cachePromotionFailures(overlapping, rows)).toContain("namespace-overlap");
  });

  it("does not count duplicate shadow or pair receipts as independent experiments", () => {
    const rows = A.map(completeObservations(), (row) =>
      CacheQualificationObservation.make({
        ...row,
        run: "same-run",
        roots: ["same-root"],
        receipt: CacheEvidenceReference.make({ path: "same.json", sha256: digest(99) }),
      })
    );
    const failures = cachePromotionFailures(contract, rows);
    expect(failures).toContain("stable:missing-isolated-fresh-fresh");
    expect(failures).toContain("stable:missing-shadow-decisions");
  });

  it("rejects failed observations and every pin or tuple change", () => {
    const rows = completeObservations();
    for (const field of ["contract", "configuration", "toolchain", "fixtures", "backend"] satisfies ReadonlyArray<
      keyof CacheQualificationPins
    >) {
      const changed = CacheTaskContract.make({
        ...contract,
        pins: CacheQualificationPins.make({ ...pins, [field]: digest(99) }),
      });
      expect(cachePromotionFailures(changed, rows)).toContain("evidence-identity-drift");
    }
    const changed = CacheTaskContract.make({ ...contract, key: CacheQualificationKey.make({ ...key, epoch: "next" }) });
    expect(cachePromotionFailures(changed, rows)).toContain("evidence-identity-drift");
    expect(
      cachePromotionFailures(
        contract,
        A.map(rows, (row) => CacheQualificationObservation.make({ ...row, passed: false }))
      )
    ).toContain("failed-observation");
  });

  it("requires individual semantic and negative perturbations", () => {
    const rows = A.map(completeObservations(), (row) =>
      CacheQualificationObservation.make({ ...row, subjects: ["files", "environment", "toolchain"] })
    );
    expect(cachePromotionFailures(contract, rows)).toContain("stable:missing-semantic-invalidation:files");
    expect(cachePromotionFailures(contract, rows)).toContain("stable:missing-negative-case:missing-script");
  });

  it("requires real conformance and trust imports before promotion", () => {
    const rows = A.filter(completeObservations(), (row) => row.kind !== "conformance" && row.kind !== "trust");
    expect(cachePromotionFailures(contract, rows)).toContain("stable:missing-conformance");
    expect(cachePromotionFailures(contract, rows)).toContain("stable:missing-trust");
  });

  it("cannot promote required statuses, other proof owners, or persistent services", () => {
    const hosted = CacheTaskContract.make({
      ...contract,
      key: CacheQualificationKey.make({ ...key, layer: "hosted-required-status" }),
    });
    expect(cachePromotionFailures(hosted, [])).toContain("reuse-layer-owned-elsewhere");
    const persistent = CacheTaskContract.make({
      ...contract,
      configuration: CacheTaskConfiguration.make({ ...contract.configuration, persistent: true }),
    });
    expect(cachePromotionFailures(persistent, [])).toContain("non-finite-command");
  });

  it.effect(
    "rejects invalid identities, unbound evidence and unsafe receipt paths at decode",
    Effect.fnUntraced(function* () {
      for (const computation of ["lint", "workspace#", "workspace#lint#extra", "workspace #lint"]) {
        expect(yield* S.decodeEffect(CacheQualificationKey)({ ...key, computation }).pipe(Effect.isFailure)).toBe(true);
      }
      expect(yield* S.decodeUnknownEffect(CacheQualificationObservation)({ passed: true }).pipe(Effect.isFailure)).toBe(
        true
      );
      for (const path of ["/private/log", "../receipt.json", "safe/../../escape", "windows\\\\receipt"]) {
        expect(yield* S.decodeEffect(CacheEvidenceReference)({ path, sha256: digest(1) }).pipe(Effect.isFailure)).toBe(
          true
        );
      }
    })
  );
});

const review = CacheReviewDecision.make({
  reviewer: "fixture-reviewer",
  reason: "reviewed pilot boundary",
  basis: CacheEvidenceReference.make({ path: "review.md", sha256: digest(1) }),
});
const policyNode = CachePolicyNode.make({
  computation: key.computation,
  command: contract.commands[0],
  commandDigest: contract.commandDigest,
  dependencies: [],
  configuration: contract.configuration,
});
const projection = CachePolicyProjection.make({
  globalConfiguration: { globalEnv: ["CI"] },
  nodes: [policyNode],
  sources: [CachePolicySource.make({ path: "turbo.json", sha256: digest(2) })],
});
const baseline = CachePolicyBaseline.make({
  review,
  profile: key.profile,
  epoch: key.epoch,
  scope: [key.computation],
  projection,
});
const store = CacheQualificationStore.make({ revision: NonNegativeInt.make(0), entries: [], history: [] });
const auditRequest = CachePolicyAuditRequest.make({
  baseline,
  current: projection,
  store,
  profile: key.profile,
  epoch: key.epoch,
});
const withNodes = (nodes: ReadonlyArray<CachePolicyNode>) =>
  CachePolicyAuditRequest.make({ ...auditRequest, current: CachePolicyProjection.make({ ...projection, nodes }) });
const withEntries = (entries: ReadonlyArray<CacheQualificationEntry>) =>
  CachePolicyAuditRequest.make({ ...auditRequest, store: CacheQualificationStore.make({ ...store, entries }) });

describe("cache governance audit", () => {
  it("retains all reviews and reconstructs the current entry from legal contiguous history", () => {
    const candidate = CacheQualificationEntry.make({ key, status: { state: "candidate", contract, review } });
    const shadow = CacheQualificationEntry.make({
      key,
      status: { state: "shadow", contract, review, receipts: [review.basis] },
    });
    const suspended = CacheQualificationEntry.make({
      key,
      status: {
        state: "suspended",
        contract,
        review: CacheReviewDecision.make({ ...review, reason: "failed invalidation" }),
      },
    });
    const history = A.map([candidate, shadow, suspended], (entry, index) =>
      CacheQualificationEvent.make({ revision: PosInt.make(index + 1), entry })
    );
    const ledger = CacheQualificationStore.make({ revision: NonNegativeInt.make(3), entries: [suspended], history });
    expect(cacheLedgerFailures(ledger)).toEqual([]);
    expect(ledger.history[1]?.entry.status).toEqual(shadow.status);
    expect(cacheLedgerFailures(CacheQualificationStore.make({ ...ledger, history: A.drop(history, 1) }))).toContain(
      "noncontiguous-history"
    );
    expect(cacheLedgerFailures(CacheQualificationStore.make({ ...ledger, entries: [candidate] }))).toContain(
      "history-projection-mismatch"
    );
    expect(
      cacheLedgerFailures(CacheQualificationStore.make({ ...ledger, revision: NonNegativeInt.make(2) }))
    ).toContain("revision-history-mismatch");
  });

  it("rejects history that skips candidate and shadow even when the head claims qualification", () => {
    const qualified = CacheQualificationEntry.make({
      key,
      status: { state: "qualified", contract, review, receipts: [review.basis] },
    });
    const history = [CacheQualificationEvent.make({ revision: PosInt.make(1), entry: qualified })];
    const ledger = CacheQualificationStore.make({ revision: NonNegativeInt.make(1), entries: [qualified], history });
    expect(cacheLedgerFailures(ledger)).toContain("illegal-history-transition");
    expect(auditCachePolicy(CachePolicyAuditRequest.make({ ...auditRequest, store: ledger })).findings).toContainEqual({
      kind: "assessment-drift",
      subject: "qualification-ledger:illegal-history-transition",
      blocking: true,
    });
  });

  it("reports legacy cached executions as unassessed without granting qualification", () => {
    expect(auditCachePolicy(auditRequest)).toMatchObject({ findings: [], unassessed: [key.computation] });
  });

  it("keeps ordinary candidate and shadow reuse disabled even when the legacy baseline allowed caching", () => {
    for (const status of [
      { state: "candidate", contract, review },
      { state: "shadow", contract, review, receipts: [] },
    ] satisfies ReadonlyArray<typeof CacheQualificationEntry.fields.status.Type>) {
      const entry = CacheQualificationEntry.make({ key, status });
      expect(auditCachePolicy(withEntries([entry])).findings).toContainEqual({
        kind: "unqualified-reuse",
        subject: key.computation,
        blocking: true,
      });
      const disabled = CachePolicyNode.make({
        ...policyNode,
        configuration: CacheTaskConfiguration.make({ ...policyNode.configuration, cache: false }),
      });
      const request = withEntries([entry]);
      expect(
        auditCachePolicy(
          CachePolicyAuditRequest.make({
            ...request,
            current: CachePolicyProjection.make({ ...request.current, nodes: [disabled] }),
          })
        ).findings
      ).not.toContainEqual({ kind: "unqualified-reuse", subject: key.computation, blocking: true });
    }
  });

  it("allows disabling existing cache reuse but blocks newly cached computations", () => {
    const disabled = CachePolicyNode.make({
      ...policyNode,
      configuration: CacheTaskConfiguration.make({ ...contract.configuration, cache: false }),
    });
    expect(auditCachePolicy(withNodes([disabled])).findings).toEqual([]);
    const added = CachePolicyNode.make({ ...policyNode, computation: "@beep/new#lint" });
    expect(auditCachePolicy(withNodes([policyNode, added])).findings).toContainEqual({
      kind: "unreviewed-expansion",
      subject: added.computation,
      blocking: true,
    });
    const neverCached = CachePolicyBaseline.make({
      ...baseline,
      projection: CachePolicyProjection.make({ ...projection, nodes: [disabled] }),
    });
    expect(
      auditCachePolicy(CachePolicyAuditRequest.make({ ...auditRequest, baseline: neverCached })).findings
    ).toContainEqual({ kind: "unreviewed-expansion", subject: key.computation, blocking: true });
  });

  it("detects every effective configuration field, nested script and graph dependency change", () => {
    const configurations = [
      { inputs: ["src/**"] },
      { env: ["MODE"] },
      { passThroughEnv: ["TOKEN"] },
      { outputs: ["dist/**"] },
      { dependsOn: ["^lint"] },
      { persistent: true },
      { interactive: true },
      { interruptible: true },
      { outputLogs: "none" },
    ];
    for (const change of configurations) {
      const node = CachePolicyNode.make({
        ...policyNode,
        configuration: CacheTaskConfiguration.make({ ...contract.configuration, ...change }),
      });
      expect(auditCachePolicy(withNodes([node])).findings).toContainEqual({
        kind: "configuration-drift",
        subject: key.computation,
        blocking: true,
      });
    }
    for (const change of [
      { command: "biome check . --write" },
      { commandDigest: digest(99) },
      { dependencies: ["@beep/types#lint"] },
    ]) {
      expect(auditCachePolicy(withNodes([CachePolicyNode.make({ ...policyNode, ...change })])).findings).toContainEqual(
        { kind: "configuration-drift", subject: key.computation, blocking: true }
      );
    }
  });

  it("blocks global semantic changes while attributing source-only root/child changes as review findings", () => {
    const current = CachePolicyProjection.make({
      ...projection,
      globalConfiguration: { globalEnv: [] },
      sources: [CachePolicySource.make({ path: "apps/child/turbo.json", sha256: digest(3) })],
    });
    const report = auditCachePolicy(CachePolicyAuditRequest.make({ ...auditRequest, current }));
    expect(report.findings).toContainEqual({
      kind: "global-configuration-drift",
      subject: "turbo-global-configuration",
      blocking: true,
    });
    expect(report.findings).toContainEqual({
      kind: "configuration-source-drift",
      subject: "turbo.json",
      blocking: false,
    });
    expect(report.findings).toContainEqual({
      kind: "configuration-source-drift",
      subject: "apps/child/turbo.json",
      blocking: false,
    });
  });

  it("blocks reuse of suspended and excluded tuples at their exact boundary", () => {
    for (const status of [
      { state: "suspended", contract, review },
      { state: "excluded", review },
    ] satisfies ReadonlyArray<CacheQualificationEntry["status"]>) {
      expect(auditCachePolicy(withEntries([CacheQualificationEntry.make({ key, status })])).findings).toContainEqual({
        kind: "suspended-reuse",
        subject: key.computation,
        blocking: true,
      });
    }
  });

  it("refuses duplicate identities and stale contract configuration even with a qualified label", () => {
    const entry = CacheQualificationEntry.make({ key, status: { state: "candidate", contract, review } });
    expect(auditCachePolicy(withEntries([entry, entry])).findings).toContainEqual({
      kind: "duplicate-identity",
      subject: "qualification-ledger",
      blocking: true,
    });
    expect(auditCachePolicy(withNodes([policyNode, policyNode])).findings).toContainEqual({
      kind: "duplicate-identity",
      subject: "executable-census",
      blocking: true,
    });
    const changed = CacheTaskContract.make({ ...contract, dependencies: ["new#lint"] });
    const qualified = CacheQualificationEntry.make({
      key,
      status: { state: "qualified", contract: changed, review, receipts: [review.basis] },
    });
    expect(auditCachePolicy(withEntries([qualified])).findings).toContainEqual({
      kind: "configuration-drift",
      subject: key.computation,
      blocking: true,
    });
  });

  it("does not borrow assessments from another profile, epoch or reuse owner", () => {
    for (const changed of [
      { profile: "other-profile" },
      { epoch: "other-epoch" },
      { layer: "hosted-required-status" as const },
    ]) {
      const entry = CacheQualificationEntry.make({
        key: CacheQualificationKey.make({ ...key, ...changed }),
        status: { state: "candidate", contract, review },
      });
      expect(auditCachePolicy(withEntries([entry])).unassessed).toEqual([key.computation]);
    }
  });
});
