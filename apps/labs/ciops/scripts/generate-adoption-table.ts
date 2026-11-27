import { $CiopsId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { CiOpsKpi } from "@/kpi/CiOpsKpi";
import { kpiWindows } from "@/kpi/Fold";
import { kpiOutputPaths, kpiReadingInput, kpiSourcePins } from "@/kpi/Pins";
import { renderAdoptionTable } from "@/kpi/Render";
import { AdoptionTable, AdoptionTableRow } from "@/kpi/Schemas";
import { runKpiScript, syncKpiArtifacts } from "@/kpi/Script";
import { decodeEvidenceMode, EvidenceMode, EvidenceWriteScript } from "@/projection/Evidence";
import type { AdoptionProbe, AncestryVerdict } from "@/kpi/Schemas";

// decision: local-ancestry-generation
const repoRoot = "../../..";
const $I = $CiopsId.create("scripts/generate-adoption-table");
const writeScript = EvidenceWriteScript.Enum["evidence:kpi-adoption:write"];
const generator = "apps/labs/ciops/scripts/generate-adoption-table.ts";
const probe =
  "git merge-base --is-ancestor <mergeCommit> <resolvedHeadSha>; head-missing when git cat-file -e <resolvedHeadSha>^{commit} fails";
const generation =
  "local generator, never a CI check: run in a clone with full history, with GIT_ALTERNATE_OBJECT_DIRECTORIES " +
  "naming the sibling clones' object stores so unpushed lane heads resolve; a head found in no store is " +
  "head-missing; a shallow or treeless clone is refused before any probe (git rev-parse " +
  "--is-shallow-repository must print false); regenerate with `bun run evidence:kpi-adoption:write` in " +
  "apps/labs/ciops";

class KpiAdoptionRepositoryError extends S.TaggedError<KpiAdoptionRepositoryError, { readonly brand: unique symbol }>(
  $I`KpiAdoptionRepositoryError`
)(
  "KpiAdoptionRepositoryError",
  { message: S.String },
  $I.annoteError<KpiAdoptionRepositoryError>("KpiAdoptionRepositoryError", {
    description: "The adoption-table generator needs a clone with full history and found a shallow one.",
  })
) {}

const gitExit = Effect.fn("KpiAdoption.gitExit")(function* (args: ReadonlyArray<string>) {
  const handle = yield* ChildProcess.make("git", [...args], {
    cwd: repoRoot,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  });
  return yield* handle.exitCode;
}, Effect.scoped);

const gitStdout = Effect.fn("KpiAdoption.gitStdout")(function* (args: ReadonlyArray<string>) {
  const handle = yield* ChildProcess.make("git", [...args], {
    cwd: repoRoot,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "ignore",
  });
  const text = yield* Stream.mkString(handle.stdout.pipe(Stream.decodeText()));
  const code = yield* handle.exitCode;
  return [code, Str.trim(text)] as const;
}, Effect.scoped);

const requireFullHistory = Effect.gen(function* () {
  const [code, shallow] = yield* gitStdout(["rev-parse", "--is-shallow-repository"]);
  if (code !== 0 || shallow !== "false") {
    return yield* KpiAdoptionRepositoryError.make({
      message:
        `The adoption-table generator needs a clone with full history: git rev-parse --is-shallow-repository ` +
        `printed "${shallow}" (exit ${code}). At a shallow boundary merge-base --is-ancestor answers not-ancestor ` +
        `for true ancestors, so neither mode probes here.`,
    });
  }
});

const makeMemoizedCommitPresence = Effect.gen(function* () {
  const cache = yield* Ref.make(HashMap.empty<string, boolean>());
  const lookup = (sha: string) =>
    Effect.map(gitExit(["cat-file", "-e", `${sha}^{commit}`]), (code) => code === 0).pipe(
      Effect.tap((found) => Ref.update(cache, HashMap.set(sha, found)))
    );
  return (sha: string) =>
    Effect.flatMap(Ref.get(cache), (known) =>
      O.match(HashMap.get(known, sha), { onNone: () => lookup(sha), onSome: Effect.succeed })
    );
});

const ancestry = (entry: AdoptionProbe) =>
  Effect.flatMap(gitExit(["merge-base", "--is-ancestor", entry.mergeCommit, entry.resolvedHeadSha]), (code) =>
    code === 0 || code === 1
      ? Effect.succeed<AncestryVerdict>(code === 0 ? "ancestor" : "not-ancestor")
      : Effect.fail(`git merge-base exited ${code} for ${entry.changeEventId} at ${entry.resolvedHeadSha}`)
  );

const generate = Effect.gen(function* () {
  const mode = yield* decodeEvidenceMode(process.argv, writeScript);
  yield* requireFullHistory;
  const probes = yield* (yield* CiOpsKpi).probes(kpiReadingInput(repoRoot));
  const present = yield* makeMemoizedCommitPresence;
  const missingMerges = yield* Effect.filter(A.dedupe(A.map(probes, (entry) => entry.mergeCommit)), (sha) =>
    Effect.map(present(sha), (found) => !found)
  );
  yield* Effect.when(
    Effect.fail(`Merge commits absent from the object store: ${A.join(missingMerges, ", ")}`),
    Effect.succeed(A.isReadonlyArrayNonEmpty(missingMerges))
  );
  const rows = yield* Effect.forEach(
    probes,
    (entry) =>
      Effect.flatMap(present(entry.resolvedHeadSha), (found) =>
        found ? ancestry(entry) : Effect.succeed<AncestryVerdict>("head-missing")
      ).pipe(Effect.map((verdict) => AdoptionTableRow.make({ ...entry, ancestry: verdict }))),
    { concurrency: 1 }
  );
  const [windowW] = kpiWindows;
  const table = AdoptionTable.make({
    schemaVersion: "ciops-kpi-adoption-table/v1",
    generator,
    probe,
    generation,
    windowStart: windowW.start,
    windowEnd: windowW.end,
    pins: kpiSourcePins,
    rows,
  });
  yield* syncKpiArtifacts(mode, repoRoot, writeScript, [
    [kpiOutputPaths.adoptionTable, yield* renderAdoptionTable(table)],
  ]);
  const count = (verdict: AncestryVerdict) => A.countBy(rows, (entry) => entry.ancestry === verdict);
  yield* Console.log(
    `${EvidenceMode.is.check(mode) ? "Checked" : "Wrote"} ${kpiOutputPaths.adoptionTable}: ${A.length(rows)} probes; ancestor ${count("ancestor")}, not-ancestor ${count("not-ancestor")}, head-missing ${count("head-missing")}.`
  );
}).pipe(Effect.withSpan("KpiAdoption.generate"));

runKpiScript(generate);
