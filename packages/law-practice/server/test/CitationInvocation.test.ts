import {
  CitationInvocation,
  reserveCitationInvocationText,
} from "@beep/law-practice-server/internal/Citation/Invocation";
import {
  citationUnaccountedText,
  makeCitationRegexInput,
} from "@beep/law-practice-server/internal/Citation/RegexInput";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import { withCitationTestInvocation } from "./CitationInvocation.fixtures.ts";

it.effect("binds one installed source preparer to a fresh ledger on every invocation", () =>
  Effect.gen(function* () {
    const { limits } = yield* defaultCitationEnginePolicy;
    const input = yield* makeCitationRegexInput(limits, reserveCitationInvocationText);
    const prepare = Effect.gen(function* () {
      const invocation = yield* CitationInvocation;
      const prepared = yield* input.prepareText("abc", () => Effect.void);
      const used = yield* invocation.budget.snapshot;
      return { text: prepared.value.text, used };
    });
    const first = yield* withCitationTestInvocation(prepare, limits);
    const second = yield* withCitationTestInvocation(prepare, limits);
    expect(first).toEqual({ text: "abc", used: 3 });
    expect(second).toEqual({ text: "abc", used: 3 });
  })
);

it.effect("runs worker-local preparation without invocation authority", () =>
  Effect.gen(function* () {
    const { limits } = yield* defaultCitationEnginePolicy;
    const input = yield* makeCitationRegexInput(limits, citationUnaccountedText);
    const preparation = input.prepareText("abc", () => Effect.void);
    const closed: Effect.Effect<Effect.Success<typeof preparation>, Effect.Error<typeof preparation>> = preparation;
    expect((yield* closed).value.text).toBe("abc");
  })
);

it.effect("keeps preflight, reservation and native grant ordered while patterns remain uncharged", () =>
  Effect.gen(function* () {
    const { limits } = yield* defaultCitationEnginePolicy;
    const events = yield* Ref.make(A.empty<string>());
    const record = (name: string) => Ref.update(events, A.append(name));
    const source = yield* makeCitationRegexInput(limits, () => record("reserve"));
    const pattern = yield* makeCitationRegexInput(limits, () => record("pattern-reserve"), "pattern");
    const word = { width: 1, bytes: new Uint8Array([65]) };
    yield* source.prepareUnicode(word, () => record("preflight"), record("grant"));
    yield* pattern.prepareUnicode(word, () => Effect.void);
    const recorded = yield* Ref.get(events);
    expect(recorded).toEqual(["preflight", "reserve", "grant"]);
  })
);
