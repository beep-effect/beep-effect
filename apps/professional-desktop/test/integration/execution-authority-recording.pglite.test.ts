import { defaultPolicyRevision, ExecutionAuthorityServerConfig } from "@beep/execution-authority-config/server";
import { fixtureAllowedDestination, makeExecutionAuthorityConfigTest } from "@beep/execution-authority-config/test";
import {
  ExecutionRunKey,
  verifyExecutionDecisionChain,
} from "@beep/execution-authority-domain/entities/ExecutionRecord";
import { ExecutionLedgerDrizzle } from "@beep/execution-authority-server/ExecutionLedger";
import { ExecutionLedger } from "@beep/execution-authority-use-cases/ExecutionLedger";
import { PublishProvenanceRequest, PublishProvenanceTool } from "@beep/ontology-use-cases/tools";
import { makeDrizzleLayer } from "@beep/postgres";
import { it } from "@beep/test-runner";
import { makePgliteIntegrationGate, makePgliteSqlTestLayer } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import { migrateOnBoot } from "@/runtime/Migrations";
import {
  decodeOntologyFilePath,
  HttpServerFixture,
  makeHttpServerLayer,
  makeMcpClient,
} from "./support/ontology-mcp-harness.ts";

// Observable-state recording for the execution-authority slice move
// (goals/execution-authority-slice). It drives the real desktop MCP transport
// over a migrated PGlite ledger and records what an operator can observe: the
// sidecar bind host, the ledger's verdict and settlement counts, chain
// verification, and the physical column, constraint and trigger pins. Set
// EXECUTION_AUTHORITY_RECORDING_OUT to write the recording as JSON; the packet
// keeps the pre-move and post-move recordings and their diff.
const decisionTable = "execution_authority_decision";
const outcomeTable = "execution_authority_outcome";

const { pgliteIntegrationTimeoutMillis } = makePgliteIntegrationGate();
const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
const encodePublishProvenanceRequest = S.encodeUnknownEffect(PublishProvenanceRequest);
const recordingOut = Config.option(Config.String("EXECUTION_AUTHORITY_RECORDING_OUT"));

const makeRecordingLayer = () =>
  ExecutionLedgerDrizzle.pipe(
    Layer.provideMerge(makeDrizzleLayer()),
    Layer.provideMerge(
      Layer.fresh(makePgliteSqlTestLayer({ inProcess: { extensions: { btree_gist } }, mode: "in-process" }))
    ),
    Layer.provideMerge(BunCrypto.layer),
    Layer.merge(NodeServices.layer)
  );

const readSidecarHost = Effect.fnUntraced(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const source = yield* fileSystem.readFileString(path.resolve(import.meta.dirname, "../../server/main.ts"));
  return A.map(A.fromIterable(Str.matchAll(/hostname: "([^"]+)"/g)(source)), (match) => match[1]);
});

