/**
 * Reject-scan for captured Codex findings content.
 *
 * This scan runs over the capture payload itself and over every byte written to
 * the packet's ignored `raw/` directory — not only over tracked output. That
 * scope is the point: `raw/` is gitignored, so the repository's commit-range
 * secret scanner structurally never sees it, yet execution agents read it. A
 * credential that reaches `raw/` would otherwise sit in a working tree with no
 * control anywhere able to observe it.
 *
 * Detection rejects rather than redacts. Missed redaction in a public
 * repository is irreversible; a false rejection costs one hand-edit, and the
 * raw evidence directory is the pressure valve so no captured data is lost.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A, O } from "@beep/utils";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Codex/Findings.scan");

/**
 * **Details**
 *
 * - `private-home-path`: a home or user directory on Linux, macOS or Windows,
 *   which discloses the local username and usually the project tree under it.
 * - `email-address`: a local part, an at sign and an alphabetic TLD, so scoped
 *   package names, JSDoc tags and version specs such as `cli@1.0.0` never match.
 *   The CSV parser already drops the PII columns; this rule is the control that
 *   survives a parser change that reintroduces them, since a GitHub noreply
 *   address still discloses the account name.
 * - `secret-shaped-value`: an assignment-shaped `SECRET`, `TOKEN` or `API_KEY`
 *   label, or an `sk-` key; the bare words in policy prose do not match.
 * - `auth-header`: an authorization or cookie header name in prose, JSON or
 *   code, the quoted `{"cookie": ...}` form included.
 * - `session-cookie`: a session-cookie name of the ChatGPT origin, which a
 *   snippet reading `document.cookie` carries.
 * - `signed-url-param`: a presigned or capability URL parameter whose value is
 *   at least 8 characters, so a bare `?sig=1` does not match.
 * - `bidi-control`: a bidirectional or invisible format character, which can
 *   reverse how a generated table row renders in a reviewer's diff.
 * - `spreadsheet-formula`: a formula sigil at the start of one payload field,
 *   which a spreadsheet re-export would execute; it is anchored, so a Markdown
 *   body's `-` bullet does not match.
 *
 * **Example** (Naming a rule)
 *
 * ```ts
 * import { SensitiveTextCode } from "@beep/repo-cli/commands/Codex/Findings.scan"
 *
 * console.log(SensitiveTextCode.is["private-home-path"]("private-home-path")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SensitiveTextCode = LiteralKit([
  "private-home-path",
  "email-address",
  "onepassword-ref",
  "secret-shaped-value",
  "auth-header",
  "bearer-credential",
  "jwt-token",
  "session-cookie",
  "signed-url-param",
  "bidi-control",
  "spreadsheet-formula",
  "max-scan-depth",
]).pipe(
  $I.annoteSchema("SensitiveTextCode", {
    description: "Class of content refused on the way into a generated Codex findings packet.",
  })
);

/**
 * Rule class matched by one scan hit.
 *
 * @category type-level
 * @since 0.0.0
 */
export type SensitiveTextCode = typeof SensitiveTextCode.Type;

/**
 * One refusal, addressed by logical surface rather than by value.
 *
 * **Gotchas**
 *
 * A hit deliberately carries no excerpt of what matched. The whole point of the
 * scan is that the offending text must not propagate, and an error rendered to
 * a terminal, a log, a span, or a `--json` envelope is exactly the kind of
 * propagation that would defeat it.
 *
 * **Example** (Reading a hit)
 *
 * ```ts
 * import { SensitiveTextHit } from "@beep/repo-cli/commands/Codex/Findings.scan"
 *
 * const hit = SensitiveTextHit.make({ code: "onepassword-ref", surface: "findings[3].title" })
 *
 * console.log(`${hit.surface} (${hit.code})`) // "findings[3].title (onepassword-ref)"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class SensitiveTextHit extends S.Opaque<SensitiveTextHit, { readonly brand: unique symbol }>()(
  S.Struct({
    code: SensitiveTextCode.pipe(
      $I.annoteKey("SensitiveTextHit.code", {
        description: "Rule class that matched.",
      })
    ),
    surface: S.String.pipe(
      $I.annoteKey("SensitiveTextHit.surface", {
        description: "Logical address of the offending field, never its contents.",
      })
    ),
  }).pipe(
    $I.annoteSchema("SensitiveTextHit", {
      description: "One refusal raised by the Codex findings reject-scan.",
    })
  )
) {}

const rules: ReadonlyArray<{ readonly code: SensitiveTextCode; readonly pattern: RegExp }> = [
  { code: "private-home-path", pattern: /\/home\/[A-Za-z0-9_.-]+/u },
  { code: "private-home-path", pattern: /\/Users\/[A-Za-z0-9_.-]+/u },
  { code: "private-home-path", pattern: /[A-Za-z]:[\\/]Users[\\/][A-Za-z0-9_.-]+/u },
  { code: "private-home-path", pattern: /(?:^|[\s"'`(=:])~[\\/]/u },
  { code: "private-home-path", pattern: /(?:^|[\s"'`(=:])~[A-Za-z0-9_.-]+[\\/]/u },
  { code: "private-home-path", pattern: /%(?:USERPROFILE|HOMEPATH|HOMEDRIVE)%/iu },
  { code: "email-address", pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/u },
  { code: "onepassword-ref", pattern: /op:\/\//u },
  { code: "secret-shaped-value", pattern: /(?:\b(?:SECRET|TOKEN|API[_-]?KEY)\b\s*[=:]|sk-[A-Za-z0-9_-]{12,})/iu },
  {
    code: "auth-header",
    pattern: /\b(?:authorization|proxy-authorization|set-cookie|cookie)\b["']?\s*[:=]/iu,
  },
  { code: "bearer-credential", pattern: /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/u },
  { code: "jwt-token", pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/u },
  { code: "session-cookie", pattern: /(?:__Secure-|__Host-|__cf_bm=|_puid=|oai-did=|oai-sc=)/u },
  {
    code: "signed-url-param",
    pattern:
      /[?&](?:X-Amz-Signature|X-Amz-Credential|X-Amz-Security-Token|sig|signature|token|access_token|api[_-]?key)=[A-Za-z0-9%_.~+/-]{8,}/iu,
  },
  { code: "bidi-control", pattern: /[‎‏‪-‮⁦-⁩]/u },
  { code: "spreadsheet-formula", pattern: /^[=+\-@\t\r]/u },
];

/**
 * Maximum nesting the scan walks before refusing a payload outright.
 *
 * **Example** (Reading the depth bound)
 *
 * ```ts
 * import { MAX_SCAN_DEPTH } from "@beep/repo-cli/commands/Codex/Findings.scan"
 *
 * console.log(MAX_SCAN_DEPTH > 0) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_SCAN_DEPTH = 16;

/**
 * Scan one string and report every rule it violates.
 *
 * **Example** (Refusing a private path)
 *
 * ```ts
 * import { scanSensitiveText } from "@beep/repo-cli/commands/Codex/Findings.scan"
 *
 * const hits = scanSensitiveText("capture.note", "see /home/dev/notes.txt")
 *
 * console.log(hits[0]?.code) // "private-home-path"
 * ```
 *
 * @param surface - Logical address reported with any hit.
 * @param value - Text to scan.
 * @returns Every rule the text violates, addressed by surface.
 * @category utilities
 * @since 0.0.0
 */
