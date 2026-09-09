import { testLayer } from "@beep/test-utils/FileSystemConformance";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import { describe } from "@effect/vitest";

describe("FileSystem conformance (NodeFileSystem)", () => {
  testLayer(NodeFileSystem.layer);
});
