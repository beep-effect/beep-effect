import {
  ownCitationConfiguration,
  ownedField,
  ownedItems,
  ownedStruct,
} from "@beep/law-practice-server/internal/Citation/ConfigurationOwnership";
import { CitationPythonUnicodeStorage } from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const Patterns = S.Struct({
  name: S.String,
  patterns: S.Array(CitationPythonUnicodeStorage),
});
const Wrapped = S.Struct({ pattern: CitationPythonUnicodeStorage });
const refused = () => "refused" as const;

it.effect("detaches caller buffers through the JSON codec at the boundary", () =>
  Effect.gen(function* () {
    const bytes = new Uint8Array([65, 66]);
    const raw = { name: "fixed", patterns: [{ width: 1, bytes }] };
    const owned = yield* ownCitationConfiguration(Patterns, raw, refused);
    expect(owned).toEqual(raw);
    const pattern = A.getUnsafe(ownedItems(ownedField(owned, "patterns")), 0);
    expect(pattern.bytes).not.toBe(bytes);
    bytes[0] = 90;
    expect(pattern.bytes[0]).toBe(65);
  })
);

it.effect("refuses configuration outside the schema with the caller's closed failure", () =>
  Effect.gen(function* () {
    const failure = yield* ownCitationConfiguration(Patterns, { name: 1, patterns: null }, refused).pipe(Effect.flip);
    expect(failure).toBe("refused");
  })
);

it.effect("projects and assembles owned values without another detach", () =>
  Effect.gen(function* () {
    const owned = yield* ownCitationConfiguration(
      Patterns,
      { name: "fixed", patterns: [{ width: 1, bytes: new Uint8Array([67]) }] },
      refused
    );
    const patterns = ownedField(owned, "patterns");
    expect(patterns).toBe(owned.patterns);
    const items = ownedItems(patterns);
    expect(A.length(items)).toBe(1);
    const first = A.getUnsafe(items, 0);
    const assembled = ownedStruct(Wrapped.make, { pattern: first });
    expect(assembled.pattern).toEqual(first);
  })
);
