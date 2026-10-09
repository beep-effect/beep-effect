// The differential oracle: the identical vendored contract suite, run against
// the REAL filesystem through @effect/platform-node (a devDependency — the
// `@effected/workspaces` self.int.test.ts precedent). Everything the suite
// touches lives under a scoped temp directory, so this run is confined to the
// host's os.tmpdir() and never touches the repository tree.
//
// If the memory run and this run ever disagree, the engine is wrong, never the
// expectation — the platform layer is the reference implementation.

import { NodeFileSystem } from "@effect/platform-node";
import { errnoSuite } from "../ErrnoParityContract.ts";
import { suite } from "../FileSystemContract.ts";

suite("node", NodeFileSystem.layer);
errnoSuite("node", NodeFileSystem.layer);
