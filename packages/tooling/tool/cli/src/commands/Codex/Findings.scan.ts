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
 * Classes of content refused on the way into a generated packet.
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
export class SensitiveTextHit extends S.Class<SensitiveTextHit>($I`SensitiveTextHit`)(
  {
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
  },
  $I.annote("SensitiveTextHit", {
    description: "One refusal raised by the Codex findings reject-scan.",
  })
) {}

const rules: ReadonlyArray<{ readonly code: SensitiveTextCode; readonly pattern: RegExp }> = [
  // Private home and user paths across platforms. Each leaks the local username
  // and usually the project tree beneath it, which the packet sanitation policy
  // forbids in tracked records of a public repository.
  { code: "private-home-path", pattern: /\/home\/[A-Za-z0-9_.-]+/u },
  { code: "private-home-path", pattern: /\/Users\/[A-Za-z0-9_.-]+/u },
  { code: "private-home-path", pattern: /[A-Za-z]:[\\/]Users[\\/][A-Za-z0-9_.-]+/u },
  { code: "private-home-path", pattern: /(?:^|[\s"'`(=:])~[\\/]/u },
  { code: "private-home-path", pattern: /(?:^|[\s"'`(=:])~[A-Za-z0-9_.-]+[\\/]/u },
  { code: "private-home-path", pattern: /%(?:USERPROFILE|HOMEPATH|HOMEDRIVE)%/iu },
  // Every CSV export carries an `author_email` — in practice a GitHub
  // `<digits>+<user>@users.noreply.github.com` address, which still discloses
  // the account name. The parser drops the PII columns outright, so this rule
  // is defense in depth: it is the control that survives a future parser change
  // that reintroduces them. A local part is required before `@`, so scoped
  // package names (`@beep/schema`) and JSDoc tags (`@category`) do not match,
  // and the alphabetic TLD floor keeps version specs (`cli@1.0.0`) out.
  { code: "email-address", pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/u },
  { code: "onepassword-ref", pattern: /op:\/\//u },
  // Assignment-shaped labels or key-like values only. Bare words such as TOKEN
  // appear in benign policy prose, and broader matching produced false
  // positives on metric names in the lane this was ported from.
  { code: "secret-shaped-value", pattern: /(?:\b(?:SECRET|TOKEN|API[_-]?KEY)\b\s*[=:]|sk-[A-Za-z0-9_-]{12,})/iu },
  // Header names in prose, JSON, or code form. The trailing optional quote is
  // what catches the serialized `{"cookie": "..."}` shape that a bare
  // `name:` matcher misses.
  {
    code: "auth-header",
    pattern: /\b(?:authorization|proxy-authorization|set-cookie|cookie)\b["']?\s*[:=]/iu,
  },
  { code: "bearer-credential", pattern: /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/u },
  { code: "jwt-token", pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/u },
  // Session-cookie names specific to this origin, which a snippet reading
  // `document.cookie` would carry even though no rule above matches them.
  { code: "session-cookie", pattern: /(?:__Secure-|__Host-|__cf_bm=|_puid=|oai-did=|oai-sc=)/u },
  // Presigned and capability URLs. The length floor keeps a bare `?sig=1`
  // style query parameter from tripping the rule.
  {
    code: "signed-url-param",
    pattern:
      /[?&](?:X-Amz-Signature|X-Amz-Credential|X-Amz-Security-Token|sig|signature|token|access_token|api[_-]?key)=[A-Za-z0-9%_.~+/-]{8,}/iu,
  },
  // Bidirectional and invisible format characters, which can reverse how a
  // generated table row renders in a reviewer's diff.
  { code: "bidi-control", pattern: /[‎‏‪-‮⁦-⁩]/u },
  // A leading formula sigil turns a captured value into executable content the
  // moment anything re-exports it to a spreadsheet. The anchor is deliberate:
  // this fires on an individual payload field, not on a Markdown document whose
  // body merely contains a `-` bullet.
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
