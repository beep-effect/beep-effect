import {
  makeTikaError,
  makeTikaFileProcessingEngine,
  TikaAppEngineConfig,
  TikaContentText,
  TikaError,
  TikaErrorOptions,
  TikaFileProcessingEngine,
  TikaFileProcessingEngineDescriptor,
  VERSION,
} from "@beep/tika";
import { describe, expect, it } from "tstyche";
import type { FileProcessingEngineShape } from "@beep/file-processing/Service";
import type { FileProcessingEngineDescriptor } from "@beep/file-processing/Strategy";
import type { PosInt } from "@beep/schema";
import type { TikaErrorReason } from "@beep/tika";

describe("@beep/tika", () => {
  it("exports the driver engine and driver-local technical error contract", () => {
    const reason: TikaErrorReason = "engine-unavailable";

    expect(VERSION).type.toBe<"0.0.0">();
    expect(TikaFileProcessingEngineDescriptor).type.toBe<FileProcessingEngineDescriptor>();
    expect(TikaFileProcessingEngine).type.toBe<FileProcessingEngineShape>();
    expect(makeTikaFileProcessingEngine()).type.toBe<FileProcessingEngineShape>();
    expect(TikaAppEngineConfig.make({ jarPath: "/opt/tika/tika-app.jar" }).timeoutMillis).type.toBe<PosInt>();
    expect(TikaContentText.fromUnknown("hello")).type.toBe<TikaContentText>();
    expect(TikaErrorOptions.make({})).type.toBe<TikaErrorOptions>();
    expect(TikaError.fromReason(reason)).type.toBe<TikaError>();
    expect(makeTikaError(reason)).type.toBe<TikaError>();
  });
});
