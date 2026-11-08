import * as NodeURL from "node:url";
import { EyeciteRecognizeInput } from "@beep/eyecite";
import { recognizeEyecite } from "@beep/eyecite/recognize";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import { expect, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as SchemaBinary from "effect/encoding/SchemaBinary";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";

const Profile = S.fromJsonString(
  S.Struct({
    cases: S.Array(
      S.Struct({
        id: S.String,
        text: S.String,
        expected: S.Array(S.Struct({ form: S.String })),
      })
    ),
  })
);
const forms = {
  case: "full-case",
  shortFormCase: "short-case",
  id: "id",
  supra: "supra",
  statute: "usc",
  regulation: "cfr",
};
layer(NodeFileSystem.layer)("pinned raw recognition", (it) => {
  it.effect("recognizes the frozen finite profile without donor pointers or confidence", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const raw = yield* fs.readFileString(
        NodeURL.fileURLToPath(
          new URL(
            "../../../../goals/citation-extraction-engine/history/evidence/2026-11-08-six-form-selection/profile.frozen.json.txt",
            import.meta.url
          )
        )
      );
      const profile = yield* S.decodeEffect(Profile)(raw);
      expect(profile.cases).toHaveLength(29);
      let occurrences = 0;
      for (const row of profile.cases) {
        const output = yield* recognizeEyecite({ source: row.text, sourceUtf16: 100_000, candidates: 100 });
        expect(
          A.map(output.tokens, (token) => forms[token.type]),
          row.id
        ).toEqual(A.map(row.expected, (token) => token.form));
        for (const token of output.tokens) {
          expect("confidence" in token).toBe(false);
          expect("id" in token).toBe(false);
          expect("resolution" in token).toBe(false);
        }
        occurrences += A.length(output.tokens);
      }
      expect(occurrences).toBe(33);
    })
  );
  it.effect("refuses source and complete candidate overflows without returning a partial list", () =>
    Effect.gen(function* () {
      const sourceFailure = yield* recognizeEyecite({ source: "35 U.S.C. 101", sourceUtf16: 1, candidates: 10 }).pipe(
        Effect.flip
      );
      expect(sourceFailure.reason).toBe("source-limit");
      const candidateFailure = yield* recognizeEyecite({
        source: "35 U.S.C. 101; 35 U.S.C. 102",
        sourceUtf16: 100,
        candidates: 1,
      }).pipe(Effect.flip);
      expect(candidateFailure.reason).toBe("candidate-limit");
      const malformed = yield* recognizeEyecite(null).pipe(Effect.flip);
      expect(malformed.reason).toBe("invalid-input");
      const empty = yield* recognizeEyecite({ source: "", sourceUtf16: 0, candidates: 0 });
      expect(empty.tokens).toEqual([]);
    })
  );
  it.effect("preserves an absent case page without refusing other citations", () =>
    Effect.gen(function* () {
      const output = yield* recognizeEyecite({
        source: "Foo v. Bar, 123 U.S. ___ (2020). 35 U.S.C. 101.",
        sourceUtf16: 100,
        candidates: 10,
      });
      expect(output.tokens).toHaveLength(2);
      const first = A.getUnsafe(output.tokens, 0);
      expect(first.type).toBe("case");
      if (first.type === "case") expect(first.page).toBeNull();
      expect(A.getUnsafe(output.tokens, 1).type).toBe("statute");
    })
  );
  it.effect("uses provided codecs to preserve isolated UTF-16 surrogates on the wire", () =>
    Effect.gen(function* () {
      const input = yield* S.decodeUnknownEffect(S.toType(EyeciteRecognizeInput))({
        source: "😀e\u0301\ud800x\udc00",
        sourceUtf16: 100,
        candidates: 10,
      });
      const codec = SchemaBinary.toCodec(EyeciteRecognizeInput, { fingerprint: true });
      const bytes = yield* S.encodeEffect(codec)(input);
      const decoded = yield* S.decodeEffect(codec)(bytes);
      expect(decoded.source).toBe(input.source);
    })
  );
});
