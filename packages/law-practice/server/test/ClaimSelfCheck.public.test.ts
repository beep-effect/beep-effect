import { ClaimElementTree } from "@beep/law-practice-domain/values/ClaimElement";
import { PatentClaims } from "@beep/law-practice-domain/values/PatentDocument";
import { PatentNumber } from "@beep/law-practice-domain/values/PatentNumber";
import { UsptoClaimsLive } from "@beep/law-practice-server/UsptoClaims";
import { ClaimSelfCheck, ClaimSelfCheckLive, UsptoClaimSource } from "@beep/law-practice-use-cases/ClaimSelfCheck";
import { it } from "@beep/test-runner";
import { Uspto, UsptoConfigInput } from "@beep/uspto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { assert, describe } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as FileSystem from "effect/FileSystem";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { compareStructuralFamily } from "./evaluation/Structural.ts";

const fixture = Effect.fnUntraced(function* (name: string) {
  const path = yield* Path.Path;
  const filename = yield* path.fromFileUrl(new URL(`./fixtures/claim-element/${name}`, import.meta.url));
  return yield* (yield* FileSystem.FileSystem).readFileString(filename);
});

// Replay only the public claims subtree and the metadata needed to locate it.
// No network, credentials, party names or complete file-wrapper records.
const nativePublicationClient = (application: string, publication: string, xml: ReturnType<typeof fixture>) =>
  Layer.effect(
    HttpClient.HttpClient,
    Effect.gen(function* () {
      const text = yield* xml;
      return HttpClient.make((request) =>
        Effect.succeed(
          HttpClientResponse.fromWeb(
            request,
            Str.includes("/applications/search?")(request.url)
              ? new Response(`{
                  "patentFileWrapperDataBag": [{
                    "applicationNumberText": "${application}",
                    "applicationMetaData": { "earliestPublicationNumber": "${publication}" },
                    "pgpubDocumentMetaData": {
                      "productIdentifier": "APPXML", "xmlFileName": "${publication}.xml",
                      "fileLocationURI": "https://api.uspto.gov/native-publication.xml"
                    }
                  }]
                }`)
              : new Response(text)
          )
        )
      );
    })
  );

const checkerFor = (transport: ReturnType<typeof nativePublicationClient>) =>
  ClaimSelfCheckLive.pipe(
    Layer.provide(UsptoClaimsLive),
    Layer.provide(Uspto.makeLayer(UsptoConfigInput.make({}))),
    Layer.provide(transport)
  );
const checker = checkerFor(
  nativePublicationClient("16287736", "US20200109732A1", fixture("US20200109732A1.claims.xml"))
);

const patentClaimsJson = S.fromJsonString(PatentClaims);
const claimElementTreeJson = S.fromJsonString(ClaimElementTree);

describe("Public USPTO antecedent slice", () => {
  it.layer(checker.pipe(Layer.provideMerge(Layer.mergeAll(BunFileSystem.layer, BunPath.layer))), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("preserves the recorded legacy slice while adding source-anchored relationships", () =>
      Effect.gen(function* () {
        const expectedClaims = yield* S.decodeEffect(patentClaimsJson)(yield* fixture("US20200109732A1.claims.json"));
        const expectedTree = yield* S.decodeEffect(claimElementTreeJson)(
          yield* fixture("US20200109732A1.claim1.expected.json")
        );
        const result = yield* ClaimSelfCheck.use((service) =>
          service.checkPublished(
            UsptoClaimSource.cases.publication.make({ publicationNumber: PatentNumber.make("20200109732") })
          )
        );
        // Preserve the immutable legacy file; only its old wrapper boundary is
        // projected to the corrected canonical preamble, never its source text.
        assert.deepStrictEqual(
          result.claimSet.claims,
          A.map(expectedClaims, (claim) => ({
            ...claim,
            preamble: Str.trim(Str.replace(/,?\s+further$/iu, "")(claim.preamble)),
          }))
        );
        assert.deepStrictEqual(result.report.undecomposed, []);
        // This immutable first-slice fixture predates functional/bare-mention support.
        // Keep its exact source spans, terms and edges as a subset, not current gold.
        // The independent 538-claim evaluator still uses unprojected strict equality.
        const actualTree = yield* Effect.fromOption(A.head(result.report.trees));
        for (const expected of expectedTree.elements) {
          const actual = yield* Effect.fromOption(
            A.findFirst(actualTree.elements, (element) => element.path === expected.path)
          );
          assert.deepStrictEqual(actual.anchor, expected.anchor);
          for (const term of expected.terms)
            assert.isTrue(
              A.some(
                actual.terms,
                (candidate) =>
                  candidate.head === term.head &&
                  candidate.determiner === term.determiner &&
                  candidate.anchor.startChar === term.anchor.startChar &&
                  candidate.anchor.endChar === term.anchor.endChar &&
                  candidate.anchor.quote === term.anchor.quote
              )
            );
        }
        for (const edge of expectedTree.edges)
          assert.isTrue(A.some(actualTree.edges, (candidate) => Equal.equals(candidate, edge)));
        assert.isTrue(A.some(actualTree.edges, (edge) => edge.kind === "functional"));
        assert.isTrue(
          A.some(
            result.report.findings,
            (finding) =>
              finding.kind === "pattern-not-covered" &&
              finding.rule === "unsupported-determiner" &&
              finding.referring.anchor.quote === "its forward part" &&
              finding.referring.anchor.startChar === 199 &&
              finding.referring.anchor.endChar === 215
          )
        );
        assert.isTrue(
          A.some(
            result.report.findings,
            (finding) =>
              finding.kind === "missing-antecedent" &&
              finding.referring.path === "1.a" &&
              finding.referring.anchor.quote === "the foot" &&
              finding.referring.anchor.startChar === 356 &&
              finding.referring.anchor.endChar === 364
          )
        );
      })
    );
  });
});

