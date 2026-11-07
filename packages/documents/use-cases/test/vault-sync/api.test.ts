import { VaultSyncApi, vaultSyncCli } from "@beep/documents-use-cases/aggregates/VaultSync";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";

it("derives a CLI without internal command targets", () => {
  const command = vaultSyncCli({ headers: {} });
  expect(command).toBeDefined();
  expect(A.map(VaultSyncApi.commands, (command) => command.tag)).toEqual([
    "ClaimDestinationName",
    "RecordConflict",
    "PauseDestination",
    "ResumeDestination",
    "ReviewConflict",
  ]);
});
