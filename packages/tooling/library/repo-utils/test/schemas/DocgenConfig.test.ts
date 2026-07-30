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
  }),
});

describe("mergeManagedDocgenConfig", () => {
  it("preserves custom compiler settings, prunes managed path mappings, and keeps custom aliases", () => {
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
          "@custom/*": ["./custom/*"],
        },
        types: ["node"],
      },
      exclude: ["src/internal/**/*.ts"],
      srcLink: "https://example.test/custom-source/",
    });
    expect(
      (merged as { readonly examplesCompilerOptions?: { readonly paths?: Record<string, unknown> } })
        .examplesCompilerOptions?.paths
    ).not.toHaveProperty("@beep/example");
  });

  it("drops the paths key entirely when only managed aliases exist", () => {
    const merged = mergeManagedDocgenConfig(
      {
        examplesCompilerOptions: {
          paths: {
            "@beep/example": ["./stale.ts"],
          },
        },
      },
      canonical
    );

    expect(merged.examplesCompilerOptions).not.toHaveProperty("paths");
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
        types: [],
      },
      exclude: ["src/internal/**/*.ts"],
      srcLink: canonical.srcLink,
    });
    expect(merged.examplesCompilerOptions).not.toHaveProperty("paths");
  });
});
