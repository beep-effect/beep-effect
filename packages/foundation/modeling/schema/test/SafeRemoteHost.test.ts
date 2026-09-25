import { assertAllowedRemoteHost, assertAllowedRemoteUrl, isBlockedRemoteHost } from "@beep/schema";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";

describe("SafeRemoteHost", () => {
  it("classifies literal loopback, link-local, RFC1918/ULA, and metadata hosts", () => {
    expect(isBlockedRemoteHost("127.0.0.1")).toBe(true);
    expect(isBlockedRemoteHost("169.254.169.254")).toBe(true);
    expect(isBlockedRemoteHost("10.0.0.5")).toBe(true);
    expect(isBlockedRemoteHost("192.168.1.1")).toBe(true);
    expect(isBlockedRemoteHost("172.16.0.1")).toBe(true);
    expect(isBlockedRemoteHost("172.32.0.1")).toBe(false);
    expect(isBlockedRemoteHost("example.com")).toBe(false);
  });

  it.effect(
    "rejects a public hostname that resolves to an internal address when a resolver is supplied (CSF-006)",
    Effect.fnUntraced(function* () {
      const exit = yield* Effect.exit(
        assertAllowedRemoteHost("internal.example.com", {
          resolve: () => Effect.succeed(["93.184.216.34", "169.254.169.254"]),
        })
      );
      expect(exit._tag).toBe("Failure");
    })
  );

  it.effect(
    "allows a public hostname that resolves only to public addresses",
    Effect.fnUntraced(function* () {
      const exit = yield* Effect.exit(
        assertAllowedRemoteHost("example.com", { resolve: () => Effect.succeed(["93.184.216.34"]) })
      );
      expect(exit._tag).toBe("Success");
    })
  );

  it.effect(
    "stays back-compatible: with no resolver only the literal host is classified",
    Effect.fnUntraced(function* () {
      const blocked = yield* Effect.exit(assertAllowedRemoteHost("169.254.169.254"));
      expect(blocked._tag).toBe("Failure");
      const allowed = yield* Effect.exit(assertAllowedRemoteHost("example.com"));
      expect(allowed._tag).toBe("Success");
    })
  );

  it("blocks IPv4-mapped IPv6 RFC1918/loopback/link-local forms (CSF-SSRF mapped-v6 bypass)", () => {
    // Hex form as produced by `new URL(...).hostname` normalization.
    expect(isBlockedRemoteHost("::ffff:c0a8:101")).toBe(true); // 192.168.1.1
    expect(isBlockedRemoteHost("::ffff:a00:1")).toBe(true); // 10.0.0.1
    expect(isBlockedRemoteHost("::ffff:ac10:1")).toBe(true); // 172.16.0.1
    expect(isBlockedRemoteHost("::ffff:7f00:1")).toBe(true); // 127.0.0.1
    expect(isBlockedRemoteHost("::ffff:a9fe:a9fe")).toBe(true); // 169.254.169.254
    expect(isBlockedRemoteHost("[::ffff:c0a8:101]")).toBe(true); // bracketed
    // Dotted-suffix mapped form (reachable for raw-host callers).
    expect(isBlockedRemoteHost("::ffff:192.168.1.1")).toBe(true);
    expect(isBlockedRemoteHost("::ffff:10.0.0.1")).toBe(true);
    // Public mapped addresses stay allowed (no over-blocking).
    expect(isBlockedRemoteHost("::ffff:101:101")).toBe(false); // 1.1.1.1
    expect(isBlockedRemoteHost("::ffff:ac20:1")).toBe(false); // 172.32.0.1 (outside the /12)
  });

  it.effect(
    "assertAllowedRemoteUrl blocks an IPv4-mapped IPv6 URL host (::ffff:c0a8:101 -> 192.168.1.1)",
    Effect.fnUntraced(function* () {
      const exit = yield* Effect.exit(assertAllowedRemoteUrl("http://[::ffff:c0a8:101]/file"));
      expect(exit._tag).toBe("Failure");
    })
  );

  it.effect(
    "assertAllowedRemoteUrl resolves the host and blocks names resolving to internal space",
    Effect.fnUntraced(function* () {
      const blocked = yield* Effect.exit(
        assertAllowedRemoteUrl("https://internal.example.com/x", {
          resolve: () => Effect.succeed(["10.0.0.5"]),
        })
      );
      expect(blocked._tag).toBe("Failure");
      const allowed = yield* Effect.exit(
        assertAllowedRemoteUrl("https://example.com/x", { resolve: () => Effect.succeed(["93.184.216.34"]) })
      );
      expect(allowed._tag).toBe("Success");
    })
  );
});
