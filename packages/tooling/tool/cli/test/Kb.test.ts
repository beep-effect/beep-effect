import {
  Assertion,
  Audience,
  buildKb,
  DerivationBasis,
  hasKbCanary,
  KbClaim,
  KbGraph,
  KbGraphExport,
  KbLedger,
  KbProposition,
  KbRegistryNode,
  kbCommand,
  kbLogicalKey,
  makeKbGraphExport,
  makeKbLedger,
  projectKb,
  validateKb,
} from "@beep/repo-cli/commands/Kb";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it, layer } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

const encodeClaim = S.encodeEffect(S.fromJsonString(KbClaim));
const encodeAssertion = S.encodeEffect(S.fromJsonString(Assertion));
const encodeRegistryNode = S.encodeEffect(S.fromJsonString(KbRegistryNode));
const decodeGraph = S.decodeEffect(S.fromJsonString(KbGraph));
const decodeClaim = S.decodeUnknownEffect(S.toType(KbClaim));

const digest = Str.repeat(64)("a");
const absent = { _tag: "Absent", reason: "not-assessed" };
const signals = {
  sourceTrust: absent,
  sourceAssertedConfidence: absent,
  extractorConfidence: absent,
  validator: absent,
  reviewer: absent,
};
const fixture = Effect.fnUntraced(function* (
  options: { readonly public?: boolean; readonly text?: string; readonly id?: string } = {}
) {
  const id = options.id ?? "claim/1";
  const text = options.text ?? "Acme Widgets Co. published a guide.";
  const proposition = KbProposition.cases.Published.make({ subject: "entity/1", object: "entity/2", text });
  const internalId = `${id}/internal`;
  const publicId = `${id}/public`;
  const claim = yield* S.decodeUnknownEffect(KbClaim)({
    id,
    logicalKey: kbLogicalKey(proposition),
    proposition,
    supportedBy: options.public === true ? [internalId, publicId] : [internalId],
    challengedBy: [],
    validTime: { _tag: "Unknown" },
    knowledge: { recordedAt: 1, expiredAt: null },
    supersedes: null,
    signals,
    review: {
      _tag: "Accepted",
      disposition: {
        disposition: "accepted",
        reviewer: "reviewer/1",
        basis: digest,
        reviewedAt: 2,
        reason: "Verified synthetic evidence",
      },
    },
  });
  const assertion = (audience: "public" | "internal") =>
    S.decodeEffect(Assertion)({
      id: audience === "public" ? publicId : internalId,
      claimId: id,
      captureId: `${id}/capture/${audience}`,
      sourceRef: {
        kind: audience === "public" ? "web" : "internal-file",
        locator: "https://example.com/guide",
        sha256: digest,
        text: "Acme Widgets Co.",
      },
      selector: { _tag: "TextQuote", exact: "Acme Widgets Co.", prefix: "", suffix: "", start: 0, end: 16 },
      quote: "Acme Widgets Co.",
      quoteDigest: digest,
      audience,
      review: "accepted",
      outcome: "captured",
      derivation: {
        basis: audience === "public" ? "public-source" : "none",
        ref: audience === "public" ? "https://example.com/guide" : "",
      },
    });
  const internal = yield* assertion("internal");
  const assertions = options.public === true ? [internal, yield* assertion("public")] : [internal];
  return { claim, assertions, internal };
});
const platform = Layer.mergeAll(BunFileSystem.layer, Path.layer);
const live = Layer.effect(KbLedger, makeKbLedger).pipe(Layer.provideMerge(platform));

const withLedger = Effect.fnUntraced(function* (options: { readonly public?: boolean; readonly text?: string } = {}) {
  const fs = yield* FileSystem.FileSystem;
  const dir = yield* fs.makeTempDirectoryScoped();
  const root = `${dir}/ledger`;
  yield* fs.makeDirectory(root);
  const f = yield* fixture(options);
  yield* fs.writeFileString(`${root}/claims.jsonl`, `${yield* encodeClaim(f.claim)}\n`);
  const lines = yield* Effect.forEach(f.assertions, (assertion) => encodeAssertion(assertion));
  yield* fs.writeFileString(`${root}/assertions.jsonl`, `${A.join(lines, "\n")}\n`);
  return { ...f, root, out: `${dir}/out` };
});

