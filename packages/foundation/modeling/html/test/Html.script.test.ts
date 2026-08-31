import { HtmlScript, inspectConformance, ScriptState as RootScriptState } from "@beep/html";
import { Script } from "@beep/html/Html.model";
import {
  HtmlMimeType,
  InvalidScriptType,
  JavaScriptMimeTypeEssence,
  resolveScriptState,
  ScriptDataBlockMimeType,
  ScriptState,
} from "@beep/html/Html.script";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";

const ScriptStateArbitrary = S.toArbitrary(ScriptState)(fc);

describe("HTML script semantic states", () => {
  it("publishes script semantics through the dedicated subpath and root boundary", () => {
    expect(HtmlScript.ScriptState).toBe(ScriptState);
    expect(RootScriptState).toBe(ScriptState);
  });

  it("recognizes the exact JavaScript MIME essence registry as classic script", () => {
    expect(JavaScriptMimeTypeEssence.Options).toStrictEqual([
      "application/ecmascript",
      "application/javascript",
      "application/x-ecmascript",
      "application/x-javascript",
      "text/ecmascript",
      "text/javascript",
      "text/javascript1.0",
      "text/javascript1.1",
      "text/javascript1.2",
      "text/javascript1.3",
      "text/javascript1.4",
      "text/javascript1.5",
      "text/jscript",
      "text/livescript",
      "text/x-ecmascript",
      "text/x-javascript",
    ]);

    A.forEach(JavaScriptMimeTypeEssence.Options, (mimeType) => {
      expect(
        Result.getOrThrow(resolveScriptState(Script.make({ content: "", type: O.some(Str.toUpperCase(mimeType)) })))
      ).toStrictEqual(ScriptState.cases.classic.make({}));
    });
  });

  it("classifies every author-conforming script type without rewriting its wire", () => {
    const missing = Script.make({ content: "" });
    expect(O.isNone(missing.type)).toBe(true);
    expect(Result.getOrThrow(resolveScriptState(missing))).toStrictEqual(ScriptState.cases.classic.make({}));
    expect(Result.getOrThrow(resolveScriptState(Script.make({ content: "", type: O.some("") })))).toStrictEqual(
      ScriptState.cases.classic.make({})
    );
    expect(Result.getOrThrow(resolveScriptState(Script.make({ content: "", type: O.some("MoDuLe") })))).toStrictEqual(
      ScriptState.cases.module.make({})
    );
    expect(
      Result.getOrThrow(resolveScriptState(Script.make({ content: "", type: O.some("IMPORTMAP") })))
    ).toStrictEqual(ScriptState.cases.importMap.make({}));
    expect(
      Result.getOrThrow(resolveScriptState(Script.make({ content: "", type: O.some("SpeculationRules") })))
    ).toStrictEqual(ScriptState.cases.speculationRules.make({}));

    const jsonMime = Result.getOrThrow(S.decodeResult(ScriptDataBlockMimeType)("application/ld+json"));
    expect(
      Result.getOrThrow(resolveScriptState(Script.make({ content: "", type: O.some("application/ld+json") })))
    ).toStrictEqual(ScriptState.cases.dataBlock.make({ mimeType: jsonMime }));

    const parameterizedJavaScriptMime = Result.getOrThrow(
      S.decodeResult(ScriptDataBlockMimeType)("text/javascript; charset=utf-8")
    );
    expect(
      Result.getOrThrow(
        resolveScriptState(Script.make({ content: "", type: O.some("text/javascript; charset=utf-8") }))
      )
    ).toStrictEqual(ScriptState.cases.dataBlock.make({ mimeType: parameterizedJavaScriptMime }));
  });

  it("returns a typed failure and conformance diagnostic for an invalid script type", () => {
    const invalidScript = Script.make({ content: "", type: O.some("beep") });
    expect(
      Result.match(resolveScriptState(invalidScript), {
        onFailure: (error) => ({ isInvalid: S.is(InvalidScriptType)(error), tag: error._tag, value: error.value }),
        onSuccess: () => ({ isInvalid: false, tag: "unexpected", value: "" }),
      })
    ).toStrictEqual({ isInvalid: true, tag: "InvalidScriptType", value: "beep" });

    A.forEach(
      [
        invalidScript,
        Script.make({ content: "", type: O.some(" module ") }),
        Script.make({ content: "", type: O.some("text/javascript;") }),
      ],
      (script) => {
        expect(Result.isFailure(resolveScriptState(script))).toBe(true);
        expect(
          A.some(
            inspectConformance(script),
            (issue) => issue.rule === "attributeRelationship" && A.contains(issue.path, "attributes.type")
          )
        ).toBe(true);
      }
    );
    expect(
      A.some(
        inspectConformance(Script.make({ content: "", type: O.some("application/ld+json") })),
        (issue) => issue.rule === "attributeRelationship" && A.contains(issue.path, "attributes.type")
      )
    ).toBe(false);
  });

  it("accepts the contextual script attribute matrix", () => {
    const validScripts = [
      Script.make({
        content: "",
        src: O.some("/classic.js"),
        nomodule: O.some(true),
        async: O.some(true),
        defer: O.some(true),
        blocking: O.some("render"),
        crossorigin: O.some("anonymous"),
        referrerpolicy: O.some("origin"),
        integrity: O.some("sha256-Zm9v"),
        fetchpriority: O.some("auto"),
      }),
      Script.make({
        content: "void 0",
        nomodule: O.some(true),
        crossorigin: O.some("anonymous"),
        referrerpolicy: O.some("origin"),
      }),
      Script.make({
        content: "",
        type: O.some("module"),
        src: O.some("/module.js"),
        async: O.some(true),
        blocking: O.some("render"),
        crossorigin: O.some("anonymous"),
        referrerpolicy: O.some("origin"),
        integrity: O.some("sha256-Zm9v"),
        fetchpriority: O.some("auto"),
      }),
      Script.make({
        content: "export {}",
        type: O.some("module"),
        async: O.some(true),
        crossorigin: O.some("anonymous"),
        referrerpolicy: O.some("origin"),
      }),
      Script.make({ content: "{}", type: O.some("importmap") }),
      Script.make({ content: "{}", type: O.some("speculationrules") }),
      Script.make({ content: "{}", type: O.some("application/json") }),
    ];
    A.forEach(validScripts, (script) => expect(inspectConformance(script)).toStrictEqual([]));
  });

  it("rejects attributes outside the contextual script matrix", () => {
    const hasAttributeRelationshipIssue = (script: Script.Type, name: string): boolean =>
      A.some(
        inspectConformance(script),
        (issue) => issue.rule === "attributeRelationship" && A.contains(issue.path, `attributes.${name}`)
      );
    const expectForbiddenAttributes = (script: Script.Type, names: ReadonlyArray<string>): void =>
      A.forEach(names, (name) => expect(hasAttributeRelationshipIssue(script, name)).toBe(true));

    expectForbiddenAttributes(
      Script.make({
        content: "void 0",
        async: O.some(true),
        defer: O.some(true),
        blocking: O.some("render"),
        integrity: O.some("sha256-Zm9v"),
        fetchpriority: O.some("auto"),
      }),
      ["async", "defer", "blocking", "integrity", "fetchpriority"]
    );
    expectForbiddenAttributes(
      Script.make({
        content: "",
        type: O.some("module"),
        src: O.some("/module.js"),
        nomodule: O.some(true),
        defer: O.some(true),
      }),
      ["nomodule", "defer"]
    );
    expectForbiddenAttributes(
      Script.make({
        content: "export {}",
        type: O.some("module"),
        nomodule: O.some(true),
        defer: O.some(true),
        blocking: O.some("render"),
        integrity: O.some("sha256-Zm9v"),
        fetchpriority: O.some("auto"),
      }),
      ["nomodule", "defer", "blocking", "integrity", "fetchpriority"]
    );
    expectForbiddenAttributes(
      Script.make({
        content: "{}",
        type: O.some("importmap"),
        src: O.some("/map.json"),
        nomodule: O.some(true),
        async: O.some(true),
        defer: O.some(true),
        blocking: O.some("render"),
        crossorigin: O.some("anonymous"),
        referrerpolicy: O.some("origin"),
        integrity: O.some("sha256-Zm9v"),
        fetchpriority: O.some("auto"),
      }),
      ["src", "nomodule", "async", "defer", "blocking", "crossorigin", "referrerpolicy", "integrity", "fetchpriority"]
    );
    expectForbiddenAttributes(Script.make({ content: "{}", type: O.some("speculationrules"), async: O.some(true) }), [
      "async",
    ]);
    expectForbiddenAttributes(
      Script.make({ content: "{}", type: O.some("application/json"), src: O.some("/data.json") }),
      ["src"]
    );
  });

  it("enforces script MIME correlations at compile and decode boundaries", () => {
    const mimeType = Result.getOrThrow(S.decodeResult(ScriptDataBlockMimeType)("application/json"));
    const validState: ScriptState = ScriptState.cases.dataBlock.make({ mimeType });
    // @ts-expect-error -- data-block MIME types are schema-refined rather than arbitrary strings.
    const invalidMimeType: ScriptDataBlockMimeType = "application/json";
    // @ts-expect-error -- unsupported is not an author-conforming script state.
    const invalidState: ScriptState = { state: "unsupported" };

    expect(validState.state).toBe("dataBlock");
    expect(invalidMimeType).toBe("application/json");
    expect(invalidState.state).toBe("unsupported");
    expect(Result.isSuccess(S.decodeResult(HtmlMimeType)("application/json"))).toBe(true);
    expect(Result.isFailure(S.decodeResult(HtmlMimeType)("beep"))).toBe(true);
    expect(Result.isFailure(S.decodeResult(ScriptDataBlockMimeType)("text/javascript"))).toBe(true);
    expect(Result.isFailure(S.decodeResult(ScriptState)({ state: "dataBlock", mimeType: "text/javascript" }))).toBe(
      true
    );
  });

  it("exhaustively matches every script semantic state", () => {
    const describeState: (state: ScriptState) => string = ScriptState.match({
      classic: () => "classic",
      module: () => "module",
      importMap: () => "import-map",
      speculationRules: () => "speculation-rules",
      dataBlock: ({ mimeType }) => `data-block:${mimeType}`,
    });
    const mimeType = Result.getOrThrow(S.decodeResult(ScriptDataBlockMimeType)("application/json"));

    expect(describeState(ScriptState.cases.classic.make({}))).toBe("classic");
    expect(describeState(ScriptState.cases.module.make({}))).toBe("module");
    expect(describeState(ScriptState.cases.importMap.make({}))).toBe("import-map");
    expect(describeState(ScriptState.cases.speculationRules.make({}))).toBe("speculation-rules");
    expect(describeState(ScriptState.cases.dataBlock.make({ mimeType }))).toBe("data-block:application/json");
  });

  it("round-trips schema-derived script semantic states", () => {
    fc.assert(
      fc.property(ScriptStateArbitrary, (state) => {
        const encoded = Result.getOrThrow(S.encodeResult(ScriptState)(state));
        const decoded = Result.getOrThrow(S.decodeResult(ScriptState)(encoded));
        expect(Eq.equals(decoded, state)).toBe(true);
      }),
      fcRuns(25)
    );
  });
});
