import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  HydratedSearchResult,
  SearchDecision,
  SearchGatewayResult,
  SearchMode,
  SearchVectorHit,
  VectorRepairPurgeCandidate,
  VectorRepairPurgeReason,
  hydrateAndFilterVectorHits,
} from "../../beep/MemorySearchGateway.ts";
import { MemoryItem, memoryAccessPolicyForOmiChat, memoryAccessPolicyForThirdParty } from "../../beep/ProductMemory.ts";

const encodeSearchVectorHit = S.encodeEffect(SearchVectorHit);

const decode = <A>(schema: S.ConstraintDecoder<A>, input: unknown): A =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const captured = DateTime.toUtc(DateTime.makeUnsafe("2026-09-20T10:00:00Z"));
const updated = DateTime.toUtc(DateTime.makeUnsafe("2026-09-21T10:00:00Z"));
const now = DateTime.toUtc(DateTime.makeUnsafe("2026-09-22T10:00:00Z"));

const item = (patch: Partial<Parameters<typeof MemoryItem.make>[0]> = {}): MemoryItem =>
  MemoryItem.make({
    memoryId: "m-1",
    uid: "user-1",
    version: 1,
    tier: "long_term",
    status: "active",
    processingState: "processed",
    content: O.some("Ada lives in Seattle"),
    sourceState: "active",
    sensitivityLabels: [],
    visibility: "private",
    userAsserted: false,
    capturedAt: captured,
    updatedAt: updated,
    ledgerCommitId: O.some("commit-1"),
    ledgerSequence: O.some(3),
    accountGeneration: 2,
    itemRevision: 4,
    sourceCommitId: O.some("source-1"),
    contentHash: O.some("hash-1"),
    ...patch,
  });

const hitWire = {
  vectorId: "vec-1",
  memoryId: "m-1",
  score: 0.9,
  projectionCommitId: "commit-1",
  vectorUpdatedAt: "2026-09-21T12:00:00.000Z",
  uid: "user-1",
  accountGeneration: 2,
  itemRevision: 4,
  sourceCommitId: "source-1",
  contentHash: "hash-1",
};

const hit = (patch: Record<string, unknown> = {}): SearchVectorHit => decode(SearchVectorHit, { ...hitWire, ...patch });

const gateway = (
  hits: ReadonlyArray<SearchVectorHit>,
  items: { readonly [key: string]: MemoryItem },
  patch: Partial<Parameters<typeof hydrateAndFilterVectorHits>[0]> = {},
): SearchGatewayResult =>
  hydrateAndFilterVectorHits({
    hits,
    authoritativeItems: items,
    policy: memoryAccessPolicyForOmiChat(),
    mode: "default",
    requiredProjectionCommitId: "commit-1",
    requiredAccountGeneration: 2,
    now,
    ...patch,
  });

const onlyReason = (result: SearchGatewayResult): VectorRepairPurgeReason | "none" =>
  O.match(A.head(result.repairPurgeCandidates), { onNone: () => "none", onSome: (candidate) => candidate.reason });

describe("SearchVectorHit", () => {
  it("decodes present freshness metadata and treats missing or null as none", () => {
    const full = hit();
    assert.strictEqual(O.getOrNull(full.vectorId), "vec-1");
    assert.strictEqual(O.getOrNull(full.accountGeneration), 2);
    assert.strictEqual(DateTime.formatIso(full.vectorUpdatedAt), "2026-09-21T12:00:00.000Z");
    const bare = decode(SearchVectorHit, {
      memoryId: "m-1",
      score: 0.1,
      projectionCommitId: "commit-1",
      vectorUpdatedAt: "2026-09-21T12:00:00.000Z",
      uid: null,
    });
    assert.strictEqual(O.isNone(bare.vectorId), true);
    assert.strictEqual(O.isNone(bare.uid), true);
    assert.strictEqual(O.isNone(bare.itemRevision), true);
    const encoded = Effect.runSync(encodeSearchVectorHit(bare));
    assert.strictEqual(encoded.vectorId, null);
    assert.strictEqual(encoded.contentHash, null);
    assert.strictEqual(decodeFails(SearchVectorHit, { ...hitWire, score: "high" }), true);
  });
});

