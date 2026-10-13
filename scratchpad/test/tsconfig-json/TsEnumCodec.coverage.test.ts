import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { TsEnumCodec } from "../../effected/tsconfig-json/TsEnumCodec.ts";

it.effect("unvalidated numeric options preserve unknown numbers, non-string lib entries and passthrough", () => Effect.gen(function* () {
  assert.deepStrictEqual(TsEnumCodec.decodeCompilerOptions({ target: 999, module: "COMMONJS", lib: [7, null, "LIB.DOM.D.TS"], extension: { enabled: true } }), { target: 999, module: "COMMONJS", lib: [7, null, "dom"], extension: { enabled: true } });
}));
