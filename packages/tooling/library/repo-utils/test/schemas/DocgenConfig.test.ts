import {
  CanonicalDocgenConfig,
  CanonicalDocgenExamplesCompilerOptions,
  mergeManagedDocgenConfig,
} from "@beep/repo-utils/schemas/DocgenConfig";
import { describe, expect, it } from "@effect/vitest";

const canonical = CanonicalDocgenConfig.make({
  $schema: "../../packages/tooling/tool/docgen/schema.json",
  exclude: ["src/internal/**/*.ts"],
  srcLink: "https://github.com/beep-effect/beep-effect/tree/main/packages/example/src/",
  examplesCompilerOptions: CanonicalDocgenExamplesCompilerOptions.make({
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    moduleResolution: "bundler",
    module: "es2022",
    target: "es2022",
    lib: ["ESNext"],
    rewriteRelativeImportExtensions: true,
    allowImportingTsExtensions: true,
    moduleDetection: "force",
    verbatimModuleSyntax: true,
    allowJs: false,
    erasableSyntaxOnly: true,
    declaration: true,
    declarationMap: true,
    sourceMap: true,
    exactOptionalPropertyTypes: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
    noImplicitOverride: true,
    noFallthroughCasesInSwitch: true,
    stripInternal: false,
    noErrorTruncation: true,
    types: [],
    jsx: "react-jsx",
    paths: {
      "@beep/example": ["./packages/example/src/index.ts"],
    },
  }),
});

describe("mergeManagedDocgenConfig", () => {
  it("preserves custom compiler settings and lets canonical paths win collisions", () => {
    const merged = mergeManagedDocgenConfig(
      {
        examplesCompilerOptions: {
          module: "preserve",
          paths: {
            "@beep/example": ["./stale.ts"],
            "@custom/*": ["./custom/*"],
          },
          types: ["node"],
        },
        srcDir: "generated",
        srcLink: "https://example.test/custom-source/",
      },
      canonical
    );

    expect(merged).toMatchObject({
      examplesCompilerOptions: {
        module: "preserve",
        paths: {
          "@beep/example": ["./packages/example/src/index.ts"],
          "@custom/*": ["./custom/*"],
        },
        types: ["node"],
      },
      exclude: ["src/internal/**/*.ts"],
      srcLink: "https://example.test/custom-source/",
    });
  });

  it("uses managed defaults for a standard source directory", () => {
    const merged = mergeManagedDocgenConfig(
      {
        srcDir: "src",
        srcLink: "https://example.test/stale-source/",
      },
      canonical
    );

    expect(merged).toMatchObject({
      examplesCompilerOptions: {
        module: "es2022",
        paths: {
          "@beep/example": ["./packages/example/src/index.ts"],
        },
        types: [],
      },
      exclude: ["src/internal/**/*.ts"],
      srcLink: canonical.srcLink,
    });
  });
});
