import { readSignature } from "@beep/repo-utils/TSMorph/TSMorph.shared";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { Project } from "ts-morph";

describe("TSMorph.shared", () => {
  describe("readSignature", () => {
    it("strips multiline decorator spans before reading the declaration signature", () => {
      const project = new Project({
        compilerOptions: {
          experimentalDecorators: true,
        },
        useInMemoryFileSystem: true,
      });
      const sourceFile = project.createSourceFile(
        "decorated.ts",
        `@trace()
@config({
  nested: {
    enabled: true,
  },
})
export class DecoratedThing {}`
      );
      const declaration = sourceFile.getClassOrThrow("DecoratedThing");

      expect(readSignature(declaration)).toBe("export class DecoratedThing {}");
    });
  });
});
