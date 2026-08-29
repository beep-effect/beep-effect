# External landscape — sandbox isolation runtimes & host boundaries

> Research-stage artifact of `explorations/agent-execution-sandbox`, produced
> 2026-07-25 by the `agent-sandbox-research` workflow (ext-isolation sweep agent; structured
> output, verbatim). URLs were retrieved or seen in search results by the
> agent under a no-fabrication rule; license fields reflect what the agent
> verified (see per-source notes; unverified licenses are marked
> reference-only). Synthesis and caveats: [`../RESEARCH.md`](../RESEARCH.md);
> provenance ledger: [`SOURCES.md`](./SOURCES.md).
## findings

### [0] Anthropic sandbox-runtime (srt) — verified to exist
Anthropic ships an open-source (Apache-2.0) sandbox runtime at anthropic-experimental/sandbox-runtime, published as npm @anthropic-ai/sandbox-runtime, usable as CLI (srt) or TypeScript library (SandboxManager). It enforces filesystem restrictions (reads deny-then-allow, writes allow-only) and default-deny network via host-side HTTP/SOCKS5 proxies, using bubblewrap+seccomp-BPF on Linux, sandbox-exec/Seatbelt profiles on macOS, and alpha WFP filtering on Windows. It has NO CPU/memory/disk resource limits, and README-documented gaps include Linux proxy bypass via env vars and weaker nested-sandbox mode inside Docker.

*relevance:* The only permissively-licensed, TypeScript-native, library-embeddable default-deny sandbox found; a natural base layer for an Effect monorepo wrapping bash/MCP/tool subprocesses — but must be composed with cgroups/rlimits or a microVM to satisfy the packet's host-level resource-ceiling requirement.

*urls:* https://github.com/anthropic-experimental/sandbox-runtime | https://www.npmjs.com/package/@anthropic-ai/sandbox-runtime

### [1] Claude Code sandboxed Bash — production default-deny reference design
Claude Code's sandbox (built on the same primitives as sandbox-runtime) implements: zero pre-allowed network domains with per-domain escalation prompts; OS-enforced boundaries that apply to all child processes 'regardless of what the model chose to run'; automatic write-deny of its own settings.json at every scope (with symlink resolution since v2.1.210) so a sandboxed command cannot edit its own policy; managed-settings lockdown (allowManagedDomainsOnly, allowManagedReadPathsOnly, failIfUnavailable, allowUnsandboxedCommands:false); and a visible typed escape hatch (dangerouslyDisableSandbox) that re-routes through the permission flow.

*relevance:* Directly instantiates several packet requirements: authorization outside the model, policy immutable from inside the boundary, visible typed outcomes (denial → escalation prompt → unsandboxed retry), and admin-pinned policy revisions; strongest single prior-art document for the design.

*urls:* https://code.claude.com/docs/en/sandboxing

### [2] Secret-minimizing egress via proxy-side credential injection
Claude Code's credentials 'mask' mode gives sandboxed commands a per-session sentinel value instead of the real secret; the TLS-terminating sandbox proxy substitutes the real credential only on requests to declared injectHosts, so 'the command and anything it logs never hold the real credential.' Docker Sandboxes independently converged on the same pattern: 'secrets injected at runtime (outside microVM boundary), never baked into environment.'

*relevance:* Two independent production implementations of the packet's secret-minimizing storage-class and disclosure-authority requirements: the privileged credential lives only at the boundary component (proxy/host), and 'credential + allowed sink' composition is made explicit as injectHosts naming both secret and destination.

*urls:* https://code.claude.com/docs/en/sandboxing | https://www.docker.com/blog/why-microvms-the-architecture-behind-docker-sandboxes/

### [3] Domain-fronting limit of hostname-based egress allowlists
Claude Code's docs explicitly warn that because the proxy makes allow decisions from the client-supplied hostname without terminating TLS, sandboxed code 'can potentially use domain fronting or similar techniques to reach hosts outside the allowlist,' and that broad domains like github.com create exfiltration paths; the stated remedy is a TLS-terminating proxy with its CA installed inside the sandbox.

