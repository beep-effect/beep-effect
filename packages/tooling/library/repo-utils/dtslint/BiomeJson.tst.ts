import { renderBiomeJson } from "@beep/repo-utils/schemas/BiomeJson";
import { describe, expect, it } from "tstyche";
import type { DomainError } from "@beep/repo-utils";
import type { Effect, FileSystem, Path } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";

describe("BiomeJson", () => {
  it("declares every platform service required to render JSON", () => {
    expect(renderBiomeJson("package.json", { private: true })).type.toBe<
      Effect.Effect<string, DomainError, FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner>
    >();
  });
});
