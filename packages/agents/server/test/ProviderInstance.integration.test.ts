import * as NodeOS from "node:os";
import * as Domain from "@beep/agents-domain/entities/ProviderInstance";
import {
  makeProviderInstanceRepository,
  ProviderInstanceRepositoryLive,
  ProviderInstanceUseCasesLive,
  ProviderProbeLive,
} from "@beep/agents-server/ProviderInstance";
import {
  AddProviderInstanceCommand,
  GetProviderInstanceQuery,
  ListProviderInstancesQuery,
  makeProviderInstanceUseCases,
  ProbeProviderInstanceCommand,
  ProviderInstanceActorContext,
  ProviderInstanceActorScope,
  ProviderInstanceRepository,
  ProviderInstanceUseCases,
  ProviderProbe,
  RemoveProviderInstanceCommand,
  UpdateProviderInstanceCommand,
} from "@beep/agents-use-cases/server";
import {
  AiProviderCli,
  AiProviderCliCodexHomeLayout,
  AiProviderCliHome,
  AiProviderCliProcessResult,
} from "@beep/ai-provider-cli";
import { makeDrizzle, makeDrizzleLayer } from "@beep/postgres";
import { CuidState } from "@beep/schema/Cuid";
import { SystemPrincipal } from "@beep/shared-domain/entity/Principal";
import * as PublicEntityId from "@beep/shared-domain/entity/PublicEntityId";
import * as Agents from "@beep/shared-domain/identity/Agents";
import { OrganizationId } from "@beep/shared-domain/identity/Shared";
import { it } from "@beep/test-runner";
import { makePgliteIntegrationGate } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import * as HostPath from "@beep/utils/Path";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import { sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import type { AiProviderCliRunner } from "@beep/ai-provider-cli";

const { makePgliteLayer, pgliteIntegrationTimeoutMillis } = makePgliteIntegrationGate();
const ProviderInstancePublicId = PublicEntityId.factory(Agents.ProviderInstanceId);
const primaryActorScope = ProviderInstanceActorScope.make({
  orgId: OrganizationId.make(1),
  principal: SystemPrincipal.make({ component: "Runtime", kind: "System" }),
});

const secondaryActorScope = ProviderInstanceActorScope.make({
  orgId: OrganizationId.make(2),
  principal: SystemPrincipal.make({ component: "Sync", kind: "System" }),
});

const TestActorScopeLayer = Layer.succeed(ProviderInstanceActorContext, primaryActorScope);

const runnerRequests = Ref.makeUnsafe<ReadonlyArray<Parameters<AiProviderCliRunner>[0]>>([]);

// A test can arm one write that lands while the next probe's CLI call runs:
// after the probe read the instance and before it saves the snapshot.
const writeDuringNextProbe = Ref.makeUnsafe<O.Option<Effect.Effect<void>>>(O.none());

const runner: AiProviderCliRunner = (request) =>
  Ref.getAndSet(writeDuringNextProbe, O.none()).pipe(
    Effect.flatMap(O.getOrElse(() => Effect.void)),
    Effect.andThen(Ref.update(runnerRequests, (requests) => [...requests, request])),
    Effect.as(
      request.provider === "claude"
        ? AiProviderCliProcessResult.make({
            exitCode: 0,
            stderr: "",
            stdout: '{"loggedIn":true,"authMethod":"claude.ai","email":"dev@example.com","subscriptionType":"max"}',
          })
        : AiProviderCliProcessResult.make({ exitCode: 1, stderr: "logged out", stdout: "Not logged in" })
    )
  );

const TestHomeLayer = Layer.succeed(AiProviderCliHome)(
  AiProviderCliHome.of({
    ensureCodexShadowHome: Effect.fnUntraced(function* () {
      return yield* Effect.void;
    }),
    makeClaudeEnv: ({ baseEnv, homePath }) =>
      O.match(homePath, {
        onNone: () => baseEnv,
        onSome: (HOME) => ({ ...baseEnv, HOME }),
      }),
    makeCodexEnv: ({ baseEnv, layout }) =>
      O.match(layout.effectiveHomePath, {
        onNone: () => baseEnv,
        onSome: (CODEX_HOME) => ({ ...baseEnv, CODEX_HOME }),
      }),
    resolveClaudeHome: O.getOrElse(() => "/tmp/claude-default"),
    resolveCodexHomeLayout: ({ shadowHomePath }) =>
      AiProviderCliCodexHomeLayout.make({
        effectiveHomePath: shadowHomePath,
        mode: O.isSome(shadowHomePath) ? "authOverlay" : "direct",
        sharedHomePath: "/tmp/codex-shared",
      }),
  })
);

const PortsLive = Layer.mergeAll(ProviderInstanceRepositoryLive, ProviderProbeLive);
const TestLayer = ProviderInstanceUseCasesLive.pipe(
  Layer.provideMerge(PortsLive),
  Layer.provideMerge(
    AiProviderCli.makeLayerFromRunner(runner, { claudePath: "/opt/bin/claude", codexPath: "~/opt/bin/codex" })
  ),
  Layer.provideMerge(TestHomeLayer),
  Layer.provideMerge(TestActorScopeLayer),
  Layer.provideMerge(CuidState.Default),
  Layer.provideMerge(BunCrypto.layer),
  Layer.provideMerge(makeDrizzleLayer()),
  Layer.provideMerge(makePgliteLayer())
);

const makeAddCommand = (label: string) =>
  AddProviderInstanceCommand.make({
    binaryPath: Domain.BinaryPath.make("/opt/bin/claude"),
    envVars: {},
    homePath: O.none(),
    kind: "claude",
    label: Domain.InstanceLabel.make(label),
  });

const prepareTable = Effect.fnUntraced(function* () {
  const db = yield* makeDrizzle();
  yield* db.execute(sql`DROP TABLE IF EXISTS agents_provider_instance`);
  yield* db.execute(sql`
    CREATE TABLE agents_provider_instance (
      id serial PRIMARY KEY,
      public_id text NOT NULL UNIQUE,
      entity_type text NOT NULL,
      schema_version text NOT NULL,
      created_at bigint NOT NULL,
      created_by_principal jsonb NOT NULL,
      deleted_at bigint,
      deleted_by_principal jsonb,
      updated_at bigint NOT NULL,
      updated_by_principal jsonb NOT NULL,
      source text NOT NULL,
      row_version integer NOT NULL,
      org_id integer NOT NULL,
      binary_path text NOT NULL,
      env_vars jsonb NOT NULL,
      home_path text,
      kind text NOT NULL,
      label text NOT NULL,
      last_probe jsonb
    )
  `);
});

describe("ProviderInstance PGLite integration", { concurrent: false }, () => {
  it.layer(TestLayer, { timeout: "5 minutes" })((it) => {
    it.effect(
      "persists an authenticated probe snapshot and lists it",
      Effect.fnUntraced(function* () {
        yield* prepareTable();
        const useCases = yield* ProviderInstanceUseCases;
        yield* Ref.set(runnerRequests, []);
        const envVars = yield* S.decodeEffect(Domain.EnvVars)({ NO_PROXY: "localhost" });
        const added = yield* useCases.add(
          AddProviderInstanceCommand.make({
            binaryPath: Domain.BinaryPath.make("/opt/bin/claude"),
            envVars,
            homePath: O.some(Domain.HomePath.make("/tmp/claude-home")),
            kind: "claude",
            label: Domain.InstanceLabel.make("Personal Claude"),
          })
        );
        const probed = yield* useCases.probe(ProbeProviderInstanceCommand.make({ id: added.id }));
        const listed = yield* useCases.list(ListProviderInstancesQuery.make({}));

        expect(listed).toHaveLength(1);
        expect(O.getOrThrow(probed.lastProbe).status).toBe("authenticated");
        expect(O.getOrThrow(O.flatMap(A.head(listed), (instance) => instance.lastProbe)).status).toBe("authenticated");
        const snapshot = O.getOrThrow(O.flatMap(A.head(listed), (instance) => instance.lastProbe));
        expect(Domain.AuthenticatedSnapshot.is(snapshot)).toBe(true);
        const requests = yield* Ref.get(runnerRequests);
        expect(requests[0]?.executable).toBe("/opt/bin/claude");
        expect(requests[0]?.env).toEqual({ HOME: "/tmp/claude-home", NO_PROXY: "localhost" });
      }),
      pgliteIntegrationTimeoutMillis
    );

    it.effect(
      "surfaces exact Codex login guidance while persisting logged-out state",
      Effect.fnUntraced(function* () {
        yield* prepareTable();
        const useCases = yield* ProviderInstanceUseCases;
        yield* Ref.set(runnerRequests, []);
        const added = yield* useCases.add(
          AddProviderInstanceCommand.make({
            binaryPath: Domain.BinaryPath.make("~/opt/bin/codex"),
            envVars: {},
            homePath: O.some(Domain.HomePath.make("/tmp/codex-home")),
            kind: "codex",
            label: Domain.InstanceLabel.make("Work Codex"),
          })
        );
        const failure = yield* Effect.flip(useCases.probe(ProbeProviderInstanceCommand.make({ id: added.id })));

        expect(P.isTagged("ProviderUnauthenticated")(failure)).toBe(true);
        if (P.isTagged("ProviderUnauthenticated")(failure)) {
          expect(failure.guidance).toContain("`codex login`");
        }
        const listed = yield* useCases.list(ListProviderInstancesQuery.make({}));
        expect(O.getOrThrow(O.flatMap(A.head(listed), (instance) => instance.lastProbe)).status).toBe(
          "unauthenticated"
        );
        const requests = yield* Ref.get(runnerRequests);
        expect(requests[0]?.executable).toBe(HostPath.join(NodeOS.homedir(), "opt/bin/codex"));
        expect(requests[0]?.env).toEqual({ CODEX_HOME: "/tmp/codex-home" });
      }),
      pgliteIntegrationTimeoutMillis
    );

    it.effect(
      "rejects a probe save that lost the race to a concurrent configuration update",
      Effect.fnUntraced(function* () {
        yield* prepareTable();
        const useCases = yield* ProviderInstanceUseCases;
        const repository = yield* ProviderInstanceRepository;
        const added = yield* useCases.add(makeAddCommand("Before the race"));
        // The table has no DEFAULT (it predates the kit default), so this proves
        // the insert writes the first version itself.
        expect(added.rowVersion).toBe(1);

        yield* Ref.set(
          writeDuringNextProbe,
          O.some(
            useCases
              .update(
                UpdateProviderInstanceCommand.make({
                  binaryPath: added.binaryPath,
                  envVars: added.envVars,
                  homePath: added.homePath,
                  id: added.id,
                  kind: added.kind,
                  label: Domain.InstanceLabel.make("Renamed mid-probe"),
                })
              )
              .pipe(Effect.asVoid, Effect.orDie)
          )
        );
        const lost = yield* Effect.flip(useCases.probe(ProbeProviderInstanceCommand.make({ id: added.id })));
        expect(lost).toMatchObject({
          _tag: "ProviderInstanceVersionConflict",
          actualRowVersion: 2,
          expectedRowVersion: 1,
          providerInstanceId: added.id,
        });

        // The configuration update survived; the stale probe did not revert it.
        const stored = yield* useCases.get(GetProviderInstanceQuery.make({ id: added.id }));
        expect([stored.label, stored.rowVersion]).toEqual(["Renamed mid-probe", 2]);
        assertNone(stored.lastProbe);

        const stale = yield* Effect.flip(repository.save(added));
        expect(stale).toMatchObject({ _tag: "ProviderInstanceVersionConflict", actualRowVersion: 2 });
        const fresh = yield* repository.save(
          Domain.ProviderInstance.make({ ...stored, label: Domain.InstanceLabel.make("Fresh") })
        );
        expect(fresh.rowVersion).toBe(3);
      }),
      pgliteIntegrationTimeoutMillis
    );

    it.effect(
      "uses database-generated ids for concurrent inserts",
      Effect.fnUntraced(function* () {
        yield* prepareTable();
        const useCases = yield* ProviderInstanceUseCases;
        const concurrency = 8;
        const added = yield* Effect.all(
          A.makeBy(concurrency, (index) => useCases.add(makeAddCommand(`Concurrent ${index + 1}`))),
          { concurrency: "unbounded" }
        );
        const ids = A.map(added, (instance) => instance.id);
        const publicIds = A.map(added, (instance) => instance.publicId);
        const generatedPublicIdLength = Str.length(Agents.ProviderInstanceId.tableName) + 25;

        expect(A.length(A.dedupe(ids))).toBe(concurrency);
        expect(A.length(A.dedupe(publicIds))).toBe(concurrency);
        expect(A.every(publicIds, S.is(ProviderInstancePublicId))).toBe(true);
        expect(A.every(publicIds, (publicId) => Str.length(publicId) === generatedPublicIdLength)).toBe(true);
      }),
      pgliteIntegrationTimeoutMillis
    );

    it.effect(
      "isolates organizations and attributes writes to the trusted actor scope",
      Effect.fnUntraced(function* () {
        yield* prepareTable();
        const primaryUseCases = yield* ProviderInstanceUseCases;
        const primaryRepository = yield* ProviderInstanceRepository;
        const providerProbe = yield* ProviderProbe;
        const cuidState = yield* CuidState;
        const secondaryRepository = yield* makeProviderInstanceRepository().pipe(
          Effect.provideService(ProviderInstanceActorContext, secondaryActorScope),
          Effect.provideService(CuidState, cuidState)
        );
        const secondaryUseCases = makeProviderInstanceUseCases(secondaryRepository, providerProbe);
        yield* Ref.set(runnerRequests, []);

        const primary = yield* primaryUseCases.add(makeAddCommand("Primary tenant"));
        const secondary = yield* secondaryUseCases.add(makeAddCommand("Secondary tenant"));

        expect(primary.orgId).toBe(primaryActorScope.orgId);
        expect(primary.createdByPrincipal).toEqual(primaryActorScope.principal);
        expect(secondary.orgId).toBe(secondaryActorScope.orgId);
        expect(secondary.createdByPrincipal).toEqual(secondaryActorScope.principal);

        const primaryList = yield* primaryUseCases.list(ListProviderInstancesQuery.make({}));
        const secondaryList = yield* secondaryUseCases.list(ListProviderInstancesQuery.make({}));
        expect(A.map(primaryList, (instance) => instance.id)).toEqual([primary.id]);
        expect(A.map(secondaryList, (instance) => instance.id)).toEqual([secondary.id]);

        const getFailure = yield* Effect.flip(primaryUseCases.get(GetProviderInstanceQuery.make({ id: secondary.id })));
        const updateFailure = yield* Effect.flip(
          primaryUseCases.update(
            UpdateProviderInstanceCommand.make({
              binaryPath: secondary.binaryPath,
              envVars: secondary.envVars,
              homePath: secondary.homePath,
              id: secondary.id,
              kind: secondary.kind,
              label: Domain.InstanceLabel.make("Cross-tenant update"),
            })
          )
        );
        const probeFailure = yield* Effect.flip(
          primaryUseCases.probe(ProbeProviderInstanceCommand.make({ id: secondary.id }))
        );
        const saveFailure = yield* Effect.flip(primaryRepository.save(secondary));
        const removeFailure = yield* Effect.flip(
          primaryUseCases.remove(RemoveProviderInstanceCommand.make({ id: secondary.id }))
        );

        expect(P.isTagged("ProviderInstanceNotFound")(getFailure)).toBe(true);
        expect(P.isTagged("ProviderInstanceNotFound")(updateFailure)).toBe(true);
        expect(P.isTagged("ProviderInstanceNotFound")(probeFailure)).toBe(true);
        expect(P.isTagged("ProviderInstanceNotFound")(saveFailure)).toBe(true);
        expect(P.isTagged("ProviderInstanceNotFound")(removeFailure)).toBe(true);
        const got = yield* Ref.get(runnerRequests);
        expect(got).toHaveLength(0);

        const persistedSecondary = yield* secondaryUseCases.get(GetProviderInstanceQuery.make({ id: secondary.id }));
        const updatedSecondary = yield* secondaryUseCases.update(
          UpdateProviderInstanceCommand.make({
            binaryPath: persistedSecondary.binaryPath,
            envVars: persistedSecondary.envVars,
            homePath: persistedSecondary.homePath,
            id: persistedSecondary.id,
            kind: persistedSecondary.kind,
            label: Domain.InstanceLabel.make("Updated secondary tenant"),
          })
        );

        expect(updatedSecondary.orgId).toBe(secondaryActorScope.orgId);
        expect(updatedSecondary.updatedByPrincipal).toEqual(secondaryActorScope.principal);
        expect(updatedSecondary.rowVersion).toBe(secondary.rowVersion + 1);
      }),
      pgliteIntegrationTimeoutMillis
    );
  });
});
