import { assert, describe, it } from "@effect/vitest";
import type { ProgrammaticCompilerOptions } from "../../effected/tsconfig-json/TsEnumCodec.ts";
import { TsEnumCodec } from "../../effected/tsconfig-json/TsEnumCodec.ts";

// Compile-time proof that `encodeCompilerOptions`'s return
// (`ProgrammaticCompilerOptions`) is assignable to TypeScript's own
// `ts.CompilerOptions` — the shape `@typescript/vfs`'s
// `createVirtualTypeScriptEnvironment` / `createDefaultMapFromNodeModules` and
// `ts.createProgram` consume — WITHOUT importing `typescript` (the package's
// zero-`typescript` HARD RULE, tests included). Per the tsc-parity discipline
// (facts transcribed from TypeScript source with a version citation), the
// assignability target is transcribed here as a structural replica.
//
// Transcribed from `typescript@6.0.3`'s
// `node_modules/typescript/lib/typescript.d.ts` (the version `@typescript/vfs@1.6.4`,
// the encode target's consumer, pins). Assignability to the REAL `ts.CompilerOptions`
// of that version was additionally settled at rung 3 by a throwaway probe
// (`tsc --noEmit --strict` against the real `.d.ts`, 2026-07-21): a plain
// `number` reaches the enum-typed named keys through the index signature, so
// the enum keys typed `number` and the passthrough index signature are both
// accepted, while an `unknown`-valued index signature is correctly rejected.
//
// The replica is deliberately at least as strict as the real interface: its
// index-signature value union is the exact transcription of
// `CompilerOptionsValue` (minus the compiler-internal `TsConfigSourceFile`
// node, which no JSON-derived value can be), and the numeric enums are
// transcribed as their structural `number` (the replica cannot express nominal
// enums without importing them — the probe above covered that gap).

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

describe("TsEnumCodec — ProgrammaticCompilerOptions assignability", () => {
	it("ProgrammaticCompilerOptions is assignable to ts.CompilerOptions (no cast)", () => {
		const programmatic: ProgrammaticCompilerOptions = { target: 10, strict: true, lib: ["lib.esnext.d.ts"] };
		// The proof: assigns to the tsc replica with no cast. A regression that
		// widened the return (e.g. back to `Record<string, unknown>`) fails here.
		const compilerOptions: CompilerOptionsReplica = programmatic;
		assert.strictEqual(compilerOptions.target, 10);
	});

	it("encodeCompilerOptions(...) result assigns to ts.CompilerOptions with no cast", () => {
		// The ergonomic win the issue asked for: the consumer's trailing cast is
		// gone — the boundary hands back an honest, tsc-assignable type.
		const compilerOptions: CompilerOptionsReplica = TsEnumCodec.encodeCompilerOptions({
			target: "es2023",
			strict: true,
			lib: ["esnext"],
		});
		assert.deepStrictEqual(compilerOptions, { target: 10, strict: true, lib: ["lib.esnext.d.ts"] });
	});

	it("structurally guarantees enum keys read back as number", () => {
		const programmatic = TsEnumCodec.encodeCompilerOptions({ module: "nodenext" });
		const module: number | undefined = programmatic.module;
		assert.strictEqual(module, 199);
	});
});
