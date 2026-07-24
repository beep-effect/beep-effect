# Adversarial Review

1. **CRITICAL — The Nix evidence does not support the proposed Pulumi mechanism; the verdict is DOES-NOT-HOLD-AS-SPECIFIED.**

   **Target:** `RESEARCH.md:177-202`, `RESEARCH.md:249-254`, `BRIEF.md:27-29`, `BRIEF.md:69-75`, and decision 7 in `DECISIONS.md:93-108`.

   **Evidence:** `OPENCLAW_NIX_MODE=1` is an in-process policy check, not filesystem immutability. The guard only tests an environment variable and throws (`~/YeeBois/dev/openclaw/src/config/nix-mode-write-guard.ts:32-43`), and the central writer calls it before its own write path (`~/YeeBois/dev/openclaw/src/config/io.write.ts:75-84`). An agent shell command, third-party plugin, compromised dependency, editor, or any process that writes the path directly bypasses that code. This directly contradicts the BRIEF's stronger claim that the runtime and agent “cannot mutate” the file.

   The Nix deployment does substantially more than set two environment variables. It creates the config with `pkgs.writeText`, places it in the immutable store, links the user-visible path to that store object, and manages the service and package in the same Home Manager generation (`~/YeeBois/dev/nix-openclaw/nix/modules/home-manager/openclaw/config.nix:234-237`, `:303-311`, `:352-368`, `:473-478`). The packet has mistaken one defense-in-depth check for the Nix ownership boundary that makes the check credible.

   **Concrete change:** Replace HOLDS-WITH-CONDITIONS with **DOES-NOT-HOLD-AS-SPECIFIED** until a prototype proves a content-addressed generation containing the exact Node/OpenClaw package, config, unit, plugins, skills, and workspace artifacts; an atomic `current` switch; and an OS-enforced read-only config boundary. Add periodic hash verification that alerts and repairs drift independently of OpenClaw. If the deployer cannot make the artifact unwritable to the service/agent identity, use split ownership and stop presenting `OPENCLAW_NIX_MODE` as a security boundary.

2. **CRITICAL — Version rollback can be destroyed by automatic SQLite migration even when config rendering is perfect.**

   **Target:** condition 6 in `RESEARCH.md:232-235`, the upgrade rabbit hole in `BRIEF.md:105-107`, and the preflight→apply→health chain in `BRIEF.md:60-67`.

   **Evidence:** The upgrade discussion is config-centric, but both shared and per-agent databases migrate on ordinary open. Shared-state startup applies schema changes and stamps the new `PRAGMA user_version` (`~/YeeBois/dev/openclaw/src/state/openclaw-state-db.ts:236-283`); agent startup likewise ensures/migrates its schema and stamps the current version (`~/YeeBois/dev/openclaw/src/state/openclaw-agent-db.ts:270-318`, `~/YeeBois/dev/openclaw/src/state/openclaw-agent-db-schema.ts:510-550`). After that, an older binary refuses a newer shared or agent schema (`~/YeeBois/dev/openclaw/src/state/openclaw-state-db-maintenance.ts:64-72`, `~/YeeBois/dev/openclaw/src/state/openclaw-agent-db-schema-helpers.ts:15-23`). A failed health check after first startup can therefore leave the old package unable to consume the now-migrated state.

   The closest Ansible prior art already calls out the same split-brain hazard: migration failure must not restore an old binary against version-stamped migrated data (`~/YeeBois/dev/openclaw-infra/ansible/roles/openclaw/tasks/install.yml:145-167`). Pulumi Command has no transaction spanning package install, config switch, service restart, database migration, and health.

   **Concrete change:** Make upgrade a state machine, not three independent commands: install the candidate package side-by-side; validate the candidate config with that binary; stop/drain the gateway; take SQLite-consistent backups of every shared and agent database (including WAL state); switch one generation pointer; start; run deep probes; then retain or restore the previous generation and database snapshot. Classify migrations as reversible or irreversible before apply. An irreversible migration requires an explicit operator gate and tested restore, not automatic rollback. Add a downgrade test to every version bump.

