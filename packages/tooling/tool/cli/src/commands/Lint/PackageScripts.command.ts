/**
 * Workspace scripts policy: `beep lint package-scripts`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { findRepoRoot, jsonStringifyPretty } from "@beep/repo-utils";
import { A } from "@beep/utils";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { PackageScriptsReportFromWire } from "../../internal/package-scripts/PackageScripts.schemas.ts";
import { PackageScriptsPolicy } from "../../internal/package-scripts/PackageScriptsPolicy.ts";

const encodeScriptsReport = S.encodeEffect(PackageScriptsReportFromWire);

const gateFlags = {
  check: Flag.Boolean("check").pipe(Flag.withDefault(false)),
  write: Flag.Boolean("write").pipe(Flag.withDefault(false)),
};

const printScriptsReport = Effect.fnUntraced(function* (
  report: PackageScriptsReportFromWire,
  wire: typeof PackageScriptsReportFromWire.Encoded,
  json: boolean,
  implDrift: boolean
) {
  if (json) return yield* Console.log(yield* jsonStringifyPretty(wire));
  yield* Console.log(
    `package-scripts: ${report.manifests} manifests, ${HashMap.size(report.drift)} drifting, ${HashSet.size(report.written)} written, ${HashMap.size(report.implDrift)} with advisory impl drift`
  );
  const violations = A.flatMap(HashMap.toEntries(report.drift), ([manifest, rows]) =>
    A.map(rows, (row) => `${manifest}: ${row.name}: ${row._tag}`)
  );
  const advisories = implDrift
    ? A.flatMap(HashMap.toEntries(report.implDrift), ([manifest, rows]) =>
        A.map(
          rows,
          (row) => `${manifest}: ${row.name}: advisory impl drift: actual=${row.actual}; default=${row.expected}`
        )
      )
    : [];
  yield* Effect.forEach([...violations, ...advisories], Console.log, { discard: true });
});

/**
 * Checks or repairs the strict package scripts block.
 * **Example** (Inspect the gate name)
 * ```ts
 * import { lintPackageScriptsCommand } from "@beep/repo-cli/test/PackageScripts"
 * console.log(lintPackageScriptsCommand.name) // package-scripts
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const lintPackageScriptsCommand = Command.make(
  "package-scripts",
  {
    ...gateFlags,
    json: Flag.Boolean("json").pipe(Flag.withDefault(false)),
    implDrift: Flag.Boolean("impl-drift").pipe(Flag.withDefault(false)),
  },
  Effect.fn("lintPackageScripts")(function* ({ check, write, json, implDrift }) {
    if (check && write) return yield* failWithReportedExit("Choose --check or --write, not both.");
    const root = yield* findRepoRoot();
    const policy = yield* PackageScriptsPolicy.make(root);
    const report = yield* write ? policy.write(root) : policy.check(root);
    const wire = yield* encodeScriptsReport(report);
    yield* printScriptsReport(report, wire, json, implDrift);
    if (HashMap.size(report.drift) > 0) return yield* failWithReportedExit("Package scripts policy drift.");
  })
).pipe(
  Command.withDescription(
    "Check or repair canonical workspace scripts; impl differences from scaffold defaults are advisory (counted on the summary line; --impl-drift lists them), except that beep:build, beep:check and beep:check:* must type-check with tsrs unless checkerEngineExemptions lists the script. --write seeds missing impls and preserves existing values; --json includes implDrift."
  )
);
