import { testLayer } from "@beep/test-utils/FileSystemConformance";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { describe } from "@effect/vitest";
import { pipe } from "effect";

// At rc.112 this public subpath also loads on Node. A Node run proves only
// compatibility; execute Vitest with Bun to prove the Bun runtime behavior.
describe("FileSystem conformance (BunFileSystem)", () => {
  pipe(BunFileSystem.layer, testLayer());
});