// This witness uses an existing pre-prediction reference, selected after the
// measurement solely to restore current full-tree vertical-slice evidence.
// It is not a new label, extra benchmark claim or held-out accuracy result.
const brushFixture = Effect.fnUntraced(function* (name: string) {
  const path = yield* Path.Path;
  const filename = yield* path.fromFileUrl(
    new URL(`../../domain/test/fixtures/claim-element/positive/12838228-root-1/${name}`, import.meta.url)
  );
  return yield* (yield* FileSystem.FileSystem).readFileString(filename);
});
const brushChecker = checkerFor(
  nativePublicationClient("12838228", "US20110074901A1", brushFixture("source.claims.xml"))
);
const referenceTreesJson = ClaimElementTree.pipe(S.Array, S.fromJsonString);
const canonicalClaimsJson = S.fromJsonString(
  S.Struct({ claims: S.Array(S.Struct({ claimNumber: S.Int, claimText: S.String })) })
);
const publicProvenanceJson = S.fromJsonString(
  S.Struct({
    officeActionDocumentIdentifiers: S.Array(S.String),
    officeActionMailDate: S.String,
    officeActionSection112Text: S.Array(S.String),
  })
);

describe("Current strict public claim slice", () => {
  it.layer(brushChecker.pipe(Layer.provideMerge(Layer.mergeAll(BunFileSystem.layer, BunPath.layer))), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("matches the frozen full claim9 tree and the examiner's exact brush-roller phrase", () =>
      Effect.gen(function* () {
        const expected = yield* S.decodeEffect(referenceTreesJson)(yield* brushFixture("expected.json"));
        const canonical = yield* S.decodeEffect(canonicalClaimsJson)(yield* brushFixture("claims.json"));
        const provenance = yield* S.decodeEffect(publicProvenanceJson)(yield* brushFixture("provenance.json"));
        assert.deepStrictEqual(provenance.officeActionDocumentIdentifiers, ["H2KCNOYDPXXIFW4"]);
        assert.strictEqual(provenance.officeActionMailDate, "2012-05-25");
        const action = A.join(provenance.officeActionSection112Text, " ");
        assertTrue(
          Str.includes("claims 6, 7, 8, 9, 10, 11-20 are rejected under 35 u.s.c. 112, second paragraph")(action)
        );
        assertTrue(Str.includes("claim 9, “the brush roller” lacks antecedent basis.")(action));
        const result = yield* ClaimSelfCheck.use((service) =>
          service.checkPublished(
            UsptoClaimSource.cases.publication.make({ publicationNumber: PatentNumber.make("20110074901") })
          )
        );
        const source = yield* Effect.fromOption(A.findFirst(canonical.claims, (claim) => claim.claimNumber === 9));
        const actual = yield* Effect.fromOption(
          A.findFirst(result.claimSet.claims, (claim) => claim.claimNumber === 9)
        );
        assert.strictEqual(actual.claimText, source.claimText);
        assert.deepStrictEqual(result.report.undecomposed, []);
        const scores = yield* compareStructuralFamily(expected, result.report.trees);
        const score = yield* Effect.fromOption(A.findFirst(scores, (value) => value.claimNumber === 9));
        assertTrue(score.strict);
        const finding = yield* Effect.fromOption(
          A.findFirst(
            result.report.findings,
            (value) =>
              value.kind === "missing-antecedent" &&
              value.referring.path === "9.a" &&
              value.referring.anchor.quote === "the brush roller"
          )
        );
        assert.strictEqual(finding.referring.anchor.startChar, 44);
        assert.strictEqual(finding.referring.anchor.endChar, 60);
        assert.strictEqual(finding.referring.anchor.quote, "the brush roller");
      })
    );
  });
});
