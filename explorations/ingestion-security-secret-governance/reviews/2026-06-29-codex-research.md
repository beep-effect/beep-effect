# Codex research-gate critique — ingestion-security-secret-governance (2026-06-29)

## Blocking

1. **The ordered secret resolver design relies on `ConfigProvider.orElse` behavior that the installed Effect source explicitly does not provide.**

   Claim: `RESEARCH.md:24` says `ConfigProvider.orElse(self, that)` "preferentially loads from one provider, falls back on load error"; `research/secret-resolution-and-per-user-vault.md:20-21` says placeholder and too-short-key rejection should be an `S.filter`/refinement so a bad first-provider value becomes a typed parse error that "triggers fallback"; `research/secret-resolution-and-per-user-vault.md:47` repeats that the shared resolver should apply the refinement so "bad values fall through." The same file marks this as unverified at `research/secret-resolution-and-per-user-vault.md:75`, but the aggregate still treats it as the recommended shape.

   Why this is wrong/risky: the live installed Effect source says the opposite. `node_modules/effect/src/ConfigProvider.ts:420-422` and `:458-461` state that fallback only runs when the first provider returns `undefined`; a `SourceError` from the first provider is not caught. A schema/refinement parse failure is therefore not a reliable "missing" signal for `orElse`. If shipped as researched, a placeholder value in secure storage can stop resolution instead of falling back to env/dotenv. If the implementation then catches all failures to recover fallback, it risks masking real provider errors.

   Specific fix: split "recoverable absent/placeholder" from "provider failure." Either normalize placeholders to absence inside the secure-storage provider before `orElse`, or implement an explicit resolver service that tries providers sequentially and catches only typed `MissingSecret` / `PlaceholderRejected` errors. Add a focused unit test proving secure-storage placeholder -> env fallback and secure-storage transport/auth failure -> no fallback.

2. **The HTML sanitizer allowlist recommendation would include event-handler attributes if implemented literally.**

   Claim: `RESEARCH.md:67` says to derive the sanitizer tag/attr allowlist from `@beep/html`; `research/redaction-integrity-and-html-sanitization.md:29` identifies `GlobalAttributes` as part of that source of truth and notes it includes `EventHandlerAttributes`; `research/redaction-integrity-and-html-sanitization.md:37` recommends deriving the tag/attr allowlist from `ELEMENT_META` / `GlobalAttributes`. `research/redaction-integrity-and-html-sanitization.md:73` also leaves open a typed-AST route where this allowlist could be the entire boundary.

   Why this is wrong/risky: `packages/foundation/modeling/html/src/Html.attributes.ts:292-374` defines `EventHandlerAttributes` including `onclick`, `onload`, `onerror`, and the rest of the `on*` event handler surface. `packages/foundation/modeling/html/src/Html.attributes.ts:385-390` then spreads `EventHandlerAttributes` into `GlobalAttributes`. `StandardGlobalAttributes` also includes `style` at `Html.attributes.ts:173-209`. A sanitizer allowlist generated from all `GlobalAttributes` would preserve direct script execution sinks and unsafe CSS unless another gate strips them. DOMPurify at the browser boundary may catch this in one path, but the research also contemplates server-normalized/typed-AST output as the full boundary.

   Specific fix: derive element names from `ELEMENT_META` if useful, but define a separate `SafeHtmlAttributes` sanitizer subset that excludes `EventHandlerAttributes`, excludes `style` unless backed by a real CSS sanitizer, and treats URL-bearing attributes through a strict scheme allowlist. Add regression fixtures such as `<img src=x onerror=alert(1)>`, `<a onclick=alert(1)>`, and `style="background:url(javascript:alert(1))"`.

## Advisory

