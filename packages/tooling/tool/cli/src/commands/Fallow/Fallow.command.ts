/**
 * Fallow integration helpers for repo quality experiments.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { buildRepoDependencyIndex, findRepoRoot, jsonStringifyPretty, resolveWorkspaceDirs } from "@beep/repo-utils";
import { A, Str } from "@beep/utils";
import { Console, Effect, FileSystem, HashMap, Order, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { runCaptured } from "../../internal/process/StepExec.ts";
import type { WorkspaceDeps } from "@beep/repo-utils";

const $I = $RepoCliId.create("commands/Fallow/Fallow.command");

const FALLOW_CONFIG_SCHEMA_URL = "https://raw.githubusercontent.com/fallow-rs/fallow/main/schema.json";
const DEFAULT_BOUNDARY_CONFIG_PATH = "standards/fallow.boundaries.generated.jsonc";
const ROOT_FALLOW_CONFIG_FILENAME = ".fallowrc.jsonc";

type FallowBoundaryZone = {
  readonly name: string;
  readonly patterns: ReadonlyArray<string>;
};

type FallowBoundaryRule = {
  readonly from: string;
  readonly allow: ReadonlyArray<string>;
  readonly allowTypeOnly: ReadonlyArray<string>;
};

type FallowBoundaryPackageRole = "domain" | "drivers" | "other" | "server" | "tables" | "ui";

type FallowBoundaryWorkspaceEntry = {
  readonly name: string;
  readonly workspacePath: string;
  readonly role: FallowBoundaryPackageRole;
};

type FallowDoctrineRule = {
  readonly ruleId: string;
  readonly fromRole: FallowBoundaryPackageRole;
  readonly forbiddenTargetRoles: ReadonlyArray<FallowBoundaryPackageRole>;
};

type FallowDoctrineManifestViolation = {
  readonly ruleId: string;
  readonly from: string;
  readonly fromRole: FallowBoundaryPackageRole;
  readonly to: string;
  readonly toRole: FallowBoundaryPackageRole;
};

type FallowBoundaryConfig = {
  readonly $schema: string;
  readonly extends: ReadonlyArray<string>;
  readonly boundaries: {
    readonly zones: ReadonlyArray<FallowBoundaryZone>;
    readonly rules: ReadonlyArray<FallowBoundaryRule>;
  };
  readonly rules: {
    readonly "boundary-violation": "warn";
  };
};

class FallowBoundaryViolation extends S.Class<FallowBoundaryViolation>($I`FallowBoundaryViolation`)(
  {
    from_path: S.String,
    to_path: S.String,
    from_zone: S.String,
    to_zone: S.String,
    import_specifier: S.String,
    line: S.Finite,
    col: S.Finite,
  },
  $I.annote("FallowBoundaryViolation", {
    description: "Boundary violation emitted by `fallow dead-code --boundary-violations`.",
  })
) {}

class FallowBoundaryReport extends S.Class<FallowBoundaryReport>($I`FallowBoundaryReport`)(
  {
    boundary_violations: S.Array(FallowBoundaryViolation),
  },
  $I.annote("FallowBoundaryReport", {
    description: "Fallow boundary report subset used for doctrine-pinned layer checks.",
  })
) {}

const decodeFallowBoundaryReport = S.decodeUnknownEffect(S.fromJsonString(FallowBoundaryReport));

const DOCTRINE_BOUNDARY_RULES = [
  {
    ruleId: "doctrine:domain-deny-drivers-tables-server",
    fromRole: "domain",
    forbiddenTargetRoles: ["drivers", "tables", "server"],
  },
  {
    ruleId: "doctrine:tables-deny-server",
    fromRole: "tables",
    forbiddenTargetRoles: ["server"],
  },
  {
    ruleId: "doctrine:ui-deny-server",
    fromRole: "ui",
    forbiddenTargetRoles: ["server"],
  },
] as const satisfies ReadonlyArray<FallowDoctrineRule>;

const normalizeSlashes = Str.replaceAll("\\", "/");

const workspaceEntryOrder: Order.Order<readonly [string, string]> = Order.mapInput(Order.String, ([name]) => name);

const classifyWorkspaceRole = (workspacePath: string): FallowBoundaryPackageRole => {
  const segments = pipe(workspacePath, Str.split("/"), A.filter(Str.isNonEmpty));
  const family = segments[1];
  const role = segments[2];

  if (family === "drivers") {
    return "drivers";
  }
  if (role === "domain" || role === "server" || role === "tables" || role === "ui") {
    return role;
  }

  return "other";
};

const doctrineRuleFor = (
  fromRole: FallowBoundaryPackageRole,
  toRole: FallowBoundaryPackageRole
): O.Option<FallowDoctrineRule> =>
  A.findFirst(
    DOCTRINE_BOUNDARY_RULES,
    (rule) => rule.fromRole === fromRole && A.contains(rule.forbiddenTargetRoles, toRole)
  );

const isDoctrineAllowed = (fromRole: FallowBoundaryPackageRole, toRole: FallowBoundaryPackageRole): boolean =>
  O.isNone(doctrineRuleFor(fromRole, toRole));

const workspaceEntryByName = (
  entries: ReadonlyArray<FallowBoundaryWorkspaceEntry>
): HashMap.HashMap<string, FallowBoundaryWorkspaceEntry> =>
  HashMap.fromIterable(A.map(entries, (entry) => [entry.name, entry] as const));

const resolveBoundaryWorkspaceEntries = Effect.fn("Fallow.resolveBoundaryWorkspaceEntries")(function* (
  repoRoot: string
) {
  const path = yield* Path.Path;
  const workspaceDirs = yield* resolveWorkspaceDirs(repoRoot);
  const workspaceEntries = pipe(A.fromIterable(workspaceDirs), A.sort(workspaceEntryOrder));

  return pipe(
    workspaceEntries,
    A.map(([name, absolutePath]): FallowBoundaryWorkspaceEntry => {
      const workspacePath = normalizeSlashes(path.relative(repoRoot, absolutePath));

      return {
        name,
        workspacePath,
        role: classifyWorkspaceRole(workspacePath),
      };
    })
  );
});

const workspaceDependencyNames = (workspaceDeps: WorkspaceDeps): ReadonlyArray<string> =>
  pipe(
    [
      ...R.keys(workspaceDeps.workspace.dependencies),
      ...R.keys(workspaceDeps.workspace.devDependencies),
      ...R.keys(workspaceDeps.workspace.peerDependencies),
      ...R.keys(workspaceDeps.workspace.optionalDependencies),
    ],
    A.dedupe,
    A.sort(Order.String)
  );

const findDoctrineManifestViolations = (
  dependencyIndex: HashMap.HashMap<string, WorkspaceDeps>,
  workspaceEntries: ReadonlyArray<FallowBoundaryWorkspaceEntry>
): ReadonlyArray<FallowDoctrineManifestViolation> => {
  const entriesByName = workspaceEntryByName(workspaceEntries);

  return pipe(
    workspaceEntries,
    A.flatMap((entry) =>
      pipe(
        HashMap.get(dependencyIndex, entry.name),
        O.map(workspaceDependencyNames),
        O.getOrElse(A.empty<string>),
        A.map((dependencyName) =>
          pipe(
            HashMap.get(entriesByName, dependencyName),
            O.flatMap((target) =>
              pipe(
                doctrineRuleFor(entry.role, target.role),
                O.map((rule) => ({
                  ruleId: rule.ruleId,
                  from: entry.name,
                  fromRole: entry.role,
                  to: target.name,
                  toRole: target.role,
                }))
              )
            )
          )
        ),
        A.getSomes
      )
    ),
    A.sort(
      Order.mapInput(
        Order.String,
        (violation: FallowDoctrineManifestViolation) => `${violation.from}\0${violation.to}\0${violation.ruleId}`
      )
    )
  );
};

const makeBoundaryConfig = Effect.fn("Fallow.makeBoundaryConfig")(function* (
  repoRoot: string,
  rootConfigExtendsPath: string
) {
  const workspaceEntries = yield* resolveBoundaryWorkspaceEntries(repoRoot);
  const entriesByName = workspaceEntryByName(workspaceEntries);
  const dependencyIndex = yield* buildRepoDependencyIndex(repoRoot);

  const zones = pipe(
    workspaceEntries,
    A.map(
      (entry): FallowBoundaryZone => ({
        name: entry.name,
        patterns: [`${entry.workspacePath}/src/**`],
      })
    )
  );

  const rules = pipe(
    workspaceEntries,
    A.map((entry): FallowBoundaryRule => {
      const dependencyNames = pipe(
        HashMap.get(dependencyIndex, entry.name),
        O.map(workspaceDependencyNames),
        O.getOrElse(A.empty<string>)
      );
      const allow = pipe(
        [entry.name, ...dependencyNames],
        A.dedupe,
        A.map((dependencyName) =>
          pipe(
            HashMap.get(entriesByName, dependencyName),
            O.filter((target) => isDoctrineAllowed(entry.role, target.role)),
            O.map((target) => target.name)
          )
        ),
        A.getSomes,
        A.sort(Order.String)
      );

      return {
        from: entry.name,
        allow,
        allowTypeOnly: allow,
      };
    })
  );

  return {
    $schema: FALLOW_CONFIG_SCHEMA_URL,
    extends: [rootConfigExtendsPath],
    boundaries: {
      zones,
      rules,
    },
    rules: {
      "boundary-violation": "warn",
    },
  } satisfies FallowBoundaryConfig;
});

const renderBoundaryConfig = Effect.fn("Fallow.renderBoundaryConfig")(function* (repoRoot: string, outputPath: string) {
  const path = yield* Path.Path;
  const rootConfigExtendsPath = normalizeSlashes(
    path.relative(path.dirname(outputPath), path.join(repoRoot, ROOT_FALLOW_CONFIG_FILENAME))
  );
  const config = yield* makeBoundaryConfig(repoRoot, rootConfigExtendsPath);
  const configText = yield* jsonStringifyPretty(config);

  return `${configText}\n`;
});

const extractJsonDocumentText = (output: string): O.Option<string> =>
  pipe(
    Str.match(/\{[\s\S]*\}/u)(output),
    O.flatMap((match) => O.fromUndefinedOr(match[0]))
  );

const runFallowBoundaryReport = Effect.fn("Fallow.runFallowBoundaryReport")(function* (
  repoRoot: string,
  configPath: string
) {
  const args = [
    "run",
    "fallow",
    "--",
    "dead-code",
    "--boundary-violations",
    "--config",
    configPath,
    "--format",
    "json",
    "--quiet",
  ] as const;
  const { output } = yield* runCaptured({
    command: "bun",
    args,
    cwd: repoRoot,
    extendEnv: true,
  });
  const jsonText = yield* pipe(
    extractJsonDocumentText(output),
    O.match({
      onNone: () => failWithReportedExit("fallow boundaries: Fallow did not emit a JSON boundary report."),
      onSome: Effect.succeed,
    })
  );

  return yield* decodeFallowBoundaryReport(jsonText);
});

const doctrineViolationForReportFinding = (
  entriesByName: HashMap.HashMap<string, FallowBoundaryWorkspaceEntry>,
  violation: FallowBoundaryViolation
): O.Option<
  readonly [FallowDoctrineRule, FallowBoundaryWorkspaceEntry, FallowBoundaryWorkspaceEntry, FallowBoundaryViolation]
> =>
  pipe(
    HashMap.get(entriesByName, violation.from_zone),
    O.flatMap((fromEntry) =>
      pipe(
        HashMap.get(entriesByName, violation.to_zone),
        O.flatMap((toEntry) =>
          pipe(
            doctrineRuleFor(fromEntry.role, toEntry.role),
            O.map((rule) => [rule, fromEntry, toEntry, violation] as const)
          )
        )
      )
    )
  );

const renderManifestDoctrineViolation = (violation: FallowDoctrineManifestViolation): string =>
  `- ${violation.ruleId}: ${violation.from} (${violation.fromRole}) declares ${violation.to} (${violation.toRole})`;

const renderSourceDoctrineViolation = (
  violation: readonly [
    FallowDoctrineRule,
    FallowBoundaryWorkspaceEntry,
    FallowBoundaryWorkspaceEntry,
    FallowBoundaryViolation,
  ]
): string => {
  const [rule, fromEntry, toEntry, finding] = violation;
  return `- ${rule.ruleId}: ${finding.from_path}:${finding.line}:${finding.col} imports ${finding.import_specifier} (${fromEntry.name}/${fromEntry.role} -> ${toEntry.name}/${toEntry.role})`;
};

const checkDoctrineBoundaries = Effect.fn("Fallow.checkDoctrineBoundaries")(function* (
  repoRoot: string,
  configPath: string
) {
  const workspaceEntries = yield* resolveBoundaryWorkspaceEntries(repoRoot);
  const dependencyIndex = yield* buildRepoDependencyIndex(repoRoot);
  const entriesByName = workspaceEntryByName(workspaceEntries);
  const manifestViolations = findDoctrineManifestViolations(dependencyIndex, workspaceEntries);
  const report = yield* runFallowBoundaryReport(repoRoot, configPath).pipe(
    Effect.catch(
      Effect.fn(function* () {
        yield* Console.error("fallow boundaries: failed to run Fallow boundary analyzer for doctrine checks.");
        return yield* failWithReportedExit("fallow boundaries: doctrine analyzer failed.");
      })
    )
  );
  const sourceViolations = pipe(
    report.boundary_violations,
    A.map((violation) => doctrineViolationForReportFinding(entriesByName, violation)),
    A.getSomes
  );

  if (A.isReadonlyArrayEmpty(manifestViolations) && A.isReadonlyArrayEmpty(sourceViolations)) {
    yield* Console.log("fallow boundaries: doctrine-pinned layer-legality checks passed.");
    return;
  }

  yield* Console.error("fallow boundaries: doctrine-pinned layer-legality violations found.");
  if (A.isReadonlyArrayNonEmpty(manifestViolations)) {
    yield* Console.error("Manifest dependency violations:");
    yield* Effect.forEach(
      manifestViolations,
      (violation) => Console.error(renderManifestDoctrineViolation(violation)),
      {
        discard: true,
      }
    );
  }
  if (A.isReadonlyArrayNonEmpty(sourceViolations)) {
    yield* Console.error("Source import violations:");
    yield* Effect.forEach(sourceViolations, (violation) => Console.error(renderSourceDoctrineViolation(violation)), {
      discard: true,
    });
  }
  return yield* failWithReportedExit("fallow boundaries: doctrine-pinned layer-legality violations detected.");
});

const resolveOutputPath = Effect.fn("Fallow.resolveOutputPath")(function* (repoRoot: string, output: string) {
  const path = yield* Path.Path;
  return path.isAbsolute(output) ? output : path.join(repoRoot, output);
});

const writeBoundaryConfig = Effect.fn("Fallow.writeBoundaryConfig")(function* (
  outputPath: string,
  expectedText: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  yield* fs.makeDirectory(path.dirname(outputPath), { recursive: true });
  yield* fs.writeFileString(outputPath, expectedText);
});

const checkBoundaryConfig = Effect.fn("Fallow.checkBoundaryConfig")(function* (
  outputPath: string,
  expectedText: string
) {
  const fs = yield* FileSystem.FileSystem;
  const existingText = yield* fs.readFileString(outputPath).pipe(
    Effect.catch(
      Effect.fn(function* (error) {
        yield* Console.error(`fallow boundaries: failed to read ${outputPath}: ${error.message}`);
        return yield* failWithReportedExit("fallow boundaries: generated config is missing or unreadable.");
      })
    )
  );

  if (existingText === expectedText) {
    yield* Console.log(`fallow boundaries: ${outputPath} is up to date.`);
    return;
  }

  yield* Console.error(`fallow boundaries: ${outputPath} is stale.`);
  yield* Console.error("Run `bun run fallow:boundaries:write` to refresh it.");
  return yield* failWithReportedExit("fallow boundaries: generated config drift detected.");
});

const boundariesCommand = Command.make(
  "boundaries",
  {
    output: Flag.string("output").pipe(
      Flag.withAlias("o"),
      Flag.withDefault(DEFAULT_BOUNDARY_CONFIG_PATH),
      Flag.withDescription("Generated Fallow boundary config path")
    ),
    write: Flag.boolean("write").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Write the generated boundary config")
    ),
    check: Flag.boolean("check").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Fail when the generated boundary config is stale")
    ),
  },
  Effect.fn(function* ({ output, write, check }) {
    if (write && check) {
      yield* Console.error("fallow boundaries: --write and --check are mutually exclusive.");
      return yield* failWithReportedExit("fallow boundaries: choose either --write or --check.");
    }

    const repoRoot = yield* findRepoRoot();
    const outputPath = yield* resolveOutputPath(repoRoot, output);
    const expectedText = yield* renderBoundaryConfig(repoRoot, outputPath);

    if (write) {
      yield* writeBoundaryConfig(outputPath, expectedText);
      yield* Console.log(`fallow boundaries: wrote ${outputPath}.`);
      return;
    }

    if (check) {
      yield* checkBoundaryConfig(outputPath, expectedText);
      yield* checkDoctrineBoundaries(repoRoot, outputPath);
      return;
    }

    yield* Console.log(expectedText);
  })
).pipe(Command.withDescription("Generate the advisory Fallow boundary config from workspace dependency metadata"));

/**
 * Fallow quality-tooling command group.
 *
 * **Example** (Run fallow command group)
 *
 * ```ts
 * import { fallowCommand } from "@beep/repo-cli/commands/Fallow"
 * import { Command } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const run = Command.run(fallowCommand, { version: "0.0.0" })
 * console.log(Effect.isEffect(run)) // true
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const fallowCommand = Command.make("fallow", {}, () => Console.log("Available Fallow helpers: boundaries")).pipe(
  Command.withDescription("Fallow quality-tooling helpers"),
  Command.withSubcommands([boundariesCommand])
);
