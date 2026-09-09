import { testLayer } from "@beep/test-utils/FileSystemConformance";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import { describe } from "@effect/vitest";

describe("FileSystem conformance (MemoryFileSystem)", () => {
  testLayer(MemoryFileSystem.layer);
});
