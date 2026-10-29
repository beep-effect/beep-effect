import { $LawPracticeServerId } from "@beep/identity/packages";
import { Citation } from "@beep/law-practice-domain/values";
import { CitationAuthorityEdition } from "@beep/law-practice-server/_test/Citation/AuthorityIdentity";
import { makeCitationMention } from "@beep/law-practice-server/_test/Citation/Mention";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import {
  VerifySourceTextIdentityInput,
  VerifyTextAnchorAgainstVerifiedSourceInput,
  verifySourceTextIdentity,
  verifyTextAnchorAgainstVerifiedSource,
} from "@beep/provenance/VerifiedTextAnchor";
import { PosixPath, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $LawPracticeServerId.create("test/CitationResolve.fixtures");
/**
 * Test-only semantic context and independent source witness.
 * @internal
 * @category testing
 * @since 0.0.0
 */
export class CitationResolutionContext extends S.Opaque<CitationResolutionContext, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.NonEmptyString,
    text: S.String,
    editions: S.Array(CitationAuthorityEdition),
    mentions: S.Array(S.Struct({ citation: Citation, start: S.Natural, end: S.Natural, quote: S.NonEmptyString })),
    outcome: S.Union([
      S.Struct({ status: S.tag("value"), groups: S.Natural.pipe(S.Array, S.Array) }),
      S.Struct({ status: S.tag("error"), kind: S.NonEmptyString }),
    ]).pipe(S.toTaggedUnion("status")),
  }).pipe(
    $I.annoteSchema("CitationResolutionContext", {
      description:
        "Semantic resolution context; witness coordinates are constructed evidence and do not claim extraction parity.",
    })
  )
) {}
const artifact = Sha256Hex.make(Str.repeat(64)("a"));
/**
 * Materialize genuine source/anchor proofs around a supplied semantic context.
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const prepareCitationResolutionContext = Effect.fn("ResolveTest.prepare")(function* (
  row: CitationResolutionContext
) {
  const digest = SourceTextDigest.make(
    `sha256:${yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(row.text))}`
  );
  const source = SourceTextIdentity.make({
    scopeRef: "matter:resolve-fixture",
    sourceRef: row.name,
    locator: PosixPath.make("resolve/source.txt"),
    sourceDigest: digest,
    textDigest: digest,
    extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
    normalizationVersion: "1",
  });
  const verifiedSource = yield* verifySourceTextIdentity(
    VerifySourceTextIdentityInput.make({ source, expectedSource: source, sourceText: row.text })
  );
  const mentions = yield* Effect.forEach(row.mentions, (mention) =>
    Effect.gen(function* () {
      const anchor = yield* verifyTextAnchorAgainstVerifiedSource(
        VerifyTextAnchorAgainstVerifiedSourceInput.make({
          verifiedSource,
          anchor: TextAnchor.make({ startChar: mention.start, endChar: mention.end, quote: mention.quote }),
        })
      );
      return yield* makeCitationMention({
        citation: mention.citation,
        anchor,
        engineArtifact: artifact,
        components: [],
        footnote: O.none(),
        signal: O.none(),
        warnings: [],
        evidenceConfidence: O.none(),
      });
    })
  );
  const policy = yield* defaultCitationEnginePolicy;
  return { verifiedSource, mentions, editions: row.editions, engineArtifact: artifact, limits: policy.limits };
});
