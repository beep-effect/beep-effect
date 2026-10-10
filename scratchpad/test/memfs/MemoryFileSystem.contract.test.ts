// The vendored FileSystem contract suite (see FileSystemContract.ts for the
// port header) run against the in-memory volume. The same suite runs against
// the real filesystem in integration/node.int.test.ts — memory and disk
// passing one suite is the differential proof the port matches real semantics
// on the installed beta. The kit-owned errno-parity suite rides alongside it
// on both sides.

import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { errnoSuite } from "./ErrnoParityContract.ts";
import { suite } from "./FileSystemContract.ts";

suite("memory", MemoryFileSystem.layer);
errnoSuite("memory", MemoryFileSystem.layer);
