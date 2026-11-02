import * as Configuration from "@beep/repo-docgen/Configuration";
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertTrue, strictEqual } from "@effect/vitest/utils";
import { flow } from "effect/Function";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import schemaJson from "../schema.json" with { type: "json" };

const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);

describe("schema.json", () => {
  it("equals the JSON Schema rendered from ConfigurationSchema", () => {
    // Regenerate with the command in the configurationJsonSchema JSDoc when this fails.
    strictEqual(encodeJson(schemaJson), encodeJson(Configuration.configurationJsonSchema()));
  });

  it("renders the compiler-option inputs from the closed CompilerOptionsShape, not a second model", () => {
    const rendered = Configuration.configurationJsonSchema();
    const defs = rendered.$defs;
    assertTrue(P.isReadonlyObject(defs));
    const root = defs["@beep/repo-docgen/Configuration/ConfigurationSchema"];
    assertTrue(
      P.isReadonlyObject(root) &&
        P.isReadonlyObject(root.properties) &&
        P.isReadonlyObject(root.properties.parseCompilerOptions)
    );
    strictEqual(
      encodeJson(root.properties.parseCompilerOptions),
      encodeJson({
        allOf: [
          { $ref: "#/$defs/@beep~1repo-docgen~1Configuration~1CompilerOptionsInput" },
          { description: "Compiler options or TSConfig path used when parsing package source files." },
        ],
      })
    );
    const input = defs["@beep/repo-docgen/Configuration/CompilerOptionsInput"];
    assertTrue(P.isReadonlyObject(input));
    strictEqual(
      encodeJson(input.anyOf),
      encodeJson([{ type: "string" }, { $ref: "#/$defs/@beep~1repo-docgen~1Configuration~1CompilerOptionsShape" }])
    );
    const shape = defs["@beep/repo-docgen/Configuration/CompilerOptionsShape"];
    assertTrue(P.isReadonlyObject(shape) && P.isReadonlyObject(shape.properties));
    // The closed view's option set, closed, with nothing the retired repo-utils model carried.
    assertTrue(P.isReadonlyObject(shape.properties.allowImportingTsExtensions));
    strictEqual(shape.additionalProperties, false);
    const text = encodeJson(rendered);
    strictEqual(Str.includes("TSConfigCompilerOptionsSemantic")(text), false);
    strictEqual(Str.includes('"type":"null"')(text), false);
  });
});
