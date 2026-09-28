import { SerializedEditorState } from "@beep/lexical-schema/Lexical.model";
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { pipe, Result } from "effect";
import * as S from "effect/Schema";

const decodeUnknownSerializedEditorStateResult = S.decodeUnknownResult(SerializedEditorState);

const element = {
  version: 1,
  direction: null,
  format: "",
  indent: 0,
} as const;

const text = (value: string) => ({
  type: "text",
  version: 1,
  detail: 0,
  format: 0,
  mode: "normal",
  style: "",
  text: value,
});

const paragraph = (children: ReadonlyArray<unknown> = []) => ({
  ...element,
  type: "paragraph",
  children,
});

const state = (child: unknown) => ({
  root: {
    ...element,
    type: "root",
    children: [child],
  },
});

const decode = (input: unknown) => decodeUnknownSerializedEditorStateResult(input);

describe("Lexical strict semantic invariants", () => {
  it("requires canonical TabNode state", () => {
    const canonical = {
      type: "tab",
      version: 1,
      detail: 2,
      format: 0,
      mode: "normal",
      style: "",
      text: "\t",
    };

    pipe(decode(state(paragraph([canonical]))), Result.isSuccess, assertTrue);
    pipe(decode(state(paragraph([{ ...canonical, detail: 0 }]))), Result.isFailure, assertTrue);
    pipe(decode(state(paragraph([{ ...canonical, text: "spaces" }]))), Result.isFailure, assertTrue);
  });

  it("uses shadowRoot to discriminate quote child grammar", () => {
    pipe(
      decode(
        state({
          ...element,
          type: "quote",
          shadowRoot: true,
          children: [paragraph([text("block")])],
        })
      ),
      Result.isSuccess,
      assertTrue
    );
    pipe(
      decode(
        state({
          ...element,
          type: "quote",
          children: [paragraph([text("block")])],
        })
      ),
      Result.isFailure,
      assertTrue
    );
    pipe(
      decode(
        state({
          ...element,
          type: "quote",
          shadowRoot: true,
          children: [text("inline")],
        })
      ),
      Result.isFailure,
      assertTrue
    );
  });

  it("rejects empty links and lists at the strict runtime boundary", () => {
    const link = {
      ...element,
      type: "link",
      url: "https://example.com",
      children: [],
    };
    const item = {
      ...element,
      type: "listitem",
      value: 1,
      children: [],
    };

    pipe(decode(state(paragraph([link]))), Result.isFailure, assertTrue);
    pipe(
      decode(state({ ...element, type: "list", listType: "bullet", start: 1, tag: "ul", children: [] })),
      Result.isFailure,
      assertTrue
    );
    pipe(
      decode(
        state({
          ...element,
          type: "list",
          listType: "bullet",
          start: 1,
          tag: "ul",
          children: [item],
        })
      ),
      Result.isSuccess,
      assertTrue
    );
  });

  it("requires check-state only for check-list items", () => {
    const item = {
      ...element,
      type: "listitem",
      value: 1,
      children: [],
    };
    const list = (listType: "bullet" | "check", checked?: boolean) => ({
      ...element,
      type: "list",
      listType,
      start: 1,
      tag: "ul",
      children: [{ ...item, ...(checked === undefined ? {} : { checked }) }],
    });

    pipe(decode(state(list("check", false))), Result.isSuccess, assertTrue);
    pipe(decode(state(list("check"))), Result.isSuccess, assertTrue);
    pipe(decode(state(list("bullet", false))), Result.isFailure, assertTrue);
  });

  it("requires rectangular, non-empty tables and bounded dimensions", () => {
    const cell = (children: ReadonlyArray<unknown>, extra: Readonly<Record<string, unknown>> = {}) => ({
      ...element,
      type: "tablecell",
      headerState: 0,
      children,
      ...extra,
    });
    const row = (children: ReadonlyArray<unknown>) => ({ ...element, type: "tablerow", children });
    const validRows = [row([cell([paragraph()], { colSpan: 2 })]), row([cell([paragraph()]), cell([paragraph()])])];
    const table = (children: ReadonlyArray<unknown>, extra: Readonly<Record<string, unknown>> = {}) => ({
      ...element,
      type: "table",
      children,
      ...extra,
    });

    pipe(
      decode(state(table(validRows, { colWidths: [120, 240], frozenColumnCount: 2 }))),
      Result.isSuccess,
      assertTrue
    );
    pipe(decode(state(table([]))), Result.isFailure, assertTrue);
    pipe(decode(state(table([row([])]))), Result.isFailure, assertTrue);
    pipe(decode(state(table([validRows[0], row([cell([paragraph()])])]))), Result.isFailure, assertTrue);
    pipe(decode(state(table(validRows, { colWidths: [120] }))), Result.isFailure, assertTrue);
    pipe(decode(state(table(validRows, { frozenColumnCount: 3 }))), Result.isFailure, assertTrue);
    pipe(
      decode(state(table([validRows[0], row([cell([paragraph()], { rowSpan: 2 }), cell([paragraph()])])]))),
      Result.isFailure,
      assertTrue
    );
  });

  it("accepts logical table grids occupied by prior row spans", () => {
    const cell = (extra: Readonly<Record<string, unknown>> = {}) => ({
      ...element,
      type: "tablecell",
      headerState: 0,
      children: [paragraph()],
      ...extra,
    });
    const row = (children: ReadonlyArray<unknown>) => ({ ...element, type: "tablerow", children });
    const table = {
      ...element,
      type: "table",
      children: [row([cell({ rowSpan: 2 }), cell()]), row([cell()])],
    };

    pipe(decode(state(table)), Result.isSuccess, assertTrue);
  });

  it("rejects table grid collisions with prior row spans", () => {
    const cell = (extra: Readonly<Record<string, unknown>> = {}) => ({
      ...element,
      type: "tablecell",
      headerState: 0,
      children: [paragraph()],
      ...extra,
    });
    const row = (children: ReadonlyArray<unknown>) => ({ ...element, type: "tablerow", children });
    const table = {
      ...element,
      type: "table",
      children: [row([cell({ rowSpan: 2 }), cell()]), row([cell(), cell()])],
    };

    pipe(decode(state(table)), Result.isFailure, assertTrue);
  });
});
