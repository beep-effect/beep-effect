import * as AcpError from "@beep/acp/errors";
import {
  ACP_STDERR_TAIL_MAX_CHARS,
  AcpStderrTail,
  appendStderrTail,
  collectStderrTail,
  sanitizeStderrExcerpt,
  withStderrExcerpt,
} from "@beep/acp/stderr";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const encoder = new TextEncoder();
const bytes = (...chunks: ReadonlyArray<string>) =>
  Stream.fromIterable(A.map(chunks, (chunk) => encoder.encode(chunk)));

describe("sanitizeStderrExcerpt", () => {
  it("removes the entire underscore-containing provider credential", () => {
    const body = `${Str.repeat(20)("A")}_${Str.repeat(40)("B")}`;
    for (const prefix of ["sk-proj-", "sk-svcacct-", "sk-ant-api03-", "sk-ant-oat01-"]) {
      assert.strictEqual(sanitizeStderrExcerpt(`key=${prefix}${body}`, []), "key=[redacted]");
    }
  });

  it("redacts home paths, pairing URLs, sign-in URLs and tokens", () => {
    const excerpt = sanitizeStderrExcerpt(
      A.join(
        [
          "Invalid project config at /Users/ada/.agent/cli.json",
          "Authorization: Bearer secret-token-value",
          "Sign in: https://accounts.google.com/o/oauth2/v2/auth?state=oauth-state-value",
          "Visit http://localhost:5733/pair#token=ABCDEF for pairing",
          "key=sk-abcdefghijklmnopqrstuv",
        ],
        "\n"
      ),
      ["/home/server", "/Users/ada"]
    );

    assert.include(excerpt, "Invalid project config at ~/.agent/cli.json");
    assert.include(excerpt, "Bearer [redacted]");
    assert.include(excerpt, "[pairing-url]");
    assert.include(excerpt, "[sign-in-url]");
    assert.notInclude(excerpt, "secret-token-value");
    assert.notInclude(excerpt, "ABCDEF");
    assert.notInclude(excerpt, "oauth-state-value");
    assert.notInclude(excerpt, "sk-abcdefghijklmnopqrstuv");
  });

  it("redacts project keys, header credentials and forge tokens", () => {
    const secrets = [
      "sk-proj-abcdefghijklmnopqrstuvwxyz012345",
      "sk-svcacct-abcdefghijklmnopqrstuvwxyz012345",
      "sk-ant-api03-abcdefghijklmnopqrstuvwxyz012345",
      "ghp_abcdefghijklmnopqrstuvwxyz0123456789",
      "github_pat_11ABCDEFG0123456789_abcdefghijklmnop",
      "xoxb-1234-5678-abcdefghijkl",
      `ops_${Str.repeat(2)("eyJzaWduSW5BZGRyZXNzIjoibXkuMXBhc3N3b3JkLmNvbSJ9")}`,
    ];
    const excerpt = sanitizeStderrExcerpt(
      A.join([...secrets, "Authorization: Basic dXNlcjpwYXNz", "x-api-key: ant-api-key-value"], "\n"),
      []
    );

    assert.include(excerpt, "Authorization: Basic [redacted]");
    assert.include(excerpt, "x-api-key: [redacted]");
    for (const secret of secrets) assert.notInclude(excerpt, secret);
    assert.notInclude(excerpt, "dXNlcjpwYXNz");
    assert.notInclude(excerpt, "ant-api-key-value");
  });

  it("replaces nested homes longest first, ignores root-like homes and drops NUL characters", () => {
    const excerpt = sanitizeStderrExcerpt(" /home/ada/profile/log /home/ada/x\0 ", [
      "/home/ada",
      "/home/ada/profile",
      "/",
    ]);

    assert.strictEqual(excerpt, "~/log ~/x");
  });

  it("has a data-last form", () => {
    assert.strictEqual(sanitizeStderrExcerpt(["/srv/owned"])("/srv/owned/agent.log"), "~/agent.log");
  });
});

