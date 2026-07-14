# LLM Provider Subscription Auth via CLI Delegation — Sources & Provenance

- **Source exploration:** `explorations/multi-provider-llm-dispatch-fallback`
  — primary ledger:
  `explorations/multi-provider-llm-dispatch-fallback/research/SOURCES.md`.
  Partial graduation: only the CLI subscription-auth leg (Q5's user>CLI>env
  chain) graduates into this goal; dispatch/registry/fallback remain there.
- **Sibling exploration:** `explorations/ingestion-security-secret-governance`
  — owns the per-user vault / secret-governance spine. Unaffected by this
  goal: CLI delegation stores no tokens, so the vault question stays parked
  there.
- **Provenance:** this goal was authored directly from a grill-with-docs
  session (2026-07-11) plus a fresh source read of the local t3code checkout
  (`~/YeeBois/dev/t3code`); it did not pass through the gold-intake pipeline.

## 1. Mined source corpus

All t3code paths are relative to the local checkout `~/YeeBois/dev/t3code`
(remote: `github.com/pingdotgg/t3code`), read 2026-07-11.

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| t3-1 | Codex account probe + ChatGPT plan-label map (`codexAccountAuthLabel`, `account/read`) | t3code | `apps/server/src/provider/Layers/CodexProvider.ts:69-101,350,456` | auth probe | port-with-attribution |
| t3-2 | Claude subscription probe via Agent SDK `init.account` (email, subscriptionType, tokenSource) | t3code | `apps/server/src/provider/Layers/ClaudeProvider.ts:490-620` | auth probe | port-with-attribution |
| t3-3 | Claude HOME resolution + child-env injection (`makeClaudeEnvironment`) | t3code | `apps/server/src/provider/Drivers/ClaudeHome.ts:17` | credential isolation | port-with-attribution |
| t3-4 | Codex shadow-home layout: shared entries symlinked, `auth.json`/`models_cache.json` private real files, symlinked-auth refusal | t3code | `apps/server/src/provider/Drivers/CodexHomeLayout.ts:31` (`PRIVATE_ENTRY_NAMES`, `ensureShadowAuthIsPrivate`) | credential isolation | port-with-attribution |
| t3-5 | Provider driver SPI shape (`driverKind`, `metadata`, `configSchema`, `create` -> snapshot/adapter) | t3code | `apps/server/src/provider/ProviderDriver.ts` | instance modeling | reference |
| t3-6 | Provider instance registry (live `Map<InstanceId, ProviderInstance>`) | t3code | `apps/server/src/provider/Services/ProviderInstanceRegistry.ts` | instance modeling | reference |
| t3-7 | Unauthenticated UX: status banner + "run `<cli> login`" guidance | t3code | `apps/web/src/components/chat/ProviderStatusBanner.tsx:23`, `apps/web/src/components/settings/providerStatus.ts` | login UX | reference |
| t3-8 | Add-instance wizard (kind, label, binary path, HOME path, env vars) + coming-soon kinds | t3code | `apps/web/src/components/settings/AddProviderInstanceDialog.tsx:73` | login UX | reference |
| t3-9 | User-facing auth model docs (multi-account = separate HOMEs; `ANTHROPIC_API_KEY=""` external-provider quirk) | t3code | `docs/providers/claude.md:79-127`, `docs/providers/codex.md` | methodology | reference |

**How these inform implementation:** t3-1/t3-2 define the rich probe snapshot
shape (status, email, plan label, token source) and the plan-label vocabulary
the driver should reproduce; t3-3/t3-4 define the HOME/env/shadow-home
mechanics ported into `drivers/ai-provider-cli` role modules, including the
security-relevant refusal of a symlinked `auth.json`; t3-5..t3-8 shape the
`ProviderInstance` entity, registry-as-repository port, and login-guidance
behavior — reimplemented in beep's schema-first/Effect idiom, not copied.
Negative finding (load-bearing): t3code contains **no** provider OAuth/PKCE/
device-code implementation; the `apps/server/src/auth/` OAuth+DPoP code is its
own client-pairing system ("T3 Connect"), deliberately not ported.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| `pingdotgg/t3code` (`@t3tools/monorepo`) | MIT (Copyright 2026 T3 Tools Inc., `LICENSE`) | port-with-attribution | Probe shapes, plan-label mapping, HOME/shadow-home isolation mechanics, instance/UX vocabulary |
| opencode / vendor CLIs (Claude Code, Codex CLI) | not read for this goal | reference-only | Named as the actual owners of subscription OAuth; explicitly NOT ported (non-goal) |

## 3. External research sources

None on disk beyond the local t3code checkout read above. No URLs are cited
because none were fetched for this packet.

## 4. In-repo capability references

| Capability | Path | Disposition |
|------------|------|-------------|
| CLI auth-status probe driver (claude/codex LiteralKit, injectable `AiProviderCliRunner`, redaction discipline) | `packages/drivers/ai-provider-cli` | extend |
| Agents slice (Agent/Skill entities, Chat/AssistantTurn processes, `AnthropicTurnKernel`) | `packages/agents/{domain,use-cases,server,client}` | extend |
| Agents persistence surface | `packages/agents/tables` | NET-NEW |
| Entity kernel + table projection (`BaseEntity.Class`, `pgTableFrom(entity)`) | `packages/shared/domain`, `packages/drivers/drizzle` | reuse |
| Child-process spawning seam | `effect/unstable/process` `ChildProcessSpawner` (used by ai-provider-cli) | reuse |
| OAuth2+PKCE reference (host-owned authorizer, encrypted token cache, silent refresh) | `packages/drivers/m365/src/M365.auth.ts` | reference-only (kept for a possible future OAuth revisit) |
| Per-provider LLM drivers (API-key lane, unaffected) | `packages/drivers/{anthropic,openai-compat,xai,venice-ai}` | reference |
| Package-shape proof | `packages/fixture-lab/specimen` | reference |

## 5. Cross-links & provenance

- `ops/manifest.json` `provenance.exploration` ->
  `explorations/multi-provider-llm-dispatch-fallback`; that exploration's
  `ops/manifest.json` `links.goals` lists this packet.
- Grilling decisions (2026-07-11, /grill-with-docs session): (1) CLI
  delegation over in-app OAuth; (2) local-first t3code-shaped deployment,
  metadata/snapshots in DB, never tokens; (3) `agents` slice owns
  ProviderInstance (consuming slice; cross-slice imports forbidden and
  `shared/use-cases` does not exist); (4) partial graduation bookkeeping.
- `SPEC.md` Architecture Mapping table is the binding t3code->beep placement
  record derived from these sources.
