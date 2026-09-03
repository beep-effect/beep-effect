import { EditorViewer } from "@beep/editor/viewer";
import { documentToEditorState } from "@beep/lexical-schema/Lexical.codec";
import * as MdModel from "@beep/md/Md.model";
import "@testing-library/jest-dom/vitest";
import { it } from "@effect/vitest";
import { cleanup, render } from "@testing-library/react";
import * as Effect from "effect/Effect";
import { afterEach, describe, expect } from "vitest";

// The wide table the reviewers used: twelve columns, each holding one long unbroken
// token. Nothing here can wrap without wrapping *inside* a word.
const cell = (value: string) => MdModel.TableCell.make({ children: [MdModel.Text.make({ value })] });

const row = (values: ReadonlyArray<string>) => MdModel.TableRow.make({ children: values.map(cell) });

const columns = Array.from({ length: 12 }, (_, i) => i + 1);

const document = MdModel.Document.make({
  children: [
    MdModel.Table.make({
      headerRow: true,
      children: [row(columns.map((n) => `C${n}`)), row(columns.map((n) => `verylongvaluecolumn${n}`))],
    }),
  ],
});

const state = documentToEditorState(document).pipe(Effect.runSync);

describe("a wide table in a message", () => {
  afterEach(cleanup);

  it.effect(
    "is allowed to be as wide as its contents and scroll, not crush them",
    Effect.fnUntraced(function* () {
      // Two class-strings did this together. The cells were pinned to `w-24` — 96px,
      // whatever they held — and the table itself carried `overflow-scroll`, which makes
      // it a scroll container and collapses its min-content width to zero. Between them
      // the browser was free to squeeze every column down and break the words inside:
      // "verylongvaluecolumn1" came out as three stacked eight-character fragments.
      const { container } = render(<EditorViewer state={state} />);

      const table = container.querySelector("table");
      expect(table).not.toBeNull();

      const className = table?.className ?? "";
      expect(className).not.toContain("overflow-scroll");
      expect(className).toContain("overflow-x-auto");
      expect(className).toContain("w-max");

      const cells = container.querySelectorAll("td, th");
      expect(cells.length).toBeGreaterThan(0);
      for (const node of cells) {
        expect(node.className).not.toContain("w-24");
      }

      yield* Effect.void;
    })
  );
});