describe("professional desktop execution authority observable-state recording", { concurrent: false }, () => {
  it.layer(makeRecordingLayer(), { timeout: "5 minutes" })((it) => {
    it.effect(
      "records the governed publish path and the ledger's physical pins",
      Effect.fnUntraced(function* () {
        yield* migrateOnBoot;
        const ledger = yield* ExecutionLedger;
        function egressFetch(
          _input: Parameters<typeof globalThis.fetch>[0],
          _init?: Parameters<typeof globalThis.fetch>[1]
        ): ReturnType<typeof globalThis.fetch> {
          return Promise.resolve(new Response("stored", { status: 202 }));
        }
        egressFetch.preconnect = globalThis.fetch.preconnect;

        yield* Effect.gen(function* () {
          const context = yield* Layer.build(
            makeHttpServerLayer({
              mutationsEnabled: true,
              approvedMutationTools: [PublishProvenanceTool.name],
              egressFetch,
              executionAuthorityConfig: makeExecutionAuthorityConfigTest(
                ExecutionAuthorityServerConfig.make({
                  destinationAllowlist: [fixtureAllowedDestination],
                  policyRevision: defaultPolicyRevision,
                })
              ),
              ledger: Layer.succeed(ExecutionLedger, ledger),
            })
          );
          const { root } = Context.get(context, HttpServerFixture);
          return yield* Effect.gen(function* () {
            const fileSystem = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const provenancePath = yield* decodeOntologyFilePath("recording.prov.ttl");
            yield* fileSystem.writeFileString(path.join(root, provenancePath), "published provenance");
            const client = yield* makeMcpClient();
            const publish = (destination: string) =>
              Effect.flatMap(
                encodePublishProvenanceRequest(
                  PublishProvenanceRequest.make({ provPath: provenancePath, destination })
                ),
                (args) => client["tools/call"]({ name: PublishProvenanceTool.name, arguments: args })
              );
            const allowed = yield* publish(`${fixtureAllowedDestination}/recording`);
            const denied = yield* publish("https://exfiltration.example/recording");
            expect(allowed.isError).toBe(false);
            expect(denied.isError).toBe(true);
          }).pipe(Effect.provide(context));
        }).pipe(Effect.scoped);

        const sql = (yield* SqlClient.SqlClient).withoutTransforms();
        const runKeyRows = yield* sql.unsafe<{ readonly run_key: string }>(
          `SELECT DISTINCT run_key FROM ${decisionTable}`
        );
        const runKeys = A.map(runKeyRows, (row) => ExecutionRunKey.make(row.run_key));
        const chains = yield* Effect.forEach(runKeys, (runKey) =>
          Effect.map(ledger.readDecisions(runKey), (records) => ({
            verdicts: A.map(records, (record) => (record.verdict === "denied" ? `denied:${record.reason}` : "allowed")),
            chain: verifyExecutionDecisionChain(records, runKey).result,
          }))
        );
        const outcomesByRun = yield* Effect.forEach(runKeys, ledger.readOutcomes);
        const outcomes = A.flatten(outcomesByRun);
        const columns = yield* sql.unsafe<{
          readonly table_name: string;
          readonly column_name: string;
          readonly data_type: string;
          readonly is_nullable: string;
        }>(
          `SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns
           WHERE table_schema = current_schema() AND table_name IN ('${decisionTable}', '${outcomeTable}')
           ORDER BY table_name, ordinal_position`
        );
        const constraints = yield* sql.unsafe<{ readonly conname: string; readonly contype: string }>(
          `SELECT conname, contype FROM pg_constraint
           WHERE conrelid IN ('${decisionTable}'::regclass, '${outcomeTable}'::regclass) ORDER BY conname`
        );
        const triggers = yield* sql.unsafe<{ readonly tgname: string; readonly proname: string }>(
          `SELECT t.tgname, p.proname FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
           WHERE NOT t.tgisinternal AND t.tgrelid IN ('${decisionTable}'::regclass, '${outcomeTable}'::regclass)
           ORDER BY t.tgname`
        );

        const sidecarHost = yield* readSidecarHost();
        const recording = {
          sidecarHost,
          ledger: {
            chains: A.sort(
              A.map(chains, (chain) => `${A.join(chain.verdicts, ",")} => ${chain.chain}`),
              Order.String
            ),
            outcomeSettlements: A.sort(
              A.map(outcomes, (outcome) => outcome.settlement),
              Order.String
            ),
          },
          columns,
          constraints,
          triggers,
        };
        expect(recording.sidecarHost).toEqual(["127.0.0.1"]);
        expect(A.every(chains, (chain) => chain.chain === "chain-intact")).toBe(true);
        expect(A.some(chains, (chain) => A.some(chain.verdicts, Str.startsWith("denied:")))).toBe(true);

        const out = yield* recordingOut;
        if (O.isSome(out)) {
          const fileSystem = yield* FileSystem.FileSystem;
          const json = yield* encodeJson(recording);
          yield* fileSystem.writeFileString(out.value, `${json}\n`);
        }
      }),
      pgliteIntegrationTimeoutMillis
    );
  });
});
