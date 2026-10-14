# Privacy-tiered, privilege-aware telemetry for a desktop MCP server (attorney PC vs. family QA/dev PC)

Research date: 2026-10-14. "Accessed 2026-10-14" means the page showed no publication date. This is design research, not legal advice. Items marked **[lawyer to confirm]** need review by a licensed attorney in the relevant jurisdiction.

Working tier vocabulary used below (a proposal, not a standard): `privileged` (attorney PC; shape-only), `standard` (shape plus pseudonymous ids and non-content error detail), `dev-verbose` (family QA/dev PC; content allowed).

## Q1. What does OpenTelemetry (spec + collector-contrib) offer in 2026 for allowlisting, redaction, salted hashing, and PII detection, and where should enforcement live so a misconfigured collector cannot leak?

### Takeaway
OTel has real allowlist primitives at both layers: SDK metric Views have a normative `attribute_keys` allow-list, and the collector-contrib `redaction` processor deletes every attribute not on `allowed_keys` and supports keyed HMAC hashing. Collector redaction is still post-hoc scrubbing, and the processor is only beta for traces and alpha for logs and metrics. For the `privileged` tier the authoritative gate should therefore be in-process: an allowlist exporter or View in the bun binary. The collector is a second fence, and backend schema checks are a third.

### Cited Findings
**SDK layer (in-process, the primary gate)**
- Metrics SDK Views: `attribute_keys` is "at a minimum, an allow-list of attribute keys for measurements captured in the metric stream", and "all other attributes MUST be ignored". With no View value and no `Attributes` advisory parameter, all attributes are kept, so allowlisting has to be configured explicitly. SDKs SHOULD also support an exclude-list. A key that is both included and excluded may fail fast at init. — [OTel Metrics SDK spec](https://opentelemetry.io/docs/specs/otel/metrics/sdk/) (accessed 2026-10-14)
- Exemplar leak path: attributes a View removes "may still be exported on Exemplars as a filtered attribute". To prevent it, use the `AlwaysOff` exemplar filter or a custom filter or reservoir. The default filter SHOULD be `TraceBased`. — [OTel Metrics SDK spec](https://opentelemetry.io/docs/specs/otel/metrics/sdk/)
- Cardinality: attribute filtering runs before cardinality enforcement. The default limit is 2000 series. Overflow series carry `otel.metric.overflow`. Cardinality limits and Exemplars are Stable; measurement processing is "Mixed". — [OTel Metrics SDK spec](https://opentelemetry.io/docs/specs/otel/metrics/sdk/)
- OTel's own guidance says the best protection is not collecting sensitive data at all, and that you are responsible for reviewing what instrumentation libraries emit. — [OTel: Handling sensitive data](https://opentelemetry.io/docs/security/handling-sensitive-data/) (accessed 2026-10-14)

**MCP / GenAI semantic conventions (what the attribute names should be)**
- The MCP semconv marks `gen_ai.tool.call.arguments`, `gen_ai.tool.call.result` and `gen_ai.prompt.variable` as **Opt-In** and flags them as possibly sensitive. The non-content attributes and their levels:
  - Required: `mcp.method.name`
  - Conditionally Required: `error.type` (on failure only), `gen_ai.tool.name`, `gen_ai.prompt.name`, `jsonrpc.request.id`, `mcp.resource.uri`
  - Recommended: `mcp.session.id`, `mcp.protocol.version`, `network.transport`, `gen_ai.operation.name`
  - Metrics: `mcp.server.operation.duration`, `mcp.server.session.duration` (plus the client equivalents)
  - Stability: the document is "Development". `error.type` and `network.transport` are Stable.
  - [semantic-conventions-genai: mcp.md](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/mcp.md) (accessed 2026-10-14; GenAI semconv moved out of the main semconv site to this repo — [old page notice](https://opentelemetry.io/docs/specs/semconv/gen-ai/mcp/))
- GenAI content capture is opt-in by convention: instrumentations "SHOULD NOT capture inputs/outputs by default". The env var's accepted values differ between implementations. Vendor docs use the boolean `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=true`; `opentelemetry-util-genai` uses an enum `NO_CONTENT` (default) / `SPAN_ONLY` / `EVENT_ONLY` / `SPAN_AND_EVENT`, gated by `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`. — [opentelemetry-util-genai 0.4b0](https://simple-repository.app.cern.ch/project/opentelemetry-util-genai); [SigNoz OpenAI guide](https://signoz.io/docs/opentelemetry-openai-monitoring); [Google Cloud Trace guide](https://docs.cloud.google.com/trace/docs/collect-view-multimodal-prompts-responses) (all accessed 2026-10-14; secondary sources, and they conflict on the value format)

**Collector layer (second fence)**
- `redaction` processor ([README](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/processor/redactionprocessor/README.md), accessed 2026-10-14):
  - `allowed_keys`: "If empty, all attributes are removed". Non-allowed attributes are *removed*, not masked, and never reach value checks.
  - Other key options: `allow_all_keys`, `ignored_keys` / `ignored_key_patterns` (pass through unchecked; processed first), `blocked_key_patterns` (mask the whole value).
  - Value options: `blocked_values` (regex mask with `*`), `allowed_values` (takes precedence over blocked), `redact_all_types` (also checks non-string values via their string form).
  - `hash_function` accepts `md5`, `sha1`, `sha3`, `hmac-sha256`, `hmac-sha512`. The HMAC variants take an `hmac_key`; there is no separate salt option.
  - `summary` levels `debug` / `info` / `silent` emit audit attributes: `redaction.redacted.keys/count`, `redaction.masked.keys/count`, `redaction.allowed.keys/count`, `redaction.ignored.count`, and `redaction.body.*` for map log bodies.
  - `url_sanitizer` and `db_sanitizer` (sql, redis, memcached, mongo, opensearch, es) reduce variable URL and query parts.
  - Stability: traces Beta, logs and metrics Alpha.
- OTel docs name four collector processors for sensitive data: `attributes` (`delete`/`hash` actions), `filter` (drop whole spans or metrics), `redaction` (allowlist), and `transform` (OTTL, e.g. `set(attributes["user.hash"], SHA256(attributes["user.id"]))` then `delete_key`). — [OTel: Handling sensitive data](https://opentelemetry.io/docs/security/handling-sensitive-data/)
- Hashing caveat: hashing "may not anonymize enough" when the input space is small or predictable, because such hashes can be reversed in practice. Truncate instead: year-month only, email domain only, zero the last IPv4 octet. — [OTel: Handling sensitive data](https://opentelemetry.io/docs/security/handling-sensitive-data/)
- Collector hardening: bind receivers to `localhost` (the default since v0.110.0) or `127.0.0.1`/`::1` rather than `0.0.0.0`. Build a minimal distribution with the OpenTelemetry Collector Builder (`ocb`). Keep tokens in secret stores via env expansion. The redaction allowlist example uses `summary: debug`. — [OTel Collector configuration best practices](https://opentelemetry.io/docs/security/config-best-practices/) (accessed 2026-10-14)
- Persistent spool: `sending_queue.storage` pointed at a `file_storage` extension keeps a disk queue that survives restarts. `queue_size` defaults to 1000 batches. Auth-extension context is not persisted. The README does not say whether data is encrypted at rest. `retry_on_failure` defaults: 5s initial, 30s max, 300s `max_elapsed_time`. — [exporterhelper README](https://github.com/open-telemetry/opentelemetry-collector/blob/main/exporter/exporterhelper/README.md) (accessed 2026-10-14)

**Backend / schema layer (third fence and proof)**
- OTel Weaver `live-check` validates emitted OTLP against a semconv registry in real time and produces a compliance report. Custom policies are written in Rego and evaluated per attribute and signal; `weaver registry check` runs in CI. — [OTel blog: Observability by Design with Weaver (2025)](https://opentelemetry.io/blog/2025/otel-weaver/); [Dynatrace community overview](https://community.dynatrace.com/t5/OTel/OTel-Weaver-a-high-level-overview-of-OTel-s-schema-and-policy/td-p/303520) (accessed 2026-10-14)

### Inferences
- **Where enforcement must live:** a misconfigured collector cannot leak data that never left the process. So for `privileged`:
  - Make the SDK-side gate authoritative. In a bun-compiled binary this means a custom `SpanExporter` / `LogRecordExporter` / `MetricExporter` wrapper, or a `SpanProcessor.onEnd` filter, that rebuilds each record from a closed, typed allowlist schema. It drops unknown keys, strips span events, links and log bodies, and sets exemplars to `AlwaysOff`.
  - Add metric Views with explicit `attribute_keys` on every instrument.
  - The collector `redaction` processor with `allowed_keys` mirroring the same list, `summary: info`, and `hmac-sha256` with a per-install key is defense in depth.
  - Backend ingest validation (Weaver policy or a custom check) rejects or quarantines any record that carries a non-allowlisted key.
- Drive all three layers from one allowlist artifact, e.g. a schema in the repo that generates the SDK filter, the collector `allowed_keys`, and the Weaver/Rego policy. Otherwise the layers drift.
- The `privileged` allowlist should drop the Opt-In MCP content attributes outright. Treat `mcp.resource.uri` and `jsonrpc.request.id` as risky:
  - A resource URI can embed a matter name or file path. Emit only a scheme or a resource-template id.
  - Keep `gen_ai.tool.name` only if tool names are a closed enum that you ship.
- Salting: use HMAC with a per-install secret kept in the OS keystore, so hashes of small-domain values (tool args, file names) cannot be brute-forced. Better still, do not hash content-derived values at all in `privileged`. Even keyed hashes create linkability across events, which can itself reveal facts about a matter, such as "the same document was opened 40 times".
- Collector-side PII detection (regex `blocked_values`) is a backstop for `standard` and `dev-verbose`. It is not a reason to allow free text in `privileged`: regexes cannot recognize privileged legal content.

### Gaps
- No OTel-native "allowlist exporter" component exists for the JS SDK in the sources found. It has to be custom-built.
- No source found on Weaver policy packs specifically for allowlist enforcement. Allowlist checks via Rego are an inference.
- The persistent queue's at-rest encryption is undocumented. The file_storage extension docs were not checked.

## Q2. How do VS Code, JetBrains, Claude Code, Codex, GitHub Copilot, Microsoft 365/Windows, Mozilla and Apple define telemetry levels and consent, and what is the "minimum" level's content?

### Takeaway
The industry pattern is an ordered ladder: off < crash < error < usage/optional (or required < optional). Each higher level is a superset of the lower one, and policy can only make settings *more* restrictive. AI developer tools (Claude Code, Codex) add a second, orthogonal axis: per-content flags that are off by default even when telemetry is on. Content is replaced with `<REDACTED>` while length or size is kept. That two-axis model maps directly onto `privileged` / `standard` / `dev-verbose`.

### Cited Findings
**VS Code**
- `telemetry.telemetryLevel` = `all` (crash + error + usage), `error` (crash + error), `crash` (crash only), `off`.
- Turning telemetry off does not recall data already sent.
- Extensions "are not controlled by" this setting.
- Error stack traces are scrubbed of user paths. The machine id is hashed on the client and again in the pipeline.
- Users can audit with **Developer: Show Telemetry** (a live output channel plus local `telemetry.log`) and with `code --telemetry`, which dumps the JSON catalogue of possible events.
- [VS Code telemetry docs](https://code.visualstudio.com/docs/configure/telemetry) (page dated 10/7/2026; format ambiguous)

**JetBrains**
- Anonymous usage statistics cover: commonly used plugins and libraries only, file extensions, rounded file counts, feature-usage event sequences, settings, and performance durations (startup, indexing, builds).
- "We do not collect any information related to your code or custom input, such as written code, search inputs, or queries."
- Off by default in release builds and on by default in EAP builds.
- AI uses a separate "Send detailed code-related data" option that organizations can disable.
- Third-party plugins are not governed by the IDE setting.
- [JetBrains: Usage statistics](https://www.jetbrains.com/help/idea/settings-usage-statistics.html) (page dated 2026-08-17)

**Claude Code**
- Telemetry is off unless `CLAUDE_CODE_ENABLE_TELEMETRY=1`.
- Content flags, all off by default:
  - `OTEL_LOG_USER_PROMPTS`: without it, `prompt` is `<REDACTED>` but `prompt_length` is kept.
  - `OTEL_LOG_ASSISTANT_RESPONSES`: falls back to the prompts flag when unset.
  - `OTEL_LOG_TOOL_DETAILS`: bash commands, MCP server and tool names, tool input, file paths, full error messages.
  - `OTEL_LOG_TOOL_CONTENT`: tool output; requires tracing.
  - `OTEL_LOG_RAW_API_BODIES`: full request and response JSON; implies everything above.
- Without these flags, tool events still record `tool_name`, `success`, `duration_ms`, sizes and `error_type`.
- Third-party plugin names collapse to `"third-party"` and user skills to `"custom_skill"`.
- `CLAUDE_CODE_OTEL_CONTENT_MAX_LENGTH` defaults to 60 KB.
- Identifier toggles: `OTEL_METRICS_INCLUDE_SESSION_ID` (default true), `OTEL_METRICS_INCLUDE_ACCOUNT_UUID` (default true), `..._VERSION` (default false).
- `user.id` (a random anonymous id), `organization.id` and `user.email` are included when available.
- Governance:
  - Repos cannot enable or redirect telemetry. Claude Code ignores OTEL exporter vars in `.claude/settings.json`, and a repo can only set an exporter to `none`.
  - Managed settings lock endpoint and headers, but exporter selectors are not locked unless also set in managed settings.
  - Subprocesses don't inherit OTEL vars.
- [Claude Code monitoring docs](https://code.claude.com/docs/en/monitoring-usage) (accessed 2026-10-14)

**Codex**
- OTel is "Disabled by default; opt in via `[otel]`" in user-level `~/.codex/config.toml`. Project-local `.codex/config.toml` ignores `otel` and prints a warning.
- `environment` defaults to `"dev"`.
- `exporter` = `none` | `otlp-http` | `otlp-grpc`.
- `log_user_prompt = false` keeps prompts redacted. The `codex.user_prompt` event carries prompt length only.
- Other events: `codex.tool_result` (duration, success, *output snippet*), `codex.tool_decision`, `codex.api_request`, `codex.sse_event` (token counts).
- `[analytics] enabled = false` disables metrics, and that switch is separate from `[otel]`.
- [Codex advanced config](https://learn.chatgpt.com/docs/config-file/config-advanced) (accessed 2026-10-14; redirected from developers.openai.com)

**GitHub Copilot**
- Usage metrics come mostly from client IDE telemetry, with server-side signals as a fallback. `last_activity_at` is retained for 90 days and cannot be changed. — [GitHub Copilot metrics data](https://docs.github.com/en/copilot/reference/metrics-data) (accessed 2026-10-14)
- Business FAQ text: prompts and suggestions are not retained. "User Engagement Data, including pseudonymous identifiers and general usage data", is always collected and shared with Microsoft. — [mirrored docs commit](https://source-hub.etos-pro.ru/github/docs/commit/ce1f842cfba6e01667228fcbf28cc8b5f4e35c0e) (third-party mirror; confirm against live docs)

**Microsoft 365 Apps**
- Three diagnostic levels: **Required** ("minimum data necessary to help keep Office secure, up-to-date, and performing as expected", e.g. installed Office version, crashes on document open), **Optional** (e.g. time to save a document), and **Neither**.
- Diagnostic data "doesn't include a user's name or email address, the content of the user's files". A unique pseudonymous id separates "1 user × 100 crashes" from "100 users × 1".
- Users signed in with work accounts cannot change the admin-set level.
- "Required service data" and "essential services" (e.g. licensing) are still sent even at **Neither**, which is a precedent for disclosing the irreducible floor.
- The Diagnostic Data Viewer lets users inspect what is sent.
- [M365 Apps privacy controls overview](https://learn.microsoft.com/en-us/microsoft-365-apps/privacy/overview-privacy-controls) (ms.date 2026-04-30)

**Windows**
- Four levels: Diagnostic data off (Security) = 0, Required (Basic) = 1, Enhanced = 2 (legacy), Optional (Full) = 3.
- Required includes:
  - device, OS, CPU, memory and storage attributes
  - telemetry-pipeline quality metrics (% uploaded / dropped / blocked events, last upload time)
  - quality info such as crash and hang counts and per-app "how much processor time and memory were used, and the total uptime"
  - app compatibility inventory
  - crash *metadata* but no crash dumps
- Optional adds crash dumps, which "may unintentionally contain user content".
- "When both the Computer Configuration policy and User Configuration policies are set, the more restrictive policy is used."
- Users can lower the level unless a policy locks the UI.
- Separate `LimitDumpCollection` and `LimitDiagnosticLogCollection` policies exist.
- [Configure Windows diagnostic data](https://learn.microsoft.com/en-us/windows/privacy/configure-windows-diagnostic-data-in-your-organization) (ms.date 2025-09-11)

**Mozilla**
- Category 1 Technical (OS, crashes and errors, versions, settings): default-on eligible.
- Category 2 Interaction (clicks, session length): default-on eligible.
- Category 3 Stored content and communications (files, notes, communications): default OFF in release unless Trust approves.
- Category 4 Highly sensitive (identifiers, contact info, precise location, plus *combinations* of categories that could identify a person): default OFF, needs consent and advance notice.
- Every new probe goes through data-steward review (data-review+/-). Categories 3 and 4 need a cross-functional sensitive review before shipping. Firefox code changes get a `needs-data-classification` tag.
- [Mozilla wiki: Data Collection](https://wiki.mozilla.org/Data_Collection) (last edited 2026-04-27)

**Apple**
- Local differential privacy with a per-donation epsilon and a cap on contributions per user per day. Example: Lookup Hints uses epsilon 4 with 2 donations per day. Data is retained for at most 3 months. — [Apple Differential Privacy Overview (PDF)](https://apple.com/privacy/docs/Differential_Privacy_Overview.pdf) (undated; ~2017)
- Independent analysis of macOS 10.12 found per-datum loss of 1–2 but total permitted loss up to 16 per day, renewed daily. — [Tang et al., arXiv 1709.02753 (2017)](https://ar5iv.labs.arxiv.org/html/1709.02753) (old; may not reflect current OS)

**Legal-tech: iManage**
- Uses Twilio Segment for "anonymous baseline statistics" by default, and offers an optional richer tier that includes end-user search results and other PII.
- States it never sends company names, user names, emails, or document, workspace or folder names to Segment.
- An older 10.4.2 page says collection is opt-in, so the docs conflict on the default.
- [iManage Cloud usage analytics](https://docs.imanage.com/cloud/cc-help/en-US/Analytics.html); [iManage 10.4.2 analytics](https://docs.imanage.com/cc-help/10.4.2/en-US/Analytics.html) (accessed 2026-10-14)

**Legal-tech: Clio**
- The privacy policy (effective 2026-02-11) discloses analytics providers among recipients and use of *anonymized* data for testing, research and product development, including sharing it with others. — [Clio privacy policy](https://www.clio.com/privacy/); [Clio UK privacy](https://www.clio.com/uk/privacy/) (last modified 2025-11-07)

### Inferences
- Map to the proposed tiers:
  - `privileged` ≈ Windows/M365 "Required" + VS Code `error`, *minus* crash dumps, file paths and error messages. Equivalently, Claude Code with telemetry on and every content flag off, plus a further rule: tool names are allowed only from the shipped enum, the way Claude Code collapses custom names to `"custom_skill"`.
  - `standard` ≈ add pseudonymous install id, session id, and sanitized error class plus code.
  - `dev-verbose` ≈ Claude Code with `OTEL_LOG_TOOL_DETAILS` / `TOOL_CONTENT` on, allowed only on the family QA PC.
- Strong precedents to copy:
  1. Repo or project config cannot raise the tier (Claude Code, Codex).
  2. The most restrictive of several policy sources wins (Windows).
  3. A user-visible local viewer of exactly what is sent (Windows/M365 Diagnostic Data Viewer, VS Code Show Telemetry).
  4. A machine-readable catalogue of every possible event (`code --telemetry`).
  5. Per-probe classification review (Mozilla categories / data-review).
  6. Disclosure of an irreducible floor (M365 required service data).
- Mozilla's "combinations of categories can be Category 4" rule supports the case against joining a stable install id with fine timestamps and tool names in `privileged`.
- Differential privacy (Apple) is overkill for a two-machine fleet. With n = 1 attorney there is no crowd to hide in, so DP gives little utility. Shape-only plus coarse aggregation is the realistic control.

### Gaps
- NetDocuments, Westlaw (Thomson Reuters) and Clio desktop or add-in telemetry specifics were not found. Clio's telemetry fields were not readable from the policy excerpt.
- GitHub Copilot's current live docs on IDE telemetry settings were not fetched directly.
- No source checked on Claude *Desktop* (vs. Claude Code) telemetry controls, or on how Claude Desktop handles an MCP server's stderr logs.

## Q3. Legal and ethical frame: ABA Model Rule 1.6, technology opinions, state cloud opinions, and confidential information vs. software-operation metadata

### Takeaway
The governing standard is "reasonable efforts" (Rule 1.6(c), Comment [18] factors), judged by sensitivity and risk, not a bright-line ban. The duty covers all "information relating to the representation", which is broader than privilege. Telemetry that could reveal client identity, matter names, document names, search terms, or even activity patterns tied to a matter is plausibly within scope. Pure software-health data (latency, error class, version, process resources) is the strongest case for being outside it. **[lawyer to confirm]**

### Cited Findings
- Model Rule 1.6 Comment [18] factors for "reasonable efforts" include, non-exhaustively: (1) the sensitivity of the information; (2) the likelihood of disclosure if more safeguards are not used; (3) the cost of those safeguards; (4) the difficulty of implementing them; (5) how far they would hamper the lawyer's ability to represent clients. Unauthorized access is not a violation if reasonable efforts were made. A client may demand extra measures or give informed consent to forgo them. — [Univ. of Houston Law reproduction](https://law.uh.edu/faculty/adjunct/dstevenson/2019/008.pdf); [Virginia rule amendment PDF (2015)](https://www.vacourts.gov/courts/scv/amendments/2015_12_17_part6_section2_rule_1_1_1_6.pdf) (secondary or state versions; ABA page returned 403; Virginia numbers it Comment [19] and adds tech-competent personnel as a factor)
- ABA Formal Op. 477R (May 22, 2017): lawyers must make reasonable efforts to prevent inadvertent or unauthorized access when transmitting client information online. The analysis is case-by-case by sensitivity; routine unencrypted email is generally acceptable, but stronger measures are warranted for highly sensitive matters. It updated Op. 99-413. — [LawPay summary](https://www.lawpay.com/about/blog/protection-of-client-information-what-aba-opinion-477r-means-for-you/); [ezel.ai digest](https://ezel.ai/ethics-opinions/aba/477r-securing-communication-client-information) (secondary)
- ABA Formal Op. 498 (March 10, 2021, virtual practice) applies the confidentiality duty to "all hardware and software used in a law practice". It advises disabling the listening features of smart speakers and virtual assistants unless they assist the practice. This is the closest analogue to "ambient" data collection by software on the lawyer's machine. — [Holland & Knight (2021-03-12)](https://www.hklaw.com/en/insights/publications/2021/03/aba-offers-general-guidance-for-virtual-law-practices); [LawNext (2021-03)](https://www.lawnext.com/2021/03/aba-issues-cautionary-ethics-guidance-on-virtual-law-practices.html)
- ABA Formal Op. 512 (July 29, 2024, generative AI):
  - Self-learning GAI tools raise disclosure risk even inside one firm.
  - Informed client consent is required before inputting information relating to the representation into such tools.
  - Boilerplate engagement-letter consent is insufficient.
  - The opinion is persuasive, not binding.
  - Florida Op. 24-1 reaches a similar conclusion.
  - [ABA Litigation Section article](https://www.americanbar.org/groups/litigation/resources/newsletters/ethics-professionalism/generative-ai-lawyers-part-2-maintaining-confidentiality/); [FKKS summary](https://technologylaw.fkks.com/post/102jwnl/aba-issues-comprehensive-formal-ethics-opinion-on-lawyers-use-of-generative-ai) (secondary)
- State cloud opinions (all "reasonable care" standards):
  - NY State Bar Op. 842 (2010-09-10): online storage is allowed with reasonable care to maintain confidentiality. Lawyers should investigate provider security and keep watching privilege law.
  - PA Formal Op. 2011-200: cloud storage is allowed with reasonable care and safeguards against breach and data loss; a 15-point safeguard list, reaffirmed in 2020-300.
  - CA Formal Op. 2010-179: whether a technology is acceptable depends on that technology and the circumstances, including its security and the information's sensitivity. It declines a tech-by-tech approach.
  - Florida Op. 12-3 summarizes the multi-state consensus.
  - [NYSBA Op. 842](https://nysba.org/?p=8951); [Slaw on PA 2011-200 (2011-11-23)](https://www.slaw.ca/2011/11/23/new-ethics-opinion-on-cloud-computing-from-the-pennsylvania-bar/); [ezel.ai CA 2010-179](https://ezel.ai/ethics-opinions/cabar/2010-179-confidentiality-and-competence-using-technology); [Florida Op. 12-3](https://www.floridabar.org/etopinions/etopinion-12-3/); [Clio list of cloud ethics opinions](https://www.clio.com/?p=16502)
- Vendor precedent for what lawyers' vendors treat as off-limits in analytics: iManage excludes company names, user names, emails, and document, workspace and folder names from Segment analytics. — [iManage Cloud analytics](https://docs.imanage.com/cloud/cc-help/en-US/Analytics.html)

### Inferences
- Line-drawing proposal **[lawyer to confirm]**:
  - **Treat as confidential, never in `privileged`:** prompt and tool arguments, tool results, document, file, folder and matter names, paths, search queries, client or party names, email addresses, resource URIs, free-text error messages (they often echo input), and crash dumps or stack locals.
  - **Arguably confidential via pattern, so coarsen:** per-event timestamps finer than about an hour, joined with a stable id. Per-tool call counts per session can also reveal workload on a specific matter; aggregate them.
  - **Software operation (lowest risk):** binary version, OS build, tool-name enum, error *class* or code enum, latency histograms, counts, process CPU, RAM and IO, exporter health.
- Rule 1.6's "reasonable efforts" and the 477R sensitivity scaling support a tier model directly. Strictest for the attorney PC, lenient for a non-client family machine, provided no client data ever reaches the family machine. If it does, that machine inherits the strict tier.
- Under Op. 512 logic, telemetry that carries content to a third party (backend, LLM eval pipeline) could need informed client consent. Keeping `privileged` content-free avoids that question.
- The telemetry backend is a "vendor" under the state cloud opinions if it is hosted by a third party. A tailnet- or local-only sink reduces that exposure. Note that `~/.claude/rules/oip-confidentiality.md` says hosted providers are acceptable for product AI; this concerns telemetry minimization only, not architecture.

### Gaps
- The primary ABA PDFs for 477R, 498 and 512 were not fetched (ABA site returned 403). Quotations are from secondary sources.
- No ethics opinion was found that addresses *software telemetry or diagnostic metadata* specifically. That is the key open legal question **[lawyer to confirm]**.
- Privilege-waiver risk from telemetry (vs. the confidentiality duty) was not researched. Whether the existence or timing of tool calls is privileged is jurisdiction-specific **[lawyer to confirm]**.

## Q4. Proof techniques: canaries, export-time schema validation, payload snapshots, negative ledger of dropped keys, tier-change audit

### Takeaway
Off-the-shelf pieces exist for the negative ledger (the redaction processor's `redaction.*.keys/count` summary), for schema conformance (Weaver live-check plus Rego), and for user-auditable payloads (VS Code Show Telemetry / `--telemetry`, Windows/M365 Diagnostic Data Viewer). Canary strings and payload snapshot tests are standard engineering practice, but no vendor source for them was found. They have to be built.

### Cited Findings
- Negative ledger: the redaction processor can annotate each record with the *names and counts* of removed, masked and allowed keys (`summary: info|debug`). It does not redact its own `redaction.*` attributes, and zero counts are not emitted. — [redaction processor README](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/processor/redactionprocessor/README.md)
- Schema conformance: Weaver live-check produces a compliance report of the emitted signals against a registry, plus Rego policies on attribute values. It runs in CI. — [OTel Weaver blog (2025)](https://opentelemetry.io/blog/2025/otel-weaver/); [Honeycomb on Weaver](https://www.honeycomb.io/blog/making-semantic-conventions-work-opentelemetry-weaver) (accessed 2026-10-14)
- Event catalogue: `code --telemetry` emits a JSON list of every possible event for a build. — [VS Code telemetry](https://code.visualstudio.com/docs/configure/telemetry)
- Local viewers: Windows and M365 offer the Diagnostic Data Viewer, and VS Code writes a local `telemetry.log`. — [M365 privacy controls](https://learn.microsoft.com/en-us/microsoft-365-apps/privacy/overview-privacy-controls); [VS Code telemetry](https://code.visualstudio.com/docs/configure/telemetry)
- Pipeline self-telemetry precedent: Windows Required data includes % uploaded, dropped and blocked events and the last upload time. — [Windows diagnostic data](https://learn.microsoft.com/en-us/windows/privacy/configure-windows-diagnostic-data-in-your-organization)
- Per-probe human review gate: Mozilla data-review+ and the `needs-data-classification` Phabricator tag. — [Mozilla Data Collection](https://wiki.mozilla.org/Data_Collection)

### Inferences (design proposals, not sourced practice)
- **Canary test:** seed fixtures (matter names, file paths, prompts, tool args) with unique high-entropy canaries, e.g. `CANARY-<uuidv7>`. Run the real MCP server at tier `privileged` with an in-memory exporter and a file sink. Assert that no exported byte sequence contains any canary, also checking base64, URL-encoded and hex forms, plus hashes of the canaries if keyed hashing is disabled. Run the same suite through the collector config, so both fences are tested.
- **Closed-schema exporter:** for each signal and tier, encode the export DTO from an `effect/Schema` struct with no index signatures. Unknown keys fail decode, and the record is dropped and counted, not passed. Snapshot-test the *key set* per event type, and have CI fail on any new key without a classification entry (a Mozilla-style data review in code).
- **Negative ledger on the device:** count dropped keys by *key name* (keys are designer-controlled, so the names are safe) and drop reason. Export only the counts at `privileged`. A non-zero count for an unexpected key is a bug signal and never carries the value.
- **Tier-change audit:** append-only local log of `{ts, from, to, actor, source(policy|cli|env), config_hash, signature_ok}`. Export the tier-change event itself as a `privileged`-safe record. Hash-chain the entries so tampering is detectable.
- **Attorney-facing viewer:** a local command, e.g. `server telemetry --show`, that prints the exact pending spool. This mirrors the Diagnostic Data Viewer and supports the "reasonable efforts" narrative.

### Gaps
- No public example found of a legal-tech or healthcare vendor publishing canary or leak tests for telemetry.
- No HIPAA-specific telemetry guidance was researched; the healthcare comparison remains a gap.

## Q5. Operational tier switching: who can change it, signed config, local-only vs tailnet export, offline spool under the capture-time tier

### Takeaway
Precedents converge on four rules:
1. Machine or admin policy sets a ceiling.
2. Users or projects can only lower it (Windows "more restrictive wins", the Claude Code/Codex rule that project config cannot raise telemetry, M365 work accounts that cannot change the admin level).
3. Endpoints and credentials get locked by managed policy.
4. Offline durability comes from the collector's persistent queue.

Binding a tier to records at capture time is not provided by any standard. It has to be designed: stamp a resource attribute and filter before the spool.

### Cited Findings
- Windows: computer and user policies combine to the more restrictive. Users can lower the level unless a UI-lock policy is set. — [Windows diagnostic data](https://learn.microsoft.com/en-us/windows/privacy/configure-windows-diagnostic-data-in-your-organization)
- M365: users signed in with org credentials cannot change the admin-chosen diagnostic level. — [M365 privacy controls](https://learn.microsoft.com/en-us/microsoft-365-apps/privacy/overview-privacy-controls)
- Claude Code: repo settings can only turn a signal *off*. Managed settings lock the endpoint and headers. Exporter selectors must also be set in managed settings or a developer can switch them to `console` or `none`. — [Claude Code monitoring](https://code.claude.com/docs/en/monitoring-usage)
- Codex: `otel` is accepted only in user-level config; project-local config is ignored with a warning. — [Codex advanced config](https://learn.chatgpt.com/docs/config-file/config-advanced)
- Offline spool: `sending_queue.storage` with `file_storage` survives restarts. It drops data when full or on IO errors, and auth context is not persisted. — [exporterhelper README](https://github.com/open-telemetry/opentelemetry-collector/blob/main/exporter/exporterhelper/README.md)
- Local binding: bind receivers to localhost (default since collector v0.110.0). — [Collector config best practices](https://opentelemetry.io/docs/security/config-best-practices/)

### Inferences
- **Who changes the tier:**
  - The tier source is a machine-scope policy file, e.g. under `%ProgramData%` on Windows, writable only by an admin. It is signed by an operator key, and the binary embeds the public key.
  - The attorney can always *lower* the tier (to `off`) without a signature. Raising it requires a signed policy.
  - Env vars or CLI flags may lower but never raise. That rule follows the Claude Code repo-cannot-enable precedent.
  - If the signature fails, fall back to the strictest tier.
- **Default on unknown machine:** `privileged`, fail-closed. `dev-verbose` requires a signed policy naming a machine fingerprint, e.g. a hash of a machine GUID, so a copied policy file does not unlock verbose mode on the attorney PC.
- **Capture-time binding:**
  - Stamp the `telemetry.tier` resource attribute plus the policy hash on the `Resource`.
  - Apply the tier filter in-process *before* writing to any spool, so the spool only ever holds tier-compliant data. A later tier raise cannot retroactively expose content, because the content was never captured.
  - A tier *lowering* should purge or re-filter queued data down to the new tier. This mirrors Windows deleting pre-existing diagnostic data when the processor configuration is enabled.
- **Export topology:**
  - `privileged`: local file spool → tailnet-only OTLP endpoint (operator's collector), mTLS, with the redaction processor as a second fence.
  - `dev-verbose`: may export directly.
  - Never let the attorney-PC binary accept an endpoint from env without the signed policy. This mirrors Claude Code locking the endpoint.
- Encrypt the spool at rest, e.g. with DPAPI on Windows, because the persistent-queue docs do not promise encryption.
- MCP stdio caveat: stdout is the JSON-RPC channel, so diagnostics go to stderr, and Claude Desktop may persist stderr in its own logs. The `privileged` tier must apply the same allowlist to stderr logging, not only to OTLP. (Inference from the MCP stdio design; the Claude Desktop log-retention behavior was not verified.)

### Gaps
- No source found on signed telemetry-policy files in comparable desktop products; this is proposed design.
- Claude Desktop's own MCP log location and retention were not verified.

## Q6. Is resource telemetry (CPU, RAM, disk IO of the extension process) safe at the strictest tier, and at what granularity?

### Takeaway
Yes, with coarsening. Microsoft treats per-app processor time, memory and uptime as part of its *minimum* "Required" Windows tier, and JetBrains collects performance durations by default. The residual risk is side-channel inference: fine-grained IO bytes or timing aligned to specific tool calls could hint at document sizes or matter activity. Export process-level aggregates over fixed windows, not per-call samples.

### Cited Findings
- Windows Required (minimum non-off) tier includes "app state change details, such as how much processor time and memory were used, and the total uptime for an app", crash and hang counts, and processor, memory and storage attributes. — [Windows diagnostic data](https://learn.microsoft.com/en-us/windows/privacy/configure-windows-diagnostic-data-in-your-organization)
- JetBrains' default usage statistics include performance metrics: durations of startup, project analysis, builds and run configurations, plus rounded file counts. — [JetBrains usage statistics](https://www.jetbrains.com/help/idea/settings-usage-statistics.html)
- Mozilla classifies crashes, errors, versions and OS details as Category 1 Technical, which is default-on eligible. — [Mozilla Data Collection](https://wiki.mozilla.org/Data_Collection)
- Claude Code records sizes and `prompt_length` even with content redacted, so size metadata is treated as acceptable by default. — [Claude Code monitoring](https://code.claude.com/docs/en/monitoring-usage)
- OTel recommends truncation to reduce re-identification (e.g. year-month only). — [OTel sensitive data](https://opentelemetry.io/docs/security/handling-sensitive-data/)

### Inferences
- **`privileged` granularity proposal:**
  - Process CPU %, RSS and peak RSS, handle and thread counts, disk read and write bytes: export as 1–5-minute aggregates (min/max/p50/p95) on the process-runtime resource, without per-tool attributes.
  - Latency as explicit-bucket histograms per tool-name enum.
  - Byte sizes (payload, file) bucketed to powers of two, never exact. Exact sizes can fingerprint a specific document.
  - Timestamps on exported aggregates rounded to the window.
- Do not attach resource samples to individual tool spans in `privileged`, because the correlation lets an observer infer what was processed. In `dev-verbose`, per-span resource deltas are fine.
- Host-level data (other processes, window titles, full file system usage) is out of scope for an MCP server and should never be collected at any tier on the attorney PC.
- Note the Mozilla "combination" rule: version + coarse resources + a pseudonymous install id is low risk. Adding fine timestamps and tool names on every sample raises it.

### Gaps
- No source quantifies side-channel risk from resource telemetry in legal or healthcare contexts. The granularity numbers above are proposals.
- The OTel process/runtime semconv (e.g. `process.cpu.time`, `process.memory.usage`) and the bun runtime's support for them were not verified in this session.
