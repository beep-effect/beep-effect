import { expect, test } from "bun:test";
import * as NodeURL from "node:url";
import * as O from "effect/Option";
import { protectedBridgeUrl } from "./transport.ts";

test("permits TLS endpoints and loopback tunnel endpoints", () => {
  for (const endpoint of [
    "wss://bridge.example:48123",
    "ws://127.0.0.1:48123",
    "ws://127.0.0.2",
    "ws://[::1]:48123",
    "ws://localhost:48123",
  ]) {
    expect(O.isSome(protectedBridgeUrl(endpoint))).toBe(true);
  }
});

test("rejects plaintext remote endpoints, deceptive authorities and other schemes", () => {
  for (const endpoint of [
    "ws://192.0.2.1:48123",
    "ws://0.0.0.0:48123",
    "ws://[::]",
    "ws://localhost.example",
    "ws://127.example",
    "ws://127.0.0.1.example",
    "ws://127.0.0.1@bridge.example",
    "wss://user:pass@bridge.example",
    "https://bridge.example",
    "ws://127.0.0.1/#fragment",
    "invalid",
  ]) {
    expect(O.isNone(protectedBridgeUrl(endpoint))).toBe(true);
  }
});

test("both actual entrypoints refuse remote plaintext before reading the token environment", () => {
  for (const entry of ["codex-remote-ask.ts", "codex-ws.ts"]) {
    const result = Bun.spawnSync(
      [
        process.execPath,
        NodeURL.fileURLToPath(new URL(entry, import.meta.url)),
        "--url",
        "ws://192.0.2.1:48123",
        "--token-env",
        "BEEP_ABSENT_TRANSPORT_TEST_TOKEN",
      ],
      { env: {} }
    );
    expect(result.exitCode).toBe(2);
    expect(new TextDecoder().decode(result.stderr)).toContain("--url requires wss://");
  }
});
