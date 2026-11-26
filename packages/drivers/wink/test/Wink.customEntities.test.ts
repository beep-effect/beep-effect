import { entity, literal, make, pos, withMark } from "@beep/nlp-processing/Core/PatternBuilders";
import { it } from "@beep/test-runner";
import { WinkEngineCustomEntities } from "@beep/wink/Wink.models";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Chunk from "effect/Chunk";
import * as S from "effect/Schema";

const company = withMark(make("company", [literal("Acme", "Initech"), literal("Inc.")]), [
  S.Natural.make(0),
  S.Natural.make(1),
]);
const dated = make("dated", [entity("DATE"), pos("VERB")]);
const empty = make("empty", []);

describe("WinkEngineCustomEntities", () => {
  it("renders each pattern element as one bracket string and skips an empty pattern", () => {
    const group = WinkEngineCustomEntities.fromPatterns("organizations", Chunk.make(company, dated, empty));
    expect(group.size()).toBe(2);
    expect(group.isEmpty()).toBe(false);
    expect(A.map(group.toArray(), (example) => example.patterns)).toEqual([
      ["[Acme|Initech]", "[Inc.]"],
      ["[DATE]", "[VERB]"],
    ]);
    expect(group.toWinkFormat()).toEqual([
      { mark: [0, 1], name: "organizations", patterns: ["[Acme|Initech] [Inc.]"] },
      { name: "organizations", patterns: ["[DATE] [VERB]"] },
    ]);
  });

  it("merges two groups by example content under the new name", () => {
    const first = WinkEngineCustomEntities.fromPatterns("first")([company]);
    const second = WinkEngineCustomEntities.fromPatterns("first", [company, dated]);
    const merged = first.merge(second, "both");
    expect(merged.name).toBe("both");
    expect(merged.size()).toBe(2);
    expect(first.merge(second).name).toBe("first");
    expect(WinkEngineCustomEntities.fromPatterns("none", [empty]).isEmpty()).toBe(true);
  });
});
