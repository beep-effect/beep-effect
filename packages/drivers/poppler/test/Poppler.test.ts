import { makePopplerRasterizer, PopplerConfig, PopplerError, tiffFrameCount, VERSION } from "@beep/poppler";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";

const pdfinfoStub = (pagesLine: string): string => `#!/usr/bin/env bash
printf 'Title:          Synthetic\\n${pagesLine}\\nPage size:      612 x 792 pts\\n'
exit 0
`;

const failingStub = `#!/usr/bin/env bash
exit 1
`;

const hangingStub = `#!/usr/bin/env bash
exec sleep 20
`;

// Writes the PNG pdftoppm would write (output root is the last argument) and
// records its arguments so the test can read the page range and resolution.
const pdftoppmStub = (argsLog: string): string => `#!/usr/bin/env bash
printf '%s\\n' "$*" > "${argsLog}"
printf 'synthetic-png-bytes' > "\${@: -1}.png"
exit 0
`;

const silentStub = `#!/usr/bin/env bash
exit 0
`;

const fixture = Effect.fn("PopplerTest.fixture")(function* (stubs: {
  readonly pdfinfo?: string;
  readonly pdftoppm?: string;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "poppler-test-" });
  const install = Effect.fn("PopplerTest.install")(function* (name: string, script: string | undefined) {
    const stubPath = path.join(directory, name);
    if (script !== undefined) {
      yield* fs.writeFileString(stubPath, script);
      yield* fs.chmod(stubPath, 0o755);
    }
    return stubPath;
  });
  const pdfPath = path.join(directory, "synthetic.pdf");
  yield* fs.writeFileString(pdfPath, "not a real pdf");
  return {
    directory,
    pdfinfoPath: yield* install("pdfinfo-stub", stubs.pdfinfo),
    pdfPath,
    pdftoppmPath: yield* install("pdftoppm-stub", stubs.pdftoppm),
  };
});

// Classic TIFF header plus a directory chain. Each directory has zero entries
// and a next-directory offset; a zero offset ends the chain.
const tiffBytes = (littleEndian: boolean, directoryCount: number, loop = false): Uint8Array => {
  const bytes = new Uint8Array(8 + directoryCount * 6);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, littleEndian ? 0x4949 : 0x4d4d, false);
  view.setUint16(2, 42, littleEndian);
  view.setUint32(4, directoryCount === 0 ? 0 : 8, littleEndian);
  for (let index = 0; index < directoryCount; index += 1) {
    const offset = 8 + index * 6;
    view.setUint16(offset, 0, littleEndian);
    const last = index === directoryCount - 1;
    view.setUint32(offset + 2, last ? (loop ? 8 : 0) : offset + 6, littleEndian);
  }
  return bytes;
};

it("counts TIFF frames from the directory chain without decoding", () => {
  assertSome(tiffFrameCount(tiffBytes(true, 1)), 1);
  assertSome(tiffFrameCount(tiffBytes(false, 1)), 1);
  assertSome(tiffFrameCount(tiffBytes(true, 3)), 3);
  assertNone(tiffFrameCount(tiffBytes(true, 0)));
  assertNone(tiffFrameCount(tiffBytes(true, 2, true)));
  assertNone(tiffFrameCount(new Uint8Array([0x49, 0x49, 42, 0, 200, 0, 0, 0])));
  assertNone(tiffFrameCount(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])));
  assertNone(tiffFrameCount(new Uint8Array([1, 2, 3])));
});

