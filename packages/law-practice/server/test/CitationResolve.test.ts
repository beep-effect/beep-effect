import * as NodeURL from "node:url";
import { Citation, CitationMention, citationAuthorityMentionIds } from "@beep/law-practice-domain/values";
import { resolveCitationMentions } from "@beep/law-practice-server/internal/Citation/Resolve";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { makeTestCitationDigest } from "./CitationDigest.fixtures.ts";
import { CitationResolutionContext, prepareCitationResolutionContext as prepare } from "./CitationResolve.fixtures.ts";
import { loadResolutionOperationContexts } from "./CitationResolve.operations.ts";

const Cases = S.Struct({
  schemaVersion: S.tag("citation-default-resolution-cases/v1"),
  oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
  cases: S.Array(CitationResolutionContext),
});
const CasesJson = S.fromJsonString(Cases);

const cases = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(
    NodeURL.fileURLToPath(
      new URL("../../use-cases/test/fixtures/eyecite/default-resolution-cases.json", import.meta.url)
    )
  );
  return yield* S.decodeEffect(CasesJson)(text);
});

it.layer(Layer.mergeAll(BunCrypto.layer, BunFileSystem.layer))("canonical default resolution", (it) => {
  it.effect("enforces candidate and Id edge ceilings after earlier full decisions", () =>
    Effect.gen(function* () {
      const data = yield* cases;
      const controls: ReadonlyArray<readonly [string, number, number]> = [
        ["short-ambiguous", 3, 4],
        ["repeat-and-id", 2, 3],
      ];
      for (const [name, denied, accepted] of controls) {
        const row = yield* Effect.fromOption(A.findFirst(data.cases, (candidate) => candidate.name === name));
        const input = yield* prepare(row);
        const failure = yield* resolveCitationMentions({
          ...input,
          limits: { ...input.limits, resolutionEdges: denied },
        }).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "CitationResolveFailure", reason: "limit-exceeded" });
        const complete = yield* resolveCitationMentions({
          ...input,
          limits: { ...input.limits, resolutionEdges: accepted },
        });
        expect(complete.resolutions).toHaveLength(input.mentions.length);
      }
    })
  );
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
            A.map(citationAuthorityMentionIds(document, authority.id), (id) =>
              O.getOrElse(HashMap.get(indices, id), () => -1)
            )
          );
          expect(groups, row.name).toEqual(row.outcome.groups);
        }
      }
    })
  );

  it.effect(
    "matches all 30 existing default operation observations without dropping a source site",
    () =>
      Effect.gen(function* () {
        const data = yield* loadResolutionOperationContexts;
        expect(data.corpusSha256).toBe("ae441000ddc90537864e3fdd4a9dfc4aa81af37a65818b48ce9bf37d95d1eeb1");
        expect(A.length(data.contexts)).toBe(30);
        expect(
          A.length(
            A.dedupe(A.flatMap(data.contexts, (row) => A.map(row.context.mentions, (mention) => mention.citation.type)))
          )
        ).toBe(8);
        expect(A.length(data.sourceSiteIds)).toBe(2);
        expect(A.length(A.dedupe(A.map(data.contexts, (row) => row.context.name)))).toBe(30);
        expect(A.reduce(data.contexts, 0, (total, row) => total + A.length(row.context.mentions))).toBe(94);
        for (const row of data.contexts) {
          const citationResult1 = yield* prepare(row.context);
          const document = yield* resolveCitationMentions(citationResult1);
          const indices = HashMap.fromIterable(
            A.map(document.mentions, (mention, index) => Tuple.make(mention.id, index))
          );
          const groups = A.map(document.authorities, (authority) =>
            A.map(citationAuthorityMentionIds(document, authority.id), (id) =>
              O.getOrElse(HashMap.get(indices, id), () => -1)
            )
          );
          if (row.context.outcome.status !== "value") return yield* Effect.die("Expected operation groups");
          expect(groups, row.context.name).toEqual(row.context.outcome.groups);
        }
      }),
    { timeout: 30_000 }
  );

  it.effect("retains ambiguity as data and resets the next Id. after an ambiguous result", () =>
    Effect.gen(function* () {
      const citationResult2 = yield* cases;
      const row = A.findFirst(citationResult2.cases, (row) => row.name === "short-multiple-resets-id");
      const citationResult3 = yield* Effect.fromOption(row);
      const citationResult4 = yield* prepare(citationResult3);
      const document = yield* resolveCitationMentions(citationResult4);
      expect(A.getUnsafe(document.resolutions, 2).status).toBe("Ambiguous");
      const last = A.getUnsafe(document.resolutions, 3);
      expect(last.status).toBe("Unresolved");
      if (last.status === "Unresolved") expect(last.reason).toBe("no-previous-authority");
    })
  );

  it.effect("snapshots semantic and adapter data before the first asynchronous identity check", () =>
    Effect.gen(function* () {
      const citationResult5 = yield* cases;
      const input = yield* prepare(A.getUnsafe(citationResult5.cases, 0));
      const crypto = yield* Digest.Digest;
      let hashes = 0;
      const document = yield* resolveCitationMentions(input).pipe(
        Effect.provideService(
          Digest.Digest,
          makeTestCitationDigest((algorithm, bytes) =>
            Effect.suspend(() => {
              hashes += 1;
              if (hashes === 1) Reflect.set(A.getUnsafe(input.mentions, 0).citation, "type", "unknown");
              return crypto.digest(algorithm, bytes);
            })
          )
        )
      );
      expect(A.getUnsafe(document.mentions, 0).citation.type).toBe("case");
      expect(A.length(document.authorities)).toBe(1);
    })
  );

  it.effect("enforces explicit source, mention, authority, edge and iteration counts", () =>
    Effect.gen(function* () {
      const citationResult6 = yield* cases;
      const input = yield* prepare(A.getUnsafe(citationResult6.cases, 1));
      for (const limits of [
        { ...input.limits, sourceUtf16: 1 },
        { ...input.limits, mentions: 1 },
        { ...input.limits, authorities: 1 },
        { ...input.limits, resolutionEdges: 1 },
        { ...input.limits, resolutionIterations: 1 },
      ]) {
        const citationResult7 = yield* Effect.flip(resolveCitationMentions({ ...input, limits }));
        expect(citationResult7.reason).toBe("limit-exceeded");
      }
    })
  );

  it.effect("accepts exact count ceilings without rejecting the final permitted unit", () =>
    Effect.gen(function* () {
      const citationResult8 = yield* cases;
      const input = yield* prepare(A.getUnsafe(citationResult8.cases, 0));
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
      const citationResult9 = yield* cases;
      const row = yield* Effect.fromOption(
        A.findFirst(citationResult9.cases, (row) => row.name === "reference-court-metadata")
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
      expect(A.length(citationAuthorityMentionIds(document, A.getUnsafe(document.authorities, 0).id))).toBe(2);
    })
  );

  it.effect("rejects missing or duplicate frozen edition descriptors", () =>
    Effect.gen(function* () {
      const citationResult10 = yield* cases;
      const input = yield* prepare(A.getUnsafe(citationResult10.cases, 0));
      const citationResult11 = yield* Effect.flip(resolveCitationMentions({ ...input, editions: [] }));
      expect(citationResult11.reason).toBe("edition-missing");
      const citationResult12 = yield* Effect.flip(
        resolveCitationMentions({ ...input, editions: A.appendAll(input.editions, input.editions) })
      );
      expect(citationResult12.reason).toBe("invalid-input");
    })
  );

  it.effect("rejects stale occurrence identities and unverified source substitutes", () =>
    Effect.gen(function* () {
      const citationResult13 = yield* cases;
      const input = yield* prepare(A.getUnsafe(citationResult13.cases, 0));
      const citationResult14 = yield* Effect.flip(
        resolveCitationMentions({
          ...input,
          verifiedSource: { source: input.verifiedSource.source, sourceText: input.verifiedSource.sourceText },
        })
      );
      expect(citationResult14.reason).toBe("invalid-input");
      const first = A.getUnsafe(input.mentions, 0);
      Reflect.set(first, "id", `cm1:${Str.repeat(64)("f")}`);
      const citationResult15 = yield* Effect.flip(resolveCitationMentions(input));
      expect(citationResult15.reason).toBe("evidence-failed");
    })
  );
});
