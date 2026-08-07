import { describeSensitiveHits, scanSensitiveText, scanSensitiveUnknown } from "@beep/repo-cli/test/Codex";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";

const codesFor = (value: string): ReadonlyArray<string> =>
  A.dedupe(A.map(scanSensitiveText("surface", value), (hit) => hit.code));

/**
 * Secret-shaped fixtures are assembled at runtime rather than written as
 * literals. The repository's secret gate scans the commit range using the base
 * branch's config, so a literal committed here could not be suppressed by an
 * allowlist added in the same change — and a scanner's own test file is
 * exactly where a scanner-tripping literal is least welcome. None of these are
 * real credentials.
 */
const fakeOpenAiKey = `sk-${"abcdefghijklmnopqrstuv"}`;
const fakeJwt = A.join(["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiIxMjM0NTY3ODkwIn0", "dBjftJeZ4CVPmB92K27uhbUJU1p1r"], ".");
const fakeAssignedSecret = `${A.join(["API", "KEY"], "_")}=hunter2`;

/**
 * Every entry below was measured against the repo's existing log sanitizer
 * (`sanitizeSensitiveText`) and passed through it untouched. They are the
 * reason this scan exists rather than reusing that helper.
 */
const provenSanitizerGaps: ReadonlyArray<readonly [string, string, string]> = [
  ["raw document.cookie", "__cf_bm=AbCdEfGh12345678; _puid=user-XYZ987654; oai-did=9f3c1", "session-cookie"],
  ["json-encoded cookie header", '{"cookie": "__cf_bm=AbCdEf12345; _puid=user-XYZ987"}', "auth-header"],
  [
    "presigned s3 url",
    "https://example.invalid/a.patch?X-Amz-Signature=9d8f7a6b5c4d3e2f1a0b&X-Amz-Expires=900",
    "signed-url-param",
  ],
  ["azure sas url", "https://example.invalid/a?sv=2021-08-06&sig=abcDEF123%2Bxyz&se=2026-08-05", "signed-url-param"],
  ["1password reference", "op://Private/OpenAI/credential", "onepassword-ref"],
  ["private home path", "/home/elpresidank/YeeBois/projects/beep-effect8/goals/x", "private-home-path"],
];

describe("codex findings reject-scan closes the measured sanitizer gaps", () => {
  for (const [label, input, expectedCode] of provenSanitizerGaps) {
    it(`refuses ${label}`, () => {
      expect(codesFor(input)).toContain(expectedCode);
    });
  }
});

describe("codex findings reject-scan credential classes", () => {
  const cases: ReadonlyArray<readonly [string, string, string]> = [
    ["authorization header", "Authorization: Bearer abcdefghijklmnop", "auth-header"],
    ["bearer credential", "Bearer abcdefghijklmnopqrstuv", "bearer-credential"],
    ["openai key", fakeOpenAiKey, "secret-shaped-value"],
    ["assignment-shaped secret", fakeAssignedSecret, "secret-shaped-value"],
    ["jwt", fakeJwt, "jwt-token"],
    ["macos home path", "/Users/someone/Documents", "private-home-path"],
    ["windows home path", "C:\\Users\\someone\\Documents", "private-home-path"],
    ["tilde home", "see ~/notes.txt", "private-home-path"],
    ["userprofile env ref", "%USERPROFILE%\\config", "private-home-path"],
    ["bidi override", "safe\u202Eevil", "bidi-control"],
    ["secure cookie prefix", "__Secure-next-auth.session-token=abc", "session-cookie"],
    // Present in every row of the signed-in CSV export.
    ["github noreply author email", "12345678+someuser@users.noreply.github.com", "email-address"],
    ["plain author email", "someone@example.com", "email-address"],
    ["excel formula", "=cmd|'/c calc'!A1", "spreadsheet-formula"],
    ["lotus-style formula", "@SUM(1+1)*cmd", "spreadsheet-formula"],
    ["signed formula", "-2+3+cmd|'/c calc'!A1", "spreadsheet-formula"],
  ];

  for (const [label, input, expectedCode] of cases) {
    it(`refuses ${label}`, () => {
      expect(codesFor(input)).toContain(expectedCode);
    });
  }
});

describe("codex findings reject-scan admits legitimate packet prose", () => {
  const benign: ReadonlyArray<readonly [string, string]> = [
    ["a finding title", "Unbounded source resolution enables sidecar memory DoS"],
    ["a repo-relative path", "packages/workspace/server/src/SourceText/WorkspaceSourceTextResolver.ts"],
    ["a verification command", "bunx --bun vitest run --root packages/tooling/tool/cli"],
    ["the dashboard url", "https://chatgpt.com/codex/cloud/security/findings/"],
    ["a source commit", "244529aa4f560421cd096c2a4a4cb3cd21923070"],
    ["a codex identifier", "d2b9e11e8550819193516057a336ff90"],
    ["prose naming a token concept", "The session token is never written to disk."],
    ["a typescript fence", "```ts\nconst value = 1\n```"],
    ["a vuln class label", "CWE-78 argument/exec control, missing-trust-boundary"],
    ["a short query parameter", "https://example.invalid/a?sig=1"],
    // The email rule must not fire on the `@` forms that saturate this repo.
    ["a scoped package import", 'import { A } from "@beep/utils"'],
    ["a jsdoc category tag in situ", " * @category utilities"],
    ["a version specifier", "typescript@5.9.2 and @beep/repo-cli@workspace:*"],
    // The formula rule is anchored, so interior sigils are ordinary prose.
    ["a title containing a hyphen and equals", "Config allows plaintext http= and cross-origin reads"],
    ["a markdown bullet body", "# Title\n\n- first bullet\n- second bullet"],
  ];

  for (const [label, input] of benign) {
    it(`admits ${label}`, () => {
      expect(scanSensitiveText("surface", input)).toEqual([]);
    });
  }
});

describe("codex findings reject-scan traversal of untrusted payloads", () => {
  it("addresses a nested hit by logical surface", () => {
    const hits = scanSensitiveUnknown("payload", {
      capture: { note: "fine" },
      findings: [{ title: "fine" }, { title: "op://vault/item" }],
    });

    expect(A.map(hits, (hit) => hit.surface)).toEqual(["payload.findings[1].title"]);
  });

  it("scans object keys as well as values", () => {
    const hits = scanSensitiveUnknown("payload", { "/home/dev/leak": "fine" });

    expect(A.map(hits, (hit) => hit.code)).toContain("private-home-path");
  });

  it("refuses a payload nested past the scan depth instead of walking it", () => {
    const deep = A.reduce(A.range(1, 40), {} as Record<string, unknown>, (acc) => ({ nested: acc }));
    const hits = scanSensitiveUnknown("payload", deep);

    expect(A.map(hits, (hit) => hit.code)).toContain("max-scan-depth");
  });

  it("never carries the offending value in a hit or its description", () => {
    const secret = `sk-${"abcdefghijklmnopqrstuv"}`;
    const hits = scanSensitiveUnknown("payload", { findings: [{ title: secret }] });
    const described = describeSensitiveHits(hits);

    expect(hits.length).toBeGreaterThan(0);
    expect(JSON.stringify(hits)).not.toContain(secret);
    expect(described.join(" ")).not.toContain(secret);
    expect(described).toEqual(["payload.findings[0].title (secret-shaped-value)"]);
  });
});
