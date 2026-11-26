import { appendChild, childrenOf, makeInlineNode } from "@beep/markdown/internal/inlineNode";
import { linkifyEmails } from "@beep/markdown/internal/inlines/autolinkLiteral";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { describeConstructFloor, floorRuns } from "./propertyFloor.ts";

const Sample = S.Struct({
  scheme: S.Literals(["http", "https", "ftp"]),
  label: S.Array(S.Literals(["a", "b", "9"])),
  ending: S.Literals(["", ".", ")", ";", "/q_(bar)"]),
});
const sources = Arbitrary.schema(Sample).pipe(
  Arbitrary.map(
    (sample) =>
      `www.a${A.join(sample.label, "")}.org${sample.ending} ${sample.scheme}://example.org/path${sample.ending} ada${A.join(sample.label, "")}@example.org`
  )
);
describeConstructFloor({ name: "autolinkLiteral", sources });

it.effect.prop(
  "email postprocessing is idempotent and preserves text and source bounds across pieces",
  [S.Literals(["a", "b", "9", "_"]).pipe(S.Array, Arbitrary.schema)],
  ([chars]) =>
    Effect.sync(() => {
      const address = `ada${A.join(chars, "")}@example.org`;
      const source = `prefix ${address} suffix`;
      const root = makeInlineNode("emphasis", 0, source.length);
      appendChild(root, makeInlineNode("text", 0, 9, Str.slice(0, 9)(source)));
      appendChild(root, makeInlineNode("text", 9, source.length, Str.slice(9)(source)));
      linkifyEmails(root);
      const snapshot = () =>
        A.map(childrenOf(root), (node) => ({
          type: node.type,
          value: node.value,
          start: node.start,
          end: node.end,
          url: node.data.url,
          children: A.map(childrenOf(node), (child) => ({
            type: child.type,
            value: child.value,
            start: child.start,
            end: child.end,
          })),
        }));
      const once = snapshot();
      assert.deepStrictEqual(
        A.map(once, (node) => node.type),
        ["text", "link", "text"]
      );
      assert.strictEqual(once[1]?.url, `mailto:${address}`);
      assert.strictEqual(
        once[1]?.start,
        7,
        "the address straddles pieces, yet source coordinates stay those of the full input"
      );
      assert.strictEqual(once[1]?.end, 7 + address.length);
      assert.strictEqual(
        A.join(
          A.map(once, (node) =>
            node.type === "link"
              ? A.join(
                  A.map(node.children, (child) => child.value),
                  ""
                )
              : node.value
          ),
          ""
        ),
        source
      );
      linkifyEmails(root);
      assert.deepStrictEqual(snapshot(), once);
    }),
  floorRuns
);