export const scanSensitiveText: {
  (value: string): (surface: string) => ReadonlyArray<SensitiveTextHit>;
  (surface: string, value: string): ReadonlyArray<SensitiveTextHit>;
} = dual(
  2,
  (surface: string, value: string): ReadonlyArray<SensitiveTextHit> =>
    A.map(
      A.filter(rules, (rule) => rule.pattern.test(value)),
      (rule) => SensitiveTextHit.make({ code: rule.code, surface })
    )
);

const decodeRecord = S.decodeUnknownOption(S.Record(S.String, S.Unknown));

const scanSensitiveUnknownAtDepth = (
  surface: string,
  value: unknown,
  depth: number
): ReadonlyArray<SensitiveTextHit> => {
  if (depth > MAX_SCAN_DEPTH) {
    return A.of(SensitiveTextHit.make({ code: "max-scan-depth", surface }));
  }

  if (P.isString(value)) {
    return scanSensitiveText(surface, value);
  }

  if (A.isArray(value)) {
    return A.flatMap(value, (entry, index) => scanSensitiveUnknownAtDepth(`${surface}[${index}]`, entry, depth + 1));
  }

  const record = decodeRecord(value);
  if (O.isSome(record)) {
    return A.flatMap(R.keys(record.value), (key) => {
      const nested = `${surface}.${key}`;
      return A.appendAll(
        scanSensitiveText(nested, key),
        scanSensitiveUnknownAtDepth(nested, record.value[key], depth + 1)
      );
    });
  }

  return A.empty<SensitiveTextHit>();
};

/**
 * Walk an arbitrary decoded JSON value and report every refusal it carries.
 *
 * **When to use**
 *
 * Use to walk the raw parsed capture payload before decoding it into schemas,
 * so a credential sitting in a field the schema would have dropped is still
 * caught. Use it again on the exact bytes destined for the packet's `raw/`
 * directory.
 *
 * **Gotchas**
 *
 * Object keys are scanned alongside values. A payload that hides a token in a
 * key rather than a value is still a payload carrying a token.
 *
 * **Example** (Scanning a nested payload)
 *
 * ```ts
 * import { scanSensitiveUnknown } from "@beep/repo-cli/commands/Codex/Findings.scan"
 *
 * const hits = scanSensitiveUnknown("payload", { findings: [{ title: "op://vault/item" }] })
 *
 * console.log(hits[0]?.surface) // "payload.findings[0].title"
 * ```
 *
 * @param surface - Logical address prefix for nested hits.
 * @param value - Decoded JSON value to walk.
 * @returns Every refusal the value carries, addressed by surface.
 * @category utilities
 * @since 0.0.0
 */
export const scanSensitiveUnknown: {
  (value: unknown): (surface: string) => ReadonlyArray<SensitiveTextHit>;
  (surface: string, value: unknown): ReadonlyArray<SensitiveTextHit>;
} = dual(
  2,
  (surface: string, value: unknown): ReadonlyArray<SensitiveTextHit> => scanSensitiveUnknownAtDepth(surface, value, 0)
);

/**
 * Render hits as stable, value-free surface labels.
 *
 * **Example** (Formatting a refusal list)
 *
 * ```ts
 * import { SensitiveTextHit, describeSensitiveHits } from "@beep/repo-cli/commands/Codex/Findings.scan"
 *
 * const described = describeSensitiveHits([
 *   SensitiveTextHit.make({ code: "jwt-token", surface: "payload.findings[0].title" }),
 * ])
 *
 * console.log(described[0]) // "payload.findings[0].title (jwt-token)"
 * ```
 *
 * @param hits - Refusals to render.
 * @returns Deduplicated, value-free surface labels.
 * @category utilities
 * @since 0.0.0
 */
export const describeSensitiveHits = (hits: ReadonlyArray<SensitiveTextHit>): ReadonlyArray<string> =>
  A.dedupe(A.map(hits, (hit) => `${hit.surface} (${hit.code})`));
