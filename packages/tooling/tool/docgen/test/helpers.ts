import type * as Configuration from "@beep/repo-docgen/Configuration";

export const defaultDocgenConfig: Configuration.ConfigurationShape = {
  projectName: "docgen",
  projectHomepage: "https://github.com/effect-ts/docgen",
  srcLink: "https://github.com/effect-ts/docgen/blob/main/src/",
  srcDir: "src",
  outDir: "docs",
  theme: "mikearnaldi/just-the-docs",
  enableSearch: true,
  enforceDescriptions: false,
  enforceExamples: false,
  enforceVersion: true,
  tscExecutable: "tsc",
  include: [],
  exclude: [],
  parseCompilerOptions: {},
  examplesCompilerOptions: {},
};
