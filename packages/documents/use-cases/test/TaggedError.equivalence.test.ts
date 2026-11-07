import {
  DocumentIntakeActionError,
  DocumentMaterializationFailed,
  FilingDecisionUnavailable,
} from "@beep/documents-use-cases/aggregates/Document/server";
import {
  DmsMirrorUnavailable,
  VaultScanFailed,
  VaultSyncActionError,
  VaultSyncReadUnavailable,
} from "@beep/documents-use-cases/aggregates/Sync/server";
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { pipe } from "effect/Function";
import * as S from "effect/Schema";

const expectDeclaredEquivalence = <Schema extends S.Top>(
  schema: Schema,
  a: Schema["Type"],
  b: Schema["Type"],
  c: Schema["Type"]
): void => {
  const same = S.toEquivalence(schema);

  pipe(same(a, b), assertTrue);
  pipe(same(a, c), assertFalse);
};

describe("documents-use-cases tagged-error declared equivalence", () => {
  it("compares document and sync action errors by their declared fields", () => {
    expectDeclaredEquivalence(
      FilingDecisionUnavailable,
      FilingDecisionUnavailable.make({ reason: "classifier unavailable" }),
      FilingDecisionUnavailable.make({ reason: "classifier unavailable" }),
      FilingDecisionUnavailable.make({ reason: "taxonomy unavailable" })
    );
    expectDeclaredEquivalence(
      DocumentMaterializationFailed,
      DocumentMaterializationFailed.make({ reason: "vault write failed" }),
      DocumentMaterializationFailed.make({ reason: "vault write failed" }),
      DocumentMaterializationFailed.make({ reason: "vault root missing" })
    );
    expectDeclaredEquivalence(
      DocumentIntakeActionError,
      DocumentIntakeActionError.new("Workspace vault is not configured."),
      DocumentIntakeActionError.new("Workspace vault is not configured."),
      DocumentIntakeActionError.new("Document intake is unavailable.")
    );
    expectDeclaredEquivalence(
      DmsMirrorUnavailable,
      DmsMirrorUnavailable.make({ provider: "box", reason: "rate limited", retryable: true }),
      DmsMirrorUnavailable.make({ provider: "box", reason: "rate limited", retryable: true }),
      DmsMirrorUnavailable.make({ provider: "box", reason: "permission denied", retryable: false })
    );
    expectDeclaredEquivalence(
      VaultScanFailed,
      VaultScanFailed.make({ reason: "vault root unreadable" }),
      VaultScanFailed.make({ reason: "vault root unreadable" }),
      VaultScanFailed.make({ reason: "vault root missing" })
    );
    expectDeclaredEquivalence(
      VaultSyncActionError,
      VaultSyncActionError.new("Vault sync is unavailable."),
      VaultSyncActionError.new("Vault sync is unavailable."),
      VaultSyncActionError.new("Vault sync timed out.")
    );
  });

  it("compares vault sync read-model errors by their declared fields", () => {
    expectDeclaredEquivalence(
      VaultSyncReadUnavailable,
      VaultSyncReadUnavailable.make({ reason: "database unavailable" }),
      VaultSyncReadUnavailable.make({ reason: "database unavailable" }),
      VaultSyncReadUnavailable.make({ reason: "transaction aborted" })
    );
  });
});
