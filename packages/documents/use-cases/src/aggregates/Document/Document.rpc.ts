/**
 * Document intake RPC contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Document } from "@beep/documents-domain/aggregates/Document";
import * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import { DocumentIntakeActionError } from "./Document.errors.ts";
import { IntakeDroppedFilePayload } from "./DocumentIntake.ts";

/**
 * RPC used by the desktop app to intake one dropped file.
 *
 * @category rpcs
 * @since 0.0.0
 */
export const IntakeDroppedFileRpc = Rpc.make("IntakeDroppedFile", {
  payload: IntakeDroppedFilePayload,
  success: Document,
  error: DocumentIntakeActionError,
});

/**
 * Documents RPC group exposed by the professional desktop server.
 *
 * @category rpcs
 * @since 0.0.0
 */
export const DocumentsRpcs = RpcGroup.make(IntakeDroppedFileRpc);
