# Real harness route qualification

All seven requested families remain in scope: Grok, Claude Code, Claude Desktop, Codex CLI, ChatGPT/Codex Desktop, Muse proxy and cursor-agent. Claude Code desktop runtime is separate from ordinary Desktop/Cowork; native Muse is an auxiliary route and cannot substitute for the requested proxy route. Installed apps and source adapters do not establish collection.

The launch inventory found Codex0.166.0 rather than the historical0.165.0. Its [version-pinned configuration resolver](https://raw.githubusercontent.com/openai/codex/rust-v0.166.0/codex-rs/core/src/config/otel.rs) independently defaults logs and traces to disabled. Prompt and response content logging are opt-in. The [typed configuration](https://raw.githubusercontent.com/openai/codex/rust-v0.166.0/codex-rs/config/src/types.rs) treats log, trace and metric exporters separately. This source inspection does not establish effective running-process overrides or backend delivery. Native signal coverage remains unverified.

At470d609, the early bounded CLI prototype reused a managed observation bridge and passed local synthetic tests. Main PR2594 intentionally retired that bridge and its session APIs. The prototype is preserved in the published pre-cutover commit and private evidence, and removed from the active tree. Those results do not qualify current runtime launches. A narrow standalone native one-shot observation path must respect the accepted T3-only messaging doctrine and still prove actual source, privacy and backend delivery.

Desktop proof must bind an actual app occurrence, effective runtime/home/host/root identity and delivered event IDs. Readable Electron storage is not a safe metadata export; CLI evidence will not substitute for desktop proof. Unsupported or inaccessible cloud routes remain explicit gaps. Metadata plus curated sanitized examples remains the collection policy.

Current actual per-route collection: **not yet verified**. Current usage counters and real launch populations: **Unknown**. This report is the working capability and proof boundary, not acceptance evidence.

## Desktop boundary confirmed at launch

The operator confirmed Personal Pro/Max for Claude Desktop/Cowork. The [official organization monitoring route](https://support.claude.com/en/articles/14477985-monitor-claude-cowork-activity-with-opentelemetry) is available on Team/Enterprise, so that route is unavailable under the current plan. No upgrade or new spend is authorized. Supported local engine/connection metadata remains a separate candidate; a client connection alone does not prove complete model usage. Content capture must remain off, and account, folder and error fields still need collector allowlisting.

The current ChatGPT desktop continuation has actual native parent-process and owned session-metadata provenance, but its original recorded workspace differs from the new enrollment worktree. That continuation is not a fresh launch in the new root. A separate actual desktop occurrence and transport/source binding are still required. No Electron conversation storage or chat bodies were read.

## Current-source compatibility correction

PR2663 hosted Repo Sanity exposed missing APIs after the accepted main cutover. This is an intentional retirement, not a dependency to restore. Direct native CLI invocations are not automatically forbidden, but they must not become a renamed persistent mailbox, relay or session dispatcher. Current collection remains unverified while that source path and producer provenance are qualified.
