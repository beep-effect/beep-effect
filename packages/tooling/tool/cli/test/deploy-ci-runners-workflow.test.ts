import { findRepoRoot } from "@beep/repo-utils/Root";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { parseWorkflowYaml, yamlAt } from "./support/WorkflowYaml.ts";

// The slice of GitHub's expression language `deploy-ci-runners.yml` writes its `if:` conditions in:
// `||`, `&&`, `!`, `==`, `!=`, parentheses, single-quoted strings and dotted context reads. An absent
// context value is null, as on a push, which carries no `inputs`.
type Value = string | boolean | null;
type Context = Readonly<Record<string, Readonly<Record<string, Value>>>>;

const tokens = (text: string): ReadonlyArray<string> =>
  O.getOrElse(Str.match(/\|\||&&|==|!=|!|\(|\)|'[^']*'|[A-Za-z_][\w.]*/g)(text), () => A.empty<string>());

const truthy = (value: Value): boolean => value !== null && value !== false && value !== "";

const evaluate = (text: string, context: Context): Value => {
  const input = tokens(pipe(text, Str.replace(/^\s*\$\{\{/, ""), Str.replace(/\}\}\s*$/, ""), Str.trim));
  let at = 0;
  const peek = () => input[at];
  const take = () => input[at++];
  const read = (path: string): Value => {
    const [scope = "", key = ""] = Str.split(".")(path);
    return context[scope]?.[key] ?? null;
  };
  const primary = (): Value => {
    const token = take();
    if (token === undefined) throw new Error(`unexpected end of expression: ${text}`);
    if (token === "(") {
      const inner = or();
      take();
      return inner;
    }
    if (token === "!") return !truthy(primary());
    if (Str.startsWith("'")(token)) return Str.slice(1, -1)(token);
    if (token === "true" || token === "false") return token === "true";
    return read(token);
  };
  const comparison = (): Value => {
    const left = primary();
    const operator = peek();
    if (operator !== "==" && operator !== "!=") return left;
    take();
    const right = primary();
    return operator === "==" ? left === right : left !== right;
  };
  const and = (): Value => {
    let left = comparison();
    while (peek() === "&&") {
      take();
      const right = comparison();
      left = truthy(left) ? right : left;
    }
    return left;
  };
  const or = (): Value => {
    let left = and();
    while (peek() === "||") {
      take();
      const right = and();
      left = truthy(left) ? left : right;
    }
    return left;
  };
  const result = or();
  if (at !== input.length) throw new Error(`unread tokens in expression: ${text}`);
  return result;
};

const armed = { CI_RUNNERS_DEPLOY_ARMED: "true" };
const routineArmed = { CI_RUNNERS_DEPLOY_ARMED: "true", CI_RUNNERS_ROUTINE_ARMED: "true" };

const push = (vars: Readonly<Record<string, Value>>): Context => ({ github: { event_name: "push" }, inputs: {}, vars });

const dispatch = (
  inputs: { readonly mode: string; readonly plan_only: boolean },
  vars: Readonly<Record<string, Value>>
): Context => ({
  github: { event_name: "workflow_dispatch" },
  inputs: { ...inputs, expect_plan_digest: "" },
  vars,
});

it.layer(NodeServices.layer, { timeout: "30 seconds" })("deploy-ci-runners workflow", (it) => {
  const read = Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const root = yield* findRepoRoot();
    const text = yield* fs.readFileString(`${root}/.github/workflows/deploy-ci-runners.yml`);
    const workflow = parseWorkflowYaml(text);
    const steps = yamlAt(workflow, ["jobs", "deploy", "steps"]);
    const step = (name: string): unknown =>
      O.getOrUndefined(A.findFirst(A.isArray(steps) ? steps : [], (candidate) => yamlAt(candidate, ["name"]) === name));
    const condition = (value: unknown): string => (P.isString(value) ? value : "true");
    const runs = (context: Context) => {
      const job = truthy(evaluate(condition(yamlAt(workflow, ["jobs", "deploy", "if"])), context));
      const stepRuns = (name: string) => job && truthy(evaluate(condition(yamlAt(step(name), ["if"])), context));
      return {
        job,
        plan: stepRuns("Plan and check the prod stage"),
        deploy: stepRuns("Deploy the checked plan"),
        webhook: stepRuns("Verify the webhook answers and refuses an unsigned event"),
      };
    };
    return { workflow, step, runs };
  });

  it.effect("a push takes the path it took before plan_only existed", () =>
    Effect.gen(function* () {
      const { runs } = yield* read;
      expect(runs(push({}))).toStrictEqual({ job: false, plan: false, deploy: false, webhook: false });
      expect(runs(push(armed))).toStrictEqual({ job: false, plan: false, deploy: false, webhook: false });
      expect(runs(push(routineArmed))).toStrictEqual({ job: true, plan: true, deploy: true, webhook: true });
    })
  );

  it.effect("a dispatch with plan_only=false deploys only while armed", () =>
    Effect.gen(function* () {
      const { runs } = yield* read;
      const bootstrap = { mode: "bootstrap", plan_only: false };
      expect(runs(dispatch(bootstrap, {}))).toStrictEqual({ job: false, plan: false, deploy: false, webhook: false });
      expect(runs(dispatch(bootstrap, armed))).toStrictEqual({ job: true, plan: true, deploy: true, webhook: false });
      const routine = { mode: "routine", plan_only: false };
      expect(runs(dispatch(routine, armed))).toStrictEqual({ job: false, plan: false, deploy: false, webhook: false });
      expect(runs(dispatch(routine, routineArmed))).toStrictEqual({
        job: true,
        plan: true,
        deploy: true,
        webhook: true,
      });
    })
  );

  it.effect("a dispatch with plan_only=true plans unarmed and never reaches the deploy or webhook step", () =>
    Effect.gen(function* () {
      const { runs } = yield* read;
      const planned = { job: true, plan: true, deploy: false, webhook: false };
      for (const mode of ["routine", "bootstrap", "default-security-group"]) {
        for (const vars of [{}, armed, routineArmed]) {
          expect(runs(dispatch({ mode, plan_only: true }, vars))).toStrictEqual(planned);
        }
      }
    })
  );

  it.effect("the deploy script refuses on its own under plan_only and passes the expected digest on", () =>
    Effect.gen(function* () {
      const { workflow, step } = yield* read;
      const deploy = step("Deploy the checked plan");
      expect(yamlAt(deploy, ["env", "PLAN_ONLY"])).toBe("${{ inputs.plan_only && 'true' || 'false' }}");
      expect(yamlAt(deploy, ["env", "EXPECT_PLAN_DIGEST"])).toBe("${{ inputs.expect_plan_digest || '' }}");
      const script = yamlAt(deploy, ["run"]);
      expect(P.isString(script) && Str.includes('if [[ "$PLAN_ONLY" != "false" ]]; then')(script)).toBe(true);
      expect(
        P.isString(script) && Str.includes('${EXPECT_PLAN_DIGEST:+--expect-digest "$EXPECT_PLAN_DIGEST"}')(script)
      ).toBe(true);
      // Only the plan and deploy steps hold the App secrets, and a plan_only run needs no write permission beyond them.
      expect(yamlAt(workflow, ["on", "workflow_dispatch", "inputs", "plan_only", "default"])).toBe(false);
      expect(yamlAt(workflow, ["on", "workflow_dispatch", "inputs", "plan_only", "type"])).toBe("boolean");
    })
  );
});