describe("knowledge ledger admission and disclosure", () => {
  it.effect("enforces outward eligibility across schema-generated audiences and derivation bases", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const result = yield* Arbitrary.checkEffect(
        Arbitrary.schema(S.Struct({ audience: Audience, basis: DerivationBasis })),
        ({ audience, basis }) => {
          const assertion = Assertion.make({
            ...f.internal,
            audience,
            sourceRef: { ...f.internal.sourceRef, kind: "web" },
            derivation: { basis, ref: basis === "none" ? "" : "https://example.com/evidence" },
          });
          const expected = audience !== "internal" && basis !== "none";
          const report = validateKb([f.claim], [assertion]);
          const outward = projectKb([f.claim], [assertion], "outward");
          expect(A.isReadonlyArrayNonEmpty(report.outwardEligible)).toBe(expected);
          expect(Str.includes("%2Finternal")(outward["dataset.nq"] ?? "")).toBe(expected);
          return true;
        }
      );
      expect(result._tag).toBe("Passed");
    })
  );

  it.effect("promotes a claim only when accepted independent public evidence is added", () =>
    Effect.gen(function* () {
      const before = yield* fixture();
      expect(validateKb([before.claim], before.assertions).outwardEligible).toEqual([]);
      const after = yield* fixture({ id: "claim/2", public: true });
      const promoted = {
        ...after.claim,
        supersedes: O.some(before.claim.id),
        review: {
          ...after.claim.review,
          _tag: "Accepted",
          disposition: {
            disposition: "accepted",
            reviewer: "reviewer/1",
            basis: Str.repeat(64)("b"),
            reviewedAt: DateTime.makeUnsafe(3),
            reason: "Re-accepted against the new public basis",
          },
        },
      };
      const decoded = yield* decodeClaim(promoted);
      const claims = [before.claim, decoded];
      const assertions = A.appendAll(before.assertions, after.assertions);
      expect(validateKb(claims, assertions).outwardEligible).toEqual([after.claim.id]);
      const output = projectKb(claims, assertions, "outward");
      expect(output["dataset.nq"]).toContain("public-source");
      expect(output["dataset.nq"]).toContain("<http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <urn:beep:kb:Claim>");
      expect(output["dataset.nq"]).toContain("<http://www.w3.org/2000/01/rdf-schema#comment>");
      expect(output["dataset.nq"]).not.toContain("%2Finternal");
      expect(output["dataset.nq"]).not.toContain('"internal"');
    })
  );
  it.effect("excludes internal canaries from all outward artifacts and is deterministic", () =>
    Effect.gen(function* () {
      const internal = yield* fixture({ id: "CANARY-INTERNAL-opaque", text: "CANARY-INTERNAL-private" });
      const publicFact = yield* fixture({ id: "claim/2", public: true });
      const claims = [internal.claim, publicFact.claim];
      const assertions = A.appendAll(internal.assertions, publicFact.assertions);
      const outward = projectKb(claims, assertions, "outward");
      expect(hasKbCanary(outward)).toBe(false);
      expect(hasKbCanary(projectKb(claims, assertions, "planning"))).toBe(true);
      expect(projectKb(A.reverse(claims), A.reverse(assertions), "outward")).toEqual(outward);
      expect(A.join(R.values(outward), "\n")).not.toContain("CANARY-INTERNAL-");
    })
  );
  it.effect("rejects dangling references, duplicates and internal-only sources mislabeled public", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const bad = Assertion.make({ ...f.internal, audience: "public" });
      expect(validateKb([], [bad]).valid).toBe(false);
      expect(validateKb([f.claim], [bad]).violations).toContain(
        `Assertion ${bad.id}: internal-only source requires internal audience`
      );
      expect(validateKb([f.claim, f.claim], f.assertions).valid).toBe(false);
      expect(validateKb([f.claim], []).valid).toBe(false);
    })
  );
  it.effect("counts astral characters as UTF-16 and rejects split surrogate anchors", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const valid = Assertion.make({
        ...f.internal,
        quote: "😀",
        sourceRef: { ...f.internal.sourceRef, text: "x😀y" },
        selector: { _tag: "TextQuote", exact: "😀", prefix: "x", suffix: "y", start: 1, end: 3 },
      });
      expect(validateKb([f.claim], [valid]).valid).toBe(true);
      const invalid = Assertion.make({
        ...valid,
        selector: { ...valid.selector, _tag: "TextQuote", exact: "😀", prefix: "", suffix: "", start: 1, end: 2 },
      });
      expect(validateKb([f.claim], [invalid]).valid).toBe(false);
    })
  );
  it.effect("blocks pending and rejected evidence, missing derivation and expired versions", () =>
    Effect.gen(function* () {
      const f = yield* fixture({ public: true });
      const evidence = A.map(f.assertions, (a) => Assertion.make({ ...a, review: "pending" }));
      expect(validateKb([f.claim], evidence).outwardEligible).toEqual([]);
      const noBasis = A.map(f.assertions, (a) => Assertion.make({ ...a, derivation: { basis: "none", ref: "" } }));
      expect(validateKb([f.claim], noBasis).outwardEligible).toEqual([]);
      const proposed = { ...f.claim, review: { _tag: "Proposed" } };
      const decoded = yield* decodeClaim(proposed);
      expect(validateKb([decoded], f.assertions).outwardEligible).toEqual([]);
    })
  );

  it.effect("excludes rejected evidence and expired or superseded claim versions", () =>
    Effect.gen(function* () {
      const f = yield* fixture({ public: true });
      const rejected = A.map(f.assertions, (a) => Assertion.make({ ...a, review: "rejected" }));
      expect(validateKb([f.claim], rejected).outwardEligible).toEqual([]);
      const expired = { ...f.claim, knowledge: { ...f.claim.knowledge, expiredAt: O.some(DateTime.makeUnsafe(3)) } };
      expect(validateKb([expired], f.assertions).outwardEligible).toEqual([]);
      const next = yield* fixture({ id: "claim/2", public: true });
      const superseding = { ...next.claim, supersedes: O.some(f.claim.id) };
      expect(validateKb([f.claim, superseding], A.appendAll(f.assertions, next.assertions)).outwardEligible).toEqual([
        next.claim.id,
      ]);
    })
  );
  it.effect("permits independently derived personal evidence and validates media intervals", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const personal = Assertion.make({
        ...f.internal,
        audience: "personal",
        sourceRef: { ...f.internal.sourceRef, kind: "git" },
        derivation: { basis: "own-public-work", ref: "https://example.com/commit/1", firstCommit: "commit/1" },
        selector: { _tag: "MediaFragment", start: 0, end: 1 },
      });
      expect(validateKb([f.claim], [personal]).outwardEligible).toEqual([f.claim.id]);
      const invalid = Assertion.make({ ...personal, selector: { _tag: "MediaFragment", start: 2, end: 1 } });
      expect(validateKb([f.claim], [invalid]).valid).toBe(false);
    })
  );
  it.effect("rejects conflicting audiences on a shared capture and preserves escaped literal text", () =>
    Effect.gen(function* () {
      const f = yield* fixture({ public: true, text: 'Acme says "hello".\nA second line with \\.' });
      const conflicting = A.map(f.assertions, (a) => Assertion.make({ ...a, captureId: "capture/shared" }));
      expect(validateKb([f.claim], conflicting).valid).toBe(false);
      const dataset = projectKb([f.claim], f.assertions, "outward")["dataset.nq"] ?? "";
      expect(dataset).toContain('Acme says \\"hello\\".\\n');
      expect(dataset).not.toContain('"hello".\nA second');
    })
  );
});

