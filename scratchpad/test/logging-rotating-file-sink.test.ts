import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Result } from "effect";
import { describe, expect, it } from "vitest";
import { RotatingFileSink, RotatingFileSinkOptions } from "../explore/shared/Logging/Logging.models.ts";

describe("RotatingFileSink", () => {
  it("writes string and Buffer chunks to the configured log file", () => {
    const dir = mkdtempSync(join(tmpdir(), "beep-rotating-log-"));
    try {
      const options = RotatingFileSinkOptions.make({
        filePath: join(dir, "run.log"),
        maxBytes: 100,
        maxFiles: 2,
        throwOnError: true,
      });
      const sink = Result.getOrThrow(RotatingFileSink.make(options).new(options));

      sink.write("hello");
      sink.write(Buffer.from(" world"));

      expect(readFileSync(options.filePath, "utf8")).toBe("hello world");
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });
});