1. **The secure-storage inventory misses the in-repo 1Password driver and shared op-reference schema.**

   Claim: `RESEARCH.md:27` and `research/secret-resolution-and-per-user-vault.md:41-42` frame 1Password mainly as a beta `@1password/sdk` option plus global MCP/skill wiring. `RESEARCH.md:76` says the composed secret-resolution chain is not built, and that part is still true, but the research does not account for the existing repo substrate.

   Why this is weak: `packages/drivers/onepassword-cli/package.json:2` declares `@beep/onepassword-cli`. Its service shape exposes `probeReference`, `read`, and `whoami` at `packages/drivers/onepassword-cli/src/OnePasswordCli.service.ts:54-57`; `read` shells `op read ... --no-newline` and returns `Redacted.make(result.stdout)` at `:118-125`; `probeReference` returns non-secret metadata at `:127-134`. The shared domain already has `OnePasswordReference` as an `op://vault/item/field` schema at `packages/shared/domain/src/values/OnePasswordReference/OnePasswordReference.model.ts:14-23` and exports `isOnePasswordReference` at `:72`.

   Specific fix: update the research inventory to name `@beep/onepassword-cli` and `@beep/shared-domain/values/OnePasswordReference` as existing secure-reference/resolution bricks. If the SDK is still preferred over the CLI driver, record the reason explicitly; otherwise make the first provider wrap the existing driver instead of introducing a second 1Password integration.

2. **`@beep/identity` is a risky home for a resolver/vault service.**

   Claim: `CAPTURE.md:22-23` routes the vault to `@beep/identity`; `RESEARCH.md:71` calls `@beep/identity` the natural home for a per-user key vault; `research/secret-resolution-and-per-user-vault.md:47` says to build a single `@beep/identity` resolver as an Effect Layer + Service.

   Why this is weak: the live `@beep/identity` package is a modeling/identity-composer package, not a platform or persistence service. `packages/foundation/modeling/identity/src/index.ts:17-31` re-exports the identity system core, and `:32-45` re-exports pre-built package identity composers. The existing 1Password integration sits correctly under a driver package, and the `op://` value object sits in shared domain.

   Specific fix: keep `@beep/identity` for identity composers and branded IDs. Put a pure secret-reference value in shared domain if needed; put 1Password/op integration in `@beep/onepassword-cli`; put DB-backed vault crypto in a server/use-case or new platform-adjacent capability package that is allowed to depend on `node:crypto`, persistence, and child-process/SDK layers.

3. **The provenance routing overstates the public surface and mixes pure anchors with scored security findings.**

   Claim: `RESEARCH.md:61` says `@beep/provenance` `index.ts` exports `VERSION` + `TextAnchor` only and calls it the correct home for a net-new `RedactionAuditRow` / injection `Finding`; `research/prompt-injection-detection-landscape.md:39` proposes a `Finding` with `category`, `ruleId`, `concealment`, `confidence`, and `evidence` "written to `@beep/provenance`." The tree snapshot also says `@beep/provenance` includes `TextAnchor / EvidenceSpan` at `tree-snapshot.md:11`.

   Why this is weak/wrong: `packages/foundation/modeling/provenance/src/index.ts:23` re-exports the whole `TextAnchor.ts` module, which includes `TextAnchorFields` and `isWellOrdered`, not only the `TextAnchor` class. More importantly, `packages/foundation/modeling/provenance/src/TextAnchor.ts:4-8` says provenance is pure anchor substrate with no confidence, claim semantics, or judgment. The repo's scored span precedent is `@beep/epistemic-domain`: `packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts:52-57` describes adding confidence on top of `TextAnchorFields`, and `:76-83` defines `EvidenceSpan`.

   Specific fix: keep `TextAnchor` / `TextAnchorFields` in `@beep/provenance`, but define `InjectionFinding` and scored redaction findings in the consuming security/file-processing slice. If a generic audit row lands in provenance, keep it provenance-only; put confidence/category/rule semantics in `@beep/file-processing` or a dedicated ingestion-security module.

4. **The span-invariant language says `TextAnchor` gives more validation "for free" than it actually does.**

   Claim: `RESEARCH.md:61` describes `TextAnchor` as a half-open range plus quote where `text.slice(start,end)===quote`; `research/secret-pii-scrub-and-audit.md:34` says spreading `TextAnchorFields` gives "re-sliceable, model-stable provenance for free."

   Why this is weak: `packages/foundation/modeling/provenance/src/TextAnchor.ts:37-40` defines only `startChar`, `endChar`, and `quote` fields. `packages/foundation/modeling/provenance/src/TextAnchor.ts:70-91` provides `isWellOrdered` separately and says producers should assert cross-field ordering; no schema-level check enforces `startChar <= endChar`, and no schema can prove `source.slice(startChar, endChar) === quote` without the source text.

   Specific fix: require all injection/PII/redaction producers to construct anchors through a helper that takes `(sourceText, startChar, endChar)`, derives `quote`, asserts `isWellOrdered`, and round-trips the slice. Add negative tests for reversed ranges, out-of-bounds ranges, and mismatched quote text.

