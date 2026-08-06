import {
  CODEX_CSV_COLUMNS,
  CODEX_CSV_PII_COLUMNS,
  codexIdFromFindingUrl,
  decodeCodexFindingsCsv,
} from "@beep/repo-cli/test/Codex";
import { A, O } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";

const id = (seed: string): string => seed.repeat(32).slice(0, 32);
const sha = (seed: string): string => seed.repeat(40).slice(0, 40);
const url = (seed: string): string => `https://chatgpt.com/codex/cloud/security/findings/${id(seed)}`;

const quote = (value: string): string => `"${value.replaceAll('"', '""')}"`;

const row = (input: {
  readonly seed: string;
  readonly title?: string;
  readonly severity?: string;
  readonly status?: string;
  readonly description?: string;
}): string =>
  A.join(
    [
      url(input.seed),
      "kriegcloud/beep-effect",
      "https://github.com/kriegcloud/beep-effect",
      quote(input.title ?? "A captured finding"),
      quote(input.description ?? "Report body."),
      input.severity ?? "medium",
      input.status ?? "new",
      "2026-08-04T16:06:15.518000Z",
      "2026-08-04 12:30:00 -0400",
      "12345678+someuser@users.noreply.github.com",
      "",
      "",
      "false",
      "scan-AbCd:branch-1234567890",
      sha(input.seed === "a" ? "b" : input.seed),
      quote("packages/x/src/Y.ts"),
      "",
    ],
    ","
  );

// Serializing the decoded record is how these tests prove a dropped column
// is truly absent; the repo requires the schema codec rather than JSON.*.
const encodeJson = S.encodeUnknownSync(S.fromJsonString(S.Unknown));

const csv = (rows: ReadonlyArray<string>): string => `${A.join([A.join(CODEX_CSV_COLUMNS, ","), ...rows], "\n")}\n`;

const decode = (text: string) => decodeCodexFindingsCsv(text);
const reason = (text: string) =>
  decodeCodexFindingsCsv(text).pipe(
    Effect.map(() => "accepted"),
    Effect.catchTag("CodexFindingsIngestError", (error) => Effect.succeed(error.reason))
  );

describe("codex findings csv parser integration", () => {
  // RFC 4180 mechanics belong to `@beep/schema`'s parser and are covered there.
  // What matters here is that a quoted multiline `description` — the one column
  // that actually carries newlines — does not shear the row apart.
  it.effect("survives a description cell containing commas and newlines", () =>
    Effect.gen(function* () {
      const decoded = yield* decode(
        csv([row({ seed: "a", description: "First line, with comma.\nSecond line." }), row({ seed: "b" })])
      );

      expect(A.length(decoded.findings)).toBe(2);
      expect(decoded.findings[0]?.codexId).toBe(id("a"));
      expect(decoded.findings[1]?.codexId).toBe(id("b"));
    })
  );

  it.effect("survives a title containing a doubled quote", () =>
    Effect.gen(function* () {
      const decoded = yield* decode(csv([row({ seed: "a", title: 'Say ""hi"" to the parser' })]));

      expect(A.length(decoded.findings)).toBe(1);
    })
  );
});

describe("codex findings csv identity", () => {
  it("reads the identity from the canonical finding url", () => {
    expect(O.getOrElse(codexIdFromFindingUrl(url("d")), () => "none")).toBe(id("d"));
  });

  it("refuses an identity from a foreign host", () => {
    expect(O.isNone(codexIdFromFindingUrl(`https://evil.example/findings/${id("d")}`))).toBe(true);
  });

  it("refuses a non-hex trailing segment", () => {
    expect(O.isNone(codexIdFromFindingUrl("https://chatgpt.com/codex/cloud/security/findings/not-an-id"))).toBe(true);
  });
});

describe("codex findings csv decoding", () => {
  it.effect("maps lowercase wire severities and statuses onto the packet domain", () =>
    Effect.gen(function* () {
      const decoded = yield* decode(
        csv([
          row({ seed: "a", severity: "medium", status: "new" }),
          row({ seed: "b", severity: "low" }),
          row({ seed: "c", severity: "informational" }),
        ])
      );

      expect(A.map(decoded.findings, (finding) => finding.severity)).toEqual(["Medium", "Low", "Informational"]);
      expect(A.map(decoded.findings, (finding) => finding.codexStatus)).toEqual(["New", "New", "New"]);
    })
  );

  it.effect("drops every personal-data column at the parse boundary", () =>
    Effect.gen(function* () {
      const decoded = yield* decode(csv([row({ seed: "a" })]));
      const serialized = encodeJson(decoded);

      // The fixture row carries a real-shaped author email; nothing that leaves
      // this module may contain it, nor any dropped column name.
      expect(serialized).not.toContain("users.noreply.github.com");
      expect(serialized).not.toContain("someuser");
      for (const column of CODEX_CSV_PII_COLUMNS) {
        expect(serialized).not.toContain(column);
      }
    })
  );

  it.effect("never carries the unsanitized report body out of the parser", () =>
    Effect.gen(function* () {
      const decoded = yield* decode(csv([row({ seed: "a", description: "SENSITIVE REPORT BODY" })]));

      expect(encodeJson(decoded)).not.toContain("SENSITIVE REPORT BODY");
    })
  );

  it.effect("reports the repository named by the export", () =>
    Effect.gen(function* () {
      const decoded = yield* decode(csv([row({ seed: "a" })]));

      expect(decoded.repository).toBe("kriegcloud/beep-effect");
    })
  );
});

describe("codex findings csv refusals", () => {
  it.effect("refuses a signed-out html response as an expired session", () =>
    Effect.gen(function* () {
      expect(yield* reason("<!doctype html><html><title>Log in</title></html>")).toBe("auth-expired");
    })
  );

  it.effect("refuses an export whose header drifted", () =>
    Effect.gen(function* () {
      expect(yield* reason("finding_url,title,severity\nx,y,z\n")).toBe("csv-header-unsupported");
    })
  );

  it.effect("refuses a truncated row rather than padding it", () =>
    Effect.gen(function* () {
      expect(yield* reason(`${csv([])}${url("a")},kriegcloud/beep-effect\n`)).toBe("csv-row-malformed");
    })
  );

  it.effect("refuses an unknown severity rather than guessing a bucket", () =>
    Effect.gen(function* () {
      expect(yield* reason(csv([row({ seed: "a", severity: "catastrophic" })]))).toBe("csv-row-malformed");
    })
  );

  it.effect("refuses a duplicated finding identity", () =>
    Effect.gen(function* () {
      expect(yield* reason(csv([row({ seed: "a" }), row({ seed: "a" })]))).toBe("csv-duplicate-finding");
    })
  );

  it.effect("accepts an export with no findings at all", () =>
    Effect.gen(function* () {
      const decoded = yield* decode(csv([]));

      expect(A.length(decoded.findings)).toBe(0);
    })
  );
});
