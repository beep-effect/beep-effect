# Follow-up — competing agent-CLI sandboxes (Codex, Gemini, K8s agent-sandbox, Seatbelt status)

> Research-stage artifact of `explorations/agent-execution-sandbox`, produced
> 2026-07-25 by the `agent-sandbox-research` workflow (follow-up agent 1 (critic-dispatched); structured
> output, verbatim). URLs were retrieved or seen in search results by the
> agent under a no-fabrication rule; license fields reflect what the agent
> verified (see per-source notes; unverified licenses are marked
> reference-only). Synthesis and caveats: [`../RESEARCH.md`](../RESEARCH.md);
> provenance ledger: [`SOURCES.md`](./SOURCES.md).
# followup-1

## findings

### [0] Codex CLI — repo identity and license
OpenAI Codex CLI lives at openai/codex (default branch main); the GitHub API license endpoint reports SPDX Apache-2.0 with a LICENSE file at the repo root, so its sandbox code (Rust crates under codex-rs/) can be ported permissively.

*relevance:* The strongest single body of portable prior art: a production default-deny exec sandbox in Apache-2.0 Rust, directly minable for policy shape and per-OS enforcement for our own boundary.

*urls:* https://api.github.com/repos/openai/codex | https://github.com/openai/codex

### [1] Codex CLI — sandbox modes, network default, escape hatches
Codex exposes three filesystem modes — read-only, workspace-write (default), danger-full-access — plus approval policies (untrusted, on-request, never); network is DENY by default even in workspace-write, gated by the sandbox_workspace_write.network_access boolean (schema field network_access alongside writable_roots, exclude_tmpdir_env_var, exclude_slash_tmp), with .git protected read-only inside writable roots; escape hatches are writable_roots extension, approval escalation, and danger-full-access. No CPU/memory/process resource ceilings are documented.

*relevance:* Validates the exact policy shape for a default-deny agent boundary: mode enum + writable-roots list + explicit network opt-in + protected subpaths, with resource ceilings as a gap we would have to add ourselves.

*urls:* https://learn.chatgpt.com/docs/sandboxing | https://raw.githubusercontent.com/openai/codex/main/codex-rs/app-server-protocol/schema/typescript/v2/SandboxWorkspaceWrite.ts | https://developers.openai.com/codex/sandboxing

### [2] Codex CLI — Linux enforcement mechanism
On Linux, Codex's primary sandbox is now bubblewrap (bwrap): user/PID namespaces via --unshare-user/--unshare-pid, read-only root via --ro-bind / /, writable roots re-bound writable with protected subpaths (.git, .codex) re-applied read-only, network cut via --unshare-net, PR_SET_NO_NEW_PRIVS plus an in-process seccomp filter that blocks new socket creation in managed-proxy mode (traffic bridged TCP→Unix-domain-socket→TCP to approved proxy endpoints only); Landlock survives only as an opt-in legacy fallback (codex-rs/linux-sandbox/src/landlock.rs, codex-rs/sandboxing/src/landlock.rs).

*relevance:* Key architecture signal: OpenAI migrated from Landlock-first to bwrap-first on Linux, so a new default-deny sandbox should treat namespaces+bwrap as the primary Linux tier and Landlock as a degraded fallback, and copy the netns+UDS proxy-bridge trick for allowlisted egress.

*urls:* https://raw.githubusercontent.com/openai/codex/main/codex-rs/linux-sandbox/README.md | https://github.com/openai/codex/tree/main/codex-rs/linux-sandbox/src | https://learn.chatgpt.com/docs/sandboxing

