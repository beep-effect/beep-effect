import { BlobTransferError } from "@beep/github-actions/BlobTransfer";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

it.effect("transfer errors describe the failing direction", () =>
  Effect.sync(() => {
    assert.strictEqual(
      BlobTransferError.make({ reason: "uploadFailed" }).message,
      "Could not upload to the signed blob url"
    );
    assert.strictEqual(
      BlobTransferError.make({ reason: "downloadFailed" }).message,
      "Could not download from the signed blob url"
    );
  })
);