layer(live)("knowledge ledger filesystem", (it) => {
  it.effect("scans every on-disk outward artifact while allowing a nested planning build", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const f = yield* withLedger({ text: "CANARY-INTERNAL-filtered" });
        const fs = yield* FileSystem.FileSystem;
        yield* buildKb(f.root, "planning", `${f.root}/build/planning`);
        const text = yield* fs.readFileString(`${f.root}/build/planning/dataset.nq`);
        expect(text).toContain("CANARY-INTERNAL-filtered");
        yield* buildKb(f.root, "outward", f.out);
        for (const name of yield* fs.readDirectory(f.out, { recursive: true })) {
          const text2 = yield* fs.readFileString(`${f.out}/${name}`);
          expect(text2).not.toContain("CANARY-INTERNAL-");
        }
      })
    )
  );

  it.effect("writes the four named graphs and rejects nonempty output", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const f = yield* withLedger({ public: true });
        yield* buildKb(f.root, "outward", f.out);
        const fs = yield* FileSystem.FileSystem;
        const dataset = yield* fs.readFileString(`${f.out}/dataset.nq`);
        for (const graph of ["claims", "provenance", "current", "schema"])
          expect(dataset).toContain(`urn:beep:kb:graph:${graph}`);
        const entries = yield* fs.readDirectory(f.out);
        expect(A.sort(entries, Str.Order)).toEqual(["INDEX.md", "SCHEMA.md", "dataset.nq"]);
        const again = yield* Effect.result(buildKb(f.root, "outward", f.out));
        expect(Result.isFailure(again)).toBe(true);
      })
    )
  );
  it.effect("fails outward build on an eligible canary before writing artifacts", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const f = yield* withLedger({ public: true, text: "CANARY-INTERNAL-leak" });
        const result = yield* Effect.result(buildKb(f.root, "outward", f.out));
        expect(Result.isFailure(result)).toBe(true);
        const fs = yield* FileSystem.FileSystem;
        const present = yield* fs.exists(f.out);
        expect(present).toBe(false);
      })
    )
  );
  it.effect("rejects malformed JSONL and source-overlapping output", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const f = yield* withLedger({ public: true });
        const outcome = yield* Effect.result(buildKb(f.root, "outward", `${f.root}/output`));
        expect(Result.isFailure(outcome)).toBe(true);
        const fs = yield* FileSystem.FileSystem;
        yield* fs.writeFileString(`${f.root}/assertions.jsonl`, "{broken\n");
        const ledger = yield* KbLedger;
        const outcome2 = yield* Effect.result(ledger.read(f.root));
        expect(Result.isFailure(outcome2)).toBe(true);
      })
    )
  );
});