describe("SearchGatewayResult", () => {
  it("defaults every collection on construction", () => {
    const empty = SearchGatewayResult.make({});
    assert.deepStrictEqual(empty.results, []);
    assert.deepStrictEqual(empty.decisions, {});
    assert.deepStrictEqual(empty.repairPurgeCandidates, []);
  });
});

describe("hydrateAndFilterVectorHits", () => {
  it("hydrates an allowed hit and ranks by score then arrival order", () => {
    const low = hit({ vectorId: "vec-low", memoryId: "m-2", score: 0.2 });
    const second = item({ memoryId: "m-2" });
    const result = gateway([low, hit(), hit({ vectorId: "vec-dup", memoryId: "m-1", score: 0.9 })], {
      "m-1": item(),
      "m-2": second,
    });
    assert.deepStrictEqual(
      A.map(result.results, (entry) => [entry.item.memoryId, entry.score]),
      [
        ["m-1", 0.9],
        ["m-1", 0.9],
        ["m-2", 0.2],
      ],
    );
    assert.deepStrictEqual(result.decisions, { "m-1": "allowed", "m-2": "allowed" });
    assert.deepStrictEqual(result.repairPurgeCandidates, []);
  });

  it("flags a missing authoritative item and falls back to the memory id as vector id", () => {
    const result = gateway([hit({ vectorId: "  " })], {});
    assert.deepStrictEqual(result.decisions, { "m-1": "missing_authoritative_item" });
    const candidate = O.getOrThrow(A.head(result.repairPurgeCandidates));
    assert.strictEqual(candidate.vectorId, "m-1");
    assert.strictEqual(candidate.reason, "missing_authoritative_item");
    assert.strictEqual(candidate.decision, "missing_authoritative_item");
    assert.strictEqual(candidate.requiredProjectionCommitId, "commit-1");
    assert.strictEqual(O.isNone(candidate.authoritativeItemRevision), true);
    assert.strictEqual(O.isNone(candidate.authoritativeAccountGeneration), true);
  });

  it("flags a stale projection commit against the authoritative ledger commit", () => {
    const result = gateway([hit({ projectionCommitId: "commit-0" })], { "m-1": item({ ledgerCommitId: O.some("commit-2") }) });
    assert.deepStrictEqual(result.decisions, { "m-1": "stale_projection" });
    const candidate = O.getOrThrow(A.head(result.repairPurgeCandidates));
    assert.strictEqual(candidate.reason, "stale_projection_commit");
    assert.strictEqual(candidate.decision, "stale_projection");
    assert.strictEqual(candidate.requiredProjectionCommitId, "commit-2");
    assert.strictEqual(candidate.observedProjectionCommitId, "commit-0");
    assert.strictEqual(O.getOrNull(candidate.authoritativeItemRevision), 4);
    assert.strictEqual(O.getOrNull(candidate.authoritativeSourceCommitId), "source-1");
  });

  it("uses the required commit when the item has no ledger commit", () => {
    const result = gateway([hit()], { "m-1": item({ ledgerCommitId: O.none() }) });
    assert.deepStrictEqual(result.decisions, { "m-1": "allowed" });
  });

  it("treats missing freshness metadata as a stale vector", () => {
    const items = { "m-1": item() };
    assert.strictEqual(onlyReason(gateway([hit({ uid: null })], items)), "missing_vector_freshness_metadata");
    assert.strictEqual(onlyReason(gateway([hit({ accountGeneration: null })], items)), "missing_vector_freshness_metadata");
    assert.strictEqual(onlyReason(gateway([hit({ itemRevision: null })], items)), "missing_vector_freshness_metadata");
    assert.strictEqual(onlyReason(gateway([hit({ sourceCommitId: null })], items)), "missing_vector_freshness_metadata");
    assert.strictEqual(onlyReason(gateway([hit({ contentHash: null })], items)), "missing_vector_freshness_metadata");
    assert.deepStrictEqual(gateway([hit({ uid: null })], items).decisions, { "m-1": "stale_vector" });
  });

  it("allows a vector without source commit or hash when the item has none either", () => {
    const result = gateway([hit({ sourceCommitId: null, contentHash: null })], {
      "m-1": item({ sourceCommitId: O.none(), contentHash: O.none() }),
    });
    assert.deepStrictEqual(result.decisions, { "m-1": "allowed" });
  });

  it("flags every stale identity mismatch with its own reason", () => {
    assert.strictEqual(onlyReason(gateway([hit()], { "m-1": item({ accountGeneration: 1 }) })), "stale_account_generation");
    assert.strictEqual(onlyReason(gateway([hit({ uid: "user-2" })], { "m-1": item() })), "cross_user_vector_metadata");
    assert.strictEqual(onlyReason(gateway([hit({ accountGeneration: 1 })], { "m-1": item() })), "stale_account_generation");
    assert.strictEqual(onlyReason(gateway([hit({ itemRevision: 3 })], { "m-1": item() })), "stale_item_revision");
    assert.strictEqual(onlyReason(gateway([hit({ sourceCommitId: "source-0" })], { "m-1": item() })), "stale_source_commit");
    assert.strictEqual(onlyReason(gateway([hit({ contentHash: "hash-0" })], { "m-1": item() })), "stale_content_hash");
    assert.strictEqual(
      onlyReason(gateway([hit({ vectorUpdatedAt: "2026-09-21T09:00:00.000Z" })], { "m-1": item() })),
      "stale_vector_updated_at",
    );
  });

  it("records an access denial without a repair candidate", () => {
    const denied = gateway([hit()], { "m-1": item({ status: "superseded" }) });
    assert.deepStrictEqual(denied.decisions, { "m-1": "access_denied" });
    assert.deepStrictEqual(denied.repairPurgeCandidates, []);
    assert.deepStrictEqual(denied.results, []);
    const noGrant = gateway([hit()], { "m-1": item() }, { policy: memoryAccessPolicyForThirdParty() });
    assert.deepStrictEqual(noGrant.decisions, { "m-1": "access_denied" });
  });

  it("routes archive_explicit through the archive gate", () => {
    const archived = { "m-1": item({ tier: "archive" }) };
    assert.deepStrictEqual(gateway([hit()], archived).decisions, { "m-1": "access_denied" });
    assert.deepStrictEqual(gateway([hit()], archived, { mode: "archive_explicit" }).decisions, { "m-1": "access_denied" });
    const allowed = gateway([hit()], archived, {
      mode: "archive_explicit",
      policy: memoryAccessPolicyForOmiChat(true),
    });
    assert.deepStrictEqual(allowed.decisions, { "m-1": "allowed" });
    assert.strictEqual(O.getOrThrow(A.head(allowed.results)).item.tier, "archive");
  });

  it("keeps the last decision per memory id", () => {
    const result = gateway([hit({ vectorId: "vec-fresh", score: 0.9 }), hit({ vectorId: "vec-stale", score: 0.5, itemRevision: 1 })], {
      "m-1": item(),
    });
    assert.deepStrictEqual(result.decisions, { "m-1": "stale_vector" });
    assert.strictEqual(result.results.length, 1);
    assert.strictEqual(result.repairPurgeCandidates.length, 1);
  });
});

describe("arbitraries", () => {
  it("derive for the exported schemas", () => {
    for (const schema of [
      SearchMode,
      SearchDecision,
      VectorRepairPurgeReason,
      SearchVectorHit,
      HydratedSearchResult,
      VectorRepairPurgeCandidate,
      SearchGatewayResult,
    ]) {
      assert.isDefined(Arbitrary.schema(schema));
    }
  });
});
