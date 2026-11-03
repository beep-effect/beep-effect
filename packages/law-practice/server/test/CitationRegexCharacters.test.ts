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

it.layer(Layer.merge(BunServices.layer, BunCrypto.layer))("frozen tokenizer regex facts", (it) => {
  it.effect("binds production classes to exact source observations and their maintainer producer", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const raw = yield* fs.readFileString(
        NodeURL.fileURLToPath(
          new URL("../../use-cases/test/fixtures/eyecite/regex-character-facts.json", import.meta.url)
        )
      );
      expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw))).toBe(
        "9dec7f6a29162fd6b479cf083546bf07655c23437a362f034d4ff72a1adb59c0"
      );
      const facts = yield* S.decodeEffect(Facts)(raw);
      expect(citationPythonRegexData).toEqual({ unicodeVersion: "14.0.0", ...facts.classBodies });
      const producer = yield* fs.readFile(
        NodeURL.fileURLToPath(
          new URL("../../../../goals/citation-extraction-engine/ops/probe-regex-characters.py", import.meta.url)
        )
      );
      expect(yield* S.decodeEffect(Sha256HexFromBytes)(producer)).toBe(facts.producerSha256);
      for (const [name, body] of R.toEntries(facts.classBodies)) {
        const observed = facts.observations[name];
        const intervals = facts.intervals[name];
        expect(Str.length(body)).toBe(observed.utf16Units);
        expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(body))).toBe(observed.sha256);
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
});
