import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { citationPythonRegexData } from "@beep/law-practice-server/internal/Citation/PythonRegexData";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $LawPracticeServerId.create("test/CitationRegexCharacters");
const Counts = S.Struct({ points: S.Natural, ranges: S.Natural, utf16Units: S.Natural, sha256: Sha256Hex }).pipe(
  $I.annoteSchema("Counts", {
    description: "Independent counts and class-body digest from exhaustive pinned CPython observations.",
  })
);
const Intervals = S.Array(S.Tuple([S.Natural, S.Natural])).pipe(
  $I.annoteSchema("Intervals", { description: "Ordered maximal intervals of observed code-point membership." })
);
const Facts = S.fromJsonString(
  S.Struct({
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    pythonVersion: S.tag("3.11.15"),
    unicodeVersion: S.tag("14.0.0"),
    producerSha256: Sha256Hex,
    classBodies: S.Struct({ digitClass: S.String, spaceClass: S.String, wordClass: S.String }),
    observations: S.Struct({ digitClass: Counts, spaceClass: Counts, wordClass: Counts }),
    intervals: S.Struct({ digitClass: Intervals, spaceClass: Intervals, wordClass: Intervals }),
    asciiIgnoreCasePoints: S.Array(S.Natural),
    cases: S.Array(S.Json),
  })
).pipe(
  $I.annoteSchema("Facts", {
    description:
      "Authenticated scalar class facts and controlled captures; not a complete regex-family acceptance receipt.",
  })
);

const ProgramFacts = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-regex-program-facts/v1"),
    scope: S.tag("Complete parsed feature inventory; not target matching or family safety proof."),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    pythonVersion: S.tag("3.11.15"),
    unicodeVersion: S.tag("14.0.0"),
    producerSha256: Sha256Hex,
    sourceReaderSha256: Sha256Hex,
    sources: S.Struct({
      operationsSha256: S.tag("ae441000ddc90537864e3fdd4a9dfc4aa81af37a65818b48ce9bf37d95d1eeb1"),
      inventorySha256: S.tag("b0e75c4cd10ee153aeafe4f1b40750415c7f32ca0fabaaadc740b9f69f35fa83"),
    }),
    instances: S.tag(13610),
    maximumCaptureGroups: S.tag(10),
    flags: S.Struct({ "0": S.tag(13602), "2": S.tag(8) }),
    instanceFeatureVectorSha256: S.tag("82a584bde4d3e8e991d3bbda59f1842aa2639b5d7183e213cc006a0ce1866df8"),
    minimumWidthCounts: S.Record(S.String, S.Natural),
    zeroWidthInstances: S.tag(0),
    instancesWithRepeatedCaptures: S.tag(0),
    instancesWithNullableMultiRepeats: S.tag(0),
    instanceProfileVectorSha256: S.tag("4f46f82500b6096d244ceac0c266e1ee67327a45f707c5ed1a181045fde7f1ab"),
    instanceDescriptorVectorSha256: S.tag("f5546c424b56c59dd5702409ecf2b66b9092086391b6da804423ccc3c1bfc21a"),
    features: S.Record(S.String, S.Natural),
  })
).pipe(
  $I.annoteSchema("ProgramFacts", {
    description: "Authenticated complete source parse domain without claiming target semantics.",
  })
);

it.layer(Layer.merge(BunServices.layer, BunCrypto.layer))("frozen tokenizer regex facts", (it) => {
  it.effect("binds production classes to exact source observations and their maintainer producer", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const raw = yield* fs.readFileString(
        NodeURL.fileURLToPath(
          new URL("../../use-cases/test/fixtures/eyecite/regex-character-facts.json", import.meta.url)
        )
      );
      const citationResult1 = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw));
      expect(citationResult1).toBe("9dec7f6a29162fd6b479cf083546bf07655c23437a362f034d4ff72a1adb59c0");
      const facts = yield* S.decodeEffect(Facts)(raw);
      expect(citationPythonRegexData).toEqual({ unicodeVersion: "14.0.0", ...facts.classBodies });
      const producer = yield* fs.readFile(
        NodeURL.fileURLToPath(
          new URL("../../../../goals/citation-extraction-engine/ops/probe-regex-characters.py", import.meta.url)
        )
      );
      const citationResult2 = yield* S.decodeEffect(Sha256HexFromBytes)(producer);
      expect(citationResult2).toBe(facts.producerSha256);
      for (const [name, body] of R.toEntries(facts.classBodies)) {
        const observed = facts.observations[name];
        const intervals = facts.intervals[name];
        expect(Str.length(body)).toBe(observed.utf16Units);
        const citationResult3 = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(body));
        expect(citationResult3).toBe(observed.sha256);
        expect(intervals).toHaveLength(observed.ranges);
        expect(A.reduce(intervals, 0, (total, [start, end]) => total + end - start + 1)).toBe(observed.points);
        let prior = -2;
        for (const [start, end] of intervals) {
          expect(start).toBeGreaterThan(prior + 1);
          expect(end).toBeGreaterThanOrEqual(start);
          expect(end).toBeLessThan(0x110000);
          prior = end;
        }
      }
      expect(facts.asciiIgnoreCasePoints).toHaveLength(56);
      expect(facts.cases).toHaveLength(28);
    })
  );
  it.effect("binds the complete source parse domain and its independent producer", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const facts = yield* fs
        .readFileString(
          NodeURL.fileURLToPath(
            new URL("../../use-cases/test/fixtures/eyecite/regex-program-facts.json", import.meta.url)
          )
        )
        .pipe(Effect.flatMap(S.decodeEffect(ProgramFacts)));
      expect(A.reduce(R.values(facts.minimumWidthCounts), 0, (sum, count) => sum + count)).toBe(13610);
      expect(facts.minimumWidthCounts["0"]).toBeUndefined();
      expect(facts.features).toEqual({
        ANY: 96,
        AT: 27208,
        "AT/AT_BEGINNING": 13604,
        "AT/AT_END": 13604,
        BRANCH: 97352,
        "CATEGORY/CATEGORY_DIGIT": 31146,
        "CATEGORY/CATEGORY_NOT_SPACE": 4,
        "CATEGORY/CATEGORY_SPACE": 6746,
        "CATEGORY/CATEGORY_WORD": 12,
        IN: 92721,
        "IN/CATEGORY": 37908,
        "IN/LITERAL": 55808,
        "IN/NEGATE": 27204,
        "IN/RANGE": 82628,
        LITERAL: 689857,
        MAX_REPEAT: 183648,
        SUBPATTERN: 67814,
        "SUBPATTERN/flags/0/0": 67814,
      });
      for (const [file, digest] of [
        ["probe-regex-program.py", facts.producerSha256],
        ["probe-regex-compatibility.py", facts.sourceReaderSha256],
      ]) {
        const bytes = yield* fs.readFile(
          NodeURL.fileURLToPath(new URL(`../../../../goals/citation-extraction-engine/ops/${file}`, import.meta.url))
        );
        const citationResult4 = yield* S.decodeEffect(Sha256HexFromBytes)(bytes);
        expect(citationResult4).toBe(digest);
      }
    })
  );
});
