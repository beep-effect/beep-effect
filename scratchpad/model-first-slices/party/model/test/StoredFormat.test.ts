import * as NodeServices from "@effect/platform-node/NodeServices";
import { Story } from "@alchemy.run/domain/Story";
import { expect, it } from "@effect/vitest";
import { Provenance } from "@proto/kernel/Invocation";
import { ClaimAccepted } from "@proto/party-contract/Claim/AcceptClaim.command";
import { EvidenceAdded } from "@proto/party-contract/Claim/AddEvidence.command";
import { ProposalApproved } from "@proto/party-contract/Claim/ApproveProposal.command";
import { AssertClaim, ClaimAsserted } from "@proto/party-contract/Claim/AssertClaim.command";
import { DispositionProposed } from "@proto/party-contract/Claim/ProposeDisposition.command";
import { MergeRefusal, MergeRefused } from "@proto/party-contract/Claim/RecordMergeRefused.command";
import { ReviewRequested } from "@proto/party-contract/Claim/ReviewRequested.event";
import { Authority } from "@proto/party-model/Authority.external";
import { Claim, ClaimState } from "@proto/party-model/Claim/Claim.aggregate";
import { ClaimReview } from "@proto/party-model/Claim/ClaimReview.view";
import { MemoryPartyDirectoryStore } from "@proto/party-model/Directory/PartyDirectory.store";
import { PartyHandlers } from "@proto/party-model/Party.handlers";
import { PartyModel } from "@proto/party-model/Party.model";
import { Reasoner } from "@proto/party-model/Review/Reasoner.external";
import { ReviewAssist, ReviewAssistActivities } from "@proto/party-model/Review/ReviewAssist.saga";
import { ReviewRuns } from "@proto/party-model/Review/ReviewRuns.external";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";

// Stored as phase 2 wrote them (test/stored/*.json), read with phase 3's declarations (D22).
// Each stored event decodes by its tag, as the library's kernel does.
const StoredEvent = S.Union([ClaimAsserted, ReviewRequested, EvidenceAdded, DispositionProposed, ProposalApproved, ClaimAccepted, MergeRefused]);
const decodeEvent = (json: unknown) => S.decodeUnknownEffect(S.toCodecJson(StoredEvent))(json);
const decodeAs = <Schema extends S.Top>(schema: Schema) => S.decodeUnknownEffect(S.toCodecJson(schema));

/** The stored bytes of a fixture, and the JSON they hold. */
const stored = (name: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const file = yield* path.fromFileUrl(new URL(`./stored/${name}`, import.meta.url));
    const bytes = yield* fs.readFileString(file);
    return { file, bytes, json: yield* S.decodeUnknownEffect(S.fromJsonString(S.Unknown))(bytes) };
  });
const history = (name: string) =>
  Effect.flatMap(stored(name), ({ json }) =>
    Effect.forEach(json as ReadonlyArray<unknown>, decodeEvent),
  );

const { given, state, view } = Story;
const story = Story.make(PartyModel, {
  layer: PartyHandlers.pipe(Layer.provide(MemoryPartyDirectoryStore)),
  stub: [Reasoner, Authority, ReviewRuns],
});

it.effect("phase 2's stored events, state, receipt, saga payload and provenance decode to the values phase 3 expects", () =>
  Effect.gen(function* () {
    const claim1 = yield* history("claim_1.history.json");
    // Renamed and added: `excerpt` reads as `quote`, and a missing `trust` as "normal".
    expect(claim1[2]).toMatchObject({ signals: [{ source: "phone", quote: "confirmed by phone", trust: "normal" }] });
    // Widened: the stored integer still reads.
    expect(claim1[4]).toMatchObject({ _tag: "ProposalApproved", corroboration: 3 });
    // Reshaped: the stored line of text reads as the structured reason.
    expect(claim1[5]).toMatchObject({ reason: MergeRefusal.cases.Vetoed.make({ reason: "not-registered" }) });

    const claim2 = yield* history("claim_2.history.json");
    // Removed: the stored `corroboration` is ignored.
    expect(claim2[2]).toMatchObject({ _tag: "ClaimAccepted" });
    expect(P.hasProperty(claim2[2], "corroboration")).toBe(false);
    expect(claim2[3]).toMatchObject({ reason: MergeRefusal.cases.Readmission.make({ reason: "lapsed" }) });

    const pending = yield* Effect.flatMap(stored("Claim.state.json"), ({ json }) => decodeAs(ClaimState)(json));
    expect(pending).toMatchObject({ _tag: "Pending", revision: 2, signals: A.map([0, 1, 2], () => expect.objectContaining({ trust: "normal" })) });

    const receipt = (yield* stored("AssertClaim.receipt.json")).json as {
      readonly events: ReadonlyArray<unknown>;
      readonly reply: unknown;
    };
    expect(yield* Effect.forEach(receipt.events, decodeEvent)).toHaveLength(2);
    expect(yield* decodeAs(AssertClaim.reply!)(receipt.reply)).toEqual({ reviewRun: "review:claim_1:1" });

    const payload = yield* Effect.flatMap(stored("ReviewAssist.payload.json"), ({ json }) =>
      decodeAs(ReviewAssist.workflow.payloadSchema)(json),
    );
    expect(payload).toMatchObject({ key: "review:claim_1:1", signals: [{ quote: "From: Dana Smith <dana@acme.test>", trust: "normal" }, {}] });

    const provenance = yield* Effect.flatMap(stored("Provenance.json"), ({ json }) => decodeAs(Provenance)(json));
    expect(provenance.chain).toEqual([{ by: { _tag: "Agent", run: "review:claim_1:1" }, cause: { _tag: "SagaStep", saga: "ReviewAssist", key: "review:claim_1:1", step: "propose" } }]);
  }).pipe(Effect.provide(NodeServices.layer)),
);

