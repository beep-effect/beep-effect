import { DeprecatedApisESLintConfig } from "@beep/repo-configs/eslint/DeprecatedApisESLintConfig";
import { DocsESLintConfig } from "@beep/repo-configs/eslint/DocsESLintConfig";
import { A, Str } from "@beep/utils";
import { describe, expect, it } from "vitest";

const configIncludesPlugin = (pluginName: string): boolean =>
  A.some(DocsESLintConfig, (entry) => entry.plugins !== undefined && pluginName in entry.plugins);

describe("docs-eslint-config", () => {
  it("does not register the legacy beep-laws plugin", () => {
    expect(configIncludesPlugin("beep-laws")).toBe(false);
  });

  it("keeps jsdoc and tsdoc plugins available for the docs lane", () => {
    expect(configIncludesPlugin("jsdoc")).toBe(true);
    expect(configIncludesPlugin("beep-jsdoc")).toBe(true);
    expect(configIncludesPlugin("eslint-plugin-tsdoc")).toBe(true);
  });

  // Labs ceremony/law asymmetry (goals/lab-apps-lifecycle D2): the docs
  // (ceremony) profile ignores apps/labs globally, while the deprecated-apis
  // LAW profile must keep linting it. A future refactor must not silently
  // exempt labs from the law lane.
  it("ignores apps/labs in the docs (ceremony) profile via global ignores", () => {
    const globalEntry = DocsESLintConfig[0];
    expect(globalEntry?.files).toBeUndefined();
    expect(globalEntry?.ignores).toContain("apps/labs/**");
  });

  it("keeps apps/labs under the deprecated-apis LAW profile", () => {
    const allIgnores = A.flatMap(DeprecatedApisESLintConfig, (entry) => entry.ignores ?? A.empty<string>());
    expect(A.some(allIgnores, Str.includes("apps/labs"))).toBe(false);
  });
});
