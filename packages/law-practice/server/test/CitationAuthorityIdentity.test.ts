import { CitationAuthorityId } from "@beep/law-practice-domain/values";
import {
  CitationAuthorityIdentityInput,
  makeCitationAuthorityId,
} from "@beep/law-practice-server/_test/Citation/AuthorityIdentity";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import fixture from "../../use-cases/test/fixtures/eyecite/authority-identity-cases.json" with { type: "json" };

const Cases = S.Struct({
  schemaVersion: S.Literal("citation-authority-identity-cases/v1"),
  oracleCommit: S.Literal("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
  cases: S.Array(
    S.Struct({ name: S.NonEmptyString, expectedId: CitationAuthorityId, input: CitationAuthorityIdentityInput })
  ),
  equality: S.Boolean.pipe(S.Array, S.Array),
});
const inputs = S.decodeUnknownEffect(Cases)(fixture);

it.layer(BunCrypto.layer)("canonical authority identity", (it) => {
  it.effect("matches all 169 independently captured resource equality observations", () =>
    Effect.gen(function* () {
      const data = yield* inputs;
      const ids = yield* Effect.forEach(data.cases, (row) => makeCitationAuthorityId(row.input));
      expect(A.length(ids)).toBe(13);
      expect(ids).toEqual(A.map(data.cases, (row) => row.expectedId));
      expect(A.map(ids, (left) => A.map(ids, (right) => left === right))).toEqual(data.equality);
      expect(A.every(ids, S.is(CitationAuthorityId))).toBe(true);
      // Frozen CIT spellings stay distinct despite the same public reporter ID.
      const first = A.getUnsafe(data.cases, 6).input.citation;
      const second = A.getUnsafe(data.cases, 7).input.citation;
      if (first.type !== "case" || second.type !== "case") throw new Error("case fixture required");
      expect(A.getUnsafe(first.publication.editions, 0).reporterId).toBe(
        A.getUnsafe(second.publication.editions, 0).reporterId
      );
      expect(A.getUnsafe(ids, 6)).not.toBe(A.getUnsafe(ids, 7));
    })
  );

  it.effect("normalizes component insertion order and ignores ordinary occurrence IDs", () =>
    Effect.gen(function* () {
      const data = yield* inputs;
      const row = A.getUnsafe(data.cases, 0).input;
      const wire = yield* S.encodeEffect(CitationAuthorityIdentityInput)(row);
      const reordered = yield* S.decodeEffect(CitationAuthorityIdentityInput)({
        ...wire,
        mentionId: A.getUnsafe(data.cases, 1).input.mentionId,
        citation: { ...wire.citation, components: { page: "1", reporter: "U.S.", volume: "1" } },
      });
      expect(yield* makeCitationAuthorityId(reordered)).toBe(yield* makeCitationAuthorityId(row));
    })
  );

  it.effect("rejects missing or mismatched selected edition adapter data", () =>
    Effect.gen(function* () {
      const row = A.getUnsafe((yield* inputs).cases, 0).input;
      expect(O.isSome(row.selectedEdition)).toBe(true);
      const noLookup = yield* Effect.flip(makeCitationAuthorityId({ ...row, selectedEdition: O.none() }));
      expect(noLookup.reason).toBe("missing-edition");
      const other = A.getUnsafe((yield* inputs).cases, 6).input.selectedEdition;
      expect((yield* Effect.flip(makeCitationAuthorityId({ ...row, selectedEdition: other }))).reason).toBe(
        "missing-edition"
      );
    })
  );

  it.effect("preserves all law groups, absent/null distinctions and edition multiplicity", () =>
    Effect.gen(function* () {
      const row = A.getUnsafe((yield* inputs).cases, 8).input;
      const wire = yield* S.encodeEffect(CitationAuthorityIdentityInput)(row);
      if (wire.citation.type !== "law") throw new Error("law fixture required");
      const baseline = yield* makeCitationAuthorityId(row);
      const extra = yield* S.decodeEffect(CitationAuthorityIdentityInput)({
        ...wire,
        citation: { ...wire.citation, components: { ...wire.citation.components, extra: null } },
      });
      expect(yield* makeCitationAuthorityId(extra)).not.toBe(baseline);
      const duplicate = yield* S.decodeEffect(CitationAuthorityIdentityInput)({
        ...wire,
        citation: {
          ...wire.citation,
          publication: {
            ...wire.citation.publication,
            editions: A.appendAll(wire.citation.publication.editions, wire.citation.publication.editions),
          },
        },
      });
      expect(yield* makeCitationAuthorityId(duplicate)).not.toBe(baseline);
    })
  );

  it.effect("normalizes edition-bag order while retaining multiplicity", () =>
    Effect.gen(function* () {
      const row = A.getUnsafe((yield* inputs).cases, 8).input;
      const wire = yield* S.encodeEffect(CitationAuthorityIdentityInput)(row);
      if (wire.citation.type !== "law") throw new Error("law fixture required");
      const editions = A.append(wire.citation.publication.editions, Str.repeat(64)("0"));
      const forward = yield* S.decodeEffect(CitationAuthorityIdentityInput)({
        ...wire,
        citation: { ...wire.citation, publication: { ...wire.citation.publication, editions } },
      });
      const reverse = yield* S.decodeEffect(CitationAuthorityIdentityInput)({
        ...wire,
        citation: { ...wire.citation, publication: { ...wire.citation.publication, editions: A.reverse(editions) } },
      });
      expect(yield* makeCitationAuthorityId(forward)).toBe(yield* makeCitationAuthorityId(reverse));
    })
  );

  it.effect("drops sensitive digest causes", () =>
    Effect.gen(function* () {
      const row = A.getUnsafe((yield* inputs).cases, 0).input;
      const failure = yield* Effect.flip(
        makeCitationAuthorityId(row).pipe(
          Effect.provideService(
            Crypto.Crypto,
            Crypto.make({
              randomBytes: (size) => new Uint8Array(size),
              digest: () =>
                Effect.fail(
                  PlatformError.systemError({
                    module: "Crypto",
                    method: "digest",
                    _tag: "Unknown",
                    cause: "private-document-text",
                  })
                ),
            })
          )
        )
      );
      expect(failure.reason).toBe("digest-failed");
      expect("cause" in failure).toBe(false);
      expect(Str.includes("private-document-text")(String(failure))).toBe(false);
    })
  );
});
