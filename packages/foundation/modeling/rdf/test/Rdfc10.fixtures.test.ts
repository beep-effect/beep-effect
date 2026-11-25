import { CanonicalizationLimitExceeded, CanonicalWorkBound, canonicalize } from "@beep/rdf/Canonical";
import { makeDataset } from "@beep/rdf/Rdf";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import { parseNQuads } from "./support/NQuads.ts";

const fixtures: Readonly<Record<string, string>> = import.meta.glob<string>("./fixtures/rdfc10/*.nq", {
  eager: true,
  import: "default",
  query: "?raw",
});

const fixture = (name: string): O.Option<string> => R.get(fixtures, `./fixtures/rdfc10/${name}`);

const testIds = A.sort(
  A.filterMap(R.keys(fixtures), (path) => {
    const match = /test(\d{3})-in\.nq$/u.exec(path);
    return match?.[1] === undefined ? Result.failVoid : Result.succeed(match[1]);
  }),
  Str.Order
);

const canonicalizeText = (text: string) => canonicalize(makeDataset(parseNQuads(text)));

it.layer(Digest.layerWebCrypto, { timeout: "60 seconds" })("RDFC-1.0 W3C fixtures", (it) => {
  it.effect("vendors a subset with expected outputs and one negative test", () =>
    Effect.sync(() => {
      expect(testIds.length).toBe(24);
      expect(A.filter(testIds, (id) => O.isNone(fixture(`test${id}-rdfc10.nq`)))).toStrictEqual(["074"]);
    })
  );

  it.effect("relates blank nodes through a blank graph name", () =>
    Effect.gen(function* () {
      const form = yield* canonicalizeText(
        A.join(
          [
            "_:a <https://example.test/p> <https://example.test/o> _:g1 .",
            "_:b <https://example.test/p> <https://example.test/o> _:g2 .",
          ],
          "\n"
        )
      );
      expect(form.nquads).toBe(
        A.join(
          [
            "_:c14n0 <https://example.test/p> <https://example.test/o> _:c14n1 .",
            "_:c14n2 <https://example.test/p> <https://example.test/o> _:c14n3 .",
            "",
          ],
          "\n"
        )
      );
    })
  );

  it.effect("labels K4 in order, permuting three related nodes", () =>
    Effect.gen(function* () {
      const labels = ["x0", "x1", "x2", "x3"];
      const edges = A.flatMap(labels, (from) =>
        A.map(
          A.filter(labels, (to) => to !== from),
          (to) => `_:${from} <https://example.test/p> _:${to} .`
        )
      );
      const form = yield* canonicalizeText(A.join(edges, "\n"));
      const canonical = A.flatMap(A.range(0, 3), (from) =>
        A.map(
          A.filter(A.range(0, 3), (to) => to !== from),
          (to) => `_:c14n${from} <https://example.test/p> _:c14n${to} .\n`
        )
      );
      expect(form.nquads).toBe(A.join(canonical, ""));
    })
  );

  it.effect("sorts lines in code point order, not UTF-16 order", () =>
    Effect.gen(function* () {
      const form = yield* canonicalizeText(
        A.join(
          [
            '<https://example.test/s> <https://example.test/p> "\u{1F303}" .',
            '<https://example.test/s> <https://example.test/p> "\uF600" .',
          ],
          "\n"
        )
      );
      expect(form.nquads).toBe(
        '<https://example.test/s> <https://example.test/p> "\uF600" .\n<https://example.test/s> <https://example.test/p> "\u{1F303}" .\n'
      );
    })
  );

  for (const id of testIds) {
    const input = O.getOrThrow(fixture(`test${id}-in.nq`));
    O.match(fixture(`test${id}-rdfc10.nq`), {
      onSome: (expected) =>
        it.effect(`test${id} canonicalizes to the expected N-Quads`, () =>
          Effect.gen(function* () {
            const form = yield* canonicalizeText(input);
            expect(form.nquads).toBe(expected);
          })
        ),
      onNone: () =>
        it.effect(`test${id} is refused at the work bound`, () =>
          Effect.gen(function* () {
            const refusal = yield* Effect.flip(canonicalizeText(input));
            expect(refusal).toStrictEqual(
              CanonicalizationLimitExceeded.make({ limit: CanonicalWorkBound, reached: CanonicalWorkBound + 1 })
            );
          })
        ),
    });
  }
});