it.layer(NodeServices.layer, { timeout: "60 seconds" })("Poppler rasterizer", (it) => {
  it.effect(
    "probes both tools once and fails when either is missing",
    Effect.fnUntraced(function* () {
      const both = yield* fixture({ pdfinfo: silentStub, pdftoppm: silentStub });
      const onlyInfo = yield* fixture({ pdfinfo: silentStub });

      yield* (yield* makePopplerRasterizer(
        PopplerConfig.make({ pdfinfoPath: both.pdfinfoPath, pdftoppmPath: both.pdftoppmPath })
      )).probe;
      const missing = yield* (yield* makePopplerRasterizer(
        PopplerConfig.make({ pdfinfoPath: onlyInfo.pdfinfoPath, pdftoppmPath: onlyInfo.pdftoppmPath })
      )).probe.pipe(Effect.flip);

      expect(missing.reason).toBe("engine-unavailable");
      expect(missing.message).toBe(`${onlyInfo.pdftoppmPath} could not be started.`);
    })
  );

  it.effect(
    "applies the documented configuration defaults",
    Effect.fnUntraced(function* () {
      const config = PopplerConfig.make({});
      const decoded = yield* S.decodeEffect(PopplerConfig)({});

      expect(config).toEqual(decoded);
      expect(config.dpi).toBe(300);
      expect(config.pdfinfoPath).toBe("pdfinfo");
      expect(config.pdftoppmPath).toBe("pdftoppm");
      expect(config.timeoutMillis).toBe(60_000);
      expect(VERSION).toBe("0.0.0");
    })
  );

  it.effect(
    "reads the page count from pdfinfo",
    Effect.fnUntraced(function* () {
      const { pdfinfoPath, pdfPath } = yield* fixture({ pdfinfo: pdfinfoStub("Pages:          3") });
      const rasterizer = yield* makePopplerRasterizer(PopplerConfig.make({ pdfinfoPath }));

      expect(yield* rasterizer.pageCount(pdfPath)).toBe(3);
    })
  );

  it.effect(
    "rejects pdfinfo output without a usable page count",
    Effect.fnUntraced(function* () {
      const reasons = yield* Effect.forEach(
        ["Pages:          0", "Pages:          2.5", "Pages:          many", "Encrypted:      no"],
        Effect.fnUntraced(function* (pagesLine) {
          const { pdfinfoPath, pdfPath } = yield* fixture({ pdfinfo: pdfinfoStub(pagesLine) });
          const rasterizer = yield* makePopplerRasterizer(PopplerConfig.make({ pdfinfoPath }));
          return (yield* rasterizer.pageCount(pdfPath).pipe(Effect.flip)).reason;
        })
      );

      expect(reasons).toEqual(A.replicate("output-invalid", 4));
    })
  );

  it.effect(
    "reports a missing binary, a failed process and a timeout as distinct reasons",
    Effect.fnUntraced(function* () {
      const missing = yield* fixture({});
      const failing = yield* fixture({ pdfinfo: failingStub });
      const hanging = yield* fixture({ pdfinfo: hangingStub });

      const unavailable = yield* (yield* makePopplerRasterizer(
        PopplerConfig.make({ pdfinfoPath: missing.pdfinfoPath })
      ))
        .pageCount(missing.pdfPath)
        .pipe(Effect.flip);
      const failed = yield* (yield* makePopplerRasterizer(PopplerConfig.make({ pdfinfoPath: failing.pdfinfoPath })))
        .pageCount(failing.pdfPath)
        .pipe(Effect.flip);
      const timedOut = yield* (yield* makePopplerRasterizer(
        PopplerConfig.make({ pdfinfoPath: hanging.pdfinfoPath, timeoutMillis: 300 })
      ))
        .pageCount(hanging.pdfPath)
        // Live clock: the timeout races a real subprocess, which the test clock never advances past.
        .pipe(Effect.flip, TestClock.withLive);

      expect(unavailable).toEqual(
        PopplerError.make({ message: `${missing.pdfinfoPath} could not be started.`, reason: "engine-unavailable" })
      );
      expect(failed.reason).toBe("process-failed");
      expect(failed.message).toContain("status 1");
      expect(timedOut.reason).toBe("timed-out");
    })
  );

  it.effect(
    "renders one page to a grayscale PNG with its digest",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const base = yield* fixture({});
      const argsLog = path.join(base.directory, "pdftoppm-args.log");
      yield* fs.writeFileString(base.pdftoppmPath, pdftoppmStub(argsLog));
      yield* fs.chmod(base.pdftoppmPath, 0o755);
      const rasterizer = yield* makePopplerRasterizer(
        PopplerConfig.make({ dpi: 150, pdftoppmPath: base.pdftoppmPath })
      );

      const image = yield* rasterizer.renderPage(base.pdfPath, 2);
      const args = yield* fs.readFileString(argsLog);

      expect(new TextDecoder().decode(image.bytes)).toBe("synthetic-png-bytes");
      // sha256("synthetic-png-bytes")
      expect(image.digest).toBe("sha256:6b3d646cf8e5146959f655fdaef7e568c7b39e37662c1003bbfd4cb3bf181baa");
      expect(image.dpi).toBe(150);
      expect(image.mediaType).toBe("image/png");
      expect(Str.startsWith("-r 150 -gray -png -singlefile -f 2 -l 2 ")(args)).toBe(true);
    })
  );

  it.effect(
    "fails when pdftoppm writes no page image",
    Effect.fnUntraced(function* () {
      const { pdfPath, pdftoppmPath } = yield* fixture({ pdftoppm: silentStub });
      const rasterizer = yield* makePopplerRasterizer(PopplerConfig.make({ pdftoppmPath }));

      const error = yield* rasterizer.renderPage(pdfPath, 1).pipe(Effect.flip);

      expect(error).toEqual(
        PopplerError.make({ message: "pdftoppm produced no page image.", reason: "output-invalid" })
      );
    })
  );
});
