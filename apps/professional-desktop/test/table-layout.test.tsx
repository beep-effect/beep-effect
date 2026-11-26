import { EditorViewer } from "@beep/editor/viewer";
import { documentToEditorState } from "@beep/lexical-schema/Lexical.codec";
import * as MdModel from "@beep/md/Md.model";
import "@testing-library/jest-dom/vitest";
import { it } from "@beep/test-runner";
import { afterEach, describe, expect } from "@effect/vitest";
import { cleanup, render } from "@testing-library/react";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";

const cell = (value: string) => MdModel.TableCell.make({ children: [MdModel.Text.make({ value })] });

const row = (values: ReadonlyArray<string>) => MdModel.TableRow.make({ children: A.map(values, cell) });

const columns = Array.from({ length: 12 }, (_, i) => i + 1);

const document = MdModel.Document.make({
  children: [
    MdModel.Table.make({
      headerRow: true,
      children: [row(A.map(columns, (n) => `C${n}`)), row(A.map(columns, (n) => `verylongvaluecolumn${n}`))],
    }),
  ],
});

const state = documentToEditorState(document).pipe(Effect.runSync);

describe("a wide table in a message", () => {
  afterEach(cleanup);

  it.effect(
    "is allowed to be as wide as its contents and scroll, not crush them",
    Effect.fnUntraced(function* () {
      const { container } = render(<EditorViewer state={state} />);

      const table = container.querySelector("table");
      expect(table).not.toBeNull();

      const className = table?.className ?? "";
      expect(className, "overflow-scroll collapses the table's min-content width to zero").not.toContain(
        "overflow-scroll"
      );
      expect(className).toContain("overflow-x-auto");
      expect(className).toContain("w-max");

      const cells = container.querySelectorAll("td, th");
      expect(cells.length).toBeGreaterThan(0);
      for (const node of cells) {
        expect(node.className, "w-24 pins a cell to 96px whatever it holds, breaking words inside").not.toContain(
          "w-24"
        );
      }

      yield* Effect.void;
    })
  );
});
