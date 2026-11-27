import { Doc, Render } from "@beep/cli-kit";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { contextOf } from "./helpers/renderContext.ts";
import type { Block } from "@beep/cli-kit";

const EMPTY_HEADERLESS_TABLES: ReadonlyArray<readonly [string, Block]> = [
  ["Doc.countsTable([])", Doc.countsTable([])],
  ["Doc.table([{ header: [] }], [])", Doc.table([{ header: [] }], [])],
  ["Doc.table([{ header: [] }], [], { style: 'pipe' })", Doc.table([{ header: [] }], [], { style: "pipe" })],
];

const renderers = ["plain", "ansi", "githubLog", "markdown"] as const;

describe("an empty headerless table, the everyday case of zero projects in a counts table", () => {
  for (const [name, table] of EMPTY_HEADERLESS_TABLES) {
    for (const renderer of renderers) {
      it.effect(`${name}: Render.${renderer} draws nothing for it, and the blocks around it are kept`, () =>
        Effect.gen(function* () {
          const ctx = yield* contextOf({ color: "none" });
          assert.strictEqual(Render[renderer]([table], ctx), "");
          assert.strictEqual(
            Render[renderer]([Doc.paragraph("before"), table, Doc.paragraph("after")], ctx),
            Render[renderer]([Doc.paragraph("before"), Doc.paragraph("after")], ctx)
          );
        })
      );
    }
  }

  it.effect("still draws the overflow line when a cap hides every row", () =>
    Effect.gen(function* () {
      const ctx = yield* contextOf({ color: "none" });
      const capped = Doc.table([{ header: [] }], [["a"], ["b"]], { cap: 0 });
      assert.strictEqual(Render.plain([capped], ctx), `${ctx.glyphs.ellipsis} 2 more`);
      assert.strictEqual(Render.markdown([capped], ctx), `${ctx.glyphs.ellipsis} 2 more`);
    })
  );

  it.effect("a counts table with a label header and no row draws its header", () =>
    Effect.gen(function* () {
      const ctx = yield* contextOf({ color: "none" });
      assert.strictEqual(Render.plain([Doc.countsTable([], { labelHeader: "Project" })], ctx), "Project\n-------");
    })
  );
});
