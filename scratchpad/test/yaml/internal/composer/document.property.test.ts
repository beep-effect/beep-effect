import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { describe, expect, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { composeAllDocuments, composeDocument, composeFirstDocument, composeFirstDocumentCounted } from "../../../../effected/yaml/internal/composer/document.ts";
import { createState } from "../../../../effected/yaml/internal/composer/state.ts";
import { composeFlowMap, composeFlowSeq } from "../../../../effected/yaml/internal/composer/flow.ts";
import { parseCSTAll } from "../../../../effected/yaml/internal/cst-parser.ts";
import { stringifyDocument, stringifyValue } from "../../../../effected/yaml/internal/stringifier.ts";
import { YamlMap } from "../../../../effected/yaml/YamlNode.ts";
import type { RawYamlDocument } from "../../../../effected/yaml/internal/raw-document.ts";

const runs = { arbitrary: fcRuns(100) };
const Sample = S.Struct({ name: S.String, count: S.Int.check(S.isBetween({ minimum: -10000, maximum: 10000 })), enabled: S.Boolean, tags: S.Array(S.String) });
const direct = (text: string): RawYamlDocument => {
  const [cst] = parseCSTAll(text);
  if (cst === undefined) return composeFirstDocument(text);
  return composeDocument(createState(text, { composeFlowMap, composeFlowSeq }))(cst);
};
const parsers = [composeFirstDocument, (text: string) => composeFirstDocumentCounted(text).document, direct];

describe("document composer property floor", () => {
  for (const [index, parse] of parsers.entries()) {
    it.effect.prop(`parser ${index}: value fidelity and canonical rendering idempotence`, [Arbitrary.schema(Sample)], ([value]) => Effect.sync(() => {
      const parsed = parse(stringifyValue(value));
      expect(parsed.errors).toEqual([]);
      expect(parsed.contents?.toValue()).toEqual(value);
      const formatted = stringifyDocument(parsed);
      const reparsed = parse(formatted);
      expect(reparsed.errors).toEqual([]);
      expect(reparsed.contents?.toValue()).toEqual(parsed.contents?.toValue());
      expect(stringifyDocument(reparsed)).toBe(formatted);
    }), runs);
  }

  it.effect.prop("all-document parsing preserves every value, framing and document comment at a fixed point", [Arbitrary.schema(S.Array(Sample).check(S.isMinLength(1)))], ([values]) => Effect.sync(() => {
    const text = values.map((value) => `# header\n---\n${stringifyValue(value)}...\n# tail\n`).join("");
    const parsed = composeAllDocuments(text);
    expect(parsed.streamErrors).toEqual([]);
    expect(parsed.documents.map((document) => document.contents?.toValue())).toEqual(values);
    const formatted = parsed.documents.map((document) => stringifyDocument(document)).join("");
    const reparsed = composeAllDocuments(formatted);
    expect(reparsed.streamErrors).toEqual([]);
    expect(reparsed.documents.map((document) => document.contents?.toValue())).toEqual(values);
    expect(reparsed.documents.map((document) => [document.commentBefore, document.comment])).toEqual(parsed.documents.map((document) => [document.commentBefore, document.comment]));
    expect(reparsed.documents.map((document) => stringifyDocument(document)).join("")).toBe(formatted);
  }), runs);

  it.effect.prop("README fidelity: composition retains comments and exact source spans while canonicalizing", [Arbitrary.schema(S.Int)], ([value]) => Effect.sync(() => {
    const text = `# document\n---\n# root\nvalue: ${value} # inline\n...\n# trailing\n`;
    const document = composeFirstDocument(text);
    expect(document.errors).toEqual([]);
    expect(document.commentBefore).toBe(" document");
    expect(document.comment).toBe(" trailing");
    expect(document.contents?.commentBefore).toBe(" root");
    expect(S.is(YamlMap)(document.contents)).toBe(true);
    const scalar = S.is(YamlMap)(document.contents) ? document.contents.items[0]?.value : null;
    expect(scalar?.comment).toBe(" inline");
    if (scalar !== undefined && scalar !== null) expect(text.slice(scalar.offset, scalar.offset + scalar.length)).toBe(`${value}`);
    const formatted = stringifyDocument(document);
    const reparsed = composeFirstDocument(formatted);
    expect(reparsed.contents?.toValue()).toEqual(document.contents?.toValue());
    expect(reparsed.commentBefore).toBe(document.commentBefore);
    expect(reparsed.comment).toBe(document.comment);
    expect(reparsed.contents?.commentBefore).toBe(document.contents?.commentBefore);
    expect(S.is(YamlMap)(reparsed.contents)).toBe(true);
    if (S.is(YamlMap)(reparsed.contents)) expect(reparsed.contents.items[0]?.value?.comment).toBe(" inline");
    expect(stringifyDocument(reparsed)).toBe(formatted);
  }), runs);
});