## Confirmed sound

1. **The `SafeRemoteHost` baseline and current SSRF consumer inventory are sound.**

   Claim: `RESEARCH.md:58-60` and `research/ssrf-and-fetch-hardening.md:9-13` say `SafeRemoteHost` is pure/I-O-free, has optional resolver injection, documents DNS-rebinding TOCTOU as out of scope, and is used by Box/USPTO while `nlp-mcp` carries a duplicated literal-only guard.

   Verification: `packages/foundation/modeling/schema/src/SafeRemoteHost.ts:17-31` documents literal-host classification, optional resolver injection, and the TOCTOU gap; `:129-183` classifies loopback/link-local/RFC1918/ULA/metadata and IPv4-mapped IPv6; `:261-417` exports the predicate and assertions. Box injects DNS resolution at `packages/drivers/box/src/Box.streaming.ts:642-670`; USPTO calls `assertAllowedRemoteUrl` at `packages/drivers/uspto/src/Uspto.service.ts:281-287`; `nlp-mcp` has the duplicated guard at `packages/drivers/nlp-mcp/src/Streaming/DatasetLoader.ts:305-340`.

   Keep: collapse consumers onto a future guarded client, but preserve `SafeRemoteHost` as a pure fail-fast guard.

2. **The Effect/Undici interception seam for connect-time SSRF hardening exists.**

   Claim: `RESEARCH.md:60` and `research/ssrf-and-fetch-hardening.md:32-38` say `@effect/platform-node` exposes an Undici `Dispatcher` layer and that the built-in redirect helper should not be used for untrusted redirects.

   Verification: `node_modules/@effect/platform-node/src/NodeHttpClient.ts:89-120` defines the `Dispatcher` service and dispatcher layers; `:142-160` sends requests through `dispatcher.request(...)` without redirect-following options; `node_modules/effect/src/http/HttpClient.ts:1840-1882` implements `followRedirects` by repeatedly calling `HttpClientRequest.setUrl` on the same request, which preserves the original headers and does not re-run an SSRF guard.

   Keep: build a guarded `HttpClient` transform plus custom dispatcher, and explicitly avoid `HttpClient.followRedirects` for untrusted URLs.

3. **The main "NOT FOUND" security gaps are mostly real after live-tree search.**

   Claim: `RESEARCH.md:73-81` marks per-user vault crypto, composed secret-resolution chain, prompt-injection/hidden Unicode/`w:vanish` detection, PDF x-ray, runtime HTML sanitizer, OOXML scrub/audit, and connect-time guarded HTTP as not found.

   Verification: targeted `rg` across `packages/` and `apps/` found no `createCipheriv`, `createDecipheriv`, `scryptSync`, `aes-256-gcm`, `ConfigProvider.orElse`, `layerDotEnvAdd`, prompt-injection/Unicode/`w:vanish` detector terms, `xray`/`x-ray`/bad-redaction code, `sanitize-html`/`DOMPurify`/runtime sanitizer modules, `xmlVariants`, or `GuardedHttpClient`/pinned `connect.lookup`. The notable exception is not a complete resolver chain, but the existing 1Password CLI/reference substrate called out under Advisory.

   Keep: treat these as net-new deliverables, but route them through the corrected homes and blocking fixes above.

4. **The redaction precedent in `@beep/repo-ai-metrics` and `@beep/observability` is real and reusable.**

   Claim: `RESEARCH.md:62-63` and `research/secret-pii-scrub-and-audit.md:53-60` identify `ai-metrics` and `observability` as in-repo redaction precedents to fold into one canonical bank.

   Verification: `packages/tooling/library/ai-metrics/src/privacy.ts:36-40` defines assignment/header/bearer/OpenAI regexes; `:87-99` defines `AiMetricsRedactionResult`; `:502-525` redacts sensitive text and computes `safeForDerivedUi`. `packages/foundation/capability/observability/src/CauseRedaction.ts:137-153` includes secret/header/bearer/OpenAI/JWT/home-path redaction steps.

   Keep: make one shared pattern bank instead of adding a fourth copy, and adapt `AiMetricsRedactionResult` into a span-aware prompt/redaction proof rather than inventing an unrelated shape.