3. **MAJOR — Same-reference 1Password rotation is invisible to content hashes and will fail on day 30.**

   **Target:** the secret-ref premise in `RESEARCH.md:140-144`, decision 5 in `DECISIONS.md:64-74`, and content-hash triggers in `BRIEF.md:60-67`.

   **Evidence:** OpenClaw resolves SecretRefs eagerly into an in-memory snapshot, and runtime requests do not re-resolve them (`~/YeeBois/dev/openclaw/docs/gateway/secrets.md:21-29`). Backend rotation is applied only by `openclaw secrets reload` (`~/YeeBois/dev/openclaw/docs/gateway/secrets.md:637-640`). Rotating a bot token or model key behind the same `op://` reference changes neither rendered config nor a Pulumi trigger, so no deployment runs and the process keeps the old value. On reload failure, eligible owners can retain last-known-good values as “stale” (`~/YeeBois/dev/openclaw/docs/gateway/secrets.md:590-613`), which is not useful when that old credential has already been revoked.

   **Concrete change:** Add secret lifecycle as a first-class operational surface: a rotation hook or bounded timer invokes `secrets.reload`, records stale/cold owners, alerts on `SECRETS_RELOADER_DEGRADED`, and performs an authenticated model request plus channel probe after rotation. Do not use config hashes as evidence that secret state is current. Document the recovery path for “new value exists in 1Password, gateway still holds revoked old value.”

4. **MAJOR — “`op://` refs everywhere” omits the unavoidable 1Password bootstrap credential and its trust boundary.**

   **Target:** `BRIEF.md:24-29`, `BRIEF.md:56-67`, `BRIEF.md:124`, and decision 5 in `DECISIONS.md:64-74`.

   **Evidence:** Headless config resolution requires `OP_SERVICE_ACCOUNT_TOKEN` in the gateway service environment; desktop integration may prompt, and standalone sign-in is explicitly unsuitable for headless config resolution (`~/YeeBois/dev/openclaw/docs/gateway/1password.md:16-22`). The exec provider then requires that token to be forwarded in `passEnv` (`~/YeeBois/dev/openclaw/docs/gateway/1password.md:55-72`). The service-account token cannot itself be fetched from 1Password by an unauthenticated `op` process. It is a bootstrap secret, not an `op://` reference.

   A workstation desktop session also does not solve unattended boot: the app may be locked or absent when the lingering user manager starts. Putting the bearer token directly in a unit, rendered config, Pulumi input, or Command stdout violates the stated no-plaintext/no-state rule.

   **Concrete change:** Record an explicit bootstrap exception and choose it per target. Prefer a tightly scoped service account delivered through a separately provisioned, permissioned systemd credential or root-owned credential file, with rotation and revocation runbooks; never pass its value through a Pulumi Command output. The preflight must run `op whoami` in the exact service environment without revealing any field. If workstation desktop integration is chosen instead, make “requires unlocked desktop session” an availability limitation and do not enable linger as though startup were unattended.

