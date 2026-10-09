import * as A from "effect/Array";
import * as S from "effect/Schema";

// Fragment builders are the only source of exact canaries. Never print their results.
const value = () => A.join(["canary", "Alpha", "4927", "Beta"], "");
const provider = () => A.join(["s", "k", "-", "canary", "Provider", "8271"], "");
const jwt = () => A.join(["ey", "J", "HeaderABC", ".", "PayloadABC", ".", "SignatureABC"], "");
export const canaryBuilders = [value, provider, jwt];

class ExpectedCount extends S.Class<ExpectedCount>("SecretScrubFixtureCount")({
  category: S.Literals([
    "secret-assignment",
    "auth-header",
    "bearer-token",
    "provider-key",
    "jwt",
    "home-path",
    "private-tag",
  ]),
  count: S.Natural,
}) {}
class ExpectedScrub extends S.Class<ExpectedScrub>("SecretScrubFixtureExpected")({
  sanitizedText: S.String,
  categories: S.Array(ExpectedCount),
  coverage: S.Literals(["known", "unknown"]),
  residue: S.Literals(["clear", "present", "unresolved"]),
  safeForPrompt: S.Boolean,
  evidence: S.Literal("mask-offsets-version-retention-only"),
  persistenceCanaryCount: S.Literal(0),
  logCanaryCount: S.Literal(0),
  actionAuthorized: S.Boolean,
}) {}
export class SecretScrubFixture extends S.Class<SecretScrubFixture>("SecretScrubFixture")({
  id: S.NonEmptyString,
  text: S.String,
  inputCoverage: S.Literals(["known", "unknown"]),
  expected: ExpectedScrub,
}) {}
const fixture = (
  id: string,
  text: string,
  sanitizedText: string,
  categories: ReadonlyArray<ExpectedCount> = [],
  coverage: "known" | "unknown" = "known",
  residue: "clear" | "present" | "unresolved" = "clear",
  actionAuthorized = false
) =>
  SecretScrubFixture.make({
    id,
    text,
    inputCoverage: coverage,
    expected: ExpectedScrub.make({
      sanitizedText,
      categories,
      coverage,
      residue,
      safeForPrompt: coverage === "known" && residue === "clear",
      evidence: "mask-offsets-version-retention-only",
      persistenceCanaryCount: 0,
      logCanaryCount: 0,
      actionAuthorized,
    }),
  });
const count = (category: ExpectedCount["category"], n = 1) => ExpectedCount.make({ category, count: n });

export const secretScrubFixtures = () => [
  fixture("clean", "A public complaint.", "A public complaint."),
  fixture(
    "action-enabling-public-denied",
    "Public disclosure describes a command execution flaw.",
    "Public disclosure describes a command execution flaw."
  ),
  fixture("clean-action-allowed", "Public procedure.", "Public procedure.", [], "known", "clear", true),
  fixture("assignment", `API_KEY=${value()}`, "API_KEY=[REDACTED]", [count("secret-assignment")]),
  fixture("colon-fragment", `TOKEN : ${value()}`, "TOKEN : [REDACTED]", [count("secret-assignment")]),
  fixture("digit-hyphen-session", `2-session-id=${value()}`, "2-session-id=[REDACTED]", [count("secret-assignment")]),
  fixture("pass-fragment", `pass=${value()}`, "pass=[REDACTED]", [count("secret-assignment")]),
  fixture("passwd", `passwd=${value()}`, "passwd=[REDACTED]", [count("secret-assignment")]),
  fixture("longest-comma", `TOKEN=${value()},suffix`, "TOKEN=[REDACTED]", [count("secret-assignment")]),
  fixture("quoted", `SECRET="${value()} spaced"`, "SECRET=[REDACTED]", [count("secret-assignment")]),
  fixture(
    "quoted-unclosed",
    `SECRET="public ${value()}`,
    "[REDACTED]",
    [count("secret-assignment")],
    "known",
    "present"
  ),
  fixture(
    "single-quoted-unclosed",
    `TOKEN='${value()}`,
    "[REDACTED]",
    [count("secret-assignment")],
    "known",
    "present"
  ),
  fixture("header", `Authorization: ${value()}`, "Authorization: [REDACTED]", [
    count("secret-assignment"),
    count("auth-header"),
  ]),
  fixture("cookie", `Cookie: ${value()}`, "Cookie: [REDACTED]", [count("auth-header")]),
  fixture("set-cookie", `Set-Cookie: ${value()}`, "Set-Cookie: [REDACTED]", [count("auth-header")]),
  fixture("scheme", `Basic ${value()}`, "Basic [REDACTED]", [count("bearer-token")]),
  fixture("provider", provider(), "[REDACTED]", [count("provider-key")]),
  fixture("jwt", jwt(), "[REDACTED]", [count("jwt")]),
  fixture("home-posix", "/home/synthetic/document.txt", "/home/[REDACTED]/document.txt", [count("home-path")]),
  fixture("home-windows", "C:\\Users\\synthetic\\document.txt", "C:\\Users\\[REDACTED]\\document.txt", [
    count("home-path"),
  ]),
  fixture("private", `<private>${value()}</private>`, "[REDACTED]", [count("private-tag")]),
  fixture("private-unclosed", `<private>${value()}`, "[REDACTED]", [count("private-tag")], "known", "unresolved"),
  fixture(
    "unknown-action-allowed",
    `API_KEY=${value()}`,
    "API_KEY=[REDACTED]",
    [count("secret-assignment")],
    "unknown",
    "clear",
    true
  ),
  fixture("partial-residue", A.join(["s", "k", "-", "short"], ""), "[REDACTED]", [], "known", "present"),
  fixture("placeholder", "TOKEN=[REDACTED]", "TOKEN=[REDACTED]"),
  fixture(
    "near-miss",
    "The keyboard and token vocabulary are public.",
    "The keyboard and token vocabulary are public."
  ),
  fixture("overlap", `Authorization: Bearer ${provider()}`, "Authorization: [REDACTED]", [
    count("secret-assignment"),
    count("auth-header"),
    count("bearer-token"),
    count("provider-key"),
  ]),
];

