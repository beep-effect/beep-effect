/**
 * CLI command definitions for runner AMI operations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A } from "@beep/utils";
import { Clock, Console, Effect, Match, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import { Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { RunnersCommandError } from "./Runners.errors.ts";
import { BakeCheckReportJson, BakeConfig, BakePlanJson, BakeReportJson } from "./Runners.schemas.ts";
import { RunnersService, RunnersServiceLive } from "./Runners.service.ts";
import type * as S from "effect/Schema";
import type { BakeCheckReport, BakeMode, BakePlan, BakeReport } from "./Runners.schemas.ts";
import type { RunnersServiceShape } from "./Runners.service.ts";

const DEFAULT_REGION = "us-east-1";

/**
 * Resolve mutually exclusive bake mode flags.
 *
 * **Example** (Resolve the default bake mode)
 *
 * ```ts
 * import { resolveBakeMode } from "@beep/repo-cli/commands/Runners"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(resolveBakeMode(false, false))) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const resolveBakeMode: {
  (plan: boolean, check: boolean): Effect.Effect<BakeMode, RunnersCommandError>;
  (check: boolean): (plan: boolean) => Effect.Effect<BakeMode, RunnersCommandError>;
} = dual(2, (plan: boolean, check: boolean) =>
  plan && check
    ? Effect.fail(RunnersCommandError.make({ message: "runners bake: --plan and --check are mutually exclusive." }))
    : Effect.succeed(plan ? "plan" : check ? "check" : "bake")
);

const renderPlan = (plan: BakePlan): string =>
  A.join(
    [
      `lockfile sha256: ${plan.lockfileSha256}`,
      `bun version: ${plan.bunVersion}`,
      `git revision: ${plan.gitRevision}`,
      `required flags: ${A.join(plan.requiredFlags, ", ")}`,
      ...A.map(plan.steps, (step) => `${step.name}: ${A.join(step.argv, " ")}`),
    ],
    "\n"
  );

const renderCheck = (report: BakeCheckReport): string =>
  A.join(
    [
      `AMI: ${report.amiId}`,
      `lockfile: ${report.lockfileMatches ? "fresh" : "stale"}`,
      `bun version: ${report.bunVersionMatches ? "fresh" : "stale"}`,
      `fresh: ${report.fresh ? "yes" : "no"}`,
    ],
    "\n"
  );

const renderReport = (report: BakeReport): string =>
  A.join(
    [
      `baked AMI: ${report.amiId}`,
      `base AMI: ${report.baseAmiId}`,
      `lockfile sha256: ${report.lockfileSha256}`,
      `bun version: ${report.bunVersion}`,
      `pin: ${report.pulumiPinCommand}`,
    ],
    "\n"
  );

const printEncoded = Effect.fn("Runners.printEncoded")(function* <A>(
  value: A,
  encode: (value: A) => Effect.Effect<string, S.SchemaError>
) {
  const json = yield* encode(value).pipe(RunnersCommandError.mapError("Failed to encode runners command output."));
  yield* Console.log(json);
});

const requiredFlag = <A>(name: string, value: O.Option<A>): Effect.Effect<A, RunnersCommandError> =>
  Effect.fromOption(value, () => RunnersCommandError.make({ message: `runners bake: --${name} is required.` }));

type BakeCliOptions = {
  readonly plan: boolean;
  readonly check: boolean;
  readonly json: boolean;
  readonly region: string;
  readonly subnet: O.Option<string>;
  readonly securityGroup: O.Option<string>;
  readonly instanceProfile: O.Option<string>;
  readonly baseAmiParameter: string;
  readonly instanceType: string;
  readonly tags: O.Option<Record<string, string>>;
  readonly report: O.Option<string>;
};

const runBakeCommand = Effect.fn("Runners.runBakeCommand")(function* (options: BakeCliOptions) {
  const service = yield* RunnersService;
  const mode = yield* resolveBakeMode(options.plan, options.check);
  return yield* Match.value(mode).pipe(
    Match.when("plan", () =>
      service.plan.pipe(
        Effect.flatMap((result) =>
          options.json ? printEncoded(result, BakePlanJson.encode) : Console.log(renderPlan(result))
        )
      )
    ),
    Match.when("check", () =>
      service
        .check(options.region)
        .pipe(
          Effect.flatMap((result) =>
            pipe(
              options.json ? printEncoded(result, BakeCheckReportJson.encode) : Console.log(renderCheck(result)),
              Effect.andThen(
                result.fresh
                  ? Effect.void
                  : Effect.fail(RunnersCommandError.make({ message: "runners bake --check: live AMI is stale." }))
              )
            )
          )
        )
    ),
    Match.when(
      "bake",
      Effect.fnUntraced(function* () {
        const subnetId = yield* requiredFlag("subnet", options.subnet);
        const securityGroupId = yield* requiredFlag("security-group", options.securityGroup);
        const bakeTimestamp = yield* Clock.currentTimeMillis;
        const config = BakeConfig.make({
          region: options.region,
          subnetId,
          securityGroupId,
          instanceProfile: options.instanceProfile,
          bakeTimestamp,
          baseAmiSsmParameter: options.baseAmiParameter,
          instanceType: options.instanceType,
          tags: O.getOrElse(options.tags, () => ({})),
        });
        const report = yield* service.bake(config, options.report);
        yield* options.json ? printEncoded(report, BakeReportJson.encode) : Console.log(renderReport(report));
      })
    ),
    Match.exhaustive
  );
});

/**
 * Test seam for exercising bake-mode rendering and flag validation with an injected runner service.
 *
 * **Example** (Inspect the bake command test seam)
 *
 * ```ts
 * import { runBakeCommandForTesting } from "@beep/repo-cli/commands/Runners"
 *
 * console.log(typeof runBakeCommandForTesting) // "function"
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const runBakeCommandForTesting = Effect.fn("Runners.runBakeCommandForTesting")(
  (options: BakeCliOptions, service: RunnersServiceShape) =>
    runBakeCommand(options).pipe(Effect.provideService(RunnersService, service))
);

const bakeCommand = Command.make(
  "bake",
  {
    plan: Flag.boolean("plan").pipe(Flag.withDefault(false), Flag.withDescription("Render the AWS-free bake plan")),
    check: Flag.boolean("check").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Check the live AMI's lockfile and Bun-version tags")
    ),
    json: Flag.boolean("json").pipe(Flag.withDefault(false), Flag.withDescription("Emit schema-encoded JSON")),
    region: Flag.string("region").pipe(Flag.withDefault(DEFAULT_REGION), Flag.withDescription("AWS region")),
    subnet: Flag.string("subnet").pipe(Flag.optional, Flag.withDescription("Bake instance subnet id")),
    securityGroup: Flag.string("security-group").pipe(
      Flag.optional,
      Flag.withDescription("Bake instance security group id")
    ),
    instanceProfile: Flag.string("instance-profile").pipe(
      Flag.optional,
      Flag.withDescription("Optional bake instance profile (omit: launcher guardrails deny profiled launches)")
    ),
    baseAmiParameter: Flag.string("base-ami-parameter").pipe(
      Flag.withDefault("/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"),
      Flag.withDescription("Base AMI SSM parameter")
    ),
    instanceType: Flag.string("instance-type").pipe(
      Flag.withDefault("r7a.2xlarge"),
      Flag.withDescription("Temporary bake instance type")
    ),
    tags: Flag.keyValuePair("tag").pipe(Flag.optional, Flag.withDescription("Additional key=value AWS tags")),
    report: Flag.path("report", { pathType: "file" }).pipe(
      Flag.optional,
      Flag.withDescription("Bake report output path")
    ),
  },
  (options) =>
    runBakeCommand(options).pipe(
      Effect.catchTag("RunnersCommandError", (error) =>
        Console.error(error.message).pipe(Effect.andThen(failWithReportedExit(error.message)))
      )
    )
).pipe(
  Command.withDescription("Bake or validate the lockfile-keyed CI runner AMI"),
  Command.provide(RunnersServiceLive)
);

/**
 * Runner infrastructure command group.
 *
 * **Example** (Inspect the runners command)
 *
 * ```ts
 * import { runnersCommand } from "@beep/repo-cli/commands/Runners"
 *
 * console.log(typeof runnersCommand)
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const runnersCommand = Command.make("runners", {}, () => Console.log("runners commands: bake")).pipe(
  Command.withDescription("CI runner image operations"),
  Command.withSubcommands([bakeCommand])
);
