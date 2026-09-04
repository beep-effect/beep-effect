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
import * as PublicEntityId from "@beep/shared-domain/entity/PublicEntityId";
import * as Agents from "@beep/shared-domain/identity/Agents";
import { makePgliteIntegrationGate } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import * as HostPath from "@beep/utils/Path";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect, layer } from "@effect/vitest";
import { sql } from "drizzle-orm";
import { Effect, Layer, Ref } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { AiProviderCliRunner } from "@beep/ai-provider-cli";

const { makePgliteLayer, pgliteIntegrationTimeoutMillis } = makePgliteIntegrationGate();
const ProviderInstancePublicId = PublicEntityId.factory(Agents.ProviderInstanceId);
const decodeActorScope = S.decodeUnknownSync(ProviderInstanceActorScope);

const primaryActorScope = decodeActorScope({
  orgId: 1,
  principal: { component: "Runtime", kind: "System" },
});

const secondaryActorScope = decodeActorScope({
  orgId: 2,
  principal: { component: "Sync", kind: "System" },
});

const TestActorScopeLayer = Layer.succeed(ProviderInstanceActorContext, primaryActorScope);

const runnerRequests = Ref.makeUnsafe<ReadonlyArray<Parameters<AiProviderCliRunner>[0]>>([]);

const runner: AiProviderCliRunner = (request) =>
  Ref.update(runnerRequests, (requests) => [...requests, request]).pipe(
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
  layer(TestLayer, { timeout: "5 minutes" })((it) => {
    it.effect(
      "persists an authenticated probe snapshot and lists it",
      Effect.fnUntraced(function* () {
        yield* prepareTable();
        const useCases = yield* ProviderInstanceUseCases;
        yield* Ref.set(runnerRequests, []);
        const envVars = yield* Domain.EnvVars.decodeEffect({ NO_PROXY: "localhost" });
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
        expect(O.getOrThrow(listed[0]?.lastProbe).status).toBe("authenticated");
        const snapshot = O.getOrThrow(listed[0]?.lastProbe);
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
        expect(O.getOrThrow(listed[0]?.lastProbe).status).toBe("unauthenticated");
        const requests = yield* Ref.get(runnerRequests);
        expect(requests[0]?.executable).toBe(HostPath.join(NodeOS.homedir(), "opt/bin/codex"));
        expect(requests[0]?.env).toEqual({ CODEX_HOME: "/tmp/codex-home" });
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
        expect(A.every(publicIds, ProviderInstancePublicId.is)).toBe(true);
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
        expect(yield* Ref.get(runnerRequests)).toHaveLength(0);

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
