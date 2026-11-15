import {
  GitHubAppName,
  gitHubAppManifestPath,
  KnowledgeRefsRewriteRulesPath,
  ReferencesManifestPath,
} from "@beep/repo-configs/PolicyData";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";

describe("PolicyData", () => {
  it("locates every data file under this package's data directory", () => {
    const paths = [
      ReferencesManifestPath,
      KnowledgeRefsRewriteRulesPath,
      ...A.map(GitHubAppName.literals, gitHubAppManifestPath),
    ];
    expect(paths).toEqual([
      "packages/tooling/policy-pack/repo-configs/data/references.json",
      "packages/tooling/policy-pack/repo-configs/data/knowledge-refs-rewrite.rules.json",
      "packages/tooling/policy-pack/repo-configs/data/github-apps/beep-reviewer.manifest.json",
      "packages/tooling/policy-pack/repo-configs/data/github-apps/beep-knowledge-mint.manifest.json",
      "packages/tooling/policy-pack/repo-configs/data/github-apps/beep-infra-github.manifest.json",
    ]);
  });

  it("recognizes only the registered GitHub Apps", () => {
    expect(GitHubAppName.is["beep-knowledge-mint"]("beep-knowledge-mint")).toBe(true);
    expect(GitHubAppName.is["beep-reviewer"]("beep-knowledge-mint")).toBe(false);
    expect(GitHubAppName.is["beep-infra-github"]("beep-infra-github")).toBe(true);
  });
});
