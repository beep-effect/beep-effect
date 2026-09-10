import { TsMorphProjectInspectionRequest } from "@beep/repo-utils/TSMorph/index";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";

const decodeProjectInspectionRequest = S.decodeUnknownEffect(TsMorphProjectInspectionRequest);

describe("TsMorphProjectInspectionRequest.packageSyntax", () => {
  it.effect(
    "requests a syntax-only, workspace-only project over explicit files without the tsconfig include list",
    Effect.fnUntraced(function* () {
      const request = yield* TsMorphProjectInspectionRequest.packageSyntax(
        "/repo",
        "packages/demo/tsconfig.test.json",
        ["/repo/packages/demo/src/index.ts"]
      );
      expect(request.mode).toBe("syntax");
      expect(request.referencePolicy).toBe("workspaceOnly");
      expect(request.loadTsconfigFiles).toBe(false);
      expect(request.filePaths).toEqual([]);
      expect(request.sourceFileGlobs).toEqual(["/repo/packages/demo/src/index.ts"]);
      expect(request.entrypoint).toEqual({ _tag: "tsconfig", tsConfigPath: "packages/demo/tsconfig.test.json" });
    })
  );

  it.effect(
    "loads tsconfig files by default when a request omits the flag",
    Effect.fnUntraced(function* () {
      const request = yield* decodeProjectInspectionRequest({
        entrypoint: { _tag: "tsconfig", tsConfigPath: "packages/demo/tsconfig.json" },
        repoRootPath: "/repo",
        mode: "syntax",
        referencePolicy: "workspaceOnly",
        filePaths: [],
        sourceFileGlobs: [],
      });
      expect(request.loadTsconfigFiles).toBe(true);
    })
  );
});
