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

const fixture = Effect.fnUntraced(function* (name: string) {
  const path = yield* Path.Path;
  const filename = yield* path.fromFileUrl(new URL(`./fixtures/claim-element/${name}`, import.meta.url));
  return yield* (yield* FileSystem.FileSystem).readFileString(filename);
});

// Replay only the public claims subtree and the metadata needed to locate it.
// No network, credentials, party names or complete file-wrapper records.
const nativeHttpClient = Layer.effect(
  HttpClient.HttpClient,
  Effect.gen(function* () {
    const xml = yield* fixture("US20200109732A1.claims.xml");
    return HttpClient.make((request) =>
      Effect.succeed(
        HttpClientResponse.fromWeb(
          request,
          Str.includes("/applications/search?")(request.url)
            ? new Response(`{
                "patentFileWrapperDataBag": [{
                  "applicationNumberText": "16287736",
                  "applicationMetaData": { "earliestPublicationNumber": "US20200109732A1" },
                  "pgpubDocumentMetaData": {
                    "productIdentifier": "APPXML", "xmlFileName": "16287736_20200109732.xml",
                    "fileLocationURI": "https://api.uspto.gov/native-publication.xml"
                  }
                }]
              }`)
            : new Response(xml)
        )
      )
    );
  })
);

const checker = ClaimSelfCheckLive.pipe(
  Layer.provide(UsptoClaimsLive),
  Layer.provide(Uspto.makeLayer(UsptoConfigInput.make({}))),
  Layer.provide(nativeHttpClient)
);

describe("Public USPTO antecedent slice", () => {
  it.layer(checker.pipe(Layer.provideMerge(Layer.mergeAll(BunFileSystem.layer, BunPath.layer))))((it) => {
    it.effect("preserves the recorded legacy slice while adding source-anchored relationships", () =>
      Effect.gen(function* () {
        const expectedClaims = yield* S.decodeEffect(S.fromJsonString(PatentClaims))(
          yield* fixture("US20200109732A1.claims.json")
        );
        const expectedTree = yield* S.decodeEffect(S.fromJsonString(ClaimElementTree))(
          yield* fixture("US20200109732A1.claim1.expected.json")
        );
        const result = yield* ClaimSelfCheck.use((service) =>
          service.checkPublished(
            UsptoClaimSource.cases.publication.make({ publicationNumber: PatentNumber.make("20200109732") })
          )
        );
        assert.deepStrictEqual(result.claimSet.claims, expectedClaims);
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
