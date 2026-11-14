import {
  formatRetiredIriAuthorityFinding,
  isPublicOriginAllowlisted,
  isPublicOriginScoped,
  isRetiredIriAuthorityExempt,
  RetiredIriAuthorityFinding,
  retiredIriAuthorities,
  retiredIriAuthoritiesScope,
  retiredIriAuthorityPrefilter,
  scanPublicOriginLiterals,
  scanRetiredIriAuthorityFile,
  scanRetiredIriAuthorityText,
} from "@beep/repo-cli/test/Laws";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Str from "effect/String";

// Hosts are assembled from labels so this file never spells a retired host or
// the public origin; a repository-wide text search for them stays clean.
const host = (...labels: ReadonlyArray<string>): string => A.join(labels, ".");
const joinLines = (lines: ReadonlyArray<string>): string => A.join(lines, "\n");
const NS_HOST = host("ns", "beep", "sh");
const APEX_SH = host("beep", "sh");
const DEV_HOST = host("beep", "dev");
const EFFECT_DEV_HOST = host("beep-effect", "dev");
const ORIGIN_HOST = host("beep-effect", "com");
const ORIGIN = `https://${ORIGIN_HOST}`;

const matchesOf = (content: string) =>
  A.map(scanRetiredIriAuthorityText("fixture.md", content), (finding) => finding.match);
const originMatchesOf = (file: string, content: string) =>
  A.map(scanPublicOriginLiterals(file, content), (finding) => finding.match);