const graphLive = Layer.effect(KbGraphExport, makeKbGraphExport).pipe(Layer.provideMerge(live));
const writeGraphRows = Effect.fnUntraced(function* (
  root: string,
  claims: ReadonlyArray<KbClaim>,
  assertions: ReadonlyArray<Assertion>
) {
  const fs = yield* FileSystem.FileSystem;
  const claimLines = yield* Effect.forEach(claims, (claim) => encodeClaim(claim));
  const assertionLines = yield* Effect.forEach(assertions, (assertion) => encodeAssertion(assertion));
  yield* fs.writeFileString(`${root}/claims.jsonl`, A.join(claimLines, "\n"));
  yield* fs.writeFileString(`${root}/assertions.jsonl`, A.join(assertionLines, "\n"));
});
layer(graphLive)("knowledge JSON graph", (it) => {
  it.effect("round-trips the exact contract and registry metadata with fallback ids", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const f = yield* withLedger({ public: true });
        const fs = yield* FileSystem.FileSystem;
        const exporter = yield* KbGraphExport;
        const entry = KbRegistryNode.make({
          id: "entity/1",
          type: "Organization",
          label: "Acme Widgets Co.",
          url: "https://example.com",
          description: "Synthetic organization",
        });
        const encoded = yield* encodeRegistryNode(entry);
        yield* fs.writeFileString(`${f.root}/registry.jsonl`, encoded);
        const graph = yield* exporter.write(f.root, "outward", `${f.out}.json`, false);
        const bytes = yield* fs.readFileString(`${f.out}.json`);
        const decoded = yield* decodeGraph(bytes);
        expect(decoded).toEqual(graph);
        expect(A.sort(R.keys(graph), Str.Order)).toEqual(["builtAt", "claims", "links", "nodes", "stats", "view"]);
        expect(graph.stats).toEqual({ nodes: 2, links: 1, claims: 1 });
        expect(graph.nodes).toEqual([
          { ...entry, audience: "public", claimIds: [f.claim.id] },
          { id: "entity/2", type: "Concept", label: "entity/2", audience: "public", claimIds: [f.claim.id] },
        ]);
        expect(graph.links).toEqual([
          {
            id: "edge/claim/1",
            source: "entity/1",
            target: "entity/2",
            predicate: "kb:Published",
            label: "published",
            claimId: "claim/1",
            audience: "public",
            review: "accepted",
            confidence: "verified",
          },
        ]);
        expect(graph.claims["claim/1"]?.assertions).toEqual([
          {
            quote: "Acme Widgets Co.",
            sourceKind: "web",
            locator: "https://example.com/guide",
            url: "https://example.com/guide",
            audience: "public",
            capturedAt: "1970-01-01T00:00:00.001Z",
          },
        ]);
      })
    )
  );
  it.effect(
    "derives confidence from selected evidence: internal statements are reported, primary captures verified",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const exporter = yield* KbGraphExport;
          const internalOnly = yield* withLedger({});
          const planning = yield* exporter.write(internalOnly.root, "planning", `${internalOnly.out}.json`, false);
          expect(planning.links[0]?.confidence).toBe("reported");
          expect(planning.claims["claim/1"]?.confidence).toBe("reported");
          const promoted = yield* withLedger({ public: true });
          const outward = yield* exporter.write(promoted.root, "outward", `${promoted.out}.json`, false);
          expect(outward.links[0]?.confidence).toBe("verified");
        })
      )
  );
  it.effect("shows only the current claim version in the planning graph", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const exporter = yield* KbGraphExport;
        const f = yield* withLedger({});
        const after = yield* fixture({ id: "claim/2", public: true });
        const next = yield* decodeClaim({
          ...after.claim,
          supersedes: O.some(f.claim.id),
        });
        yield* writeGraphRows(f.root, [f.claim, next], A.appendAll(f.assertions, after.assertions));
        const planning = yield* exporter.write(f.root, "planning", `${f.out}.json`, false);
        expect(A.map(planning.links, (l) => l.claimId)).toEqual(["claim/2"]);
        expect(R.keys(planning.claims)).toEqual(["claim/2"]);
      })
    )
  );
  it.effect("outward assertions cite public URLs instead of local capture paths", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const exporter = yield* KbGraphExport;
        const f = yield* withLedger({ public: true });
        const local = Assertion.make({
          ...f.assertions[1]!,
          sourceRef: { ...f.assertions[1]!.sourceRef, locator: "captures/web/guide.md" },
        });
        const lines = yield* Effect.forEach([f.internal, local], (assertion) => encodeAssertion(assertion));
        yield* fs.writeFileString(`${f.root}/assertions.jsonl`, `${A.join(lines, "\n")}\n`);
        const outward = yield* exporter.write(f.root, "outward", `${f.out}-outward.json`, false);
        expect(outward.claims["claim/1"]?.assertions[0]).toMatchObject({
          locator: "https://example.com/guide",
          url: "https://example.com/guide",
        });
        const planning = yield* exporter.write(f.root, "planning", `${f.out}-planning.json`, false);
        const publicRow = A.findFirst(planning.claims["claim/1"]?.assertions ?? [], (a) => a.audience === "public");
        expect(O.getOrUndefined(publicRow)).toMatchObject({
          locator: "captures/web/guide.md",
          url: "https://example.com/guide",
        });
      })
    )
  );
  it.effect(
    "filters internal-only nodes, edges and canaries before projection; promotion keeps only public assertions",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const f = yield* withLedger({ public: true });
          const hidden = yield* fixture({ id: "claim/hidden", text: "CANARY-INTERNAL-hidden" });
          const hiddenClaim = KbClaim.make({
            ...hidden.claim,
            proposition: { ...hidden.claim.proposition, subject: "entity/hidden", object: "entity/secret" },
            logicalKey: kbLogicalKey({
              ...hidden.claim.proposition,
              subject: "entity/hidden",
              object: "entity/secret",
            }),
          });
          const canaryAssertion = Assertion.make({
            ...f.internal,
            quote: "CANARY-INTERNAL-quote",
            selector: { _tag: "TextQuote", exact: "CANARY-INTERNAL-quote", prefix: "", suffix: "", start: 0, end: 21 },
            sourceRef: { ...f.internal.sourceRef, text: "CANARY-INTERNAL-quote" },
          });
          yield* writeGraphRows(
            f.root,
            [f.claim, hiddenClaim],
            A.appendAll([canaryAssertion, ...A.filter(f.assertions, (a) => a.audience === "public")], hidden.assertions)
          );
          const exporter = yield* KbGraphExport;
          const graph = yield* exporter.write(f.root, "outward", `${f.out}.json`, false);
          expect(graph.stats).toEqual({ nodes: 2, links: 1, claims: 1 });
          expect(A.map(graph.nodes, (n) => n.id)).toEqual(["entity/1", "entity/2"]);
          const fs = yield* FileSystem.FileSystem;
          const text = yield* fs.readFileString(`${f.out}.json`);
          expect(text).not.toContain("CANARY-INTERNAL-");
          expect(graph.claims[f.claim.id]?.assertions).toHaveLength(1);
          yield* writeGraphRows(f.root, [hiddenClaim], hidden.assertions);
          const before = yield* exporter.write(f.root, "outward", `${f.out}-before.json`, false);
          expect(before.stats).toEqual({ nodes: 0, links: 0, claims: 0 });
          // An independent public assertion promotes a new immutable claim version.
          const promoted = yield* fixture({ id: "claim/promoted", public: true });
          const next = KbClaim.make({ ...promoted.claim, supersedes: O.some(f.claim.id) });
          yield* writeGraphRows(f.root, [f.claim, next], A.appendAll(f.assertions, promoted.assertions));
          const after = yield* exporter.write(f.root, "outward", `${f.out}-after.json`, false);
          expect(R.keys(after.claims)).toEqual([next.id]);
          expect(A.every(after.claims[next.id]?.assertions ?? [], (a) => a.audience !== "internal")).toBe(true);
        })
      )
  );
  it.effect("uses internal > personal > public for node and link audiences in each view", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const f = yield* withLedger({ public: true });
        const personalFixture = yield* fixture({ id: "claim/personal" });
        const personal = Assertion.make({
          ...personalFixture.internal,
          audience: "personal",
          sourceRef: { ...personalFixture.internal.sourceRef, kind: "git" },
          derivation: { basis: "own-public-work", ref: "https://example.com/commit" },
        });
        yield* writeGraphRows(f.root, [f.claim, personalFixture.claim], [...f.assertions, personal]);
        const exporter = yield* KbGraphExport;
        const planning = yield* exporter.write(f.root, "planning", `${f.out}-planning.json`, false);
        expect(A.map(planning.nodes, (n) => n.audience)).toEqual(["internal", "internal"]);
        expect(A.map(planning.links, (l) => l.audience)).toEqual(["internal", "personal"]);
        const outward = yield* exporter.write(f.root, "outward", `${f.out}-outward.json`, false);
        expect(A.map(outward.nodes, (n) => n.audience)).toEqual(["personal", "personal"]);
        expect(A.map(outward.links, (l) => l.audience)).toEqual(["public", "personal"]);
      })
    )
  );
  it.effect("produces identical bytes after input permutations and permits identical output", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const f = yield* withLedger({ public: true });
        const other = yield* fixture({ id: "claim/2", public: true });
        const exporter = yield* KbGraphExport;
        const fs = yield* FileSystem.FileSystem;
        yield* writeGraphRows(f.root, [other.claim, f.claim], [...other.assertions, ...f.assertions]);
        yield* exporter.write(f.root, "outward", `${f.out}.json`, false);
        const first = yield* fs.readFileString(`${f.out}.json`);
        yield* writeGraphRows(f.root, [f.claim, other.claim], A.reverse([...other.assertions, ...f.assertions]));
        yield* exporter.write(f.root, "outward", `${f.out}.json`, false);
        const text = yield* fs.readFileString(`${f.out}.json`);
        expect(text).toBe(first);
      })
    )
  );
  it.effect("refuses different nonempty files, allows empty or forced replacement, and protects ledger inputs", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const f = yield* withLedger({ public: true });
        const exporter = yield* KbGraphExport;
        const fs = yield* FileSystem.FileSystem;
        yield* fs.writeFileString(`${f.out}.json`, "keep me");
        const outcome = yield* Effect.result(exporter.write(f.root, "outward", `${f.out}.json`, false));
        expect(Result.isFailure(outcome)).toBe(true);
        const text = yield* fs.readFileString(`${f.out}.json`);
        expect(text).toBe("keep me");
        yield* exporter.write(f.root, "outward", `${f.out}.json`, true);
        yield* fs.writeFileString(`${f.out}-empty.json`, "");
        yield* exporter.write(f.root, "outward", `${f.out}-empty.json`, false);
        const outcome2 = yield* Effect.result(exporter.write(f.root, "planning", `${f.root}/claims.jsonl`, true));
        expect(Result.isFailure(outcome2)).toBe(true);
      })
    )
  );
  it.effect("rejects an eligible canary or registry canary before writing", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const f = yield* withLedger({ public: true, text: "CANARY-INTERNAL-leak" });
        const exporter = yield* KbGraphExport;
        const fs = yield* FileSystem.FileSystem;
        const outcome = yield* Effect.result(exporter.write(f.root, "outward", `${f.out}.json`, false));
        expect(Result.isFailure(outcome)).toBe(true);
        const present = yield* fs.exists(`${f.out}.json`);
        expect(present).toBe(false);
        const clean = yield* fixture({ public: true });
        yield* writeGraphRows(f.root, [clean.claim], clean.assertions);
        const encoded = yield* encodeRegistryNode(
          KbRegistryNode.make({ id: "entity/1", type: "Concept", label: "CANARY-INTERNAL-registry" })
        );
        yield* fs.writeFileString(`${f.root}/registry.jsonl`, encoded);
        const outcome2 = yield* Effect.result(exporter.write(f.root, "outward", `${f.out}.json`, false));
        expect(Result.isFailure(outcome2)).toBe(true);
        const present2 = yield* fs.exists(`${f.out}.json`);
        expect(present2).toBe(false);
      })
    )
  );
});

