# Ledgers, Leases, and Agent Memory: Prior Art for an Expiring Repo-Facts Ledger

Research date: 2026-10-22. About 17 tool calls in total. Primary sources were used where possible. Several sub-questions are only partly covered; see each Gaps section.

## 1. Tech-debt registries and developer-portal scorecards

### Takeaway
Developer portals (Backstage Tech Insights/Roadie, Cortex) use a three-part model. Facts are ingested from data sources, checks are boolean rules over those facts, and scorecards group the checks. The checks themselves have no deadline. In Cortex, deadlines live on a separate "Initiative" object that wraps scorecard rules and sends owner notifications as the date approaches. None of these sources describe a per-entry expiry or review cadence on a debt item. The facts are re-evaluated continuously, so they never go stale the way a hand-written ledger entry does.

### Cited Findings
- Roadie Tech Insights, a Backstage-based scorecard add-on, "tracks software assets in the Backstage catalog by ingesting Fact data via various Data Sources, and then aggregating Checks on those Facts." Its worked example tracks CODEOWNERS adoption with three objects: a Data Source, a Check, and a Scorecard. It is a paid add-on that an admin enables. — [Roadie: Creating a scorecard](https://roadie.io/docs/getting-started/creating-a-scorecard/); [Roadie changelog: Tech Insights beta](https://roadie.io/changelog/tech-insights-beta-release)
- Cortex: Scorecards themselves have no deadline. For time-bound goals you create an **Initiative**, which "take[s] one or more rules from your scorecards along with a deadline." — [Cortex docs: Scorecards](https://docs.cortex.io/standardize/scorecards); [Cortex: Create a Scorecard](https://docs.cortex.io/scorecards/create)
- Cortex notifies owners and team members as initiative deadlines approach, and progress appears on the Engineering homepage. — [Cortex: Review and evaluate Scorecards](https://docs.cortex.io/standardize/scorecards/evaluate)
- Stepsize describes itself as "the engineer's frontend to issue trackers," a way to log debt from the editor into Jira and similar tools. I found no 2024–2026 news of a shutdown or acquisition. Most of the visible material is older marketing, with a case study dated January 2022, so its current status is **unverified**. — [Stepsize blog: tools to track tech debt](https://stepsize.com:443/blog/tools-to-track-and-manage-technical-debt); [Stepsize Arcane case study](https://stepsize.com/blog/how-arcane-fixed-50-of-their-technical-debt-and-improved-productivity-quality-and-morale)
- In-code expiring TODOs: eslint-plugin-unicorn's `expiring-todo-comments` rule adds expiration conditions to TODO comments, and lint fails once a condition is met. Current versions require ESLint >= 9.18, flat config, and ESM. The rule is not in the recommended preset. With `allowWarningComments: false`, unhandled comments are passed through to `no-warning-comments`. — [eslint-plugin-unicorn readme (v66)](https://cdn.jsdelivr.net/npm/eslint-plugin-unicorn@66.0.0/readme.md); [issue #2076 (ESLint 8.40 crash)](https://redirect.github.com/sindresorhus/eslint-plugin-unicorn/issues/2076)

### Inferences
- The facts → checks → scorecards split corresponds directly to "entry, probe, review." A ledger entry that carries an executable probe works like a one-entity Tech Insights check, and the review deadline works like a Cortex Initiative deadline. Keeping the deadline off the rule, as Cortex does, suggests that "what to check" and "by when" should be separate fields.
- `expiring-todo-comments` is the clearest in-repo example of "rot loudly." The expiry condition sits next to the code, and CI turns the item red when it passes. Its conditions include dates and package versions (my recollection of the rule's options, which I did not re-check this session).

### Gaps
- Spotify Soundcheck, OpsLevel (campaigns/due dates), and CodeScene's debt tracking were not covered; one search for OpsLevel returned nothing relevant.
- I found no primary source for `debt.yaml` / `TECH_DEBT.md` conventions or for Google internal practices such as Testing on the Toilet.
- The `todo-or-die` Ruby gem (raises once a date passes) returned no search results, so it is unverified here.
- Backstage's own open-source Tech Insights plugin docs were not fetched; only the Roadie commercial docs were.

## 2. Issue-tracker-native approaches

### Takeaway
GitHub's ecosystem offers two primitives. One is inactivity-based staleness (`actions/stale`), where any update resets the clock, so it measures activity, not truth. The other is cron-based recurring issue creation (`imjohnbo/issue-bot`). Neither stores a structured expiry per entry or asks for evidence on renewal. A drive-by comment is enough to renew a stale item.

### Cited Findings
- `actions/stale` defaults: `days-before-stale: 60`, `days-before-close: 7`. A negative value disables either stage. Exemptions use `exempt-issue-labels` / `exempt-pr-labels`, and filters include `only-labels` and `any-of-labels`. — [actions/stale README](https://github.com/actions/stale)
- `remove-stale-when-updated` defaults to `true`. Any update or comment resets the idle timer, which is read from `updated_at`. With `ignore-updates: true` the timer uses `created_at` instead. — [actions/stale README](https://github.com/actions/stale)
- `operations-per-run` defaults to 30, as API-rate protection. When the cap is hit, the next run resumes at the first unprocessed item. The README highlights V11 (an ESM migration with no behavior change), though examples still reference `@v10`. — [actions/stale README](https://github.com/actions/stale)
- `imjohnbo/issue-bot` is GitHub's documented example for creating issues on a cron `schedule`, such as a weekly agenda. `close-previous: true` closes the most recent issue with matching labels; the docs warn to use a unique label so the wrong issue isn't closed. `pinned: true` pins the new issue. The docs show no assignee-rotation feature. — [GitHub Docs: Scheduling issue creation](https://docs.github.com/es/enterprise-server@3.14/actions/tutorials/project-management/scheduling-issue-creation)
- GitHub notes that `schedule` events can be delayed when Actions load is high. — [GitHub Docs: Scheduling issue creation](https://docs.github.com/en/enterprise-server@3.0/actions/managing-issues-and-pull-requests/scheduling-issue-creation)

### Inferences
- **Issue tracker vs in-repo ledger.** Issue trackers give you notification, assignment, and UI for free. Their staleness is activity-based, though, and their schema is free text plus labels, so entries can't be schema-validated or tied to the commit that resolves them. An in-repo ledger can be schema-checked in CI, reviewed in the same PR as the code change, and evaluated against the tree, but it needs its own scheduler to notify anyone. A common hybrid is to keep the in-repo ledger as truth and have a cron job open or close issues as the notification surface (the issue-bot pattern).
- `actions/stale`'s "any comment resets the clock" is the blind-extension anti-pattern that lease designs avoid. A ledger should not let an untyped touch renew an entry.
- The `operations-per-run` cap with resume is a pattern worth copying for a pruning job, because it keeps API cost bounded.

### Gaps
- Not covered: probot-reminders / "Slash reminders" (status, and whether abandoned), Linear SLA/cycles, and GitHub issue due dates (Projects date fields). No sources were fetched.

## 3. Lease / TTL / renewal semantics worth borrowing

### Takeaway
The strongest prior art is HashiCorp Vault and cert-manager/ACME. Vault has a per-lease TTL, renewals that count from now (not stacked on the remaining TTL), backend-capped increments, and an **explicit max TTL as a hard lifetime cap**. Periodic tokens are the "renew forever while alive" case, still bounded by an explicit max. cert-manager renews at a fraction of lifetime (2/3 by default) and recommends percentage-based renew-before to avoid renewal loops. ACME ARI (RFC 9773, June 2025) lets the *server* suggest a renewal window, and clients choose a random point inside it to spread load. Kubernetes Leases are heartbeat-only: the holder updates `renewTime`, and others may take over after `leaseDurationSeconds`. None of these renewals carry evidence beyond holder liveness, except certificates, where a renewal is a fresh issuance that needs fresh domain validation.

### Cited Findings
- Vault: every dynamic secret and service token has a lease whose duration is a TTL. On expiry Vault may revoke automatically. — [Vault: Lease concepts](https://developer.hashicorp.com/vault/docs/concepts/lease)
- Vault renewal: "This is not an increment at the end of the current TTL; it is an increment _from the current time_." The requested increment "is completely advisory," because backends may cap it. Clients must read the returned lease to learn the real new TTL. — [Vault: Lease concepts](https://developer.hashicorp.com/vault/docs/concepts/lease)
- Vault revocation "invalidates that secret immediately and prevents any further renewals." Revoking a token revokes every lease it created. Lease IDs are prefixed by request path, so `vault lease revoke -prefix aws/` revokes a whole subtree. — [Vault: Lease concepts](https://developer.hashicorp.com/vault/docs/concepts/lease)
- Vault token TTL counts from creation or the last renewal. An explicit max TTL "becomes a hard limit on the token's lifetime," and even periodic tokens "cannot live past this explicitly-set value." — [Vault: Tokens](https://developer.hashicorp.com/vault/docs/concepts/tokens)
- A Vault periodic token, "as long as the token is successfully renewed within each of these periods of time, it will never expire," unless an explicit max TTL is also set. — [Vault: Tokens](https://developer.hashicorp.com/vault/docs/concepts/tokens)
- Vault's maximum TTL is layered: system max (default "32 days," configurable), then mount max, then an auth-method suggestion that may lower but not raise it. It is "dynamically generated and can change from renewal to renewal." A renewal that fails to extend the TTL signals that the client should re-authenticate, which means getting fresh credentials. — [Vault: Tokens](https://developer.hashicorp.com/vault/docs/concepts/tokens)
- cert-manager: `spec.duration` defaults to 90 days with a minimum of 1 hour. By default, renewal happens "2/3 through the X.509 certificate's duration." `renewBefore` is absolute; `renewBeforePercentage` is relative to the issued duration and is "recommended to prevent renewal loops." The effective minimum renewBefore is 5 minutes, and `duration > renewBefore` is required. — [cert-manager: Certificate resource](https://cert-manager.io/docs/usage/certificate/)
- cert-manager publishes the scheduled time in `status.renewalTime`. Optional `spec.renewal` windows limit when renewal may run, but if no window fits before expiry, renewal still happens at the calculated time. `spec.renewal.policy: Disabled` turns auto-renewal off. `cmctl renew` forces a renewal, and changing certain spec fields triggers reissuance. — [cert-manager: Certificate resource](https://cert-manager.io/docs/usage/certificate/)
- ACME ARI, RFC 9773 (Standards Track, June 2025, author Aaron Gable): the server publishes a suggested renewal window per certificate. The client picks a uniform random time inside it, renews at once if that time has passed, and otherwise re-checks after `Retry-After`. Clients can also tell the server which certificate a renewal replaces. Cron-based clients may need to run more often. — [RFC 9773](https://rfc-editor.org/rfc/rfc9773.html); [datatracker](https://datatracker.ietf.org/doc/rfc9773/)
- Kubernetes Lease (`coordination.k8s.io/v1`) supports node heartbeats and leader election. Each kubelet heartbeat updates `spec.renewTime` on the node's Lease in `kube-node-lease`. `leaseDurationSeconds` is how long candidates must wait after the last observed `renewTime` before they can force-acquire. — [Kubernetes: Leases](https://www.kubernetes.io/docs/concepts/architecture/leases/); [OKD Lease API reference](https://docs.okd.io/4.15/rest_api/metadata_apis/lease-coordination-k8s-io-v1.html)
- With Coordinated Leader Election, the holder identity must equal the elected `LeaseCandidate.metadata.name`. — [OpenShift 4.18 Lease API](https://docs.redhat.com/it/documentation/openshift_container_platform/4.18/html/metadata_apis/lease-coordination-k8s-io-v1)

### Inferences
- **Fresh evidence vs blind extension.** Vault and K8s renewals are blind: a live holder can extend. Certificates are the evidence-bearing case, because each renewal is a fresh issuance that must pass domain validation again, so the evidence is regenerated. A facts ledger should copy the certificate model: renewal re-runs the probe and records its result and commit SHA, and a bare "still true" touch should be rejected.
- **Caps worth copying.** (a) A per-renewal increment capped by policy, Vault-style, so an author can't ask for a 2-year lease. (b) An explicit max lifetime from creation, after which the entry must be re-created with new rationale, as with Vault's explicit max TTL. (c) Renewal measured from now, not stacked. No source surveyed caps the *number* of renewals; Vault caps total lifetime instead.
- **Renew at a fraction of the lease** (cert-manager's 2/3; percentage over absolute to avoid loops) maps onto a "due-soon" state that opens the review before the hard expiry.
- **Server-suggested, jittered windows** (ARI) suit a nightly scheduler: spread due dates randomly within a window so a batch of entries created together doesn't come due on the same day.
- **Prefix revocation** maps onto expiring every entry under a package path when the package is deleted.

### Gaps
- DNS TTL semantics and Chubby (Burrows, OSDI 2006: leases, KeepAlive, grace period) were not fetched this session, so no citations.
- Vault's lease page does not say whether lease renewal can exceed mount max TTL. The token page says renewal is bounded by the computed max.

## 4. Agent memory / reminder stores with TTL or re-validation

### Takeaway
Of the systems checked, only two have first-class expiry. Mem0 has an `expiration_date` per memory, which hides the memory from search/list without deleting it. Zep/Graphiti has a bi-temporal edge model with `t_valid`/`t_invalid` (real-world truth) and `t'_created`/`t'_expired` (system time); contradicting new facts invalidate older edges instead of deleting them. Claude Code auto memory and Letta "Dreaming" consolidate and prune through LLM passes, with no per-entry TTL. **No surveyed system has an agent assert a fact with an expiry and a scheduler re-verify it with a probe.** That combination looks unoccupied.

### Cited Findings
- Mem0 `expiration_date` is a `YYYY-MM-DD` date evaluated in UTC. Expired memories are hidden from `search()` and `get_all()` but kept in storage and still retrievable by ID. The default is "never expires." An unparseable value is treated as not expired. Sending `expiration_date: null` makes a memory permanent again. — [Mem0: Memory expiration](https://docs.mem0.ai/platform/features/memory-expiration); [Mem0: expiration-date](https://docs.mem0.ai/features/expiration-date)
- Conflict: a Mem0 cookbook says expired memories are "automatically removed," while the feature page says they are hidden, not deleted. The feature page is the more precise source. — [Mem0 cookbook: short- and long-term expiration](https://docs.mem0.ai/cookbooks/essentials/memory-expiration-short-and-long-term) vs [Mem0 feature page](https://docs.mem0.ai/platform/features/memory-expiration)
- Zep/Graphiti bi-temporal model: timeline T (chronological) has `t_valid`/`t_invalid` for "the temporal range during which facts held true." Timeline T′ (transactional) has `t′_created`/`t′_expired` to "monitor when facts are created or invalidated in the system." — [Zep paper, arXiv 2501.13956](https://arxiv.org/html/2501.13956v1)
- Graphiti invalidation: an LLM compares a new edge with semantically related existing edges. For contradictions that overlap in time, it "invalidates the affected edges by setting their t_invalid to the t_valid of the invalidating edge." Newer information wins. — [Zep paper, arXiv 2501.13956](https://arxiv.org/html/2501.13956v1)
- Graphiti's README: "When information changes, old facts are invalidated — not deleted." It also has point-in-time queries. Around 32.2k GitHub stars when fetched; the Releases section was empty. — [getzep/graphiti](https://github.com/getzep/graphiti); [Graphiti overview](https://help.getzep.com/graphiti/getting-started/overview)
- Claude Code auto memory lives at `~/.claude/projects/<project>/memory/`, shared across worktrees of one repo, and the location can be overridden with `autoMemoryDirectory`. The first 200 lines or 25KB of `MEMORY.md` load at session start; topic files load on demand. — [Claude Code docs: memory](https://code.claude.com/docs/en/memory)
- Claude Code has no TTL. Memory files are exempt from the `cleanupPeriodDays` transcript sweep and "stay until you or Claude edits or deletes them." Near the size limit, Claude Code reminds Claude to "merge or drop stale entries." Over the limit, the write succeeds but returns an error telling Claude to rewrite the index. — [Claude Code docs: memory](https://code.claude.com/docs/en/memory)
- Claude Code `/doctor prompt-audit` (v2.1.283+) checks CLAUDE.md, AGENTS.md, rules, and skills for outdated content, "references to files or commands that don't exist," and contradictions. It reports proposed edits and changes nothing until you approve. — [Claude Code docs: memory](https://code.claude.com/docs/en/memory)
- Letta's current docs call background consolidation "Dreaming," configured via `/sleeptime` or Dream settings. It runs after N completed agent steps or on context compaction. Background subagents consolidate lessons into MemFS, a git-backed filesystem. An optional "Agent reviews before applying" pass revises proposed updates without asking the user. The page has no decay, expiry, or re-validation. — [Letta docs: sleep-time / Dreaming](https://docs.letta.com/guides/agents/architectures/sleeptime)
- A Glama-listed community MCP server (`WhenMoon-afk/claude-memory-mcp`) includes a `ttl-manager.ts` scoring module. This is evidence that hobbyist MCP memory servers try TTL scoring; I did not inspect how it behaves. — [Glama listing](https://glama.ai/mcp/servers/@WhenMoon-afk/claude-memory-mcp/blob/869724047870c6e4dca5bc2789994346484c1140/src/scoring/ttl-manager.ts)
- Supermemory's 2026-03-26 changelog mentions "Memory expiration fields" in its web app (title only, not examined). — [Supermemory changelog](https://supermemory.ai/changelog/2026-03-26-improvements-and-fixes.md)

### Inferences
- Graphiti's two timelines translate directly to a repo ledger: `valid_from`/`valid_until` record when the fact held in the code, and `recorded_at`/`superseded_at` record ledger bookkeeping. Invalidate-not-delete keeps an audit trail. A git-tracked ledger gets T′ from history for free but still needs an explicit T.
- Mem0's "hide but keep" expiry and its fail-open handling of malformed dates are cautionary. For a governance ledger, a malformed date should fail closed (a CI error), not silently mean "never expires."
- Claude Code's own memory guidance (one line per entry, prune stale entries, a lint-like audit for references to missing files) is a weak, LLM-mediated version of what a probe-backed ledger would enforce mechanically.

### Gaps
- MCP registry scan for reminder/scheduling/todo servers was not done. Only incidental Glama hits.
- Cursor rules and AGENTS.md have no expiry semantics that I could source, and I did not fetch their docs.
- Letta's older `sleeptime_agent_frequency` / memory-block API is not in the current page, so whether it was renamed or removed is unverified.

## 5. Executable assertions / "rot loudly" patterns

### Takeaway
The most concrete sourced example is eslint-plugin-unicorn's `expiring-todo-comments`: the condition is checked mechanically in CI and fails loudly. Other patterns that fit the "probe command, exit code decides" model are cert-manager's renewal (re-issuance re-validates the claim) and scorecard checks over ingested facts. I didn't get to Datadog/Checkly synthetics or doc-test tooling this session.

### Cited Findings
- `expiring-todo-comments` gives TODOs expiration conditions that fail lint once met. It needs ESLint >= 9.18 flat config and is not in the recommended preset. — [eslint-plugin-unicorn readme](https://cdn.jsdelivr.net/npm/eslint-plugin-unicorn@66.0.0/readme.md)
- Tech Insights checks are evaluated over continuously ingested facts, not hand-asserted. — [Roadie: Creating a scorecard](https://roadie.io/docs/getting-started/creating-a-scorecard/)
- Vault: a renewal that doesn't extend the TTL means the client should re-authenticate, which escalates from "extend" to "prove again." — [Vault: Tokens](https://developer.hashicorp.com/vault/docs/concepts/tokens)

### Inferences
- A combined design: each ledger entry stores `probe: <command>` plus `expect: exit 0 = still-temporary`. A scheduler runs probes at `renew_at = created + 2/3·ttl` (cert-manager), with jitter (ARI). A passing probe renews from now, capped by policy (Vault). A failing probe closes the entry as resolved, with the commit as evidence. Hitting `max_lifetime` forces a human or agent to re-justify the entry (Vault explicit max TTL). Supersession sets `valid_until` instead of deleting (Graphiti). An entry with a malformed or missing expiry fails CI.

### Gaps
- Datadog Synthetics, Checkly ("monitoring as code"), and doctest-style tools (e.g. Rust doctests, `mdx`/markdown code-block test runners) were not fetched, so no citations.
- I found no source describing an existing tool where an agent stores a fact with an expiry and a scheduler re-verifies it by probe. This is absence of evidence from a limited search, not proof that no such tool exists.
