import { fileURLToPath } from "node:url";
import { Citation, CitationMention, citationAuthorityMembers } from "@beep/law-practice-domain/values";
import { CitationAuthorityEdition } from "@beep/law-practice-server/_test/Citation/AuthorityIdentity";
import { makeCitationMention } from "@beep/law-practice-server/_test/Citation/Mention";
import { resolveCitationMentions } from "@beep/law-practice-server/_test/Citation/Resolve";
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
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";

const Row = S.Struct({
  name: S.NonEmptyString,
  text: S.String,
  editions: S.Array(CitationAuthorityEdition),
  mentions: S.Array(S.Struct({ citation: Citation, start: S.Natural, end: S.Natural, quote: S.NonEmptyString })),
  outcome: S.Union([
    S.Struct({ status: S.tag("value"), groups: S.Natural.pipe(S.Array, S.Array) }),
    S.Struct({ status: S.tag("error"), kind: S.NonEmptyString }),
  ]).pipe(S.toTaggedUnion("status")),
});
const Cases = S.Struct({
  schemaVersion: S.Literal("citation-default-resolution-cases/v1"),
  oracleCommit: S.Literal("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
  cases: S.Array(Row),
});
const cases = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(
    fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/default-resolution-cases.json", import.meta.url))
  );
  return yield* S.decodeEffect(S.fromJsonString(Cases))(text);
});
const artifact = Sha256Hex.make(Str.repeat(64)("a"));
const prepare = Effect.fn("ResolveTest.prepare")(function* (row: typeof Row.Type) {
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

it.layer(Layer.mergeAll(BunCrypto.layer, BunFileSystem.layer))("canonical default resolution", (it) => {
  it.effect("matches all captured extracted and synthetic semantic resource groups", () =>
    Effect.gen(function* () {
      const data = yield* cases;
      expect(A.length(data.cases)).toBe(46);
      for (const row of data.cases) {
        const input = yield* prepare(row);
        if (row.outcome.status === "error") {
          const failure = yield* Effect.flip(resolveCitationMentions(input));
          expect(["invalid-input", "identity-failed", "text-failed"]).toContain(failure.reason);
          expect("cause" in failure).toBe(false);
        } else {
          const document = yield* resolveCitationMentions(input);
          const indices = HashMap.fromIterable(
            A.map(document.mentions, (mention, index) => Tuple.make(mention.id, index))
          );
          const groups = A.map(document.authorities, (authority) =>
            A.map(citationAuthorityMembers(document, authority.id), (id) =>
              O.getOrElse(HashMap.get(indices, id), () => -1)
            )
          );
          expect(groups, row.name).toEqual(row.outcome.groups);
        }
      }
    })
  );

  it.effect("retains ambiguity as data and resets the next Id. after an ambiguous result", () =>
    Effect.gen(function* () {
      const row = A.findFirst((yield* cases).cases, (row) => row.name === "short-multiple-resets-id");
      const document = yield* resolveCitationMentions(yield* prepare(yield* Effect.fromOption(row)));
      expect(A.getUnsafe(document.resolutions, 2).status).toBe("Ambiguous");
      const last = A.getUnsafe(document.resolutions, 3);
      expect(last.status).toBe("Unresolved");
      if (last.status === "Unresolved") expect(last.reason).toBe("no-previous-authority");
    })
  );

  it.effect("snapshots semantic and adapter data before the first asynchronous identity check", () =>
    Effect.gen(function* () {
      const input = yield* prepare(A.getUnsafe((yield* cases).cases, 0));
      const crypto = yield* Crypto.Crypto;
      let hashes = 0;
      const document = yield* resolveCitationMentions(input).pipe(
        Effect.provideService(
          Crypto.Crypto,
          Crypto.make({
            randomBytes: (size) => new Uint8Array(size),
            digest: (algorithm, bytes) =>
              Effect.suspend(() => {
                hashes += 1;
                if (hashes === 1) Reflect.set(A.getUnsafe(input.mentions, 0).citation, "type", "unknown");
                return crypto.digest(algorithm, bytes);
              }),
          })
        )
      );
      expect(A.getUnsafe(document.mentions, 0).citation.type).toBe("case");
      expect(A.length(document.authorities)).toBe(1);
    })
  );

  it.effect("enforces explicit source, mention, authority, edge and iteration counts", () =>
    Effect.gen(function* () {
      const input = yield* prepare(A.getUnsafe((yield* cases).cases, 1));
      for (const limits of [
        { ...input.limits, sourceUtf16: 1 },
        { ...input.limits, mentions: 1 },
        { ...input.limits, authorities: 1 },
        { ...input.limits, resolutionEdges: 1 },
        { ...input.limits, resolutionIterations: 1 },
      ]) {
        expect((yield* Effect.flip(resolveCitationMentions({ ...input, limits }))).reason).toBe("limit-exceeded");
      }
    })
  );

  it.effect("accepts exact count ceilings without rejecting the final permitted unit", () =>
    Effect.gen(function* () {
      const input = yield* prepare(A.getUnsafe((yield* cases).cases, 0));
      const limits = {
        ...input.limits,
        sourceUtf16: Str.length(input.verifiedSource.sourceText),
        mentions: A.length(input.mentions),
        authorities: 1,
        resolutionEdges: A.length(input.mentions),
        resolutionIterations: A.length(input.mentions),
      };
      const document = yield* resolveCitationMentions({ ...input, limits });
      expect(A.length(document.authorities)).toBe(1);
      expect(A.length(document.resolutions)).toBe(A.length(input.mentions));
    })
  );

  it.effect("matches a versioned known court identifier as canonical court metadata", () =>
    Effect.gen(function* () {
      const row = yield* Effect.fromOption(
        A.findFirst((yield* cases).cases, (row) => row.name === "reference-court-metadata")
      );
      const input = yield* prepare(row);
      const first = A.getUnsafe(input.mentions, 0);
      const wire = yield* S.encodeEffect(Citation)(first.citation);
      if (wire.type !== "case") return yield* Effect.die("Expected case fixture");
      const citation = yield* S.decodeEffect(Citation.cases.case)({
        ...wire,
        metadata: {
          ...wire.metadata,
          court: { status: "known", id: "scotus", vocabularyVersion: wire.publication.vocabularyVersion },
        },
      });
      const mentions = A.map(input.mentions, (mention) =>
        mention.id === first.id ? CitationMention.make({ ...mention, citation }) : mention
      );
      const document = yield* resolveCitationMentions({ ...input, mentions });
      expect(A.length(citationAuthorityMembers(document, A.getUnsafe(document.authorities, 0).id))).toBe(2);
    })
  );

  it.effect("rejects missing or duplicate frozen edition descriptors", () =>
    Effect.gen(function* () {
      const input = yield* prepare(A.getUnsafe((yield* cases).cases, 0));
      expect((yield* Effect.flip(resolveCitationMentions({ ...input, editions: [] }))).reason).toBe("edition-missing");
      expect(
        (yield* Effect.flip(
          resolveCitationMentions({ ...input, editions: A.appendAll(input.editions, input.editions) })
        )).reason
      ).toBe("invalid-input");
    })
  );

  it.effect("rejects stale occurrence identities and unverified source substitutes", () =>
    Effect.gen(function* () {
      const input = yield* prepare(A.getUnsafe((yield* cases).cases, 0));
      expect(
        (yield* Effect.flip(
          resolveCitationMentions({
            ...input,
            verifiedSource: { source: input.verifiedSource.source, sourceText: input.verifiedSource.sourceText },
          })
        )).reason
      ).toBe("invalid-input");
      const first = A.getUnsafe(input.mentions, 0);
      Reflect.set(first, "id", `cm1:${Str.repeat(64)("f")}`);
      expect((yield* Effect.flip(resolveCitationMentions(input))).reason).toBe("evidence-failed");
    })
  );
});
