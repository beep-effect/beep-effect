import { ProgrammaticCompilerOptions, TsEnumCodec } from "@beep/tsconfig/TsEnumCodec";
import { assert, describe, it } from "@effect/vitest";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";
import type { ProgrammaticRecord } from "@beep/tsconfig/CompilerOptionsFromProgrammatic";

// Adapted from typescript@6.0.3 lib/typescript.d.ts CompilerOptionsValue and CompilerOptions (Apache-2.0).
type MapLikeStringArray = { [index: string]: string[] };
type PluginImportArray = { name: string }[];
type ProjectReferenceArray = { path: string; originalPath?: string; prepend?: boolean; circular?: boolean }[];
type CompilerOptionsValueReplica =
  | string
  | number
  | boolean
  | (string | number)[]
  | string[]
  | MapLikeStringArray
  | PluginImportArray
  | ProjectReferenceArray
  | null
  | undefined;

type JsxEmit = number;
type ModuleKind = number;
type ModuleDetectionKind = number;
type ModuleResolutionKind = number;
type NewLineKind = number;
type ScriptTarget = number;
interface CompilerOptionsReplicaWithEnumsAsNumber {
  jsx?: JsxEmit;
  lib?: string[];
  module?: ModuleKind;
  moduleDetection?: ModuleDetectionKind;
  moduleResolution?: ModuleResolutionKind;
  newLine?: NewLineKind;
  target?: ScriptTarget;
  [option: string]: CompilerOptionsValueReplica;
}

describe("TsEnumCodec — ProgrammaticCompilerOptions assignability", () => {
  it("ProgrammaticCompilerOptions accepts unknown values and assigns to ProgrammaticRecord: unknown options survive the schema and encoder, and their values need not fit CompilerOptionsValue", () => {
    const futureOption = { enabled: true };
    const programmatic: ProgrammaticCompilerOptions = {
      target: 10,
      strict: true,
      lib: ["lib.esnext.d.ts"],
      futureOption,
    };
    const compilerOptions: ProgrammaticRecord = programmatic;
    const passthrough: unknown = programmatic.futureOption;
    assert.strictEqual(compilerOptions.target, 10);
    assert.strictEqual(passthrough, futureOption);
    assert.isTrue(S.is(ProgrammaticCompilerOptions)(programmatic));
  });

  it("encodeCompilerOptions(...) preserves unknown values in its ProgrammaticRecord result", () => {
    const futureOption = { enabled: true };
    const compilerOptions: ProgrammaticRecord = TsEnumCodec.encodeCompilerOptions({
      target: "es2023",
      strict: true,
      lib: ["esnext"],
      futureOption,
    });
    assert.deepStrictEqual(compilerOptions, {
      target: 10,
      strict: true,
      lib: ["lib.esnext.d.ts"],
      futureOption: { enabled: true },
    });
    assert.strictEqual(compilerOptions.futureOption, futureOption);
  });

  it("the known enum and lib subset assigns to the upstream compiler replica without a cast", () => {
    const programmatic = TsEnumCodec.encodeCompilerOptions({
      target: "es2023",
      module: "nodenext",
      moduleResolution: "bundler",
      jsx: "react-jsx",
      newLine: "lf",
      moduleDetection: "force",
      lib: ["esnext", "dom"],
      futureOption: { enabled: true },
    });
    const compilerOptions: CompilerOptionsReplicaWithEnumsAsNumber = Struct.pick(programmatic, [
      "target",
      "module",
      "moduleResolution",
      "jsx",
      "newLine",
      "moduleDetection",
      "lib",
    ]);
    assert.deepStrictEqual(compilerOptions, {
      target: 10,
      module: 199,
      moduleResolution: 100,
      jsx: 4,
      newLine: 1,
      moduleDetection: 3,
      lib: ["lib.esnext.d.ts", "lib.dom.d.ts"],
    });
  });

  it("structurally guarantees enum keys read back as number", () => {
    const programmatic = TsEnumCodec.encodeCompilerOptions({ module: "nodenext" });
    const module: number | undefined = programmatic.module;
    assert.strictEqual(module, 199);
  });
});