describe("retired IRI authority law", () => {
  describe("rule 1: retired authorities", () => {
    it.effect("reports every retired host after an https scheme", () =>
      Effect.sync(() => {
        for (const retired of [NS_HOST, APEX_SH, DEV_HOST, EFFECT_DEV_HOST]) {
          expect(matchesOf(`see https://${retired}/a/b\n`)).toEqual([`https://${retired}`]);
        }
      })
    );

    it.effect("reports the http scheme and the protocol-relative form", () =>
      Effect.sync(() => {
        expect(matchesOf(`http://${DEV_HOST}/x and //${NS_HOST}/y`)).toEqual([`http://${DEV_HOST}`, `//${NS_HOST}`]);
      })
    );

    it.effect("reports a scheme-less host followed by a path", () =>
      Effect.sync(() => {
        expect(matchesOf(`IRIs under ${NS_HOST}/patent/Claim`)).toEqual([NS_HOST]);
      })
    );

    it.effect("reports a bare host in prose and in a quoted string", () =>
      Effect.sync(() => {
        expect(matchesOf(`we never owned ${APEX_SH}.`)).toEqual([APEX_SH]);
        expect(matchesOf(`host = "${EFFECT_DEV_HOST}"`)).toEqual([EFFECT_DEV_HOST]);
      })
    );

    it.effect("reports an email domain under a retired host", () =>
      Effect.sync(() => {
        const findings = scanRetiredIriAuthorityText("story.tsx", `placeholder="team@${DEV_HOST}"`);
        expect(A.map(findings, (finding) => [finding.match, finding.suggestion])).toEqual([
          [`@${DEV_HOST}`, "use an RFC 2606 example.com address"],
        ]);
      })
    );

    it.effect("reports subdomains of a retired host after a scheme or in an email", () =>
      Effect.sync(() => {
        expect(matchesOf(`https://www.${DEV_HOST}/x //api.${APEX_SH}/y ops@mail.${EFFECT_DEV_HOST}`)).toEqual([
          `https://www.${DEV_HOST}`,
          `//api.${APEX_SH}`,
          `@mail.${EFFECT_DEV_HOST}`,
        ]);
      })
    );

    it.effect("reports a bare subdomain of a retired host followed by a path", () =>
      Effect.sync(() => {
        expect(matchesOf(`see www.${DEV_HOST}/x and x.${NS_HOST}/a`)).toEqual([`www.${DEV_HOST}`, `x.${NS_HOST}`]);
      })
    );

    it.effect("reports a bare subdomain of a retired host with no path", () =>
      Effect.sync(() => {
        expect(matchesOf(`see docs.${DEV_HOST} for more`)).toEqual([`docs.${DEV_HOST}`]);
        expect(matchesOf(`host: api.${EFFECT_DEV_HOST}`)).toEqual([`api.${EFFECT_DEV_HOST}`]);
        expect(matchesOf(`config.${DEV_HOST}`)).toEqual([`config.${DEV_HOST}`]);
      })
    );

    it.effect("reports JSON-escaped and percent-encoded IRIs", () =>
      Effect.sync(() => {
        expect(matchesOf(`{"iri":"https:\\/\\/${NS_HOST}\\/a"} ?u=https%3A%2F%2F${DEV_HOST}%2Fb`)).toEqual([
          `https:\\/\\/${NS_HOST}`,
          `https%3A%2F%2F${DEV_HOST}`,
        ]);
      })
    );

    it.effect("reports the namespace host once, not also its apex", () =>
      Effect.sync(() => {
        expect(matchesOf(`https://${NS_HOST}/epistemic/Claim`)).toEqual([`https://${NS_HOST}`]);
      })
    );

    it.effect("is case-insensitive like DNS", () =>
      Effect.sync(() => {
        expect(matchesOf(`https://${Str.toUpperCase(DEV_HOST)}/A`)).toEqual([`https://${Str.toUpperCase(DEV_HOST)}`]);
      })
    );

    it.effect("suggests the public origin for IRIs and a defanged host for prose", () =>
      Effect.sync(() => {
        expect(
          A.map(scanRetiredIriAuthorityText("a.md", `https://${NS_HOST}/x`), (finding) => finding.suggestion)
        ).toEqual([`${ORIGIN}/ns/<path> (derive with $I from @beep/identity)`]);
        expect(
          A.map(scanRetiredIriAuthorityText("a.md", `the ${APEX_SH} host`), (finding) => finding.suggestion)
        ).toEqual(["defang the host in prose (beep[.]sh) or derive the IRI with $I from @beep/identity"]);
        expect(
          A.map(
            scanRetiredIriAuthorityText(
              "a.json",
              `{"iri":"https:\\/\\/${NS_HOST}\\/a"} ?u=https%3a%2f%2f${DEV_HOST}%2fb`
            ),
            (finding) => finding.suggestion
          )
        ).toEqual([
          `${ORIGIN}/ns/<path> (derive with $I from @beep/identity)`,
          `${ORIGIN}/ns/<path> (derive with $I from @beep/identity)`,
        ]);
      })
    );

    it.effect("ignores lookalike names, file paths, and subdomains of other hosts", () =>
      Effect.sync(() => {
        for (const content of [
          `${DEV_HOST}tools`,
          `https://${DEV_HOST}tools.example/`,
          `a${DEV_HOST}`,
          `x-${DEV_HOST}`,
          `https://${NS_HOST}op/`,
          `https://${DEV_HOST}.example/`,
          `scripts/${APEX_SH}`,
          `./${APEX_SH}`,
          `https://example.com/${DEV_HOST}`,
          `@beep/identity`,
          `https://${ORIGIN_HOST}/ns/`,
        ]) {
          expect(matchesOf(content), content).toEqual([]);
        }
      })
    );

    it.effect("records 1-based positions across CRLF lines", () =>
      Effect.sync(() => {
        const [finding] = scanRetiredIriAuthorityText("a.md", `first\r\nsecond https://${DEV_HOST}/x\r\n`);
        expect([finding?.line, finding?.column]).toEqual([2, 8]);
      })
    );

    it.effect("formats a finding as a report line", () =>
      Effect.sync(() => {
        const finding = RetiredIriAuthorityFinding.make({
          file: "a.md",
          line: 2,
          column: 8,
          match: "//old.example",
          rule: "retired-authority",
          suggestion: "replace",
        });
        expect(formatRetiredIriAuthorityFinding(finding)).toBe("a.md:2:8  //old.example  →  replace");
      })
    );

    it.effect("keeps the host table free of spelled-out hosts", () =>
      Effect.sync(() => {
        expect(A.map(retiredIriAuthorities, (row) => A.join(row.labels, "."))).toEqual([
          EFFECT_DEV_HOST,
          NS_HOST,
          DEV_HOST,
          APEX_SH,
        ]);
      })
    );
  });

  // LINT-04 S2 parity gate (goals/heavy-pool-diet): the pre-filter is generated from the rows, and it
  // never drops a file the rule would report.
  describe("rule 1 pre-filter", () => {
    // The two pre-filters it replaced, kept here to show the findings did not move:
    // #3019's hand-written host shape and the `beep` substring before it.
    const HAND_WRITTEN_PREFILTER = /beep(?:-effect)?\.(?:dev|sh)/iu;
    const SUBSTRING_PREFILTER = /beep/iu;
    const rowHosts = A.map(retiredIriAuthorities, (row) => A.join(row.labels, "."));
    const IRI_SUGGESTION = `${ORIGIN}/ns/<path> (derive with $I from @beep/identity)`;
    const EMAIL_SUGGESTION = "use an RFC 2606 example.com address";
    const proseSuggestion = (match: string) =>
      `defang the host in prose (${pipe(match, Str.replaceAll(".", "[.]"))}) or derive the IRI with $I from @beep/identity`;
    const finding = (column: number, match: string, suggestion: string) =>
      RetiredIriAuthorityFinding.make({
        file: "fixture.md",
        line: 1,
        column,
        match,
        rule: "retired-authority",
        suggestion,
      });

    it.effect("is the alternation of the escaped row hosts under the rule's flags", () =>
      Effect.sync(() => {
        expect(retiredIriAuthorityPrefilter.source).toBe(
          A.join(
            A.map(rowHosts, (retired) => pipe(retired, Str.replaceAll(".", String.raw`\.`))),
            "|"
          )
        );
        expect(retiredIriAuthorityPrefilter.flags).toBe("iu");
      })
    );

    it.effect("matches every retired-host row in every case", () =>
      Effect.sync(() => {
        expect(rowHosts).toEqual([EFFECT_DEV_HOST, NS_HOST, DEV_HOST, APEX_SH]);
        for (const retired of rowHosts) {
          for (const spelling of [retired, Str.toUpperCase(retired), `docs.${retired}`]) {
            expect(retiredIriAuthorityPrefilter.test(spelling), spelling).toBe(true);
          }
        }
      })
    );

    it.effect("keeps the exact findings for each host in every authority form", () =>
      Effect.sync(() => {
        const cases = A.flatMap(rowHosts, (retired) => {
          const upper = Str.toUpperCase(retired);
          return [
            [`see https://${retired}/a`, [finding(5, `https://${retired}`, IRI_SUGGESTION)]],
            [`x HTTPS%3A%2F%2F${upper}/a`, [finding(3, `HTTPS%3A%2F%2F${upper}`, IRI_SUGGESTION)]],
            [`{"id":"https:\\/\\/${retired}\\/a"}`, [finding(8, `https:\\/\\/${retired}`, IRI_SUGGESTION)]],
            [`mail me@docs.${retired}`, [finding(8, `@docs.${retired}`, EMAIL_SUGGESTION)]],
            [`we never owned ${retired}.`, [finding(16, retired, proseSuggestion(retired))]],
          ] as const;
        });
        expect(cases).toHaveLength(20);
        for (const [content, expected] of cases) {
          expect(scanRetiredIriAuthorityText("fixture.md", content), content).toEqual(expected);
          // Both earlier pre-filters admit the same text, so they reached the same rule and findings.
          expect(HAND_WRITTEN_PREFILTER.test(content), content).toBe(true);
          expect(SUBSTRING_PREFILTER.test(content), content).toBe(true);
        }
      })
    );

    it.effect("shares the rule's Unicode case folding", () =>
      Effect.sync(() => {
        // U+017F LATIN SMALL LETTER LONG S folds to `s` under `iu`, so the rule reports it.
        const content = `see ${host("beep", "ſh")} now`;
        expect(retiredIriAuthorityPrefilter.test(content)).toBe(true);
        expect(scanRetiredIriAuthorityText("fixture.md", content)).toEqual([
          finding(5, host("beep", "ſh"), proseSuggestion(host("beep", "ſh"))),
        ]);
      })
    );

    it.effect("rejects text that names no retired host, which the rule never reports", () =>
      Effect.sync(() => {
        const negative = `the ${host("beep-effect", "sh")} mirror, beep_dev, beep-dev and the beep CLI`;
        expect(retiredIriAuthorityPrefilter.test(negative)).toBe(false);
        // The hand-written shape admitted this text; the rule found nothing in it either way.
        expect(HAND_WRITTEN_PREFILTER.test(negative)).toBe(true);
        expect(scanRetiredIriAuthorityText("fixture.md", negative)).toEqual([]);
        // A longer DNS name passes the pre-filter, and the rule still reports nothing.
        const longer = `see ${host("beep", "devtools")}`;
        expect(retiredIriAuthorityPrefilter.test(longer)).toBe(true);
        expect(scanRetiredIriAuthorityText("fixture.md", longer)).toEqual([]);
      })
    );
  });

  describe("exemptions", () => {
    it.effect("exempts any history directory at any depth", () =>
      Effect.sync(() => {
        for (const file of ["history/a.md", "goals/x/history/a.md", "explorations/y/history/deep/b.jsonl"]) {
          expect(isRetiredIriAuthorityExempt(file), file).toBe(true);
        }
      })
    );

    it.effect("exempts the top-level research tree only", () =>
      Effect.sync(() => {
        expect(isRetiredIriAuthorityExempt("research/ledger/claims.jsonl")).toBe(true);
        expect(isRetiredIriAuthorityExempt("goals/x/research/notes.md")).toBe(false);
        expect(isRetiredIriAuthorityExempt("explorations/y/research/04.md")).toBe(false);
      })
    );

    it.effect("does not exempt near-miss names", () =>
      Effect.sync(() => {
        for (const file of ["goals/x/historyx/a.md", "goals/x/history.md", "researchers/a.md", "docs/history"]) {
          expect(isRetiredIriAuthorityExempt(file), file).toBe(false);
        }
      })
    );

    it.effect("scanRetiredIriAuthorityFile skips exempt paths for both rules", () =>
      Effect.sync(() => {
        expect(scanRetiredIriAuthorityFile("goals/x/history/a.md", `https://${DEV_HOST}/a`)).toEqual([]);
        expect(scanRetiredIriAuthorityFile("research/a.md", `https://${DEV_HOST}/a`)).toEqual([]);
        expect(A.length(scanRetiredIriAuthorityFile("goals/x/research/a.md", `https://${DEV_HOST}/a`))).toBe(1);
      })
    );
  });

  describe("rule 2: public-origin literals", () => {
    it.effect("reports the origin inside a string literal in code", () =>
      Effect.sync(() => {
        const findings = scanPublicOriginLiterals("packages/x/src/a.ts", `export const docs = "${ORIGIN}/docs";\n`);
        expect(A.map(findings, (finding) => [finding.rule, finding.match, finding.line, finding.column])).toEqual([
          ["public-origin-literal", ORIGIN, 1, 22],
        ]);
      })
    );

    it.effect("orders findings of both rules on one line by column", () =>
      Effect.sync(() => {
        const findings = scanRetiredIriAuthorityFile(
          "packages/x/src/a.ts",
          `export const docs = "${ORIGIN}/docs"; // was https://${DEV_HOST}/docs\n`
        );
        expect(A.map(findings, (finding) => [finding.rule, finding.line])).toEqual([
          ["public-origin-literal", 1],
          ["retired-authority", 1],
        ]);
      })
    );

    it.effect("parses JSX and plain JavaScript sources with their own script kinds", () =>
      Effect.sync(() => {
        const literal = `export const docs = "${ORIGIN}/docs";\n`;
        expect(A.length(scanPublicOriginLiterals("packages/x/src/a.jsx", literal))).toBe(1);
        expect(A.length(scanPublicOriginLiterals("packages/x/src/a.mjs", literal))).toBe(1);
      })
    );

    it.effect("reports the origin in template heads, middles, tails, and no-substitution templates", () =>
      Effect.sync(() => {
        const source = joinLines([
          `const a = \`${ORIGIN}/ns/\${x}\`;`,
          `const b = \`\${x}${ORIGIN}/y\`;`,
          `const c = \`\${x}/\${y}${ORIGIN}\`;`,
          `const d = \`${ORIGIN}\`;`,
        ]);
        expect(A.length(scanPublicOriginLiterals("packages/x/src/a.ts", source))).toBe(4);
      })
    );

    it.effect("reports http, www, and JSX text", () =>
      Effect.sync(() => {
        const source = `const a = "http://${ORIGIN_HOST}";\nconst b = "https://www.${ORIGIN_HOST}/";\nconst c = <a>${ORIGIN}</a>;\n`;
        expect(originMatchesOf("apps/web/src/a.tsx", source)).toEqual([
          `http://${ORIGIN_HOST}`,
          `https://www.${ORIGIN_HOST}`,
          ORIGIN,
        ]);
      })
    );

    it.effect("ignores line and block comments", () =>
      Effect.sync(() => {
        const source = `// ${ORIGIN}/a\n/** ${ORIGIN}/b */\nconst ok = 1; /* ${ORIGIN} */\n`;
        expect(originMatchesOf("packages/x/src/a.ts", source)).toEqual([]);
      })
    );

    it.effect("ignores service subdomains and lookalike names", () =>
      Effect.sync(() => {
        const source = `const a = "https://docs.${ORIGIN_HOST}/";\nconst b = "${ORIGIN}munity";\nconst c = "${ORIGIN}.example";\n`;
        expect(originMatchesOf("packages/x/src/a.ts", source)).toEqual([]);
      })
    );

    it.effect("scopes code under the code roots at any depth, package-root configs included", () =>
      Effect.sync(() => {
        for (const file of [
          "packages/x/src/a.ts",
          "apps/web/vite.config.ts",
          "apps/web/.storybook/main.mjs",
          "scripts/build.cjs",
          "tools/a.js",
          "infra/deploy.mts",
        ]) {
          expect(isPublicOriginScoped(file), file).toBe(true);
        }
      })
    );

    it.effect("leaves tests, owners, data, prose, and other roots out of scope", () =>
      Effect.sync(() => {
        for (const file of [
          "packages/x/test/a.ts",
          "packages/x/tests/a.ts",
          "packages/x/src/__tests__/a.ts",
          "packages/x/test/fixtures/a.ts",
          "packages/x/src/a.test.ts",
          "packages/x/src/a.spec.tsx",
          "packages/foundation/modeling/identity/src/Id.ts",
          "packages/foundation/modeling/public-site/src/index.ts",
          "packages/foundation/modeling/ontology/src/seed/docketing.ttl",
          "packages/foundation/modeling/ontology/src/seed/docketing.jsonld",
          "packages/x/src/data.json",
          "packages/x/README.md",
          "goals/x/a.ts",
          "scratchpad/a.ts",
        ]) {
          expect(isPublicOriginScoped(file), file).toBe(false);
        }
      })
    );

    it.effect("allowlists the bootstrap test runner with a reason", () =>
      Effect.sync(() => {
        const file = "packages/tooling/test-kit/test-runner/src/Vitest.errors.ts";
        expect(isPublicOriginAllowlisted(file)).toBe(true);
        expect(isPublicOriginScoped(file)).toBe(false);
        for (const entry of retiredIriAuthoritiesScope.originAllowlist) {
          expect(entry.reason.length).toBeGreaterThan(0);
        }
        expect(scanRetiredIriAuthorityFile(file, `const iri = "${ORIGIN}/ns/test-utils/Vitest/TestHang";\n`)).toEqual(
          []
        );
      })
    );

    it.effect("scanRetiredIriAuthorityFile applies rule 2 only in scope", () =>
      Effect.sync(() => {
        const source = `export const iri = "${ORIGIN}/ns/a";\n`;
        expect(A.map(scanRetiredIriAuthorityFile("packages/x/src/a.ts", source), (finding) => finding.rule)).toEqual([
          "public-origin-literal",
        ]);
        expect(scanRetiredIriAuthorityFile("packages/x/test/a.test.ts", source)).toEqual([]);
        expect(scanRetiredIriAuthorityFile("packages/foundation/modeling/identity/src/a.ts", source)).toEqual([]);
        expect(scanRetiredIriAuthorityFile("docs/a.md", `"${ORIGIN}/ns/a"`)).toEqual([]);
      })
    );

    it.effect("scanRetiredIriAuthorityFile orders findings of both rules by position", () =>
      Effect.sync(() => {
        const source = `const a = "${ORIGIN}/x";\nconst b = "https://${DEV_HOST}/y";\n`;
        expect(
          pipe(
            scanRetiredIriAuthorityFile("packages/x/src/a.ts", source),
            A.map((finding) => [finding.line, finding.rule])
          )
        ).toEqual([
          [1, "public-origin-literal"],
          [2, "retired-authority"],
        ]);
      })
    );
  });
});
