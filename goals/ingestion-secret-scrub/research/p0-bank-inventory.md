# P0 bank inventory — ingestion-secret-scrub

Audit baseline: `origin/main` at `36027982f2`. Fixtures are synthetic, built at runtime.

## Rules and canonical semantics

Bank home: `@beep/schema/CredentialPatternBank`; version: `credential-pattern-bank/v1`.
Pure schema-backed rules and detect/replace/count functions; no Layer, I/O or new dependency.

| Category | CauseRedaction | ai-metrics | Canonical reconciliation |
| --- | --- | --- | --- |
| secret-assignment | Value-only; equals/colon; hyphenated names; session/passwd fragments; bare values terminate at comma | Captured name rewritten with equals; requires leading letter before fragment; pass fragment; bare values include comma | Union name shapes/fragments/separators, longest bare value includes comma; preserve consumer rendering |
| auth-header | Authorization, proxy authorization, cookie, set-cookie; value-only | Authorization/proxy authorization; normalized header and colon | Union headers and whitespace extent; preserve consumer rendering |
| bearer-token | Bearer/Basic credential values of at least eight allowed characters | Same shape, captures scheme | One rule; consumer keeps scheme |
| provider-key | Case-sensitive provider prefix and at least eight allowed characters, bounded by word boundaries | Same match shape | One rule; metrics retains secret-specific placeholder |
| jwt | Three URL-safe segments with header prefix and minimum segment widths | Absent | Observability and scrub only |
| home-path | POSIX home/Users and Windows drive/Users user component | Absent | One category with two alternatives; observability and scrub only |
| private-tag | Absent | Absent | Clean implementation of described author-marked private regions; ingestion only |

Assignment name fragments are api-key variants, key, token, secret, password, passwd,
pass, pwd, auth, credential and session. Names admit letters, digits, underscores and
hyphens. Both former rules are case insensitive. Quoted values retain the full quoted
extent; bare values end at whitespace, semicolon, ampersand or pipe. Header values
extend to the line end. This intentionally increases the CauseRedaction comma extent
and metrics coverage of fragment-only/digit-leading/hyphenated names, colons, session,
passwd, cookie and set-cookie. No existing match loses coverage.

## Ordering, overlap and placeholders

CauseRedaction formerly applies assignment, header, credential scheme, provider key,
JWT, POSIX home, Windows home in order, then collapses horizontal whitespace and trims.
Metrics applies assignment, header, scheme and provider key; counts each rule on raw
input, including overlapping matches. Preserve these consumer-specific steps and counts.
Ingestion records original-coordinate findings independently, merges overlapping spans
for replacement, and returns no matched text. Placeholders are never secret values;
replacement must be idempotent. Legacy metrics counts retain their raw-input semantics,
including placeholder-shaped values; ingestion findings exclude complete redaction markers. A malformed or unclosed private region is masked but
blocks prompt admission. Partial credential forms have explicit residue/unknown outcomes.

CauseRedaction keeps its common placeholder and original name/separator/scheme/path;
metrics keeps normalized name-equals, scheme-space, header-colon forms and its
secret-specific provider placeholder. `redactString`, `redactCause`, cause summaries,
and derived diagnostic outputs inherit the stricter union redaction. Public export types
stay unchanged. `AiMetricsRedactionResult` gains assignment/header counts only for the
union-added inputs, and `safeForDerivedUi` becomes false for those inputs. Other categories
remain absent from metrics. Changesets are minor for stricter output and additive APIs.

Home-path matches participate in scrub replacement and residue checks as carried-over
coverage; they do not introduce general PII recognition. Their successful removal permits
prompt admission within this bank, without asserting PII coverage.

## Detection limits and gitleaks comparison

`.gitleaks.toml` extends the default gitleaks bank; its repo allowlists are scanner policy,
not runtime rules. The CauseRedaction allowlist is limited to its own source/test paths.
Existing runtime provider/JWT shapes are broader and less provider-specific than gitleaks;
AWS, GitHub, Google, Slack, private-key, entropy and validity recognition remain unsupported.
Known coverage means this versioned credential/private-tag bank on plain extracted text,
never exhaustive secret discovery, PII, binary, OOXML, encoded or injection coverage.
Caller-declared unknown coverage, unresolved private tags and partial supported token
residue fail closed. No source or NOTICE is copied from agentmemory; its private-tag
contract description informs a clean implementation with provenance attribution.

## Consumers

Method: requested exhaustive ripgrep over `packages` and `apps`, deduplicated by file.
This includes exports, examples, tests and internal consumers; no matched samples retained.

- `apps/professional-desktop/src/App.tsx`
- `apps/professional-desktop/src/lib/failureMessage.ts`
- `apps/professional-desktop/src/spikes/CosmosSpike.tsx`
- `apps/professional-desktop/src/spikes/Graph3DSpike.tsx`
- `apps/professional-desktop/src/transport/IpcSpikePanel.tsx`
- `packages/agents/server/src/AssistantTurn/BlockRepair.ts`
- `packages/foundation/capability/nlp-processing/src/internal/observability.ts`
- `packages/foundation/capability/observability/src/CauseRedaction.ts`
- `packages/foundation/capability/observability/test/Boundary.test.ts`
- `packages/foundation/capability/observability/test/CauseRedaction.test.ts`
- `packages/ontology/client/src/aggregates/Session/Session.atoms.ts`
- `packages/tooling/library/ai-metrics/src/derived-storage.ts`
- `packages/tooling/library/ai-metrics/src/privacy.ts`
- `packages/tooling/library/ai-metrics/src/scorecard.ts`
- `packages/tooling/library/ai-metrics/test/privacy.test.ts`
- `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.service.ts`
- `packages/tooling/tool/cli/test/codex-findings-scan.test.ts`
