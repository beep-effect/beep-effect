import { defaultPolicyRevision, EpistemicServerConfig } from "@beep/epistemic-config/server";
import { fixtureAllowedDestination, makeEpistemicConfigTest } from "@beep/epistemic-config/test";
import { verifyExecutionDecisionChain, verifyOutcomeBinding } from "@beep/epistemic-domain/values/ExecutionRecord";
import { ExecutionLedger, ExecutionLedgerUnavailable } from "@beep/epistemic-use-cases/ExecutionLedger";
import { ChangeOperation } from "@beep/ontology-domain/aggregates/Session";
import {
  CapabilityMetadataResponse,
  ExportProvenanceRequest,
  ExportProvenanceTool,
  OntologySparqlQueryRequest,
  OntologySparqlQueryResponse,
  OntologyToolFailure,
  OpenInspectRequest,
  ProposeChangeBatchRequest,
  ProposeChangeBatchResponse,
  ProposeChangeBatchTool,
  PublishProvenanceResponse,
  PublishProvenanceTool,
} from "@beep/ontology-use-cases/tools";
import { makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { rpcSessionAuthorizationHeader } from "../../server/RpcSessionAuth.ts";
import {
  allowedOrigin,
  decodeOntologyFilePath,
  makeMcpClient,
  openThroughMcp,
  token,
  withHttpServer,
} from "./support/ontology-mcp-harness.ts";
import type { ExecutionDecisionRecord, ExecutionOutcomeRecord } from "@beep/epistemic-domain/values/ExecutionRecord";

const decodeCapabilityMetadataResponse = S.decodeUnknownEffect(CapabilityMetadataResponse);
const encodeOntologySparqlQueryRequest = S.encodeUnknownEffect(OntologySparqlQueryRequest);
const decodeOntologySparqlQueryResponse = S.decodeUnknownEffect(OntologySparqlQueryResponse);
const encodeProposeChangeBatchRequest = S.encodeUnknownEffect(ProposeChangeBatchRequest);
const decodeProposeChangeBatchResponse = S.decodeUnknownEffect(ProposeChangeBatchResponse);
const decodeOntologyToolFailure = S.decodeUnknownEffect(OntologyToolFailure);
const encodeExportProvenanceRequest = S.encodeUnknownEffect(ExportProvenanceRequest);
const decodePublishProvenanceResponse = S.decodeUnknownEffect(PublishProvenanceResponse);

const assertSchemaRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema): void => {
  const encode = S.encodeResult(schema);
  const decode = S.decodeUnknownResult(schema);
  const equivalent = S.toEquivalence(schema);

  fc.assert(
    fc.property(S.toArbitrary(schema)(fc), (value) => {
      const encoded = Result.getOrThrow(encode(value));
      const decoded = Result.getOrThrow(decode(encoded));
      return equivalent(decoded, value);
    }),
    fcRuns(10)
  );
};

interface LedgerProbe {
  readonly decisions: Ref.Ref<ReadonlyArray<ExecutionDecisionRecord>>;
  readonly failWrites: Ref.Ref<boolean>;
  readonly layer: Layer.Layer<ExecutionLedger>;
  readonly outcomes: Ref.Ref<ReadonlyArray<ExecutionOutcomeRecord>>;
}