describe("appendStderrTail", () => {
  it("keeps the last characters once the bound is exceeded", () => {
    const tail = appendStderrTail(`${Str.repeat(ACP_STDERR_TAIL_MAX_CHARS)("a")}TAIL`)(AcpStderrTail.empty);

    assert.strictEqual(tail.text.length, ACP_STDERR_TAIL_MAX_CHARS);
    assert.isTrue(Str.endsWith("TAIL")(tail.text));
    assert.isTrue(tail.truncated);
  });

  it("stays untruncated within the bound", () => {
    const tail = appendStderrTail("b")(appendStderrTail("a")(AcpStderrTail.empty));

    assert.strictEqual(tail.text, "ab");
    assert.isFalse(tail.truncated);
  });
});

describe("collectStderrTail", () => {
  it.effect(
    "omits a truncated partial line and leaves an exit error unchanged without an excerpt",
    Effect.fnUntraced(function* () {
      const collector = yield* collectStderrTail(bytes(Str.repeat(ACP_STDERR_TAIL_MAX_CHARS + 1)("x")));
      yield* collector.drained;
      assert.isTrue((yield* collector.tail).truncated);
      assertNone(yield* collector.excerpt);
      const exited = AcpError.AcpProcessExitedError.make({ code: O.some(1) });
      assert.strictEqual(yield* withStderrExcerpt(collector)(exited), exited);
    })
  );

  it.effect(
    "collects the sanitized excerpt after the stream drains",
    Effect.fnUntraced(function* () {
      const collector = yield* collectStderrTail(bytes("fatal: config ", "/owned/profile/.agent missing\n"), {
        homeDirectories: ["/owned/profile"],
      });
      yield* collector.drained;

      assertSome(yield* collector.excerpt, "fatal: config ~/.agent missing");
      assert.isFalse((yield* collector.tail).truncated);
    })
  );

  it.effect(
    "drops the partial first line of a truncated tail so a cut credential never leaks",
    Effect.fnUntraced(function* () {
      // The 4096-character tail starts 18 characters into the first line, inside the token.
      const credential = "Bearer SECRETTOKENVALUE123\n";
      const filler = Str.repeat(ACP_STDERR_TAIL_MAX_CHARS - (credential.length - 18))("z");
      const collector = yield* collectStderrTail(bytes(credential, filler));
      yield* collector.drained;

      const tail = yield* collector.tail;
      assert.isTrue(tail.truncated);
      assert.isTrue(Str.startsWith("VALUE123\n")(tail.text));
      assertSome(yield* collector.excerpt, filler);
    })
  );

  it.effect(
    "reports no excerpt for blank output and survives a failing stream",
    Effect.fnUntraced(function* () {
      const collector = yield* collectStderrTail(Stream.concat(bytes("  \n"), Stream.fail("boom")));

      assertNone(yield* collector.excerpt);
    })
  );
});

describe("withStderrExcerpt", () => {
  it.effect(
    "attaches the excerpt to a process exit without one and leaves other errors alone",
    Effect.fnUntraced(function* () {
      const collector = yield* collectStderrTail(bytes("panic: lost auth\n"));
      const exited = AcpError.AcpProcessExitedError.make({ code: O.some(2), pid: O.some(7) });

      const enriched = yield* withStderrExcerpt(collector)(exited);
      if (enriched._tag !== "AcpProcessExitedError") return assert.fail("expected a process exit error");
      assertSome(enriched.stderr, "panic: lost auth");
      assertSome(enriched.code, 2);
      assertSome(enriched.pid, 7);
      assert.strictEqual(enriched.message, "ACP process exited with code 2\npanic: lost auth");

      const existing = AcpError.AcpProcessExitedError.make({ stderr: O.some("already captured") });
      assert.strictEqual(yield* withStderrExcerpt(collector)(existing), existing);

      const transport = AcpError.AcpTransportError.make({});
      assert.strictEqual(yield* withStderrExcerpt(collector)(transport), transport);
    })
  );
});
