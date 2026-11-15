import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import { FakeRepository } from "./support/FakeGitHub.ts";

/**
 * Ruleset validation the real API applies and the fake must too. Each case
 * is an answer from the live rehearsal on `beep-effect/infra-github-rehearsal`
 * (2026-11-14), where these Apps are not installed: GitHub refused a bypass
 * actor and a required-check binding for an App the repository's
 * organization does not have, with these messages.
 */
const repo = "/repos/beep-effect/beep-effect";
const query = new URLSearchParams();

type Json = Record<string, unknown>;

const mainBody = (fake: FakeRepository) => {
  const { id: _id, ...body } = fake.ruleset(10_240_248) as Json;
  return body;
};

const withChecks = (body: Json, checks: ReadonlyArray<Json>) => ({
  ...body,
  rules: A.map(body.rules as ReadonlyArray<Json>, (rule) =>
    rule.type === "required_status_checks"
      ? { ...rule, parameters: { ...(rule.parameters as Json), required_status_checks: checks } }
      : rule
  ),
});

describe("the GitHub fake validates rulesets like the REST API", () => {
  it("refuses a bypass actor whose App is not installed", () => {
    const fake = FakeRepository.fromCensus();
    const body = {
      ...mainBody(fake),
      bypass_actors: [{ actor_type: "Integration", actor_id: 424_242, bypass_mode: "always" }],
    };
    for (const [method, path] of [
      ["PUT", "/rulesets/10240248"],
      ["POST", "/rulesets"],
    ] as const) {
      const [status, reply] = fake.handle(method, `${repo}${path}`, query, { ...body, name: `${method}-probe` });
      expect(status).toBe(422);
      expect(reply).toMatchObject({
        errors: [expect.stringContaining("must be part of the ruleset source or owner organization")],
      });
    }
  });

  it("refuses a required check bound to an App that is not installed", () => {
    const fake = FakeRepository.fromCensus();
    const body = withChecks(mainBody(fake), [{ context: "Lint", integration_id: 424_242 }]);
    const [status, reply] = fake.handle("PUT", `${repo}/rulesets/10240248`, query, body);
    expect(status).toBe(422);
    expect(reply).toMatchObject({ errors: [expect.stringContaining("Invalid integration ids")] });
  });

  it("accepts the installed Apps the production ruleset binds", () => {
    const fake = FakeRepository.fromCensus();
    const body = withChecks(mainBody(fake), [
      { context: "Lint", integration_id: 15_368 },
      { context: "beep-reviewer", integration_id: 5_321_138 },
    ]);
    const [status] = fake.handle("PUT", `${repo}/rulesets/10240248`, query, body);
    expect(status).toBe(200);
  });
});