5. **MAJOR — `command.local.Command` cannot prove drift, target identity, preview validity, or refresh fidelity.**

   **Target:** `RESEARCH.md:145-151`, `BRIEF.md:60-67`, `BRIEF.md:108-109`, and decision 6 in `DECISIONS.md:76-91`.

   **Evidence:** The provider skips commands entirely during preview (`~/YeeBois/dev/pulumi-command/provider/pkg/provider/local/commandController.go:33-56`, `:66-89`). Its implemented lifecycle is create/update/delete; it has no read implementation that could reconstruct actual host state during refresh (`~/YeeBois/dev/pulumi-command/provider/pkg/provider/local/commandController.go:24-31`). Triggers compare declared inputs, not files, package symlinks, unit contents, user-manager state, or the machine on which Pulumi is currently running.

   A local stack copied to a rebuilt or second workstation can therefore report no changes while managing nothing there, because “local” is ambient and the content hashes are unchanged. Conversely, hand-edited config can survive indefinitely until some unrelated declared input changes.

   **Concrete change:** Bind the stack to an explicit target identity (expected `/etc/machine-id`, UID, home, and hostname) and fail before mutation on mismatch. Run a read-only drift audit on every preview/refresh path outside the Command resource: hashes, symlink targets, exact package/Node versions, unit text, enabled/active state, config validation, and target identity. Treat Command as an apply primitive only. If refresh/import-grade ownership is required, build a small native provider or retain the configuration-management owner instead of claiming Pulumi resource fidelity.

6. **MAJOR — “Flip only the executor” is false for `systemd --user`; local and remote targets have different privilege and session contracts.**

   **Target:** decision 6 in `DECISIONS.md:81-91`, `BRIEF.md:60-67`, and the systemd rabbit hole in `BRIEF.md:100-102`.

   **Evidence:** `systemctl --user` addresses the invoking user's manager. Linger is a privileged host setting, and a user manager and runtime directory must exist before non-interactive commands work. The OpenClaw Pulumi+Ansible reference explicitly uses privilege escalation for `loginctl enable-linger`, starts `user@1000.service`, and supplies `XDG_RUNTIME_DIR=/run/user/1000` (`~/YeeBois/dev/openclaw-infra/ansible/roles/openclaw/tasks/install.yml:196-205`, `~/YeeBois/dev/openclaw-infra/ansible/roles/openclaw/tasks/daemon.yml:7-13`). Its troubleshooting guide names missing linger as a common service failure (`~/YeeBois/dev/openclaw-infra/docs/TROUBLESHOOTING.md:185-195`).

   A desktop-shell local apply, a CI/local apply, and SSH as the target user are three different execution environments. A renderer can be shared; the applicator and authorization protocol cannot honestly be reduced to `local.Command` versus `remote.Command`.

   **Concrete change:** Keep pure renderers shared but define separate, explicit workstation and remote applicators. Each must declare target user/UID, runtime directory, bus reachability, linger ownership, permitted privilege boundary, and teardown semantics. The workstation preflight must test the same non-interactive context the apply uses. Do not let a Pulumi run silently target whichever user happened to launch it.

7. **MAJOR — The proposed Effect schema cannot be the claimed complete contract because OpenClaw's effective schema is plugin-set-dependent and its schema export can be intentionally incomplete.**

   **Target:** `BRIEF.md:50-59`, `BRIEF.md:110-112`, decision 13 in `DECISIONS.md:184-196`, and conditions 2/6 in `RESEARCH.md:220-235`.

   **Evidence:** Runtime validation merges installed plugin/channel schemas and validates plugin config against the selected manifest schema (`~/YeeBois/dev/openclaw/src/config/validation.ts:2173-2205`). The exported config schema is not guaranteed lossless: per-extension schemas over 256 KiB, aggregate extension schemas over 2 MiB, or more than 256 items are replaced with `additionalProperties: true` placeholders (`~/YeeBois/dev/openclaw/src/config/schema.ts:162-224`, `:576-585`). Thus `openclaw config schema` is useful UI metadata but cannot, by itself, prove that a hand-maintained Effect schema covers the runtime contract.

   The pinned tree also contains a concrete docs/source contradiction: the 1Password guide recommends `allowSymlinkCommand` (`~/YeeBois/dev/openclaw/docs/gateway/1password.md:24-60`), while the strict exec-provider schema does not accept that key (`~/YeeBois/dev/openclaw/src/config/zod-schema.core.ts:113-146`) and a source test explicitly classifies it as retired and invalid (`~/YeeBois/dev/openclaw/src/config/dead-config-keys.test.ts:217-255`). The packet's docs-index survey therefore cannot be treated as schema-accurate even at the cited commit.

   This also makes “typed schema in a reusable driver” version- and plugin-lock-specific. A schema for core 2026.7.2 plus Discord is not the schema for the same binary plus a future local plugin.

   **Concrete change:** Make `@beep/openclaw` own a small, stable desired-intent schema and versioned render adapters, not a supposed duplicate of the entire upstream contract. Lock the OpenClaw package, Node runtime, plugin artifacts/manifests, adapter version, and generated fixtures as one compatibility set. The authoritative acceptance gate remains the exact candidate binary's plugin-aware `config validate`, plus negative fixtures. Fail CI when schema export contains an omitted-extension placeholder.

