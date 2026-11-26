import { MemoryFileSystem } from "@beep/memfs";
import { errnoSuite } from "./ErrnoParityContract.ts";
import { suite } from "./FileSystemContract.ts";

suite("memory", MemoryFileSystem.layer);
errnoSuite("memory", MemoryFileSystem.layer);
