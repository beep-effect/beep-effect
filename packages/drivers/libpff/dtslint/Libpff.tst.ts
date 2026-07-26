import {
  assembleEml,
  encodePffexportMessageRecordJson,
  LIBPFF_ENGINE_NAME,
  LIBPFF_ENGINE_UNAVAILABLE_MESSAGE,
  LIBPFF_SCAFFOLD_ENGINE_UNAVAILABLE_MESSAGE,
  LIBPFF_SCAFFOLD_EXPORT_FAILED_MESSAGE,
  LIBPFF_SCAFFOLD_TIMEOUT_MESSAGE,
  LibpffError,
  LibpffFileProcessingEngine,
  LibpffFileProcessingEngineDescriptor,
  LibpffFileProcessingEngineOptions,
  libpffOperationError,
  makeLibpffError,
  makeLibpffFileProcessingEngine,
  PFFEXPORT_EML_FILE_NAME,
  PFFEXPORT_MESSAGES_SUFFIX,
  PffexportEngineConfig,
  PffexportExistingExportPolicy,
  PffexportMessageRecord,
  parseOutlookHeaders,
  stripMimeStructuralHeaders,
  synthesizeEmlHeaderBlock,
  VERSION,
} from "@beep/libpff";
import { O } from "@beep/utils";
import { describe, expect, it } from "tstyche";
import type { ExportArchiveOperation, FileProcessingOperationError } from "@beep/file-processing/Operation";
import type { FileProcessingEngineShape } from "@beep/file-processing/Service";
import type { FileProcessingEngineDescriptor } from "@beep/file-processing/Strategy";
import type { LibpffErrorReason } from "@beep/libpff";
import type { PosixPath } from "@beep/schema/PosixPath";
import type { Effect } from "effect";
import type * as S from "effect/Schema";

declare const exportOperation: ExportArchiveOperation;
declare const posixPath: PosixPath;

describe("@beep/libpff", () => {
  it("exports the driver engine and driver-local technical error contract", () => {
    const reason: LibpffErrorReason = "engine-unavailable";
    const options = LibpffFileProcessingEngineOptions.make({ syntheticExport: true });

    expect(VERSION).type.toBe<"0.0.0">();
    expect(LibpffFileProcessingEngineDescriptor).type.toBe<FileProcessingEngineDescriptor>();
    expect(LibpffFileProcessingEngine).type.toBe<FileProcessingEngineShape>();
    expect(options).type.toBe<LibpffFileProcessingEngineOptions>();
    expect(makeLibpffFileProcessingEngine(options)).type.toBe<FileProcessingEngineShape>();
    expect(LibpffError.fromReason(reason)).type.toBe<LibpffError>();
    expect(makeLibpffError(reason)).type.toBe<LibpffError>();
  });

  it("exports the shared error translation boundary", () => {
    expect(LIBPFF_ENGINE_NAME).type.toBe<"libpff">();
    expect(LIBPFF_ENGINE_UNAVAILABLE_MESSAGE).type.toBeAssignableTo<string>();
    expect(LIBPFF_SCAFFOLD_ENGINE_UNAVAILABLE_MESSAGE).type.toBeAssignableTo<string>();
    expect(LIBPFF_SCAFFOLD_EXPORT_FAILED_MESSAGE).type.toBeAssignableTo<string>();
    expect(LIBPFF_SCAFFOLD_TIMEOUT_MESSAGE).type.toBeAssignableTo<string>();
    expect(libpffOperationError(exportOperation, makeLibpffError("timeout"))).type.toBe<FileProcessingOperationError>();
  });

  it("exports the pffexport config, EML assembly, and message record contracts", () => {
    const policy: PffexportExistingExportPolicy = "replace";
    const config = PffexportEngineConfig.make({ exportRoot: "/tmp/pst-out" });

    expect(PFFEXPORT_EML_FILE_NAME).type.toBe<"Message.eml">();
    expect(PFFEXPORT_MESSAGES_SUFFIX).type.toBe<".messages.jsonl">();
    expect(PffexportExistingExportPolicy.is.replace(policy)).type.toBe<boolean>();
    expect(config.existingExportPolicy).type.toBe<PffexportExistingExportPolicy>();
    expect(assembleEml({ attachments: [], body: O.none(), boundary: "=_beep-x", headerBlock: "" })).type.toBe<string>();
    expect(stripMimeStructuralHeaders("Subject: hi")).type.toBe<string>();
    expect(parseOutlookHeaders("Subject:\thi")).type.toBe<Record<string, string>>();
    expect(synthesizeEmlHeaderBlock({ Subject: "hi" })).type.toBe<string>();

    const record = PffexportMessageRecord.make({
      attachments: [],
      folderPath: posixPath,
      headers: {},
      messagePath: posixPath,
    });
    expect(record).type.toBe<PffexportMessageRecord>();
    expect(encodePffexportMessageRecordJson(record)).type.toBe<Effect.Effect<string, S.SchemaError>>();
  });
});