// A test-local execution-ledger stub: the ledger's real guarantees are the
// database's (proven in the epistemic pglite suites); here the stub observes
// what the governed gate writes through the real MCP server and injects
// decision-write failures for the fail-closed proof.
const makeLedgerProbe = Effect.fnUntraced(function* () {
  const decisions = yield* Ref.make<ReadonlyArray<ExecutionDecisionRecord>>([]);
  const outcomes = yield* Ref.make<ReadonlyArray<ExecutionOutcomeRecord>>([]);
  const failWrites = yield* Ref.make(false);
  const shape = ExecutionLedger.of({
    appendDecision: Effect.fn("OntologyMcpHttpTest.appendDecision")(function* (record) {
      if (yield* Ref.get(failWrites)) {
        return yield* ExecutionLedgerUnavailable.during("appendDecision", "injected ledger failure");
      }
      yield* Ref.update(decisions, A.append(record));
    }),
    appendOutcome: Effect.fn("OntologyMcpHttpTest.appendOutcome")(function* (record) {
      if (yield* Ref.get(failWrites)) {
        return yield* ExecutionLedgerUnavailable.during("appendOutcome", "injected ledger failure");
      }
      yield* Ref.update(outcomes, A.append(record));
    }),
    readDecisions: Effect.fn("OntologyMcpHttpTest.readDecisions")(function* (runKey) {
      return A.filter(yield* Ref.get(decisions), (record) => record.runKey === runKey);
    }),
    readOutcomes: Effect.fn("OntologyMcpHttpTest.readOutcomes")(function* (runKey) {
      return A.filter(yield* Ref.get(outcomes), (record) => record.runKey === runKey);
    }),
    readUnsettledAllowed: Effect.fn("OntologyMcpHttpTest.readUnsettledAllowed")(function* (runKey) {
      const settled = A.map(yield* Ref.get(outcomes), (record) => record.decisionHash);
      return A.filter(
        yield* Ref.get(decisions),
        (record) => record.runKey === runKey && record.verdict === "allowed" && !A.contains(settled, record.hash)
      );
    }),
  });
  return { decisions, failWrites, layer: Layer.succeed(ExecutionLedger, shape), outcomes } satisfies LedgerProbe;
});

const initializeBody =
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"ontology-mcp-http-test","version":"0.0.0"}}}';

const rawInitialize = Effect.fn("OntologyMcpHttpTest.rawInitialize")(function* (
  useSocketTransport: boolean,
  headers: Readonly<Record<string, string>>
) {
  const client = yield* HttpClient.HttpClient;
  return yield* HttpClientRequest.post(useSocketTransport ? "/mcp" : "http://localhost/mcp").pipe(
    HttpClientRequest.setHeaders(headers),
    HttpClientRequest.bodyText(initializeBody, "application/json"),
    client.execute
  );
});

const addName = (person: string, name: string) =>
  ChangeOperation.make({
    kind: "addQuad",
    partition: "asserted",
    quad: makeQuad(
      makeNamedNode(`https://example.test/${person}`),
      makeNamedNode("https://example.test/name"),
      makeLiteral(name, XSD_STRING.value)
    ),
  });

