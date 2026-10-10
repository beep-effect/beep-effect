import { assert, describe, it } from "@effect/vitest";
import { InvalidFaultCountError, UnknownFaultKeyError } from "../../effected/memfs/index.ts";
import * as Faults from "../../effected/memfs/internal/faults.ts";
import * as MemoryFileSystemModule from "../../effected/memfs/MemoryFileSystem.ts";

describe("memfs entry-point exports", () => {
	it("exports the existing InvalidFaultCountError class", () => {
		assert.strictEqual(InvalidFaultCountError, MemoryFileSystemModule.InvalidFaultCountError);
	});

	it("exports the existing UnknownFaultKeyError class", () => {
		assert.strictEqual(UnknownFaultKeyError, Faults.UnknownFaultKeyError);
	});
});
