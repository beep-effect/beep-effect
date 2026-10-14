import {
  formatRetiredEffectPathFinding,
  isAllowlisted,
  RetiredEffectPathFinding,
  retiredEffectPathMappings,
  retiredEffectPathsAllowlist,
  scanText,
  suggestRetiredEffectPath,
} from "@beep/repo-cli/test/Laws";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";

const scanOne = (content: string) => scanText("fixture.md", content);
const matchesOf = (content: string) => A.map(scanOne(content), (finding) => finding.match);
const suggestionsOf = (content: string) => A.map(scanOne(content), (finding) => finding.suggestion);

describe("retired Effect module path law", () => {
  describe("module-specifier rule", () => {
    it.effect("reports a retired import specifier with its subpath", () =>
      Effect.sync(() => {
        const findings = scanOne('import { HttpClient } from "effect/unstable/http/HttpClient"\n');
        expect(A.map(findings, (finding) => [finding.rule, finding.match, finding.suggestion])).toEqual([
          ["module-specifier", "effect/unstable/http/HttpClient", "effect/http/HttpClient"],
        ]);
      })
    );

    it.effect("reports the wildcard export pattern", () =>
      Effect.sync(() => {
        expect(suggestionsOf('"./*": "effect/unstable/*"')).toEqual(["effect/*"]);
      })
    );

    it.effect("reports a bare namespace mention", () =>
      Effect.sync(() => {
        expect(suggestionsOf("the effect/unstable namespace")).toEqual(["effect/<module>"]);
      })
    );

    it.effect("does not double-report the source-path span inside a specifier", () =>
      Effect.sync(() => {
        const findings = scanOne('from "effect/unstable/sql"');
        expect(A.map(findings, (finding) => finding.rule)).toEqual(["module-specifier"]);
      })
    );
  });

  describe("source-path rule", () => {
    it.effect("reports a retired source directory and drops the unstable segment", () =>
      Effect.sync(() => {
        const findings = scanOne("packages/effect/src/unstable/cli/Command.ts\n");
        expect(A.map(findings, (finding) => [finding.rule, finding.match, finding.suggestion])).toEqual([
          ["source-path", "unstable/cli", "cli"],
        ]);
      })
    );

    it.effect("reports every module in the retired namespace", () =>
      Effect.sync(() => {
        const modules = ["ai", "cluster", "devtools", "encoding", "eventlog", "net", "observability"];
        const more = ["persistence", "process", "reactivity", "rpc", "schema", "socket", "workers", "workflow"];
        for (const module of A.appendAll(modules, more)) {
          expect(suggestionsOf(`dist/unstable/${module}/index.js`)).toEqual([module]);
        }
      })
    );
  });

  describe("suggestion exceptions", () => {
    it.effect("renames httpapi to http-api in both rules", () =>
      Effect.sync(() => {
        expect(suggestionsOf('from "effect/unstable/httpapi"')).toEqual(["effect/http-api"]);
        expect(suggestionsOf('from "effect/unstable/httpapi/HttpApiBuilder"')).toEqual([
          "effect/http-api/HttpApiBuilder",
        ]);
        expect(suggestionsOf("src/unstable/httpapi/HttpApi.ts")).toEqual(["http-api"]);
      })
    );

    it.effect("folds the arbitrary barrel into effect/Arbitrary", () =>
      Effect.sync(() => {
        expect(suggestionsOf('from "effect/unstable/arbitrary"')).toEqual(["effect/Arbitrary"]);
        expect(suggestionsOf('from "effect/unstable/arbitrary/Arbitrary"')).toEqual(["effect/Arbitrary"]);
        expect(suggestionsOf('from "effect/unstable/arbitrary/index"')).toEqual(["effect/Arbitrary"]);
      })
    );

    it.effect("moves the arbitrary module file up out of its directory", () =>
      Effect.sync(() => {
        expect(suggestionsOf("packages/effect/src/unstable/arbitrary/Arbitrary.ts")).toEqual(["Arbitrary.ts"]);
        expect(suggestionsOf("packages/effect/dist/unstable/arbitrary/Arbitrary.d.ts")).toEqual(["Arbitrary.d.ts"]);
        expect(suggestionsOf("packages/effect/dist/unstable/arbitrary/Arbitrary.js")).toEqual(["Arbitrary.js"]);
        expect(suggestionsOf("packages/effect/test/unstable/arbitrary/Fuzz.test.ts")).toEqual(["arbitrary"]);
      })
    );

    it.effect("keeps the suggestion table total", () =>
      Effect.sync(() => {
        expect(suggestRetiredEffectPath("unstable/rpc", "source-path")).toBe("rpc");
        expect(suggestRetiredEffectPath("effect/unstable/rpc", "module-specifier")).toBe("effect/rpc");
        expect(suggestRetiredEffectPath("not-retired", "source-path")).toBe("not-retired");
        expect(pipe("unstable/httpapi", suggestRetiredEffectPath("source-path"))).toBe("http-api");
        expect(pipe("fixture.md", scanText("unstable/rpc"))).toEqual(scanOne("unstable/rpc"));
        expect(A.length(retiredEffectPathMappings)).toBeGreaterThan(0);
      })
    );
  });

  describe("non-matches", () => {
    it.effect("ignores unstable paths that are not Effect module paths", () =>
      Effect.sync(() => {
        expect(matchesOf("node_modules/typescript/unstable/ast")).toEqual([]);
        expect(matchesOf("https://manpages.debian.org/unstable/systemd/systemd.1.en.html")).toEqual([]);
        expect(matchesOf("git status: clean/unstable/blocked")).toEqual([]);
        expect(matchesOf(" * @stability unstable")).toEqual([]);
        expect(matchesOf('"unstableApiUsage": "off"')).toEqual([]);
      })
    );

    it.effect("ignores a module name glued to a word or hyphen", () =>
      Effect.sync(() => {
        expect(matchesOf("not-unstable/http and xunstable/http")).toEqual([]);
        expect(matchesOf("unstable/httpclient")).toEqual([]);
      })
    );
  });

  describe("positions", () => {
    it.effect("reports 1-based line and column for each finding", () =>
      Effect.sync(() => {
        const content = "# Title\n\nUse `effect/unstable/rpc` here.\r\nThen src/unstable/sql too.\n";
        const findings = scanText("docs/page.md", content);
        expect(findings).toEqual([
          RetiredEffectPathFinding.make({
            file: "docs/page.md",
            line: 3,
            column: 6,
            match: "effect/unstable/rpc",
            rule: "module-specifier",
            suggestion: "effect/rpc",
          }),
          RetiredEffectPathFinding.make({
            file: "docs/page.md",
            line: 4,
            column: 10,
            match: "unstable/sql",
            rule: "source-path",
            suggestion: "sql",
          }),
        ]);
      })
    );

    it.effect("reports the first character of a file as 1:1", () =>
      Effect.sync(() => {
        const [finding] = scanOne("unstable/workflow");
        expect([finding?.line, finding?.column]).toEqual([1, 1]);
      })
    );

    it.effect("formats a finding as a report line", () =>
      Effect.sync(() => {
        const lines = A.map(scanText("demo.md", "see unstable/httpapi\n"), formatRetiredEffectPathFinding);
        expect(lines).toEqual(["demo.md:1:5  unstable/httpapi  →  http-api"]);
      })
    );
  });

  describe("allowlist", () => {
    it.effect("skips the vendored patches, the canonical record, and gitleaks fingerprints", () =>
      Effect.sync(() => {
        expect(isAllowlisted("patches/drizzle-orm@1.0.0.patch")).toBe(true);
        expect(isAllowlisted(".patterns/effect-module-paths.md")).toBe(true);
        expect(isAllowlisted(".gitleaksignore")).toBe(true);
      })
    );

    it.effect("skips the law's own model, scanner, and test", () =>
      Effect.sync(() => {
        for (const file of retiredEffectPathsAllowlist.exactPaths) {
          expect(isAllowlisted(file)).toBe(true);
        }
        expect(isAllowlisted("packages/tooling/tool/cli/test/laws-retired-effect-paths.test.ts")).toBe(true);
      })
    );

    it.effect("scans everything else, including near-miss paths", () =>
      Effect.sync(() => {
        expect(isAllowlisted(".patterns/README.md")).toBe(false);
        expect(isAllowlisted("docs/patches/notes.md")).toBe(false);
        expect(isAllowlisted("patches")).toBe(false);
        expect(isAllowlisted(".gitleaksignore.bak")).toBe(false);
      })
    );
  });
});
