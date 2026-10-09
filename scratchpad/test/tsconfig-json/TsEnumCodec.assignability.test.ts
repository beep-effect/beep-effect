import { assert, describe, it } from "@effect/vitest";
import * as S from "effect/Schema";
import type { ProgrammaticRecord } from "../../effected/tsconfig-json/CompilerOptionsFromProgrammatic.ts";
import { ProgrammaticCompilerOptions, TsEnumCodec } from "../../effected/tsconfig-json/TsEnumCodec.ts";

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

	it("structurally guarantees enum keys read back as number", () => {
		const programmatic = TsEnumCodec.encodeCompilerOptions({ module: "nodenext" });
		const module: number | undefined = programmatic.module;
		assert.strictEqual(module, 199);
	});
});