8. **MAJOR — The two-artifact sketch omits the deployable generation and misclassifies skills as config.**

   **Target:** `BRIEF.md:48-67`, `BRIEF.md:77-81`, `RESEARCH.md:183-197`, and decision 13 in `DECISIONS.md:184-196`.

   **Evidence:** Skill installation is a workspace mutation, not merely an `openclaw.json` field. OpenClaw installs extracted content under the workspace (`~/YeeBois/dev/openclaw/src/skills/lifecycle/clawhub.ts:1198-1242`) and writes a mutable `.clawhub/lock.json` containing version, integrity, file-tree hash, verification result, and installation time (`~/YeeBois/dev/openclaw/src/skills/lifecycle/clawhub.ts:373-400`, `:1535-1558`). Persona files are likewise workspace artifacts. The proposed driver schema plus stack leaves no clearly owned object that binds package, config, unit, SOUL/workspace files, plugin code, skill tree, and provenance into one revision.

   **Concrete change:** Keep two repo locations if topology demands it, but introduce one explicit `OpenClawGeneration` domain object/resource graph. It must hash and own every immutable runtime input, pin skill source by commit/version plus integrity, and switch them together. Put CLI process wrappers in the driver only if a non-infra consumer exists; otherwise keep deploy-only probes and migration operations beside the stack. Treat mutable SQLite/workspace state and generation-owned workspace files as separate inventories with collision checks.

9. **MAJOR — The global guard turns normal event-driven migrations into runtime errors unless each writer surface is disabled gracefully.**

   **Target:** condition 3 in `RESEARCH.md:222-224`, the writer-matrix rabbit hole in `BRIEF.md:83-95`, and decision 8 in `DECISIONS.md:110-122`.

   **Evidence:** Channel config writes default to enabled unless `configWrites` is explicitly false (`~/YeeBois/dev/openclaw/src/channels/plugins/config-write-policy-shared.ts:85-100`). Telegram's group-to-supergroup event performs a config mutation and rethrows failure from the event handler (`~/YeeBois/dev/openclaw/extensions/telegram/src/bot-handlers.migration.runtime.ts:16-71`). `OPENCLAW_NIX_MODE` blocks the final write, but it does not tell this event path to skip. Saying “change Pulumi input and redeploy” is not sufficient when the new identifier is discovered only from a live event and the runtime has already treated the migration as failed.

   **Concrete change:** Add a per-channel/plugin immutable-mode compatibility matrix. Render `configWrites: false` wherever supported so writers take their intentional skip path, and test the actual DM channel's login, logout, identifier migration, pairing, token rotation, and reconnect behavior under Nix mode. Any required writeback without a graceful disable path is evidence to reopen decision 7 or choose the other v1 channel.

