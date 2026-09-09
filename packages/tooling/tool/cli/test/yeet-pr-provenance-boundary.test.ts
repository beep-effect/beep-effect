import { renderPrProvenance, toPublicPrProvenance } from "@beep/repo-cli/test/Yeet";
import { fcRuns } from "@beep/test-utils";
import * as O from "@beep/utils/Option";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import { makeRecord } from "./yeet-pr-fixtures.ts";

describe("Yeet PR provenance public boundary", () => {
  // Branches are already public PR metadata, so boundary assertions remove their exact value before leak checks.
  it("projects arbitrary local identifiers without leaking resumable identity", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([
            Arbitrary.all({
              suffix: Arbitrary.schema(S.String.check(S.isPattern(/^[A-Za-z0-9_-]{1,80}$/u))),
              branch: Arbitrary.schema(
                S.Union([S.Literal("feat/footer-one"), S.Literal("release/footer-two"), S.Literal("fix/footer-three")])
              ),
              harness: Arbitrary.schema(S.Union([S.Literal("claude-code"), S.Literal("codex"), S.Literal("unknown")])),
              hostHarness: Arbitrary.schema(S.Union([S.Undefined, S.Literal("claude-code"), S.Literal("codex")])),
              entrypoint: Arbitrary.schema(
                S.Union([
                  S.Literal("claude-desktop"),
                  S.Literal("cli"),
                  S.Literal("sdk-cli"),
                  S.Literal("codex-exec"),
                  S.Literal("codex-tui"),
                  S.Literal("unknown"),
                ])
              ),
              role: Arbitrary.schema(S.Union([S.Literal("created"), S.Literal("pushed"), S.Literal("monitored")])),
              model: Arbitrary.schema(
                S.Union([S.Literal("unknown"), S.Literal("gpt-5.4"), S.Literal("claude-sonnet-4.5")])
              ),
              workspace: Arbitrary.schema(S.Union([S.Literal("beep-effect10"), S.Literal("publisher-main")])),
              sessionWorkspace: Arbitrary.schema(
                S.Union([S.Undefined, S.Literal("beep-effect3"), S.Literal("session-main")])
              ),
              sessionName: Arbitrary.schema(
                S.Union([S.Literal("FABLE"), S.Literal("footer-revival"), S.Literal("safe-agent")])
              ),
              nameSource: Arbitrary.schema(
                S.Union([S.Literal("user"), S.Literal("derived"), S.Literal("peer"), S.Literal("unknown")])
              ),
              pr: Arbitrary.schema(S.Int.check(S.isGreaterThanOrEqualTo(1), S.isLessThanOrEqualTo(999_999))),
            }),
          ]),
          ([
            {
              branch,
              entrypoint,
              harness,
              hostHarness,
              model,
              nameSource,
              pr,
              role,
              sessionName,
              sessionWorkspace,
              suffix,
              workspace,
            },
          ]) => {
            const localValues = {
              sessionId: `session-private-${suffix}`,
              hostSessionId: `host-private-${suffix}`,
              sessionHome: `/session/private/${suffix}`,
              clonePath: `/clone/private/${suffix}`,
              checkoutPath: `/checkout/private/${suffix}`,
              worktreePath: `/worktree/private/${suffix}`,
              headSha: `head-private-${suffix}`,
              runId: `run-private-${suffix}`,
              prUrl: `https://github.com/private/private/pull/${pr}?local=${suffix}`,
            };
            const local = makeRecord({
              ...localValues,
              ...O.getSomesStruct({
                hostHarness: O.fromUndefinedOr(hostHarness),
                sessionWorkspace: O.fromUndefinedOr(sessionWorkspace),
              }),
              branch,
              harness,
              entrypoint,
              role,
              model,
              workspace,
              sessionName,
              nameSource,
              pr,
            });
            const footer = renderPrProvenance(toPublicPrProvenance([local], O.some(pr), true));
            const withoutBranch = Str.replaceAll(branch, "")(footer);
            assert.notMatch(withoutBranch, /(?:^|[\s(])(?:\/[^<\s]*|~\/[^<\s]*|\$[A-Za-z_][A-Za-z0-9_]*\/)/mu);
            assert.notInclude(withoutBranch, "cd ");
            assert.notInclude(withoutBranch, "--resume");
            assert.notInclude(withoutBranch, "codex resume");
            assert.notInclude(withoutBranch, "--from-pr");
            assert.notMatch(withoutBranch, /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/iu);
            assert.notMatch(withoutBranch, /[0-9a-f]{16,}/iu);
            A.forEach(
              [
                localValues.sessionId,
                localValues.hostSessionId,
                localValues.sessionHome,
                localValues.clonePath,
                localValues.checkoutPath,
                localValues.worktreePath,
                localValues.headSha,
                localValues.runId,
                localValues.prUrl,
              ],
              (value) => assert.notInclude(footer, value)
            );
            assert.notInclude(footer, "$BEEP_PROJECTS/");
            const twin = pipeTwin(footer);
            assert.notInclude(twin, "-->");
            const fences = pipeLines(footer).filter((line) => /^bun run beep yeet resume [1-9][0-9]*$/u.test(line));
            assert.lengthOf(fences, 1);

            return true;
          },
          fcRuns(64)
        )
      )._tag
    ).toBe("Passed");
  });

  it("escapes hostile public branches without terminating the JSON comment", () => {
    const hostileBranches = [
      "feat/tick`mark",
      "feat/comment-->tail",
      "feat/less<than",
      "feat/greater>than",
      "feat/amp&sand",
      "fix/550e8400-e29b-41d4-a716-446655440000",
      `fix/${Str.repeat(40)("a")}`,
    ];
    A.forEach(hostileBranches, (branch) => {
      const footer = renderPrProvenance(toPublicPrProvenance([makeRecord({ branch })], O.some(42), false));
      const twin = pipeTwin(footer);
      assert.notInclude(twin, "-->");
      assert.lengthOf(A.fromIterable(Str.matchAll(/<!-- yeet-provenance:end -->/gu)(footer)), 1);
      assert.include(footer, "- Branch: <code>");
      if (Str.includes("<")(branch)) {
        assert.include(footer, "&lt;");
        assert.include(twin, "\\u003c");
      }
      if (Str.includes(">")(branch)) {
        assert.include(footer, "&gt;");
        assert.include(twin, "\\u003e");
      }
      if (Str.includes("&")(branch)) {
        assert.include(footer, "&amp;");
        assert.include(twin, "\\u0026");
      }
      if (Str.includes("`")(branch)) {
        assert.include(footer, "&#96;");
        assert.include(twin, "`");
      }
    });
  });

  it("omits the resume fence before a PR number exists", () => {
    const footer = renderPrProvenance(toPublicPrProvenance([makeRecord()], O.none(), false));
    assert.isFalse(Str.includes("bun run beep yeet resume")(footer));
  });
});

const pipeLines = (value: string): ReadonlyArray<string> => A.fromIterable(Str.split("\n")(value));
const pipeTwin = (footer: string): string => {
  const tail = O.getOrElse(A.get(Str.split("<!-- yeet-provenance\n")(footer), 1), () => "");
  return O.getOrElse(A.head(Str.split("\n-->")(tail)), () => "");
};
