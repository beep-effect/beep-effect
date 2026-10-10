import { assert, describe, it } from "@effect/vitest";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";
import type { ProgrammaticRecord } from "../../effected/tsconfig-json/CompilerOptionsFromProgrammatic.ts";
import { ProgrammaticCompilerOptions, TsEnumCodec } from "../../effected/tsconfig-json/TsEnumCodec.ts";

/** Transcription of `CompilerOptionsValue` (typescript@6.0.3). */
type CompilerOptionsValueReplica =
	| string
	| number
	| boolean
	| (string | number)[]
	| string[]
	| { [index: string]: string[] } // MapLike<string[]>
	| { name: string }[] // PluginImport[]
	| { path: string; originalPath?: string; prepend?: boolean; circular?: boolean }[] // ProjectReference[]
	| null
	| undefined;

/** Structural replica of `ts.CompilerOptions` (typescript@6.0.3), enums as `number`. */
interface CompilerOptionsReplica {
	[option: string]: CompilerOptionsValueReplica;
	target?: number; // ScriptTarget
	module?: number; // ModuleKind
	moduleResolution?: number; // ModuleResolutionKind
	jsx?: number; // JsxEmit
	newLine?: number; // NewLineKind
	moduleDetection?: number; // ModuleDetectionKind
	lib?: string[];
}

// Unknown options are preserved by the source schema and the encoder. Their
// values need not fit TypeScript's CompilerOptionsValue union, so the output
// belongs to the unknown-valued record accepted by the programmatic codec.
describe("TsEnumCodec — ProgrammaticCompilerOptions assignability", () => {
	it("ProgrammaticCompilerOptions accepts unknown values and assigns to ProgrammaticRecord", () => {
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
		const compilerOptions: CompilerOptionsReplica = Struct.pick(
			programmatic,
			["target", "module", "moduleResolution", "jsx", "newLine", "moduleDetection", "lib"],
		);
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
