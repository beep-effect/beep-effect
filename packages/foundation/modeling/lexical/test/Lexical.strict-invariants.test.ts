import { SerializedEditorState } from "@beep/lexical-schema/Lexical.model";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as S from "effect/Schema";

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

const decode = (input: unknown) => S.decodeUnknownResult(SerializedEditorState)(input);

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

    expect(Result.isSuccess(decode(state(paragraph([canonical]))))).toBe(true);
    expect(Result.isFailure(decode(state(paragraph([{ ...canonical, detail: 0 }]))))).toBe(true);
    expect(Result.isFailure(decode(state(paragraph([{ ...canonical, text: "spaces" }]))))).toBe(true);
  });

  it("uses shadowRoot to discriminate quote child grammar", () => {
    expect(
      Result.isSuccess(
        decode(
          state({
            ...element,
            type: "quote",
            shadowRoot: true,
            children: [paragraph([text("block")])],
          })
        )
      )
    ).toBe(true);
    expect(
      Result.isFailure(
        decode(
          state({
            ...element,
            type: "quote",
            children: [paragraph([text("block")])],
          })
        )
      )
    ).toBe(true);
    expect(
      Result.isFailure(
        decode(
          state({
            ...element,
            type: "quote",
            shadowRoot: true,
            children: [text("inline")],
          })
        )
      )
    ).toBe(true);
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

    expect(Result.isFailure(decode(state(paragraph([link]))))).toBe(true);
    expect(
      Result.isFailure(
        decode(state({ ...element, type: "list", listType: "bullet", start: 1, tag: "ul", children: [] }))
      )
    ).toBe(true);
    expect(
      Result.isSuccess(
        decode(
          state({
            ...element,
            type: "list",
            listType: "bullet",
            start: 1,
            tag: "ul",
            children: [item],
          })
        )
      )
    ).toBe(true);
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

    expect(Result.isSuccess(decode(state(list("check", false))))).toBe(true);
    expect(Result.isSuccess(decode(state(list("check"))))).toBe(true);
    expect(Result.isFailure(decode(state(list("bullet", false))))).toBe(true);
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

    expect(Result.isSuccess(decode(state(table(validRows, { colWidths: [120, 240], frozenColumnCount: 2 }))))).toBe(
      true
    );
    expect(Result.isFailure(decode(state(table([]))))).toBe(true);
    expect(Result.isFailure(decode(state(table([row([])]))))).toBe(true);
    expect(Result.isFailure(decode(state(table([validRows[0], row([cell([paragraph()])])]))))).toBe(true);
    expect(Result.isFailure(decode(state(table(validRows, { colWidths: [120] }))))).toBe(true);
    expect(Result.isFailure(decode(state(table(validRows, { frozenColumnCount: 3 }))))).toBe(true);
    expect(
      Result.isFailure(
        decode(state(table([validRows[0], row([cell([paragraph()], { rowSpan: 2 }), cell([paragraph()])])])))
      )
    ).toBe(true);
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

    expect(Result.isSuccess(decode(state(table)))).toBe(true);
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

    expect(Result.isFailure(decode(state(table)))).toBe(true);
  });
});