10. **MAJOR — The advertised health proof can be green while the agent is operationally dead.**

    **Target:** the gateway health probe in `BRIEF.md:57-59`, health stage in `BRIEF.md:64-67`, and first-slice promise in `BRIEF.md:77-81`.

    **Evidence:** `/health` is unconditional process liveness, and `/ready` checks startup/drain/event-loop state plus channel runtime snapshots (`~/YeeBois/dev/openclaw/src/gateway/server-http.ts:270-321`, `~/YeeBois/dev/openclaw/src/gateway/server/readiness.ts:44-128`). It does not prove a hosted model credential can complete a request, the local OpenAI-compatible endpoint serves the declared model, an outbound DM succeeds, the proof skill is loadable, or a rotated SecretRef is current. This makes the proposed post-apply health resource too weak to authorize generation promotion or database-migration success.

    **Concrete change:** Split probes into liveness, readiness, and acceptance. Promotion requires an authenticated benign model completion, local-provider catalog/probe, exact skill inventory/hash, secret degradation check, and a channel-specific synthetic send/receive or documented non-destructive equivalent. Keep a cheaper recurring canary for day-30 failures. Do not roll back an irreversible database migration based only on `/ready`, but do not declare an upgrade healthy from it either.

11. **MINOR — The “legal guardrails as typed config” claim promises a confidentiality control OpenClaw config does not establish.**

    **Target:** decision 10 in `DECISIONS.md:137-151` and `BRIEF.md:77-80`.

    **Evidence:** Workspace boundaries, tool policy, and command allowlists are enforceable surfaces; “no client identifiers in channel traffic” is a semantic data-loss-prevention policy. The packet identifies no outbound message interceptor, deterministic redactor, approval gate, or test oracle that enforces it. A SOUL prompt is guidance, not a confidentiality boundary. Calling the whole set “strict guardrail config” collapses these different assurance levels.

    **Concrete change:** Label persona-based confidentiality as advisory and prohibit real client data in v1. If the property is required later, make outbound DLP/approval a separately designed control with adversarial tests and fail-closed behavior. Do not let a schema-valid boolean or prompt text serve as evidence of legal confidentiality.

12. **MINOR — The packet is not ready to close research while its machine state says there are no open questions.**

    **Target:** `README.md:17-22`, `ops/manifest.json:7-9`, and the unresolved prototypes acknowledged in `BRIEF.md:89-112`.

    **Evidence:** The packet itself requires live proof for immutable operation, user-manager access, schema drift, preview fidelity, auth bootstrap, and upgrades, yet the manifest has an empty `openQuestions` array. The newly exposed filesystem-immutability, same-reference secret rotation, and SQLite rollback failures are not shape-stage implementation details; they determine whether decisions 6, 7, 12, and 13 are valid.

    **Concrete change:** Reopen decision 7 first, then decisions 6, 12, and 13. Add blocking research questions and four disposable prototypes: filesystem bypass/drift repair; non-interactive user-manager/linger apply; same-ref 1Password rotation/reload; and upgrade-plus-failed-health rollback across database schema versions. Reconsider decision 12's local backend before the dankserver phase: co-locating Pulumi state, application state, and the only operator workstation creates one disaster domain, while Command resources cannot reconstruct lost state through refresh.

HOLDS — OAuth refresh itself is not a config-write casualty: current provider refresh uses a global file lock plus locked compare-and-swap persistence into the auth-profile store/SQLite (`~/YeeBois/dev/openclaw/src/agents/auth-profiles/oauth-manager.ts:413-480`, `:483-511`, `~/YeeBois/dev/openclaw/src/agents/auth-profiles/store.ts:1207-1251`).

## What I would do differently

I would stop treating this as “render a file, run npm, restart a user unit” and build a miniature generation deployer first. Its compatibility lock would bind Node, OpenClaw, plugins, schemas, config, skills, and workspace artifacts; its apply would stage and validate side-by-side, snapshot SQLite, atomically switch, run deep acceptance, and preserve a tested recovery path. I would retain strict ownership for the greenfield agent only after the filesystem-bypass and state-rollback prototypes pass; use include-based split ownership for dankserver until every live writer is retired; and keep Ansible as the host/user-manager owner until Pulumi demonstrates real read, drift, privilege, and rollback semantics rather than merely replaying shell commands.
