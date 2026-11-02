/**
 * The `beep qa judge-lint` re-validation.
 *
 * Ingest validates once, at write time. Lint re-runs the same schema decode and
 * round cross-check against the file that is actually committed, which is what
 * catches an inventory edited by hand, carried into a goal packet, or left
 * behind after its evidence was pruned.
 *
 * Every run that finds `inventory.json` also writes `gate-certificate.json`,
 * bound to the exact inventory bytes: passed and failed gates as evaluated,
 * and every gate after the first denial as `untested`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { SessionStore } from "@beep/qa-capture";
import * as A from "@beep/utils/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { printLines } from "../../internal/cli/Printer.ts";
import {
  evidenceCrossCheckVerdictToCrossCheck,
  isCrossCheckClean,
  renderCrossCheckFailure,
  requireRoundCoherentVerdict,
  settleAgainstRound,
} from "./JudgeCheck.ts";
import {
  DeclaredRoundCoherentInput,
  evaluateDeclaredRoundCoherent,
  evaluateJudgeOutputInventoryDecodes,
  JudgeOutputInventoryDecodesInput,
  QaJudgeSettlement,
} from "./JudgeContract.ts";
import {
  GATE_CERTIFICATE_FILE,
  inventoryEvidenceSubject,
  inventoryJsonPath,
  requireDecodedInventory,
  writeQaJudgeCertificate,
} from "./JudgeIngest.ts";
import { QaCommandError } from "./Qa.errors.ts";
import { qaRootPath, readEventLog } from "./Qa.session.ts";
import type * as Digest from "effect/crypto/Digest";
import type { CliReportedExit } from "../../internal/cli/ExitCodeError.ts";
import type { QaJudgeLintOptions } from "./Qa.schemas.ts";

const utf8Decoder = new TextDecoder();

/**
 * Re-validate a round's committed inventory against its evidence.
 *
 * **Example** (Lint inventory for round)
 *
 * ```ts
 * import { runQaJudgeLint } from "@beep/repo-cli/commands/Qa/JudgeLint"
 * import { QaJudgeLintOptions } from "@beep/repo-cli/commands/Qa/Qa.schemas"
 * import * as Effect from "effect/Effect";
 * const program = runQaJudgeLint("/repo", QaJudgeLintOptions.make({ round: 3 }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runQaJudgeLint = Effect.fn("QaJudgeLint.run")(function* (
  cwd: string,
  options: QaJudgeLintOptions
): Effect.fn.Return<
  void,
  CliReportedExit | QaCommandError,
  FileSystem.FileSystem | Path.Path | SessionStore | Digest.Digest
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const store = yield* SessionStore;

  const layout = store.roundLayout(qaRootPath(path, cwd), options.round);
  const inventoryPath = inventoryJsonPath(path, layout);
  // Only a genuinely missing inventory invalidates a certificate left by an
  // earlier run; any other read failure (permissions, I/O) keeps it.
  const removeStaleCertificate = fs
    .remove(path.join(layout.root, GATE_CERTIFICATE_FILE), { force: true })
    .pipe(
      Effect.catch((error) =>
        Console.error(
          `qa judge-lint warning: could not remove the stale ${GATE_CERTIFICATE_FILE} in ${layout.root}: ${error.message}`
        )
      )
    );
  const bytes = yield* fs.readFile(inventoryPath).pipe(
    Effect.tapError((error) => (Eq.equals(error.reason._tag, "NotFound") ? removeStaleCertificate : Effect.void)),
    QaCommandError.mapError(
      `qa judge-lint could not read ${inventoryPath}; run \`bun run beep qa judge-ingest --round ${options.round} --from <file>\` first.`
    )
  );
  const subject = yield* inventoryEvidenceSubject(bytes);
  const certify = (settlement: Pick<QaJudgeSettlement, "artifact" | "crossCheck" | "decode" | "eventId" | "round">) =>
    writeQaJudgeCertificate(layout, QaJudgeSettlement.make({ ...settlement, inventory: subject }));
  // On a failing run the certificate is best-effort evidence: the run's own
  // failure stays the reported error, and a certificate-write failure is
  // printed to stderr instead of replacing it.
  const certifyAfterFailure = (
    settlement: Pick<QaJudgeSettlement, "artifact" | "crossCheck" | "decode" | "eventId" | "round">
  ) =>
    certify(settlement).pipe(
      Effect.catch((error) =>
        Console.error(`qa judge-lint warning: ${error.message} The run's own failure is reported instead.`)
      )
    );
  const untested = O.none();

  const decode = yield* evaluateJudgeOutputInventoryDecodes(
    JudgeOutputInventoryDecodesInput.make({ candidate: utf8Decoder.decode(bytes) })
  );
  const inventory = yield* requireDecodedInventory(decode, {
    "inventory-schema-rejected": `qa judge-lint rejected ${inventoryPath} against the qa-inventory/v1 schema.`,
    "malformed-json": `qa judge-lint could not parse ${inventoryPath} as JSON.`,
  }).pipe(
    Effect.tapError(() =>
      certifyAfterFailure({
        artifact: untested,
        crossCheck: untested,
        decode: O.some(decode),
        eventId: untested,
        round: untested,
      })
    )
  );
  // A copied inventory can pass another round's cross-check (seqs restart per
  // round, frame names repeat), so round coherence is checked explicitly.
  const round = yield* evaluateDeclaredRoundCoherent(
    DeclaredRoundCoherentInput.make({ declaredRound: inventory.round, requestedRound: options.round })
  );
  const beforeSettlement = {
    artifact: untested,
    crossCheck: untested,
    decode: O.some(decode),
    eventId: untested,
    round: O.some(round),
  };
  yield* requireRoundCoherentVerdict(round).pipe(Effect.tapError(() => certifyAfterFailure(beforeSettlement)));

  const eventLog = yield* readEventLog(layout.eventsPath).pipe(
    Effect.tapError(() => certifyAfterFailure(beforeSettlement))
  );
  const settled = yield* settleAgainstRound(layout, inventory, eventLog);
  const settledCertificate = {
    ...beforeSettlement,
    artifact: O.some(settled.artifact),
    crossCheck: O.some(settled.crossCheck),
    eventId: O.some(settled.eventId),
  };
  const check = evidenceCrossCheckVerdictToCrossCheck(settled.crossCheck);

  yield* printLines([
    `qa judge-lint: round ${options.round}`,
    `  findings: ${A.length(inventory.findings)} (required ${inventory.requiredCount})`,
    `  inventory: ${inventoryPath}`,
  ]);

  if (!isCrossCheckClean(check)) {
    yield* printLines([renderCrossCheckFailure(options.round, check)]);
    // A dirty run keeps the cross-check failure as its reported outcome.
    yield* certifyAfterFailure(settledCertificate);
    return yield* failWithReportedExit(`qa judge-lint: round ${options.round} inventory is not backed by evidence`, 1);
  }

  yield* printLines(["  cross-check: ok"]);
  // A clean run must leave its certificate, so a write failure fails it after
  // the verdict has been printed.
  yield* certify(settledCertificate);
});