describe("professional desktop ontology MCP streamable HTTP mount", { concurrent: false, timeout: 120_000 }, () => {
  it("round-trips MCP request codecs with schema-derived arbitraries", () => {
    assertSchemaRoundTrip(OpenInspectRequest);
    assertSchemaRoundTrip(OntologySparqlQueryRequest);
  });

  it.effect(
    "proves initialize, tools/list, and the read-only first slice while mutation registration is disabled",
    () =>
      withHttpServer({ mutationsEnabled: false, approvedMutationTools: [] }, (_root, ontologyPath) =>
        Effect.gen(function* () {
          const client = yield* makeMcpClient();
          const listed = yield* client["tools/list"](undefined);
          const names = A.map(listed.tools, (tool) => tool.name);
          expect(A.contains(names, "ontology_capability_metadata")).toBe(true);
          expect(A.contains(names, "ontology_sparql_query")).toBe(true);
          expect(A.contains(names, "ontology_propose_change_batch")).toBe(false);
          expect(A.contains(names, "ontology_repair")).toBe(false);

          const metadataCall = yield* client["tools/call"]({
            name: "ontology_capability_metadata",
            arguments: {},
          });
          const metadata = yield* decodeCapabilityMetadataResponse(metadataCall.structuredContent);
          const queryRequest = yield* encodeOntologySparqlQueryRequest(
            OntologySparqlQueryRequest.make({
              path: ontologyPath,
              profile: "select",
              query: "SELECT ?s ?p ?o WHERE { ?s ?p ?o }",
            })
          );
          const queryCall = yield* client["tools/call"]({ name: "ontology_sparql_query", arguments: queryRequest });
          const query = yield* decodeOntologySparqlQueryResponse(queryCall.structuredContent);

          expect(metadataCall.isError).toBe(false);
          expect(metadata.budgets.maxQueryResults).toBe(200);
          expect(queryCall.isError).toBe(false);
          expect(query.query.displayedResultCount).toBe(4);
        })
      )
  );

  it.effect("rejects untrusted Origins with typed 403 and rejects unauthenticated requests", () =>
    withHttpServer({ mutationsEnabled: false, approvedMutationTools: [] }, (_root, _ontologyPath, useSocketTransport) =>
      Effect.gen(function* () {
        const forbidden = yield* rawInitialize(useSocketTransport, {
          authorization: rpcSessionAuthorizationHeader(token),
          origin: "https://attacker.example",
        });
        const forbiddenBody = yield* forbidden.text;
        const unauthorized = yield* rawInitialize(useSocketTransport, { origin: allowedOrigin });

        expect(forbidden.status).toBe(403);
        expect(Str.includes("OntologyMcpOriginForbidden")(forbiddenBody)).toBe(true);
        expect(unauthorized.status).toBe(401);
      })
    )
  );

  it.effect("fails mutation closed through TierGate when no tool approval resolves", () =>
    Effect.gen(function* () {
      const probe = yield* makeLedgerProbe();
      yield* withHttpServer(
        { mutationsEnabled: true, approvedMutationTools: [], ledger: probe.layer },
        (_root, ontologyPath) =>
          Effect.gen(function* () {
            const client = yield* makeMcpClient();
            const opened = yield* openThroughMcp(client, ontologyPath);
            const request = yield* encodeProposeChangeBatchRequest(
              ProposeChangeBatchRequest.make({
                path: ontologyPath,
                expectedFingerprint: opened.fingerprint,
                operations: [addName("carol", "Carol")],
              })
            );
            const call = yield* client["tools/call"]({
              name: ProposeChangeBatchTool.name,
              arguments: request,
            });
            const refusal = yield* decodeOntologyToolFailure(call.structuredContent);

            expect(call.isError).toBe(true);
            expect(refusal._tag).toBe("OntologyTierGateRefusal");
          })
      );
      // A refused dispatch produces exactly one ledger row — the denied
      // decision. There was no execution to settle, so no outcome row exists.
      const decisions = yield* Ref.get(probe.decisions);
      expect(decisions).toHaveLength(1);
      expect(decisions[0]!.verdict).toBe("denied");
      expect(decisions[0]!.verdict === "denied" && decisions[0]!.reason).toBe("principal-not-granted");
      expect(yield* Ref.get(probe.outcomes)).toHaveLength(0);
    })
  );

  it.effect("chains two approved mutations of one MCP session into one governed run", () =>
    Effect.gen(function* () {
      const probe = yield* makeLedgerProbe();
      yield* withHttpServer(
        { mutationsEnabled: true, approvedMutationTools: [ProposeChangeBatchTool.name], ledger: probe.layer },
        (_root, ontologyPath) =>
          Effect.gen(function* () {
            const client = yield* makeMcpClient();
            const opened = yield* openThroughMcp(client, ontologyPath);
            const firstRequest = yield* encodeProposeChangeBatchRequest(
              ProposeChangeBatchRequest.make({
                path: ontologyPath,
                expectedFingerprint: opened.fingerprint,
                operations: [addName("carol", "Carol")],
              })
            );
            const firstCall = yield* client["tools/call"]({
              name: ProposeChangeBatchTool.name,
              arguments: firstRequest,
            });
            const first = yield* decodeProposeChangeBatchResponse(firstCall.structuredContent);
            const secondRequest = yield* encodeProposeChangeBatchRequest(
              ProposeChangeBatchRequest.make({
                path: ontologyPath,
                expectedFingerprint: first.currentFingerprint,
                operations: [addName("dave", "Dave")],
              })
            );
            const secondCall = yield* client["tools/call"]({
              name: ProposeChangeBatchTool.name,
              arguments: secondRequest,
            });
            expect(firstCall.isError).toBe(false);
            expect(secondCall.isError).toBe(false);
          })
      );
      // Two rows per allowed dispatch — a write-ahead decision and its
      // settlement — and both dispatches belong to ONE run. That last part is
      // the session-keying proof: the HTTP protocol mints a fresh clientId per
      // request, so a gate keyed on clientId would produce two runs, each a
      // lone genesis row, and this chain assertion would fail. The read-only
      // open/inspect call is ungated and writes nothing.
      const decisions = yield* Ref.get(probe.decisions);
      const outcomes = yield* Ref.get(probe.outcomes);
      expect(decisions).toHaveLength(2);
      const runKey = decisions[0]!.runKey;
      expect(decisions[1]!.runKey).toBe(runKey);
      expect(A.map(decisions, (record) => record.seq)).toEqual([0, 1]);
      expect(A.map(decisions, (record) => record.verdict)).toEqual(["allowed", "allowed"]);
      expect(decisions[0]!.sinkClass).toBe("mcp-write");
      expect(decisions[0]!.audience).toBe("local-workspace");
      expect(verifyExecutionDecisionChain(decisions, runKey).result).toBe("chain-intact");
      expect(outcomes).toHaveLength(2);
      expect(A.map(outcomes, (record) => record.settlement)).toEqual(["completed", "completed"]);
      expect(verifyOutcomeBinding(outcomes[0]!, decisions[0]!)).toBe(true);
      expect(verifyOutcomeBinding(outcomes[1]!, decisions[1]!)).toBe(true);
    })
  );

  it.effect("refuses the mutation and leaves the workspace unchanged when the decision write fails", () =>
    Effect.gen(function* () {
      const probe = yield* makeLedgerProbe();
      yield* Ref.set(probe.failWrites, true);
      yield* withHttpServer(
        { mutationsEnabled: true, approvedMutationTools: [ProposeChangeBatchTool.name], ledger: probe.layer },
        (root, ontologyPath) =>
          Effect.gen(function* () {
            const client = yield* makeMcpClient();
            const opened = yield* openThroughMcp(client, ontologyPath);
            const fileSystem = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const before = yield* fileSystem.readFileString(path.join(root, "ontology.ttl"));
            const request = yield* encodeProposeChangeBatchRequest(
              ProposeChangeBatchRequest.make({
                path: ontologyPath,
                expectedFingerprint: opened.fingerprint,
                operations: [addName("carol", "Carol")],
              })
            );
            const call = yield* client["tools/call"]({
              name: ProposeChangeBatchTool.name,
              arguments: request,
            });
            const refusal = yield* decodeOntologyToolFailure(call.structuredContent);

            // The operation is granted, but the write-ahead decision could
            // not be written: no record, no action. The refusal reaching the
            // agent is reason-free — the same typed envelope as any refusal.
            expect(call.isError).toBe(true);
            expect(refusal._tag).toBe("OntologyTierGateRefusal");

            const after = yield* fileSystem.readFileString(path.join(root, "ontology.ttl"));
            expect(after).toBe(before);
            // No provenance sidecar was produced either: the mutation never ran.
            expect(yield* fileSystem.readDirectory(root)).toEqual(["ontology.ttl"]);
          })
      );
      expect(yield* Ref.get(probe.decisions)).toHaveLength(0);
      expect(yield* Ref.get(probe.outcomes)).toHaveLength(0);
    })
  );

  it.effect("leaves ontology_publish_provenance unregistered when no destination is allowlisted", () =>
    withHttpServer(
      {
        mutationsEnabled: true,
        approvedMutationTools: [ProposeChangeBatchTool.name],
        epistemicConfig: makeEpistemicConfigTest(
          EpistemicServerConfig.make({ destinationAllowlist: [], policyRevision: defaultPolicyRevision })
        ),
      },
      () =>
        Effect.gen(function* () {
          const client = yield* makeMcpClient();
          const listed = yield* client["tools/list"](undefined);
          const names = A.map(listed.tools, (tool) => tool.name);

          expect(A.contains(names, PublishProvenanceTool.name)).toBe(false);
          // The sibling positive fact: registration is otherwise working, so
          // the absence above is the allowlist gate and not a broken mount.
          expect(A.contains(names, ProposeChangeBatchTool.name)).toBe(true);
        })
    )
  );

  it.effect("carries a publication from a real tool handler through the governed egress fetch", () =>
    Effect.gen(function* () {
      const probe = yield* makeLedgerProbe();
      // The base fetch the governed boundary delegates to when it allows a
      // request. Nothing here reaches the network; being called at all is the
      // proof that the policy Fetch was the one in force, because an
      // un-overridden Fetch would have used the platform fetch instead. A plain
      // array, not a Ref: `fetch` has no fiber to run an Effect on.
      const delivered: Array<string> = [];
      const egressFetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        delivered.push(`${String(init?.method ?? "GET")} ${String(input)}`);
        return Promise.resolve(new Response("stored", { status: 202 }));
      }) as typeof globalThis.fetch;

      yield* withHttpServer(
        {
          mutationsEnabled: true,
          // Publication is granted; the change-batch tool is registered but
          // deliberately ungranted, so the test has a real gate refusal to
          // compare the egress refusal against.
          approvedMutationTools: [ExportProvenanceTool.name, PublishProvenanceTool.name],
          egressFetch,
          ledger: probe.layer,
        },
        (_root, ontologyPath) =>
          Effect.gen(function* () {
            const client = yield* makeMcpClient();
            const opened = yield* openThroughMcp(client, ontologyPath);
            const exportRequest = yield* encodeExportProvenanceRequest(
              ExportProvenanceRequest.make({
                path: ontologyPath,
                baseIri: O.none(),
                sessionHandle: O.none(),
                expectedFingerprint: opened.fingerprint,
                provPath: yield* decodeOntologyFilePath("ontology.prov.ttl"),
                datasetPath: yield* decodeOntologyFilePath("ontology.dataset.ttl"),
              })
            );
            const exported = yield* client["tools/call"]({
              name: ExportProvenanceTool.name,
              arguments: exportRequest,
            });
            expect(exported.isError).toBe(false);

            const allowedCall = yield* client["tools/call"]({
              name: PublishProvenanceTool.name,
              arguments: {
                provPath: "ontology.prov.ttl",
                destination: `${fixtureAllowedDestination}/v1/provenance`,
              },
            });
            const published = yield* decodePublishProvenanceResponse(allowedCall.structuredContent);

            expect(allowedCall.isError).toBe(false);
            expect(published.status).toBe(202);
            expect(published.publishedBytes).toBeGreaterThan(0);

            const deniedCall = yield* client["tools/call"]({
              name: PublishProvenanceTool.name,
              arguments: { provPath: "ontology.prov.ttl", destination: "https://exfiltration.example/collect" },
            });
            const refusal = yield* decodeOntologyToolFailure(deniedCall.structuredContent);
            const ungrantedCall = yield* client["tools/call"]({
              name: ProposeChangeBatchTool.name,
              arguments: yield* encodeProposeChangeBatchRequest(
                ProposeChangeBatchRequest.make({
                  path: ontologyPath,
                  expectedFingerprint: opened.fingerprint,
                  operations: [addName("carol", "Carol")],
                })
              ),
            });
            const gateRefusal = yield* decodeOntologyToolFailure(ungrantedCall.structuredContent);

            expect(deniedCall.isError).toBe(true);
            expect(refusal._tag).toBe("OntologyTierGateRefusal");
            // A destination denial must be indistinguishable from an operation
            // denial. This is the only place both are visible: the guidance
            // string is restated in the ontology slice because slices cannot
            // import each other, so this assertion is what keeps them in sync.
            expect(gateRefusal._tag).toBe("OntologyTierGateRefusal");
            expect(refusal._tag === "OntologyTierGateRefusal" && refusal.guidance).toBe(
              gateRefusal._tag === "OntologyTierGateRefusal" && gateRefusal.guidance
            );
          })
      );

      // The allowlisted destination was delivered; the other never reached the
      // network side of the boundary at all.
      expect(delivered).toEqual([`POST ${fixtureAllowedDestination}/v1/provenance`]);

      const decisions = yield* Ref.get(probe.decisions);
      const egressDecisions = A.filter(decisions, (record) => record.sinkClass === "network-egress");
      // Two decisions per publication attempt: the gate's (may this session
      // publish) and the egress boundary's (may this destination be reached).
      // The denied attempt is refused by the second, not the first.
      expect(A.length(egressDecisions)).toBeGreaterThanOrEqual(3);
      expect(A.some(egressDecisions, (record) => record.verdict === "denied")).toBe(true);
      expect(A.some(egressDecisions, (record) => record.verdict === "allowed")).toBe(true);
    })
  );

  it.effect("records the authenticated MCP caller and surfaces budget and CAS failures as typed tool errors", () =>
    withHttpServer(
      { mutationsEnabled: true, approvedMutationTools: [ProposeChangeBatchTool.name] },
      (root, ontologyPath) =>
        Effect.gen(function* () {
          const client = yield* makeMcpClient();
          const opened = yield* openThroughMcp(client, ontologyPath);
          const firstRequest = yield* encodeProposeChangeBatchRequest(
            ProposeChangeBatchRequest.make({
              path: ontologyPath,
              expectedFingerprint: opened.fingerprint,
              operations: [addName("carol", "Carol")],
            })
          );
          const firstCall = yield* client["tools/call"]({
            name: ProposeChangeBatchTool.name,
            arguments: firstRequest,
          });
          const first = yield* decodeProposeChangeBatchResponse(firstCall.structuredContent);
          const fileSystem = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const provenance = yield* fileSystem.readFileString(
            path.join(root, `ontology.ttl.${first.currentFingerprint}.prov.ttl`)
          );

          const budgetRequest = yield* encodeProposeChangeBatchRequest(
            ProposeChangeBatchRequest.make({
              path: ontologyPath,
              expectedFingerprint: first.currentFingerprint,
              operations: A.makeBy(257, (index) => addName(`budget-${index}`, `Name ${index}`)),
            })
          );
          const budgetCall = yield* client["tools/call"]({
            name: ProposeChangeBatchTool.name,
            arguments: budgetRequest,
          });
          const budget = yield* decodeOntologyToolFailure(budgetCall.structuredContent);

          const staleRequest = yield* encodeProposeChangeBatchRequest(
            ProposeChangeBatchRequest.make({
              path: ontologyPath,
              expectedFingerprint: opened.fingerprint,
              operations: [addName("dave", "Dave")],
            })
          );
          const staleCall = yield* client["tools/call"]({
            name: ProposeChangeBatchTool.name,
            arguments: staleRequest,
          });
          const stale = yield* decodeOntologyToolFailure(staleCall.structuredContent);

          expect(firstCall.isError).toBe(false);
          expect(Str.includes("urn:beep:desktop-rpc-session:mcp-client:")(provenance)).toBe(true);
          expect(Str.includes("prov:Agent")(provenance)).toBe(true);
          expect(Str.includes("prov:wasAssociatedWith")(provenance)).toBe(true);
          expect(budgetCall.isError).toBe(true);
          expect(budget._tag).toBe("OntologyBudgetRefusal");
          expect(staleCall.isError).toBe(true);
          expect(stale._tag).toBe("OntologyCasConflict");
        })
    )
  );
});
