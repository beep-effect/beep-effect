import { inspectEditorStateConformance, LexicalConformanceResult } from "@beep/lexical-schema/Lexical.conformance";
import { describe, expect, it } from "@effect/vitest";

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

describe("Lexical.conformance", () => {
  it("exposes exhaustive helpers over all result variants", () => {
    const invalid = inspectEditorStateConformance({ root: null });

    expect(LexicalConformanceResult.guards.invalid(invalid)).toBe(true);
    expect(
      LexicalConformanceResult.match(invalid, {
        compatible: () => "compatible",
        normalizable: () => "normalizable",
        unsupported: () => "unsupported",
        invalid: () => "invalid",
      })
    ).toBe("invalid");
  });

  it("distinguishes exact strict wire from schema-normalizable wire", () => {
    const exact = {
      root: {
        ...element,
        type: "root",
        children: [{ ...element, type: "paragraph", children: [text("exact")] }],
      },
    };
    const legacy = {
      root: {
        ...element,
        type: "root",
        children: [
          {
            ...element,
            type: "list",
            listType: "number",
            start: 0,
            tag: "ol",
            children: [
              {
                ...element,
                type: "listitem",
                value: 1,
                children: [text("legacy")],
              },
            ],
          },
        ],
      },
    };

    expect(inspectEditorStateConformance(exact)._tag).toBe("compatible");
    const normalized = inspectEditorStateConformance(legacy);
    expect(normalized._tag).toBe("normalizable");
    if (normalized._tag === "normalizable") {
      expect(normalized.wire.root).toMatchObject({ children: [{ start: 0 }] });
      expect(normalized.normalizedWire.root).toMatchObject({ children: [{ start: 1 }] });
    }
  });

  it("retains future JSON wire as unsupported", () => {
    const future = {
      root: {
        type: "root",
        version: 9,
        children: [{ type: "future-node", version: 1, extension: true }],
      },
    };

    const result = inspectEditorStateConformance(future);
    expect(result._tag).toBe("unsupported");
    if (result._tag === "unsupported") {
      expect(result.wire).toEqual(future);
      expect(result.issues).toHaveLength(1);
    }
  });
});
