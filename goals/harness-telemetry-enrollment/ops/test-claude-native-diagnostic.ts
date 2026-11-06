import * as Fs from "node:fs/promises";
import * as Os from "node:os";
import * as Path from "node:path";
import { Sha256Hex } from "@beep/schema";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { NativeAttemptDiagnostic, writeNativeAttemptDiagnostic } from "./native-attempt-diagnostic.ts";

const record = NativeAttemptDiagnostic.make({
  requestBinding: Sha256Hex.make(Str.repeat(64)("a")),
  purpose: "source",
  stage: "dispatch-intent",
  nativeSpawned: O.none(),
  nativeExitStatus: O.none(),
  observedStdoutBytes: 0,
  outputComplete: false,
  protocol: O.none(),
  failurePhase: O.none(),
  protocolFailure: O.none(),
});
const finalName = "diagnostic-source-dispatch-intent.json";
const pendingName = ".diagnostic-source-dispatch-intent.pending";
const fixture = async () => {
  const directory = await Fs.mkdtemp(Path.join(Os.tmpdir(), "native-diagnostic-"));
  await Fs.chmod(directory, 0o700);
  return directory;
};
it.live("atomically publishes complete positive-schema metadata then removes only its owned pending", () =>
  Effect.tryPromise(async () => {
    const directory = await fixture();
    try {
      await Effect.runPromise(writeNativeAttemptDiagnostic(directory, record));
      expect(await Fs.readdir(directory)).toEqual([finalName]);
      const text = await Fs.readFile(Path.join(directory, finalName), "utf8");
      const decoded = await Effect.runPromise(S.decodeEffect(S.fromJsonString(NativeAttemptDiagnostic))(text));
      expect(O.isNone(decoded.nativeSpawned)).toBe(true);
      expect(decoded.actualApiRequestCount).toBe("unknown");
      expect((await Fs.lstat(Path.join(directory, finalName))).mode & 0o777).toBe(0o600);
    } finally {
      await Fs.rm(directory, { recursive: true, force: true });
    }
  })
);
it.live("retains partial pending bytes without exposing a complete diagnostic or overwriting them", () =>
  Effect.tryPromise(async () => {
    const directory = await fixture();
    try {
      await Fs.writeFile(Path.join(directory, pendingName), '{"partial":', { mode: 0o600 });
      const result = await Effect.runPromise(writeNativeAttemptDiagnostic(directory, record).pipe(Effect.result));
      expect(result._tag).toBe("Failure");
      expect(await Fs.readdir(directory)).toEqual([pendingName]);
      expect(await Fs.readFile(Path.join(directory, pendingName), "utf8")).toBe('{"partial":');
    } finally {
      await Fs.rm(directory, { recursive: true, force: true });
    }
  })
);
it.live("no-overwrite publication preserves an existing final and retains its new pending residue", () =>
  Effect.tryPromise(async () => {
    const directory = await fixture();
    try {
      await Fs.writeFile(Path.join(directory, finalName), "UNRELATED_FINAL_BYTES", { mode: 0o600 });
      const result = await Effect.runPromise(writeNativeAttemptDiagnostic(directory, record).pipe(Effect.result));
      expect(result._tag).toBe("Failure");
      expect(await Fs.readFile(Path.join(directory, finalName), "utf8")).toBe("UNRELATED_FINAL_BYTES");
      const pending = await Fs.readFile(Path.join(directory, pendingName), "utf8");
      expect(await Effect.runPromise(S.decodeEffect(S.fromJsonString(NativeAttemptDiagnostic))(pending))).toEqual(
        record
      );
    } finally {
      await Fs.rm(directory, { recursive: true, force: true });
    }
  })
);
it.live("refuses symlinked pending state without following or deleting another owned file", () =>
  Effect.tryPromise(async () => {
    const directory = await fixture();
    try {
      const unrelated = Path.join(directory, "unrelated");
      await Fs.writeFile(unrelated, "UNCHANGED_OTHER_STATE", { mode: 0o600 });
      await Fs.symlink(unrelated, Path.join(directory, pendingName));
      const result = await Effect.runPromise(writeNativeAttemptDiagnostic(directory, record).pipe(Effect.result));
      expect(result._tag).toBe("Failure");
      expect(await Fs.readFile(unrelated, "utf8")).toBe("UNCHANGED_OTHER_STATE");
      expect((await Fs.lstat(Path.join(directory, pendingName))).isSymbolicLink()).toBe(true);
    } finally {
      await Fs.rm(directory, { recursive: true, force: true });
    }
  })
);
