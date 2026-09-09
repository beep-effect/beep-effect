import { collectSchemaTopologyViolations } from "@beep/repo-cli/test/Lint";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect } from "effect";
import { expect } from "vitest";
import { withTempWorkingDirectory, writeProjectFile } from "./support/CommandTest.ts";

const encodeJson = UnknownFromJsonString.encodeUnknownSync;

layer(NodeServices.layer)("schema topology lint", (it) => {
  it.effect(
    "keeps @beep/schema on the canonical topology",
    Effect.fn("SchemaTopologyTest.keepsCanonicalTopology")(function* () {
      const violations = yield* collectSchemaTopologyViolations();
      expect(violations).toEqual([]);
    })
  );

  it.effect(
    "reports retired exports, aliases, directories, shims, and cross-concept barrels",
    Effect.fn("SchemaTopologyTest.reportsRetiredTopology")(function* () {
      yield* withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeProjectFile(
            "tsconfig.json",
            encodeJson({
              compilerOptions: {
                paths: {
                  "@beep/schema/color": ["packages/foundation/modeling/schema/src/color/index.ts"],
                  "@beep/schema/Http": ["packages/foundation/modeling/schema/src/Http/index.ts"],
                  "@beep/schema/internal/markdown": ["packages/foundation/modeling/schema/src/internal/markdown.ts"],
                },
              },
            })
          );
          yield* writeProjectFile(
            "packages/foundation/modeling/schema/package.json",
            encodeJson({
              exports: {
                "./color": "./src/color/index.ts",
                "./ExpectCT": "./src/ExpectCT/index.ts",
                "./Http": "./src/Http/index.ts",
                "./internal/markdown": "./src/internal/markdown.ts",
                "./private-role": "./src/Example/Example.schema.ts",
              },
              publishConfig: {
                exports: { "./person/*": "./dist/person/*.js" },
              },
            })
          );
          yield* writeProjectFile("packages/foundation/modeling/schema/src/color/index.ts", "export {};\n");
          yield* writeProjectFile("packages/foundation/modeling/schema/src/Glob.ts", "export {};\n");
          yield* writeProjectFile(
            "packages/foundation/modeling/schema/src/Example/index.ts",
            'export * from "../Sibling/index.ts";\n'
          );

          const violations = yield* collectSchemaTopologyViolations();
          const details = A.map(violations, (violation) => violation.detail);

          expect(details).toEqual(
            expect.arrayContaining([
              expect.stringContaining("retired lowercase schema subpath"),
              expect.stringContaining("retired compatibility casing subpath"),
              expect.stringContaining("retired schema suite aggregator"),
              expect.stringContaining("retired public schema parser seam"),
              expect.stringContaining("private role file"),
              expect.stringContaining("root shim file"),
              expect.stringContaining("sibling concept modules"),
              expect.stringContaining("root tsconfig contains retired lowercase"),
            ])
          );
        })
      );
    })
  );
});