*relevance:* Sets the enforcement floor for the packet's destination- and purpose-aware egress policy: SNI/hostname allowlisting alone cannot carry purpose semantics; the design needs a TLS-terminating egress proxy as a first-class boundary component.

*urls:* https://code.claude.com/docs/en/sandboxing

### [4] gVisor — userspace application kernel
gVisor (Apache-2.0, 18.9k stars) is a memory-safe Go application kernel: the Sentry intercepts and services syscalls itself (running under seccomp with no direct fs access) and a Gofer process mediates filesystem via 9P, exposed as the runsc OCI runtime integrating with Docker/Kubernetes/containerd. Modal states its compute jobs 'are containerized and virtualized using gVisor.'

*relevance:* Daemon-embeddable (OCI runtime, no cluster service) syscall-surface reduction proven in production for exactly this workload (Modal's untrusted AI code); policy is OCI-spec + cgroups level, so named grants/egress purpose must live in a layer above it.

*urls:* https://gvisor.dev/docs/ | https://github.com/google/gvisor | https://modal.com/docs/guide/security

### [5] Firecracker — microVM ceiling
Firecracker (Apache-2.0, AWS-built, powers Lambda/Fargate) is a KVM VMM running one daemon process per microVM controlled via REST over a Unix socket, with a privilege-dropping jailer (cgroups/namespaces), thread-specific seccomp, per-device rate limiters (bandwidth and ops/sec on net/disk), and configurable vCPU/memory (defaults 1 vCPU / 128 MiB). Linux/KVM-only; ~125 ms boots with <5 MiB overhead per VM are cited across the ecosystem.

*relevance:* The hardware-isolation ceiling for hostile model-generated code, with built-in host-level resource ceilings (vCPU, memory, I/O rate limits) matching the packet's budget requirements; process-per-VM + socket API fits an Effect-supervised acquire/release lifecycle, but egress policy must be built in the host network dataplane.

*urls:* https://github.com/firecracker-microvm/firecracker | https://www.docker.com/blog/why-microvms-the-architecture-behind-docker-sandboxes/

### [6] Kata Containers — VM isolation behind OCI
Kata Containers (Apache-2.0, OpenInfra Foundation) runs each pod/container in a lightweight VM with a dedicated guest kernel, is OCI-compliant via containerd shim v2, and supports QEMU, Cloud Hypervisor, or Firecracker as the hypervisor.

*relevance:* Gets VM-grade isolation while keeping standard container tooling and OCI resource limits — a lower-integration-cost path than raw Firecracker if the monorepo already orchestrates via containerd, at the price of heavier infrastructure than a library-style sandbox.

*urls:* https://katacontainers.io/learn/

### [7] Docker Sandboxes — agent-specific microVM product (proprietary)
Docker Sandboxes (launched March 2026; architecture post April 16, 2026) run each agent session (Claude Code, Codex, Copilot, Gemini CLI) in a dedicated microVM with a private Docker daemon and 'no path back to the host,' using a purpose-built VMM over Hypervisor.framework/WHP/KVM specifically because Firecracker is Linux/KVM-only and coding agents run on developer laptops; security boundaries (file scope, network policy, secrets) are 'defined before the agent runs, not by the agent.' Standalone sbx CLI installs without a Docker Desktop license; enterprise policy management is a paid contact-Docker offering.

*relevance:* Closest commercial analogue to the packet's mission and a source of design language ('boundaries defined before the agent runs'); proprietary VMM means reference-only, but it validates microVM-per-agent-session as the market's strongest-isolation posture and flags the macOS/Windows gap in Firecracker-based plans.

*urls:* https://www.docker.com/blog/why-microvms-the-architecture-behind-docker-sandboxes/ | https://www.docker.com/blog/docker-sandboxes-run-claude-code-and-other-coding-agents-unsupervised-but-safely/ | https://www.docker.com/products/docker-sandboxes/

### [8] Wasmtime/WASI — capability model with metered execution
Wasmtime (Bytecode Alliance, Apache-2.0 WITH LLVM-exception) sandboxes Wasm with bounds-checked linear memory, type-checked control flow, and 'no raw access to system calls — all interaction with the outside world is done through imports and exports'; WASI grants only explicitly provided capabilities (preopened dirs, typed preview-2 component interfaces), and the runtime is advertised as configurable with 'fine-grained control over things like CPU and memory consumption' (fuel/epoch/limits). Embeddings exist for Rust, C, Python, .NET, Go, Ruby.

*relevance:* The purest existing realization of 'grant names resource + operation with zero ambient authority' plus in-runtime CPU/memory budgets — ideal for deterministic validators and typed tool plugins in the design; not viable for arbitrary bash/npm workloads, so it is a component tier, not the host boundary.

*urls:* https://wasmtime.dev/ | https://docs.wasmtime.dev/security.html | https://github.com/bytecodealliance/wasmtime/blob/main/LICENSE

### [9] workerd — capability bindings but explicitly not a security boundary alone
workerd (Apache-2.0, Cloudflare Workers runtime) isolates V8 workers with no filesystem access and requires every external resource to be a declared binding in Cap'n Proto config (capability-based, SSRF-resistant by construction), but its docs warn it 'does not contain suitable defense-in-depth against the possibility of implementation bugs' and recommend running it inside a VM-grade sandbox for untrusted code.

*relevance:* Its config-declared bindings are a working syntax for the packet's named grants (principal/service/resource per binding), while its self-disclaimer is direct evidence that language-runtime capability models must be nested inside a kernel/VM host boundary — supporting a two-layer architecture.

*urls:* https://github.com/cloudflare/workerd

### [10] Deno — TS-native default-deny with documented escape hatches
Deno (MIT) is deny-by-default with scoped grants (--allow-read=./data, --allow-net=example.com, --allow-env=API_KEY), --deny-* overriding --allow-*, and runtime Deno.permissions query/request/revoke; its own docs flag --allow-run subprocess inheritance and --allow-ffi native code as full sandbox escapes and state that untrusted code additionally requires OS-level sandboxing.

*relevance:* The best TS-ecosystem demonstration of grant syntax users understand (resource+operation scoping, deny precedence, runtime revocation) — worth mirroring in the grant schema — but its self-documented escapes confirm it cannot be the sole enforcement layer for model-generated code.

*urls:* https://docs.deno.com/runtime/fundamentals/security/

### [11] Landlock — unprivileged kernel-enforced named grants
Landlock (Linux 5.13+, ABI now v10) lets an unprivileged process create default-deny rulesets over handled access types and add per-path-hierarchy filesystem rights (execute/read/write/truncate/create/etc.), TCP bind/connect control (ABI v4+), UDP (v10), and IPC/signal scoping (v6+); up to 16 stacked layers, cannot alter mount topology, requires CONFIG_SECURITY_LANDLOCK.

*relevance:* A no-root, no-daemon kernel primitive that can encode literal named grants (path + operation, port + connect) per spawned tool process — the cheapest way for the Effect runtime to stamp a policy revision onto every subprocess; ABI-version probing needed since features vary by kernel.

*urls:* https://docs.kernel.org/userspace-api/landlock.html

### [12] bubblewrap and nsjail — composable Linux jail tools
bubblewrap (LICENSE is GNU Library GPL, i.e. LGPL-2.0-or-later; invoked as an external binary) provides unprivileged user-namespace filesystem/namespace jails and is the exact dependency Claude Code's Linux sandbox installs; nsjail (Apache-2.0, 'not an official Google product') combines UTS/MOUNT/PID/IPC/NET/USER/CGROUP/TIME namespaces, Kafel seccomp-bpf, rlimits (CPU time, memory, fd, process counts), and cgroups, configured per-execution via protobuf files or flags.

*relevance:* nsjail's protobuf config is a ready-made shape for the packet's per-run execution record: one declarative artifact naming mounts, syscall policy, and every resource ceiling; bubblewrap's LGPL is a non-issue when exec'd as a subprocess (no linking), matching how sandbox-runtime already uses it.

*urls:* https://github.com/containers/bubblewrap/blob/main/LICENSE | https://github.com/google/nsjail | https://code.claude.com/docs/en/sandboxing

### [13] E2B — permissive Firecracker sandbox cloud with self-host path
E2B (13.1k stars) is Apache-2.0 across both its SDK repo (e2b-dev/E2B, JS/TS + Python SDKs) and its infrastructure repo (e2b-dev/infra), runs sandboxes as Firecracker microVMs (per its infra codebase's fc.Process VMM management), supports pause/resume state persistence and runtime-adjustable timeouts (up to 24h Pro), and self-hosts via Terraform on GCP (AWS beta; Azure and generic Linux not yet supported).

*relevance:* The most credible permissive-licensed buy-or-fork option for remote execution: TS SDK matches the monorepo, Apache-2.0 infra permits porting its Firecracker orchestration patterns, but self-hosting is cloud-Terraform-shaped rather than a local library, so it fits the remote tier, not laptop-local runs.

*urls:* https://github.com/e2b-dev/E2B | https://github.com/e2b-dev/infra | https://e2b.dev/docs/sandbox | https://deepwiki.com/e2b-dev/infra/3.2-firecracker-integration

### [14] Modal Sandboxes — gVisor cloud service
Modal Sandboxes are 'secure containers for executing untrusted user or agent code' on Modal's cloud (Python/JS/Go clients, exec API, default 5-minute timeout up to 24h, idle timeouts, named sandboxes, secrets support), and Modal's security page confirms the runtime is gVisor; there is no self-hosting option.

*relevance:* Production evidence that gVisor-level isolation is considered sufficient by a major untrusted-AI-code vendor, and its lifecycle API (timeouts, idle termination, exit codes, readiness probes) is a good template for the packet's budget/interruption/outcome surface; cloud-only means reference-only as a dependency.

*urls:* https://modal.com/docs/guide/sandbox | https://modal.com/docs/guide/security

### [15] Daytona — AGPL and now closed-development; eliminate as dependency
Daytona (72k stars, sandboxes with 'dedicated kernel, filesystem, network stack, and allocated vCPU, RAM, and disk' spinning up in under 90 ms) is AGPL-3.0 (verified at tag v0.190.0 LICENSE) and its README states that as of June 2026 core development moved to a private codebase with the public repo receiving 'no further updates, fixes, or releases'; the GitHub API reports no detected license file at repo root on main.

*relevance:* Rules Daytona out as a dependency (AGPL + abandoned public repo) and is a concrete cautionary datum for the packet's build-vs-buy analysis: agent-sandbox vendors can take OSS closed mid-lifecycle, favoring primitives (Firecracker, gVisor, Landlock, srt) over vendor platforms.

*urls:* https://github.com/daytonaio/daytona | https://raw.githubusercontent.com/daytonaio/daytona/v0.190.0/LICENSE | https://raw.githubusercontent.com/daytonaio/daytona/main/README.md

### [16] microsandbox — self-hosted MCP-native microVMs
microsandbox (Apache-2.0, ~7k stars, now at superradcompany/microsandbox after moving from zerocore-ai; actively pushed as of 2026-07-25) self-hosts libkrun-based microVMs booting OCI images in under ~100 ms on Apple Silicon, with an msb CLI, Rust/Python/TypeScript/Go SDKs, per-sandbox CPU/memory configuration, and a built-in MCP server for Claude Code and other agents — but carries an explicit beta 'expect breaking changes' warning.

*relevance:* The only found permissive self-hosted microVM option that runs on macOS AND ships MCP integration natively — directly relevant to mediating cross-tool agent runs locally — but beta maturity and an org rename mid-2026 make it a watch/prototype candidate rather than a foundation.

*urls:* https://github.com/zerocore-ai/microsandbox | https://api.github.com/repos/superradcompany/microsandbox

### [17] Layering conclusion across the landscape
Every surveyed in-runtime capability system disclaims being a lone host boundary (workerd recommends a VM around it; Deno docs require OS-level sandboxing for untrusted code; Wasmtime documents defense-in-depth layers), while every production agent-code platform pairs a kernel/VM boundary with an out-of-band policy plane (Modal: gVisor + platform policy; E2B/AWS: Firecracker + jailer; Docker: microVM + pre-declared policies; Anthropic: bubblewrap/Seatbelt + external proxy and settings-driven permissions).

*relevance:* Converges on the packet's core architecture: typed named grants and budgets expressed in the Effect/TypeScript layer for legibility and audit, enforced by a kernel-or-VM host boundary (bubblewrap/Landlock/nsjail locally, Firecracker/gVisor for remote or hostile tiers) plus a TLS-capable egress proxy — with authorization living in the boundary components, never in the model or generated code.

*urls:* https://github.com/cloudflare/workerd | https://docs.deno.com/runtime/fundamentals/security/ | https://docs.wasmtime.dev/security.html | https://modal.com/docs/guide/security | https://github.com/firecracker-microvm/firecracker | https://www.docker.com/blog/why-microvms-the-architecture-behind-docker-sandboxes/ | https://code.claude.com/docs/en/sandboxing

### [18] Resource-ceiling coverage map
Host-level resource ceilings are native only in the heavier runtimes: Firecracker (vCPU/memory config, net/disk rate limiters, jailer cgroups), nsjail (rlimits + cgroups for CPU/memory/PID/net), microsandbox and Daytona-style platforms (per-sandbox CPU/RAM), Modal/E2B (timeouts, idle timeouts up to 24h), and Wasmtime (fuel/epoch CPU metering, memory limits); Anthropic's sandbox-runtime and Deno's permission layer provide no CPU/memory/disk quotas at all.

*relevance:* Directly scopes the packet's budget requirement: if the local tier is built on srt/bubblewrap/Landlock, token/tool-call/spend budgets can live in the Effect layer but host CPU/memory/process/output ceilings must be added explicitly via cgroup v2 + rlimits (as nsjail composes them), or by escalating the workload to a microVM tier.

*urls:* https://github.com/firecracker-microvm/firecracker | https://github.com/google/nsjail | https://github.com/anthropic-experimental/sandbox-runtime | https://wasmtime.dev/ | https://modal.com/docs/guide/sandbox | https://github.com/zerocore-ai/microsandbox


## sources

- **anthropic-experimental/sandbox-runtime** (repo, Apache-2.0, permissive-port) https://github.com/anthropic-experimental/sandbox-runtime
  - Verified Apache-2.0 via GitHub API. Beta research preview; TS library + srt CLI; bubblewrap+seccomp (Linux), Seatbelt (macOS), WFP alpha (Windows); default-deny network via host proxies; no resource quotas.

- **Claude Code sandboxing docs** (docs, n/a, n/a) https://code.claude.com/docs/en/sandboxing
  - Full page retrieved 2026-07-25. Richest prior art: default-deny domains, credential deny/mask with proxy injection, settings write-protection, managed lockdown, domain-fronting caveat, dangerouslyDisableSandbox escape hatch.

- **gVisor** (repo, Apache-2.0, permissive-port) https://github.com/google/gvisor
  - Verified via GitHub API + README. Architecture details from https://gvisor.dev/docs/ (Sentry/Gofer/runsc). Production use for untrusted AI code confirmed by Modal's security page.

- **Firecracker** (repo, Apache-2.0, permissive-port) https://github.com/firecracker-microvm/firecracker
  - Verified via GitHub API. KVM/Linux-only; jailer, thread-specific seccomp, REST-over-unix-socket per-VM daemon, net/disk rate limiters; powers AWS Lambda/Fargate.

- **Kata Containers** (docs, Apache-2.0, permissive-port) https://katacontainers.io/learn/
  - License stated on official learn page; OpenInfra Foundation governance; VM-per-container via containerd shim v2; QEMU/Cloud Hypervisor/Firecracker backends. Repo LICENSE not independently fetched.

- **Wasmtime** (repo, Apache-2.0, permissive-port) https://github.com/bytecodealliance/wasmtime
  - LICENSE file confirmed Apache (file includes LLVM exception per size/known packaging; commonly Apache-2.0 WITH LLVM-exception). Security model from https://docs.wasmtime.dev/security.html and https://wasmtime.dev/. Component-tier fit, not arbitrary-process boundary.

- **workerd** (repo, Apache-2.0, permissive-port) https://github.com/cloudflare/workerd
  - Verified via GitHub API + README. Cap'n Proto capability bindings = named-grant syntax; explicit warning that it is insufficient defense-in-depth alone for untrusted code.

- **Deno security model** (docs, MIT, permissive-port) https://docs.deno.com/runtime/fundamentals/security/
  - denoland/deno MIT verified via GitHub API. Grant-syntax reference (scoped allow/deny, runtime query/revoke); docs self-document --allow-run and FFI escapes; not a sole boundary.

- **Landlock (Linux kernel UAPI)** (spec, n/a, n/a) https://docs.kernel.org/userspace-api/landlock.html
  - Kernel feature (GPL-2.0 kernel, but userspace callers unaffected — syscall boundary). ABI v1-v10; fs rights, TCP bind/connect v4+, UDP v10, IPC scoping v6+; Linux 5.13+.

- **bubblewrap** (repo, LGPL-2.0-or-later, copyleft-cleanroom) https://github.com/containers/bubblewrap/blob/main/LICENSE
  - LICENSE header 'GNU LIBRARY GENERAL PUBLIC LICENSE' fetched via GitHub API. Weak copyleft is moot in practice: used as an exec'd external binary (as sandbox-runtime and Claude Code do), not linked; classify usage as subprocess-invoke, not port.

- **nsjail** (repo, Apache-2.0, permissive-port) https://github.com/google/nsjail
  - Verified via GitHub API + README. Namespaces + Kafel seccomp + rlimits + cgroups in one protobuf-config'd binary; 'not an official Google product'; CTF/fuzzing pedigree.

- **E2B (SDK + infra)** (repo, Apache-2.0, permissive-port) https://github.com/e2b-dev/infra
  - Both e2b-dev/E2B and e2b-dev/infra verified Apache-2.0 via GitHub API. Firecracker-based (infra codebase; corroborated by https://deepwiki.com/e2b-dev/infra/3.2-firecracker-integration — secondary source, flagged). Self-host via Terraform: GCP green, AWS beta only.

- **Modal Sandboxes** (product, n/a, reference-only) https://modal.com/docs/guide/sandbox
  - Cloud-only proprietary service; gVisor runtime confirmed at https://modal.com/docs/guide/security. API surface (exec, timeouts, idle termination, readiness probes, tags) is a good outcome/budget-surface template.

- **Daytona** (repo, AGPL-3.0, copyleft-cleanroom) https://github.com/daytonaio/daytona
  - AGPL-3.0 verified at raw v0.190.0 LICENSE. README (fetched 2026-07-25): core development moved private June 2026, public repo frozen. Effectively reference-only; do not depend.

- **microsandbox** (repo, Apache-2.0, permissive-port) https://github.com/superradcompany/microsandbox
  - Verified via GitHub API after 301 from zerocore-ai org. libkrun microVMs, OCI images, MCP server, TS SDK, per-sandbox CPU/RAM; active (pushed 2026-07-25) but explicit beta warning.

- **Docker Sandboxes** (product, n/a, reference-only) https://www.docker.com/blog/why-microvms-the-architecture-behind-docker-sandboxes/
  - Proprietary purpose-built VMM (Hypervisor.framework/WHP/KVM), microVM + private dockerd per agent session, pre-declared policies, out-of-boundary secret injection; post dated 2026-04-16; standalone sbx CLI free for individuals, enterprise policy tier paid.

- **Anthropic sandbox-runtime npm package** (docs, Apache-2.0, n/a) https://www.npmjs.com/package/@anthropic-ai/sandbox-runtime
  - npm distribution channel for srt; confirms TypeScript library embedding model (SandboxManager API) alongside CLI.