it.effect("frozen history replays through today's evolve to the expected state and read model", () =>
  Effect.gen(function* () {
    const claim1 = yield* history("claim_1.history.json");
    const claim2 = yield* history("claim_2.history.json");
    yield* story(
      given(Claim.ref("claim_1"), ...claim1),
      given(Claim.ref("claim_2"), ...claim2),
      state(Claim.ref("claim_1"), (current) => expect(current).toMatchObject({ _tag: "Accepted", org: "org_acme" })),
      state(Claim.ref("claim_2"), (current) => expect(current).toMatchObject({ _tag: "Accepted", org: "org_acme" })),
      // The read model renders the structured reason in the form readers already know.
      view(ClaimReview, Claim.ref("claim_1"), { status: "accepted", sources: 3, notes: [{ _tag: "MergeRefused", reason: "vetoed:not-registered" }] }),
      view(ClaimReview, Claim.ref("claim_2"), { status: "accepted", notes: [{ _tag: "MergeRefused", reason: "readmission:lapsed" }] }),
    );
  }).pipe(Effect.provide(NodeServices.layer)),
);

it.effect("a read converts in memory and never rewrites stored bytes; a new write uses the new form", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const names = ["claim_1.history.json", "claim_2.history.json", "Claim.state.json", "AssertClaim.receipt.json", "ReviewAssist.payload.json"];
    const before = yield* Effect.forEach(names, stored);
    const claim1 = yield* history("claim_1.history.json");
    yield* history("claim_2.history.json");
    for (const { file, bytes } of before) expect(yield* fs.readFileString(file)).toBe(bytes);
    // Encoding what was read writes today's form: the structured reason, `excerpt` and `trust`.
    const reencoded = yield* S.encodeUnknownEffect(S.toCodecJson(MergeRefused))(claim1[5]);
    expect(reencoded).toMatchObject({ reason: { _tag: "Vetoed", reason: "not-registered" } });
    const added = yield* S.encodeUnknownEffect(S.toCodecJson(EvidenceAdded))(claim1[2]);
    expect(added).toMatchObject({ signals: [{ source: "phone", excerpt: "confirmed by phone", trust: "normal" }] });
    expect(O.isSome(R.get(added as Record<string, unknown>, "signals"))).toBe(true);
  }).pipe(Effect.provide(NodeServices.layer)),
);

// D35: activity results are stored formats. Frozen before phase 4 added `usage.cachedUnits`.
it.effect("the review saga's stored activity results decode with today's schemas, converting on read", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const { file, bytes, json } = yield* stored("ReviewAssist.activities.json");
    const results = json as Record<keyof typeof ReviewAssistActivities, unknown>;
    const exitOf = <Name extends keyof typeof ReviewAssistActivities>(name: Name) =>
      S.decodeUnknownEffect(
        S.toCodecJson(S.Exit(ReviewAssistActivities[name].success, ReviewAssistActivities[name].error, S.Defect())),
      )(results[name]);
    expect(yield* exitOf("assess")).toMatchObject({ _tag: "Success", value: { usage: { units: 12, cachedUnits: 0 } } });
    expect(yield* exitOf("reserve")).toMatchObject({ _tag: "Success", value: { run: "review:claim_1:1" } });
    const step = yield* exitOf("step");
    expect(Exit.isFailure(step)).toBe(true);
    expect(yield* exitOf("propose")).toEqual(Exit.succeed("readmission:lapsed"));
    expect(yield* fs.readFileString(file)).toBe(bytes);
  }).pipe(Effect.provide(NodeServices.layer)),
);
