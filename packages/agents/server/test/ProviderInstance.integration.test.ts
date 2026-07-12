import * as Domain from "@beep/agents-domain/entities/ProviderInstance";
import {
  ProviderInstanceRepositoryLive,
  ProviderInstanceUseCasesLive,
  ProviderProbeLive,
} from "@beep/agents-server/ProviderInstance";
import {
  AddProviderInstanceCommand,
  ListProviderInstancesQuery,
  ProbeProviderInstanceCommand,
  ProviderInstanceUseCases,
} from "@beep/agents-use-cases/server";
import { AiProviderCli, AiProviderCliProcessResult } from "@beep/ai-provider-cli";
import { makeDrizzle, makeDrizzleLayer } from "@beep/postgres";
import { makePgliteIntegrationGate } from "@beep/test-utils";
import { describe, expect, layer } from "@effect/vitest";
import { sql } from "drizzle-orm";
import { Effect, Layer } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { AiProviderCliRunner } from "@beep/ai-provider-cli";

const { makePgliteLayer, pgliteIntegrationTimeoutMillis } = makePgliteIntegrationGate();

const runner: AiProviderCliRunner = (provider) =>
  Effect.succeed(
    provider === "claude"
      ? AiProviderCliProcessResult.make({
          exitCode: 0,
          stderr: "",
          stdout: '{"loggedIn":true,"authMethod":"claude.ai","email":"dev@example.com","subscriptionType":"max"}',
        })
      : AiProviderCliProcessResult.make({ exitCode: 1, stderr: "logged out", stdout: "Not logged in" })
  );

const PortsLive = Layer.mergeAll(ProviderInstanceRepositoryLive, ProviderProbeLive);
const TestLayer = ProviderInstanceUseCasesLive.pipe(
  Layer.provideMerge(PortsLive),
  Layer.provideMerge(AiProviderCli.makeLayerFromRunner(runner)),
  Layer.provideMerge(makeDrizzleLayer()),
  Layer.provideMerge(makePgliteLayer())
);

const prepareTable = Effect.fnUntraced(function* () {
  const db = yield* makeDrizzle();
  yield* db.execute(sql`DROP TABLE IF EXISTS agents_provider_instance`);
  yield* db.execute(sql`
    CREATE TABLE agents_provider_instance (
      id serial PRIMARY KEY,
      public_id text NOT NULL,
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

describe.sequential("ProviderInstance PGLite integration", () => {
  layer(TestLayer, { timeout: "5 minutes" })((it) => {
    it.effect(
      "persists an authenticated probe snapshot and lists it",
      Effect.fnUntraced(function* () {
        yield* prepareTable();
        const useCases = yield* ProviderInstanceUseCases;
        const added = yield* useCases.add(
          AddProviderInstanceCommand.make({
            binaryPath: "/opt/bin/claude",
            envVars: { NO_PROXY: "localhost" },
            homePath: O.some("/tmp/claude-home"),
            kind: "claude",
            label: "Personal Claude",
          })
        );
        const probed = yield* useCases.probe(ProbeProviderInstanceCommand.make({ id: added.id }));
        const listed = yield* useCases.list(ListProviderInstancesQuery.make({}));

        expect(listed).toHaveLength(1);
        expect(O.getOrThrow(probed.lastProbe).status).toBe("authenticated");
        expect(O.getOrThrow(listed[0]?.lastProbe).status).toBe("authenticated");
        const snapshot = O.getOrThrow(listed[0]?.lastProbe);
        expect(S.is(Domain.AuthenticatedSnapshot)(snapshot)).toBe(true);
      }),
      pgliteIntegrationTimeoutMillis
    );

    it.effect(
      "surfaces exact Codex login guidance while persisting logged-out state",
      Effect.fnUntraced(function* () {
        yield* prepareTable();
        const useCases = yield* ProviderInstanceUseCases;
        const added = yield* useCases.add(
          AddProviderInstanceCommand.make({
            binaryPath: "/opt/bin/codex",
            envVars: {},
            homePath: O.some("/tmp/codex-home"),
            kind: "codex",
            label: "Work Codex",
          })
        );
        const failure = yield* Effect.flip(useCases.probe(ProbeProviderInstanceCommand.make({ id: added.id })));

        expect(P.isTagged("ProviderUnauthenticated")(failure)).toBe(true);
        if (P.isTagged("ProviderUnauthenticated")(failure)) {
          expect(failure.guidance).toContain("`codex login`");
        }
        const listed = yield* useCases.list(ListProviderInstancesQuery.make({}));
        expect(O.getOrThrow(listed[0]?.lastProbe).status).toBe("unauthenticated");
      }),
      pgliteIntegrationTimeoutMillis
    );
  });
});