const runKb = Command.runWith(kbCommand, { version: "0.0.0" });
layer(NodeServices.layer)("knowledge ledger CLI", (it) => {
  it.effect("validates, builds and exports a valid ledger through the command handlers", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const f = yield* withLedger({ public: true });
        yield* runKb([]);
        yield* runKb(["validate", "--root", f.root]);
        yield* runKb(["build", "--root", f.root, "--view", "outward", "--out", `${f.out}/view`]);
        yield* runKb(["graph", "--root", f.root, "--view", "planning", "--out", `${f.out}/graph.json`]);
        const logged = yield* TestConsole.logLines;
        const lines = A.map(logged, (line) => `${line}`);
        expect(A.some(lines, Str.startsWith("kb validate --root <dir>"))).toBe(true);
        expect(A.filter(lines, Str.includes('"valid": true'))).toHaveLength(2);
        expect(A.some(lines, Str.startsWith("Graph written: 2 nodes, 1 links, 1 claims"))).toBe(true);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    )
  );
  it.effect("reports and fails on a missing or invalid ledger", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const f = yield* withLedger();
        const missing = yield* Effect.exit(runKb(["validate", "--root", `${f.root}/missing`]));
        expect(Exit.isFailure(missing)).toBe(true);
        yield* fs.writeFileString(`${f.root}/assertions.jsonl`, "");
        const invalid = yield* Effect.exit(runKb(["validate", "--root", f.root]));
        expect(Exit.isFailure(invalid)).toBe(true);
        const build = yield* Effect.exit(runKb(["build", "--root", f.root, "--view", "planning", "--out", f.out]));
        expect(Exit.isFailure(build)).toBe(true);
        const logged = yield* TestConsole.logLines;
        const lines = A.map(logged, (line) => `${line}`);
        expect(A.filter(lines, Str.includes('"valid": false'))).toHaveLength(2);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    )
  );
});