### [3] Codex CLI — macOS enforcement mechanism
On macOS, Codex enforces via Apple Seatbelt with SBPL policy files in-repo: codex-rs/sandboxing/src/seatbelt.rs plus seatbelt_base_policy.sbpl, seatbelt_network_policy.sbpl, and restricted_read_only_platform_defaults.sbpl; the base policy opens with (deny default), allows process-fork/process-exec, PTY and /dev/null writes, scoped sysctl-reads and Mach lookups (comment says inspired by Chrome's sandbox), and grants no network — network stays denied unless the separate network policy is composed in.

*relevance:* A vetted, Apache-2.0, deny-default SBPL profile pair (base + network add-on) we can port nearly verbatim for the laptop-local macOS tier, including the compose-network-as-opt-in pattern.

*urls:* https://raw.githubusercontent.com/openai/codex/main/codex-rs/sandboxing/src/seatbelt_base_policy.sbpl | https://github.com/openai/codex/tree/main/codex-rs/sandboxing/src | https://learn.chatgpt.com/docs/sandboxing

### [4] Codex CLI — Windows enforcement mechanism
Codex ships a native Windows sandbox (codex-rs/windows-sandbox-rs) whose source layout evidences dedicated low-privilege sandbox user accounts (setup_main/win/sandbox_users.rs), ACL-based filesystem restriction (src/acl.rs, read_acl_mutex.rs), Windows firewall configuration (setup_main/win/firewall.rs), and cwd junctions; official docs state Windows users get either this native sandbox or the Linux sandbox under WSL2. Exact mechanism semantics (restricted token vs AppContainer) are unverified — inferred from file names only, as the crate has no README.

*relevance:* Shows the pragmatic Windows pattern (sandbox user + ACL + host firewall rather than AppContainer) if we ever need a third OS tier; also confirms WSL2 as an acceptable fallback story.

*urls:* https://github.com/openai/codex/tree/main/codex-rs/windows-sandbox-rs/src | https://learn.chatgpt.com/docs/sandboxing

### [5] Gemini CLI — repo identity and license
Google Gemini CLI lives at google-gemini/gemini-cli (default branch main, homepage geminicli.com); the GitHub API license endpoint reports SPDX Apache-2.0 with LICENSE at the repo root, so its Seatbelt profiles and container-sandbox orchestration are permissively portable.

*relevance:* Second permissive source of prior art, notably its ready-made family of parameterized macOS .sb profiles.

*urls:* https://api.github.com/repos/google-gemini/gemini-cli | https://github.com/google-gemini/gemini-cli

### [6] Gemini CLI — sandbox architecture and defaults
Gemini CLI sandboxing is OFF by default and opt-in via -s/--sandbox, GEMINI_SANDBOX=true|docker|podman|sandbox-exec|runsc|lxc, or settings.json tools.sandbox; two methods exist: macOS Seatbelt via sandbox-exec, and cross-platform containers (Docker/Podman) that mount the project directory at its identical absolute path, with custom images via GEMINI_SANDBOX_IMAGE or an auto-built .gemini/sandbox.Dockerfile (BUILD_SANDBOX=1).

*relevance:* Counter-example on defaults (opt-in, not default-deny) and the cleanest reference for a container-fallback tier — same-path workdir mounting keeps toolchains and absolute paths working inside the sandbox.

*urls:* https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/cli/sandbox.md

### [7] Gemini CLI — macOS Seatbelt profile family and network default
Gemini ships six parameterized SBPL profiles at packages/cli/src/utils/sandbox-macos-{permissive,restrictive,strict}-{open,proxied}.sb, selected via SEATBELT_PROFILE (default permissive-open); permissive-open is (deny default) for writes — allowing only TARGET_DIR, TMP_DIR, CACHE_DIR, ~/.gemini, ~/.npm, ~/.cache, five INCLUDE_DIR_N params and PTY/dev nodes — but network is fully ALLOWED (allow network-outbound, network-inbound, network-bind), with -proxied variants forcing traffic through a user-supplied proxy.

*relevance:* Demonstrates a tiered-profile UX (write-deny always, network as the tier axis) and a parameterized-.sb-template approach we can copy; its allow-network default is precisely what our default-deny design would invert.

*urls:* https://raw.githubusercontent.com/google-gemini/gemini-cli/main/packages/cli/src/utils/sandbox-macos-permissive-open.sb | https://api.github.com/repos/google-gemini/gemini-cli/contents/packages/cli/src/utils | https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/cli/sandbox.md

### [8] Kubernetes SIG agent-sandbox — identity, license, status
kubernetes-sigs/agent-sandbox (site agent-sandbox.sigs.k8s.io, SIG Apps) is Apache-2.0 with LICENSE at root; it is pre-1.0 but actively released (v0.5.1 2026-07-09, v0.5.2 2026-07-17, v0.5.3 2026-07-23) with v1alpha1 and v1beta1 API versions and Go/Python SDKs.

*relevance:* The emerging vendor-neutral standard for a cluster-hosted agent execution tier; pre-1.0 churn (alpha→beta migration guide exists in docs/) is the adoption risk to price in.

*urls:* https://api.github.com/repos/kubernetes-sigs/agent-sandbox | https://github.com/kubernetes-sigs/agent-sandbox/releases | https://raw.githubusercontent.com/kubernetes-sigs/agent-sandbox/main/README.md | https://agent-sandbox.sigs.k8s.io/

### [9] Kubernetes SIG agent-sandbox — API shape and isolation model
agent-sandbox defines Sandbox (podTemplate, volumeClaimTemplates, replicas 0|1, shutdownTime TTL with Delete|Retain shutdownPolicy, operatingMode Running|Suspended in v1beta1) plus SandboxTemplate, SandboxClaim, and SandboxWarmPool CRDs; hard isolation is delegated to standard runtimeClassName in the podTemplate (documented recipes for gVisor — 'runtimeClassName: gvisor' — and Kata Containers), and SandboxTemplate supports Managed NetworkPolicy where the controller creates a shared default-deny NetworkPolicy per template.

*relevance:* Gives the cluster-tier blueprint: our default-deny boundary maps to SandboxTemplate + Managed default-deny NetworkPolicy + gVisor runtimeClass, with warm pools solving agent cold-start latency; resource ceilings come for free via pod resources, unlike the laptop CLIs.

*urls:* https://raw.githubusercontent.com/kubernetes-sigs/agent-sandbox/main/docs/api.md | https://agent-sandbox.sigs.k8s.io/docs/use-cases/gvisor-isolation/ | https://agent-sandbox.sigs.k8s.io/docs/sandbox/

### [10] macOS sandbox-exec/Seatbelt — deprecation status
The sandbox-exec(1) man page (dated 2017, still current) states 'The sandbox-exec command is DEPRECATED', directing developers to App Sandbox (entitlement-based, App Store distribution model) instead; the SBPL profile language remains undocumented/unsupported by Apple, and an open issue on Apple's own apple/containerization repo asks Apple to clarify the deprecation timeline and provide a supported replacement for non-App-Store process sandboxing — none exists today.

*relevance:* The core risk for a laptop-local macOS tier: the enforcement primitive is officially deprecated and API-unsupported, so any Seatbelt-based tier must be built as a best-effort/defense-in-depth layer with a containerized fallback, not as a guaranteed security boundary.

*urls:* https://keith.github.io/xcode-man-pages/sandbox-exec.1.html | https://github.com/apple/containerization/issues/737 | https://developer.apple.com/documentation/security/app-sandbox

### [11] macOS Seatbelt — continued function and industry use despite deprecation
Seatbelt still works on current macOS: a Feb-2026 Claude Code issue confirms sandbox-exec succeeds on macOS 26 Tahoe (the bug was in Claude Code's init logic, not the OS), and all three major agent CLIs actively ship Seatbelt enforcement — Anthropic's sandbox-runtime (dynamically generated Seatbelt profiles, powers Claude Code), OpenAI Codex (codex-rs/sandboxing/src/seatbelt.rs + .sbpl policies), and Google Gemini CLI (six sandbox-macos-*.sb profiles); Seatbelt also underpins Apple's own App Sandbox, making removal unlikely near-term.

*relevance:* De-risks the laptop macOS tier pragmatically: deprecated-but-load-bearing, with three well-funded vendors sharing the same bet; monitoring each macOS major release (Tahoe-class breakage reports) should be an explicit operational requirement of the tier.

*urls:* https://github.com/anthropics/claude-code/issues/26095 | https://raw.githubusercontent.com/anthropic-experimental/sandbox-runtime/main/README.md | https://raw.githubusercontent.com/openai/codex/main/codex-rs/sandboxing/src/seatbelt_base_policy.sbpl | https://api.github.com/repos/google-gemini/gemini-cli/contents/packages/cli/src/utils | https://news.ycombinator.com/item?id=44283454

### [12] Anthropic sandbox-runtime — closest default-deny prior art (bonus)
anthropic-experimental/sandbox-runtime (Apache-2.0, powers Claude Code) is the closest existing default-deny design: network denied by default with explicit domain allowlists enforced by host-side HTTP + SOCKS5 proxies (Linux: netns removed, traffic routed over Unix domain sockets; macOS: Seatbelt allows only a specific localhost proxy port); filesystem is read-allow/write-deny-by-default with allowWrite/denyWrite precedence rules and mandatory unconditional write-denies for .bashrc/.zshrc/.gitconfig/IDE dirs; documented escape hatches (enableWeakerNestedSandbox, enableWeakerNetworkIsolation, allowAppleEvents) and known gaps (domain fronting, Docker socket exposure) are stated openly; Windows support is alpha via a dedicated srt-sandbox user + WFP egress fence + explicit ACEs.

*relevance:* Effectively a reference implementation of the exact system being designed — permissively licensed, with the deny-default network+proxy-allowlist architecture, mandatory dotfile protections, and an honest threat-model appendix worth mirroring.

*urls:* https://api.github.com/repos/anthropic-experimental/sandbox-runtime | https://raw.githubusercontent.com/anthropic-experimental/sandbox-runtime/main/README.md

### [13] Cross-cutting gap — resource ceilings
None of the three laptop-local sandboxes (Codex, Gemini CLI, Anthropic sandbox-runtime) document CPU, memory, process-count, or disk-quota ceilings — their boundaries are filesystem+network only; only the Kubernetes agent-sandbox tier gets resource governance, via standard pod resource requests/limits in the Sandbox podTemplate.

*relevance:* A default-deny boundary for this repo cannot inherit resource limiting from any CLI prior art; the laptop tier would need cgroups (Linux) or process supervision added deliberately, or accept that ceilings only exist in the container/cluster tiers.

*urls:* https://learn.chatgpt.com/docs/sandboxing | https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/cli/sandbox.md | https://raw.githubusercontent.com/anthropic-experimental/sandbox-runtime/main/README.md | https://raw.githubusercontent.com/kubernetes-sigs/agent-sandbox/main/docs/api.md


## sources

- **openai/codex (Codex CLI)** (repo, Apache-2.0, permissive-port) https://github.com/openai/codex
  - License verified via https://api.github.com/repos/openai/codex and /license endpoint (LICENSE at root). Portable sandbox code: codex-rs/linux-sandbox/ (bwrap primary, src/landlock.rs legacy fallback, src/proxy_routing.rs), codex-rs/sandboxing/src/ (seatbelt.rs, seatbelt_base_policy.sbpl, seatbelt_network_policy.sbpl, restricted_read_only_platform_defaults.sbpl, bwrap.rs, landlock.rs, denial.rs), codex-rs/windows-sandbox-rs/, codex-rs/execpolicy/.

- **OpenAI Codex sandboxing documentation** (docs, n/a, reference-only) https://learn.chatgpt.com/docs/sandboxing
  - Canonical behavior doc (developers.openai.com/codex/sandboxing 308-redirects here). Confirms macOS Seatbelt, Linux/WSL2 bubblewrap (bundled fallback needs unprivileged userns; Ubuntu 25.04+ bwrap-userns-restrict AppArmor profile), Windows native-or-WSL2, network default deny with managed allowlist, modes read-only/workspace-write(default)/danger-full-access, approval policies, writable_roots escape hatch.

- **google-gemini/gemini-cli (Gemini CLI)** (repo, Apache-2.0, permissive-port) https://github.com/google-gemini/gemini-cli
  - License verified via https://api.github.com/repos/google-gemini/gemini-cli and /license endpoint (LICENSE at root). Portable assets: packages/cli/src/utils/sandbox-macos-{permissive,restrictive,strict}-{open,proxied}.sb parameterized SBPL profiles plus sandbox.ts/sandboxUtils.ts orchestration; docs/cli/sandbox.md behavior spec. Sandboxing opt-in (off by default); default Seatbelt profile permissive-open allows network.

- **kubernetes-sigs/agent-sandbox** (repo, Apache-2.0, permissive-port) https://github.com/kubernetes-sigs/agent-sandbox
  - License verified via https://api.github.com/repos/kubernetes-sigs/agent-sandbox (LICENSE at root). SIG Apps subproject, pre-1.0 (v0.5.3 2026-07-23), v1alpha1/v1beta1. CRDs: Sandbox, SandboxTemplate, SandboxClaim, SandboxWarmPool; API spec in docs/api.md; isolation via runtimeClassName (gVisor/Kata recipes on site); Managed NetworkPolicy = controller-created default-deny per template.

- **Agent Sandbox documentation site** (docs, n/a, reference-only) https://agent-sandbox.sigs.k8s.io/
  - Positioning ('secure, isolated execution layer... untrusted code at scale'), gVisor use-case page (/docs/use-cases/gvisor-isolation/ shows runtimeClassName: gvisor patch), Kata use-case, network-policies example, lifecycle/shutdownTime docs.

- **anthropic-experimental/sandbox-runtime (srt, powers Claude Code)** (repo, Apache-2.0, permissive-port) https://github.com/anthropic-experimental/sandbox-runtime
  - License verified via https://api.github.com/repos/anthropic-experimental/sandbox-runtime (LICENSE at root). Closest default-deny reference: deny-all network + domain-allowlist HTTP/SOCKS5 host proxies; macOS dynamic Seatbelt profiles (localhost-proxy-port-only egress); Linux bwrap + seccomp BPF + removed netns with UDS routing; Windows alpha (srt-sandbox user, WFP egress fence, explicit ACEs); mandatory write-denies on shell/git/IDE config; documented escape hatches and known gaps.

- **sandbox-exec(1) man page (macOS, mirrored)** (docs, n/a, reference-only) https://keith.github.io/xcode-man-pages/sandbox-exec.1.html
  - Exact deprecation text: 'The sandbox-exec command is DEPRECATED. Developers who wish to sandbox an app should instead adopt the App Sandbox feature described in the App Sandbox Design Guide.' Man page dated 2017; still ships unchanged.

- **Apple App Sandbox documentation** (docs, n/a, reference-only) https://developer.apple.com/documentation/security/app-sandbox
  - Apple's supported sandboxing path (entitlement-based App Sandbox). Page existence verified; body is JS-rendered so detailed content not extracted this session — App Sandbox does not offer sandbox-exec-style ad-hoc profile application to arbitrary child processes, which is why agent CLIs remain on Seatbelt (this last characterization: unverified from this page, corroborated by apple/containerization#737).

- **apple/containerization issue #737 — sandbox-exec deprecation clarification request** (post, n/a, reference-only) https://github.com/apple/containerization/issues/737
  - Open request on Apple's own repo to clarify sandbox-exec deprecation timeline and provide a supported replacement for non-App-Store process sandboxing; evidence no supported replacement exists. Found via WebSearch; issue body not fetched — treat details beyond title as unverified.

- **anthropics/claude-code issue #26095 — Seatbelt on macOS 26 Tahoe** (post, n/a, reference-only) https://github.com/anthropics/claude-code/issues/26095
  - Feb-2026 report showing sandbox-exec -n no-network succeeds on macOS 26 Tahoe (Darwin 25.2.0, arm64); failure was Claude Code init logic, not OS Seatbelt. Found via WebSearch result summary; issue body not fetched directly.

- **Hacker News thread on sandbox-exec deprecation frustration** (post, n/a, reference-only) https://news.ycombinator.com/item?id=44283454
  - Community sentiment: 'sandbox-exec / seatbelt has been marked deprecated... hasn't impacted its functioning yet' and Apple itself still depends on Seatbelt under App Sandbox. Found via WebSearch; thread not fetched directly — background color only.

- **codex-rs/linux-sandbox README (Linux mechanism spec)** (docs, Apache-2.0, permissive-port) https://raw.githubusercontent.com/openai/codex/main/codex-rs/linux-sandbox/README.md
  - In-repo spec fetched directly: bwrap default (system bwrap preferred over bundled), --unshare-user/--unshare-pid/--unshare-net, --ro-bind / /, writable roots re-bound, .git/.codex re-protected read-only, PR_SET_NO_NEW_PRIVS, in-process seccomp socket-block under managed proxy (TCP→UDS→TCP bridge), Landlock as opt-in legacy fallback.