// Old/new rendering expectations remain transient; assertions compare booleans only.
export class ConsumerRedactionFixture extends S.Class<ConsumerRedactionFixture>("ConsumerRedactionFixture")({
  id: S.NonEmptyString,
  text: S.String,
  oldCause: S.String,
  newCause: S.String,
  oldMetrics: S.String,
  newMetrics: S.String,
  assignmentCount: S.Natural,
  headerCount: S.Natural,
}) {}
export const consumerRedactionFixtures = () => [
  ConsumerRedactionFixture.make({
    id: "header-overlap-precedence",
    text: `Authorization: Bearer ${provider()}`,
    oldCause: "Authorization: [REDACTED]",
    newCause: "Authorization: [REDACTED]",
    oldMetrics: "Authorization: [REDACTED]",
    newMetrics: "Authorization: [REDACTED]",
    assignmentCount: 1,
    headerCount: 1,
  }),
  ConsumerRedactionFixture.make({
    id: "colon-fragment",
    text: `TOKEN : ${value()}`,
    oldCause: "TOKEN : [REDACTED]",
    newCause: "TOKEN : [REDACTED]",
    oldMetrics: `TOKEN : ${value()}`,
    newMetrics: "TOKEN=[REDACTED]",
    assignmentCount: 1,
    headerCount: 0,
  }),
  ConsumerRedactionFixture.make({
    id: "hyphen-session",
    text: `2-session-id=${value()}`,
    oldCause: "2-session-id=[REDACTED]",
    newCause: "2-session-id=[REDACTED]",
    oldMetrics: `2-session-id=${value()}`,
    newMetrics: "2-session-id=[REDACTED]",
    assignmentCount: 1,
    headerCount: 0,
  }),
  ConsumerRedactionFixture.make({
    id: "pass-union",
    text: `pass=${value()}`,
    oldCause: `pass=${value()}`,
    newCause: "pass=[REDACTED]",
    oldMetrics: `pass=${value()}`,
    newMetrics: "pass=[REDACTED]",
    assignmentCount: 1,
    headerCount: 0,
  }),
  ConsumerRedactionFixture.make({
    id: "passwd-fragment",
    text: `passwd=${value()}`,
    oldCause: "passwd=[REDACTED]",
    newCause: "passwd=[REDACTED]",
    oldMetrics: `passwd=${value()}`,
    newMetrics: "passwd=[REDACTED]",
    assignmentCount: 1,
    headerCount: 0,
  }),
  ConsumerRedactionFixture.make({
    id: "longest-comma",
    text: `APP_TOKEN=${value()},suffix`,
    oldCause: "APP_TOKEN=[REDACTED],suffix",
    newCause: "APP_TOKEN=[REDACTED]",
    oldMetrics: "APP_TOKEN=[REDACTED]",
    newMetrics: "APP_TOKEN=[REDACTED]",
    assignmentCount: 1,
    headerCount: 0,
  }),
  ConsumerRedactionFixture.make({
    id: "cookie-union",
    text: `Cookie: ${value()}`,
    oldCause: "Cookie: [REDACTED]",
    newCause: "Cookie: [REDACTED]",
    oldMetrics: `Cookie: ${value()}`,
    newMetrics: "Cookie: [REDACTED]",
    assignmentCount: 0,
    headerCount: 1,
  }),
  ConsumerRedactionFixture.make({
    id: "set-cookie-union",
    text: `Set-Cookie: ${value()}`,
    oldCause: "Set-Cookie: [REDACTED]",
    newCause: "Set-Cookie: [REDACTED]",
    oldMetrics: `Set-Cookie: ${value()}`,
    newMetrics: "Set-Cookie: [REDACTED]",
    assignmentCount: 0,
    headerCount: 1,
  }),
];
