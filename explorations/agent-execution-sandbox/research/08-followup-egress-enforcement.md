# Follow-up — egress enforcement prior art (Smokescreen, mitm, eBPF, DNS exfiltration)

> Research-stage artifact of `explorations/agent-execution-sandbox`, produced
> 2026-07-25 by the `agent-sandbox-research` workflow (follow-up agent 2 (critic-dispatched); structured
> output, verbatim). URLs were retrieved or seen in search results by the
> agent under a no-fabrication rule; license fields reflect what the agent
> verified (see per-source notes; unverified licenses are marked
> reference-only). Synthesis and caveats: [`../RESEARCH.md`](../RESEARCH.md);
> provenance ledger: [`SOURCES.md`](./SOURCES.md).
# followup-2

## findings

### [0] smokescreen/acl-model
Stripe Smokescreen is an HTTP CONNECT proxy whose per-service ACL is a YAML file with a `services` list plus a `default` rule, and exactly three policies: `open` (allow all for this service), `report` (allow all but warn on hosts not in the list), `enforce` (deny anything not in `allowed_domains`). Destination globs allow only a leading `*.` prefix (`*.example.com` valid; `api.*.example.com`, `*example.com`, `ex*ample.com`, `example.*` invalid) and hosts must be Punycode.

*relevance:* Gives a proven three-state policy ladder for a default-deny agent sandbox: `report` is the observe-only rollout mode this repo needs before flipping a run profile to `enforce`, and the glob restrictions are a ready-made validation rule for a destination schema in explorations/agent-execution-sandbox.

*urls:* https://github.com/stripe/smokescreen | https://raw.githubusercontent.com/stripe/smokescreen/master/README.md

### [1] smokescreen/acl-model
Smokescreen's ACL is matched against "hostnames *as they appear in the request*" and not against post-resolution IPs; the README explicitly warns that a `global_deny_list` "will only block specific *hostnames*, not entire *destinations*", so an `open`-policy role can still reach a denied host by dialing its IP directly, and it recommends allowlists over denylists plus IP blocking via config options rather than the ACL.

*relevance:* Documents the exact failure mode a name-only allowlist has for an agent that can compute an IP: the sandbox must enforce hostname policy *and* a resolved-IP policy as two separate layers, otherwise a model-authored `curl https://1.2.3.4` escapes the allowlist.

*urls:* https://raw.githubusercontent.com/stripe/smokescreen/master/README.md | https://github.com/stripe/smokescreen

### [2] smokescreen/acl-model
Global lists layer over per-role policy with defined precedence: `global_allow_list` allows a domain even for an `enforce` role that omits it, `global_deny_list` denies even for `report`/`open` roles, a role's own `allowed_domains` overrides the global deny list, and when a domain matches both global lists the deny list wins.

*relevance:* A concrete, already-debugged precedence lattice (global-deny > policy > global-allow, with per-role explicit allow as the escape hatch) that a typed policy-resolution function in the sandbox can copy instead of inventing ad-hoc ordering.

*urls:* https://raw.githubusercontent.com/stripe/smokescreen/master/README.md

### [3] smokescreen/identity
Clients contact Smokescreen over mTLS; Smokescreen authenticates the client certificate against configurable CAs/CRLs and by default derives the calling service's role from the certificate's Common Name, and the identification function is replaceable by assigning `smokescreen.Config.RoleFromRequest` with a `func(request *http.Request) (string, error)` (the README's example extracts the role from the certificate's `OrganizationalUnit`).

*relevance:* Shows the production pattern for binding a *principal* to an egress decision without trusting a header the workload controls — directly applicable to per-run agent identity (run id / purpose) where the sandbox, not the agent process, chooses the credential.

*urls:* https://raw.githubusercontent.com/stripe/smokescreen/master/README.md | https://github.com/stripe/smokescreen

### [4] smokescreen/tls-termination
Smokescreen's ACL v1 schema carries a per-role `mitm_domains` list where each entry has `domain`, `add_headers` (map[string]string), `detailed_http_logs` (bool) and `detailed_http_logs_full_headers` ([]string); the loader validates that every `mitm_domains` entry also appears in `allowed_domains` (error text: "domain %s was added to mitm_domains but is missing in allowed_domains"), and the ACL `Decision` struct returns a `*MitmConfig` alongside `Result`, `Reason` and `Project`.

*relevance:* This is the closest production prior art to the repo's 'name the principal, purpose, resource, sink' requirement: policy attaches per-destination header injection plus per-destination request logging, so a sandbox can stamp purpose/run metadata onto outbound calls only for the destinations where MITM is authorized.

*urls:* https://api.github.com/repos/stripe/smokescreen/contents/pkg/smokescreen/acl/v1/yaml_loader.go | https://api.github.com/repos/stripe/smokescreen/contents/pkg/smokescreen/acl/v1/acl.go

### [5] smokescreen/ssrf-and-budgets
Smokescreen resolves each requested domain and verifies the result is a publicly routable address to block internal-network scanning, with `--allow-range`/`--deny-range` (CIDR) and `--allow-address`/`--deny-address` (IP[:PORT]) options and a configurable `--resolver-address`; it also ships budget controls: `--timeout` (default 10s), `--dns-timeout` (default 5s), `--max-concurrent-requests`, `--max-request-rate`, `--max-request-burst` (default 2x rate), and `--max-concurrent-connect-tunnels`.

*relevance:* Covers two sandbox requirements at one chokepoint: SSRF/internal-scan denial (the agent must not reach the host's own services) and per-run resource budgets, so rate/concurrency limits do not need a separate enforcement mechanism.

*urls:* https://raw.githubusercontent.com/stripe/smokescreen/master/README.md | https://github.com/stripe/smokescreen

### [6] tls-terminating-proxy/mitmproxy
mitmproxy implements MITM by shipping "a full CA implementation that generates interception certificates on the fly", which requires the client to trust mitmproxy as a CA; in explicit mode it answers CONNECT with 200, and for HTTPS it lets the TLS handshake proceed until the SNI value is received, pauses, connects upstream with that SNI to fetch the real certificate, then completes the client handshake (falling back to upstream cert sniffing when the client connects by IP). Transparent mode uses iptables/pf redirection and recovers the original destination from the routing layer.

*relevance:* Defines the minimum requirements for URL/method-level policy in the agent sandbox: a per-machine (ideally per-run) CA that only the sandboxed process trusts, plus SNI-driven upstream connection — and it explains why hostname-only CONNECT filtering is the cheaper default when the workload pins certificates.

*urls:* https://docs.mitmproxy.org/stable/concepts/how-mitmproxy-works/

### [7] tls-terminating-proxy/mitmproxy
mitmproxy policy is written as Python addons that respond to events — "Addons interact with mitmproxy by responding to events, which allow them to hook into and change mitmproxy's behaviour" — with handlers such as `request(self, flow)` that can read and mutate the flow (e.g. `flow.request.headers["myheader"] = "value"`); addons are exported via a module-level `addons` list and loaded with `mitmdump -s ./script.py`, with live reload on file change.

*relevance:* Confirms an off-the-shelf enforcement point for full-URL/method/body policy without writing a TLS stack, useful as a spike harness for the sandbox before committing to a bespoke Effect-based proxy service.

*urls:* https://docs.mitmproxy.org/stable/addons/overview/

### [8] agent-sandbox/anthropic-sandbox-runtime
Anthropic's sandbox-runtime is allow-only: `network.allowedDomains` accepts literal domains, `*.` wildcards and optional `:port` suffixes, `network.deniedDomains` is checked first and wins, and "An empty allowedDomains list means no network access". All traffic is routed through host-side HTTP and SOCKS5 proxies; isolation is bubblewrap + network namespace on Linux (traffic relayed over a Unix domain socket via `socat`), a generated Seatbelt profile restricted to the proxies' localhost ports on macOS, and a dedicated `srt-sandbox` user with Windows Filtering Platform egress rules on Windows.

*relevance:* The nearest complete reference implementation of the exact artifact this repo is shaping — a per-run, default-deny egress sandbox for agent subprocesses on a single developer host — and it is Apache-2.0, so its architecture can be ported rather than cleanroomed.

*urls:* https://raw.githubusercontent.com/anthropic-experimental/sandbox-runtime/main/README.md | https://github.com/anthropic-experimental/sandbox-runtime

### [9] agent-sandbox/anthropic-sandbox-runtime
sandbox-runtime supports optional TLS termination: with `network.tlsTerminate` set, "HTTPS CONNECTs are terminated in-process so SRT can see (and filter, via `network.filterRequest`) the decrypted requests", while `tlsTerminate.excludeDomains` (same pattern syntax as `allowedDomains`) tunnels opaquely so mTLS upstreams and certificate-pinning clients still work; the sandboxed process receives a trust bundle of the MITM CA plus host roots, with `extraCaCertPaths` for additions.

*relevance:* Shows the layered design the sandbox should adopt: CONNECT-hostname policy as the always-on floor, TLS termination as an opt-in per-destination upgrade for method/path policy, with an explicit exclusion list so pinned clients degrade to hostname-only instead of breaking.

*urls:* https://raw.githubusercontent.com/anthropic-experimental/sandbox-runtime/main/README.md

### [10] agent-sandbox/known-bypasses
sandbox-runtime documents its own bypass surface: on Linux it "Currently uses environment variables (`HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`) to direct traffic through proxies. This works for most applications but may be ignored by programs that don't respect these variables"; "in some cases it may be possible to bypass the network filtering through domain fronting"; broad allowlist entries like `github.com` "may allow for data exfiltration"; and `allowUnixSockets` can grant escape (e.g. `/var/run/docker.sock` "would effectively grant access to the host system").

*relevance:* A pre-written threat list for the repo's packet: env-var-only proxying is not enforcement (needs namespace/cgroup-level fallback), a coarse allowlist entry re-opens the read+egress composition problem the CAPTURE.md flags, and Unix-socket grants are an authority escalation channel distinct from network policy.

*urls:* https://raw.githubusercontent.com/anthropic-experimental/sandbox-runtime/main/README.md

### [11] agent-sandbox/per-run-proxy-lifecycle
sandbox-runtime instantiates proxies per sandbox configuration through `SandboxManager.initialize(config)`, which starts the HTTP and SOCKS5 proxy servers and manages their lifecycle for the duration of sandboxed command execution, with teardown via `SandboxManager.reset()` or automatic process-exit cleanup.

*relevance:* Direct evidence that a per-run proxy instance (rather than one shared host proxy plus request-level identity) is a workable lifecycle model — the policy is carried by *which* proxy the run is pointed at, which makes run identity unforgeable by the agent process.

*urls:* https://raw.githubusercontent.com/anthropic-experimental/sandbox-runtime/main/README.md

### [12] production/copilot-agent-firewall
GitHub's Copilot coding agent runs behind a default-on firewall; a blocked request produces "a warning ... added to the pull request body (for new pull requests) or to a comment (for existing pull requests)" showing "the blocked address and the command that tried to make the request". Admins extend it with the `COPILOT_AGENT_FIREWALL_ALLOW_LIST_ADDITIONS` Actions variable: a domain entry (`packages.contoso.corp`) allows that domain and its subdomains but not siblings, while a URL entry (`https://packages.contoso.corp/project-1/`) restricts traffic to that scheme, host and path prefix. The docs warn "Disabling the firewall will allow Copilot to connect to any host, increasing risks of exfiltration of code or other sensitive information."

*relevance:* Production proof that (a) URL-prefix granularity, not just hostname, is deployable, and (b) denials should be surfaced back into the run's artifact — matching this repo's 'immutable execution records' requirement, where a blocked egress attempt is evidence rather than a silent failure.

*urls:* https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/customize-the-agent-firewall

### [13] production/codex-cloud-internet-access
OpenAI Codex cloud blocks internet access during the agent phase by default (setup scripts keep connectivity), and when enabled per environment it offers domain allowlist presets ("None", "Common dependencies", "All (unrestricted)") plus an HTTP method restriction that limits requests to "GET, HEAD, and OPTIONS", blocking POST/PUT/PATCH/DELETE; the docs state that "enabling agent internet access increases security risk" naming prompt injection, code/secret exfiltration, malware or vulnerable dependency downloads, and license-restricted content.

*relevance:* Establishes HTTP-method as a first-class policy dimension for agent egress — a read-only (GET/HEAD/OPTIONS) profile is a cheap, high-value default that blocks the write-shaped exfiltration paths while keeping package/doc fetches working, and it requires TLS termination to enforce.

*urls:* https://learn.chatgpt.com/codex/cloud/internet-access

### [14] credential-injection-proxy/tokenizer
Fly.io's tokenizer is "an HTTP proxy that injects third party authentication credentials into requests": clients hold only a sealed ciphertext encrypted to the proxy's public key and present it per request in a `Proxy-Tokenizer` header alongside proof in `Proxy-Authorization`; the sealed secret embeds the expected authorization digest so "encrypted secrets can only be used by authorized clients", and each secret carries destination restrictions via `allowed_hosts` (e.g. `["api.stripe.com"]`) or `allowed_host_pattern` (e.g. `".*\.stripe\.com$"`).

*relevance:* The canonical pattern for the sandbox's credential problem: the agent process never holds a usable secret, and the secret itself names its permitted destination, so a prompt-injected agent cannot redirect a credential to an attacker host even when egress to that host is otherwise allowed.

*urls:* https://github.com/superfly/tokenizer

### [15] proxy-identity-metadata
RFC 9110 §11.7.2 defines `Proxy-Authorization` as the field that "allows a user agent to authenticate itself with an HTTP proxy that is requesting authentication", scoped to the immediate inbound proxy, and requires that "A proxy that receives a Proxy-Authorization field MUST remove that field before forwarding the request message downstream"; it is the client-side counterpart to the 407 / `Proxy-Authenticate` challenge.

*relevance:* Standards basis for carrying per-run identity/purpose to the sandbox proxy without leaking it to the destination — the hop-by-hop guarantee means a run token in `Proxy-Authorization` never reaches the third-party service, unlike ad-hoc `X-` headers.

*urls:* https://www.rfc-editor.org/rfc/rfc9110.html#name-proxy-authorization

### [16] host-policy/systemd-cgroup-ebpf
systemd exposes per-unit (cgroup-scoped) IP filtering: `IPAddressAllow=`/`IPAddressDeny=` "Turn on network traffic filtering for IP packets sent and received over AF_INET and AF_INET6 sockets", taking space-separated addresses with optional `/PREFIXLENGTH`, applied to all sockets created by processes of the unit; `IPIngressFilterPath=`/`IPEgressFilterPath=` add "custom network traffic filters implemented as BPF programs" from a pinned path under `/sys/fs/bpf/`, and these are "loaded in addition to filters any of the parent slice units this unit might be a member of as well as any IPAddressAllow= and IPAddressDeny= filters in any of these units"; `RestrictNetworkInterfaces=` allow-lists (or, with a leading `~`, deny-lists) usable interfaces.

*relevance:* Gives a no-new-daemon enforcement floor for agent subprocesses on a single Linux host: run each agent in its own transient scope/slice whose IPAddressAllow only permits the sandbox proxy's address, so proxy bypass via ignored `HTTP_PROXY` env vars fails at the kernel instead of silently escaping.

*urls:* https://man.archlinux.org/man/systemd.resource-control.5.en

### [17] host-policy/cgroup-bpf-hooks
The kernel/libbpf documentation lists cgroup-attached program types usable for per-process-tree network control: `BPF_PROG_TYPE_CGROUP_SKB` with sections `cgroup_skb/egress` and `cgroup_skb/ingress`, `BPF_PROG_TYPE_CGROUP_SOCK_ADDR` with `cgroup/connect4`, `cgroup/connect6`, `cgroup/sendmsg4`, `cgroup/sendmsg6`, `cgroup/bind4`, `cgroup/bind6`, and `BPF_PROG_TYPE_CGROUP_SOCK` with `cgroup/sock_create` and `cgroup/sock_release`.

*relevance:* These are the single-host equivalents of cluster CNI policy: `cgroup/connect4` can transparently redirect an agent cgroup's connects to the per-run proxy (removing env-var dependence) and `cgroup_skb/egress` can hard-deny everything else, all without Kubernetes.

*urls:* https://docs.kernel.org/bpf/libbpf/program_types.html

### [18] host-policy/tetragon
Tetragon provides eBPF security observability plus in-kernel enforcement via TracingPolicy, with two actions: Override, where "the function will never be executed and, instead, a value (typically an error) will be returned to the caller" ("only system calls and security check functions allow to change their return value in this manner"), and Signal (e.g. SIGKILL), which the docs warn "does not always stop the operation being performed by the process" — so "the `Signal` action should be combined with the `Override` action". It installs outside Kubernetes as a systemd-managed service from release tarballs (amd64 and arm64 as of v1.0).

*relevance:* Shows kernel-level enforcement is available on a plain dev host, and documents the TOCTOU caveat that matters for the sandbox: async kill-after-the-fact is not a control; egress denial must be synchronous at connect/socket time (Override or a proxy refusal), not a post-hoc signal.

*urls:* https://tetragon.io/docs/concepts/enforcement/ | https://tetragon.io/docs/overview/ | https://tetragon.io/docs/installation/package/

### [19] host-policy/opensnitch
OpenSnitch is an interactive GNU/Linux application firewall that filters outbound connections per process, intercepting via nfqueue/netfilter with eBPF process monitoring, with rules keyed on process path, destination host/IP/port and duration, split into a daemon plus a GUI; the repository is licensed GPL-3.0.

*relevance:* Prior art for per-process (not per-container) egress prompting on a single workstation — the interaction model maps onto an agent 'ask before new destination' mode — but its GPL-3.0 license means design-only reference, no code reuse, for this repo.

*urls:* https://github.com/evilsocket/opensnitch | https://api.github.com/repos/evilsocket/opensnitch/license

### [20] dns/fqdn-policy
Cilium implements FQDN egress policy through an in-agent DNS proxy: "A DNS Proxy in the agent intercepts egress DNS traffic and records IPs seen in the responses", and "Only IPs in intercepted DNS responses to an application will be allowed in the Cilium policy rules", with responses "cached within Cilium agent respecting TTL". Interception requires its own L7 DNS rule (a `*` match "matches all names, and inserts all IPs in DNS responses into the cilium-agent DNS cache"), `matchName` is exact and `matchPattern` supports `*` matching zero or more characters except the `.` separator, and applications that bypass DNS or use hardcoded IPs escape the policy entirely; DNS policies do not support port ranges.

*relevance:* The reference design for making name-based allowlists actually enforceable at L3: the sandbox's resolver becomes the only source of legitimate IPs, and any connect to an IP the sandbox never resolved is denied — which closes the direct-IP hole Smokescreen's README warns about.

*urls:* https://docs.cilium.io/en/latest/security/policy/layer7/ | https://docs.cilium.io/en/stable/security/dns/

### [21] dns/resolution-not-fenced
sandbox-runtime documents that "DNS resolution via the system resolver is not fenced. `getaddrinfo()` is serviced by the `Dnscache` service running as `NETWORK SERVICE`, so name resolution succeeds even though the subsequent `connect()` from the sandboxed process is blocked", while tools issuing direct UDP/53 queries (`nslookup`, `dig`) are subject to network fencing.

*relevance:* Concrete evidence that 'block the connect, not the lookup' leaves a residual DNS side channel — a sandboxed agent can still encode data into hostnames the host resolver dutifully forwards, so the packet needs an explicit decision on whether resolution itself is mediated and logged.

*urls:* https://raw.githubusercontent.com/anthropic-experimental/sandbox-runtime/main/README.md

### [22] dns/exfiltration-channel
DNS tunneling encodes exfiltrated data in query subdomains sent to an attacker-controlled authoritative nameserver and receives commands in responses (notably TXT records or encoded A-record octets); it works because port 53 "is nearly always open on systems, firewalls, and clients" and recursive resolution carries the queries out even when HTTP/HTTPS is blocked. Known tools include iodine, dnscat2, dns2tcp, OzymanDNS and tcp-over-dns; detection relies on anomalous query strings/lengths, query volume and frequency, and DNS server logging.

*relevance:* Justifies treating the sandbox's DNS path as a monitored sink in its own right: without query logging and rate/entropy limits, a default-deny HTTP egress policy still leaves a working covert channel for the exact secret-leak scenario the packet is trying to prevent.

*urls:* https://unit42.paloaltonetworks.com/dns-tunneling-how-dns-can-be-abused-by-malicious-actors/

### [23] dns/doh-bypass
RFC 8484 specifies DoH over the HTTPS scheme on default port 443 and notes in §8.1 that "the use of the HTTPS default port 443 and the ability to mix DoH traffic with other HTTPS traffic on the same connection can deter unprivileged on-path devices from interfering with DNS operations and make DNS traffic analysis more difficult", while §10 states that "Filtering or inspection systems that rely on unsecured transport of DNS will not function in a DNS over HTTPS environment due to the confidentiality and integrity protection provided by TLS."

*relevance:* Settles a design question for the sandbox: DNS-layer policy alone cannot be trusted because any agent-run tool can speak DoH to 443; enforcement must sit at the connection allowlist (which resolver hosts are reachable at all), with DNS policy as telemetry and convenience rather than the boundary.

*urls:* https://www.rfc-editor.org/rfc/rfc8484.html

### [24] dns/doh-opt-out-signals
Browser-level DoH opt-out signals exist but are advisory: Firefox resolves the canary domain `use-application-dns.net` via the OS-configured resolver and disables its default DoH when the answer is negative (NXDOMAIN/SERVFAIL, or NOERROR with no A/AAAA records), and Mozilla states the canary "only applies to users who have DoH enabled as the default option, and does not apply for users who have made the choice to turn on DoH by themselves"; Chrome auto-upgrades to the existing provider's DoH endpoint and states that "managed deployments should be automatically opted-out".

*relevance:* Confirms these signals are cooperative, not enforcement — useful as a low-cost hygiene step if the sandbox ever runs a browser-capable agent, but the sandbox must still block reachability of external DoH endpoints to make its DNS visibility real.

*urls:* https://support.mozilla.org/en-US/kb/canary-domain-use-application-dnsnet | https://www.chromium.org/developers/dns-over-https/

### [25] dns/resolver-side-controls
CoreDNS's `acl` plugin enforces query-level policy with syntax `acl [ZONES...] { ACTION [type QTYPE...] [net SOURCE...] }` and four actions — `allow`, `block` (REFUSED), `filter` (empty NOERROR), `drop` (no response) — matching on source CIDR, query type and zone, and exports Prometheus counters for blocked/filtered/allowed/dropped requests; it evaluates "the source IP of the TCP/UDP headers of the DNS query received by CoreDNS", which differs from the true origin behind forwarders or NAT.

*relevance:* A concrete, Apache-2.0 building block for a per-sandbox resolver: run a scoped resolver whose ACL only answers for allowlisted zones from the sandbox's namespace address, giving both denial and per-query metrics for the execution record.

*urls:* https://coredns.io/plugins/acl/ | https://api.github.com/repos/coredns/coredns/license

### [26] dns/rebinding-toctou
The OWASP SSRF Prevention Cheat Sheet treats DNS as a bypass surface for allowlists: it recommends ensuring organization domains "are resolved by your internal DNS server first in the chains of DNS resolvers", monitoring the allowlist to detect any entry resolving to a local or internal IP, and — for outbound calls to external services — retrieving "all the IP addresses behind the domain name provided (taking records _A_ + _AAAA_ for IPv4 + IPv6)" and verifying each is public before use.

*relevance:* Names the time-of-check/time-of-use gap the sandbox must close: validating a hostname and then letting the client re-resolve at connect time re-opens DNS rebinding, so the proxy must dial the specific IP it validated (as Smokescreen does) rather than re-resolving.

*urls:* https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html

### [27] agent-client-integration
Claude Code documents the client-side contract for running behind an enforcing proxy: it honors `HTTPS_PROXY`/`HTTP_PROXY`/`NO_PROXY` (no SOCKS support), trusts bundled Mozilla CAs plus the OS store by default (`CLAUDE_CODE_CERT_STORE=bundled,system`), accepts an interception CA via `NODE_EXTRA_CA_CERTS`, supports mTLS via `CLAUDE_CODE_CLIENT_CERT`/`CLAUDE_CODE_CLIENT_KEY`/`CLAUDE_CODE_CLIENT_KEY_PASSPHRASE`, and publishes an explicit host allowlist (api.anthropic.com, claude.ai, claude.com, platform.claude.com, mcp-proxy.anthropic.com, downloads.claude.ai, storage.googleapis.com, bridge.claudeusercontent.com, raw.githubusercontent.com, registry.npmjs.org for npm installs, and optional telemetry hosts). It also warns that a repository's own settings files are ignored for these variables in app-managed sessions "so a checked-out repository can't redirect the TLS or proxy path".

*relevance:* Two things the packet needs concretely: the minimum destination allowlist for an agent run that must still reach the model API and package registries, and the precedent that proxy/CA configuration must come from managed or user-level settings — never from repo-controlled files an agent can edit — otherwise the sandbox's own control plane is agent-writable.

*urls:* https://code.claude.com/docs/en/network-config


## sources

- **Stripe Smokescreen** (repo, MIT, permissive-port) https://github.com/stripe/smokescreen
  - License verified via GitHub API (LICENSE.txt, spdx_id MIT, https://github.com/stripe/smokescreen/blob/master/LICENSE.txt). Go CONNECT proxy: per-role YAML ACL (open/report/enforce), mTLS-CN role identity with replaceable RoleFromRequest, IP allow/deny ranges, per-destination mitm_domains with add_headers + detailed HTTP logging, rate/concurrency budgets. Closest match to the sandbox's egress policy layer; ACL shapes are portable to an Effect Schema.

- **mitmproxy** (docs, MIT, permissive-port) https://docs.mitmproxy.org/stable/concepts/how-mitmproxy-works/
  - License verified via GitHub API for mitmproxy/mitmproxy (spdx_id MIT, https://github.com/mitmproxy/mitmproxy/blob/main/LICENSE). Documents on-the-fly CA cert generation, CONNECT handling, SNI-driven upstream cert retrieval, transparent mode; addon model (docs.mitmproxy.org/stable/addons/overview/) gives per-request Python policy hooks for URL/method enforcement spikes.

- **anthropic-experimental/sandbox-runtime** (repo, Apache-2.0, permissive-port) https://github.com/anthropic-experimental/sandbox-runtime
  - License verified via GitHub API (spdx_id Apache-2.0, https://github.com/anthropic-experimental/sandbox-runtime/blob/main/LICENSE). Single-host, per-run default-deny agent sandbox: bubblewrap/Seatbelt/WFP isolation, HTTP+SOCKS5 host proxies, allowedDomains/deniedDomains with wildcards and :port, optional tlsTerminate + filterRequest, documented bypasses (env-var proxying, domain fronting, broad allowlists, Unix sockets). Primary port candidate.

- **Cilium DNS-aware (toFQDNs) egress policy** (docs, Apache-2.0, reference-only) https://docs.cilium.io/en/latest/security/policy/layer7/
  - License verified via GitHub API for cilium/cilium (spdx_id Apache-2.0, https://github.com/cilium/cilium/blob/main/LICENSE). DNS-proxy-observes-responses-then-allows-those-IPs design is the key transferable idea; the surrounding identity/CNI machinery is Kubernetes-scale and not appropriate to port for a single-host agent runner. Overview page: https://docs.cilium.io/en/stable/security/dns/

- **Cilium Tetragon** (docs, Apache-2.0, reference-only) https://tetragon.io/docs/concepts/enforcement/
  - License verified via GitHub API for cilium/tetragon (spdx_id Apache-2.0, https://github.com/cilium/tetragon/blob/main/LICENSE). Runs outside Kubernetes as a systemd service (https://tetragon.io/docs/installation/package/); Override vs Signal enforcement semantics and the SIGKILL-is-racy warning inform why egress denial must be synchronous.

- **systemd.resource-control(5) — IPAddressAllow/Deny, IPEgressFilterPath, RestrictNetworkInterfaces** (docs, unverified, reference-only) https://man.archlinux.org/man/systemd.resource-control.5.en
  - Man page mirror fetched directly (freedesktop.org returned 403 to this environment). Per-unit cgroup eBPF IP filtering with parent-slice inheritance, custom pinned BPF egress programs, interface restriction — the zero-dependency enforcement floor for agent subprocesses on this Linux host.

- **Linux kernel libbpf program types (cgroup BPF attach points)** (docs, n/a, n/a) https://docs.kernel.org/bpf/libbpf/program_types.html
  - Enumerates cgroup_skb/egress, cgroup/connect4|connect6, cgroup/sendmsg*, cgroup/bind*, cgroup/sock_create — the primitives for per-cgroup connect interception/redirection to a per-run proxy without Kubernetes.

- **OpenSnitch** (repo, GPL-3.0, copyleft-cleanroom) https://github.com/evilsocket/opensnitch
  - License verified via GitHub API (spdx_id GPL-3.0, https://github.com/evilsocket/opensnitch/blob/master/LICENSE). Per-process interactive egress firewall (nfqueue + eBPF process monitoring, daemon/GUI split). Useful as an interaction-model reference for ask-on-new-destination; no code reuse under this repo's licensing.

- **Fly.io tokenizer** (repo, Apache-2.0, permissive-port) https://github.com/superfly/tokenizer
  - License verified via GitHub API (spdx_id Apache-2.0, https://github.com/superfly/tokenizer/blob/main/LICENSE). Credential-injection proxy: sealed secrets encrypted to the proxy key, per-request Proxy-Tokenizer + Proxy-Authorization, per-secret allowed_hosts/allowed_host_pattern. The pattern for keeping secrets out of the agent process while binding each secret to its destination.

- **CoreDNS acl plugin** (docs, Apache-2.0, permissive-port) https://coredns.io/plugins/acl/
  - License verified via GitHub API for coredns/coredns (spdx_id Apache-2.0, https://github.com/coredns/coredns/blob/master/LICENSE). allow/block/filter/drop by source CIDR, qtype and zone, with Prometheus counters — a drop-in scoped resolver for a sandbox network namespace, giving both DNS denial and per-query telemetry.

- **RFC 8484 — DNS Queries over HTTPS (DoH)** (spec, n/a, n/a) https://www.rfc-editor.org/rfc/rfc8484.html
  - §8.1 on DoH blending with other HTTPS on 443 and §10 on unsecured-DNS filtering systems ceasing to function — the reason DNS-layer policy cannot be the boundary for an agent sandbox.

- **RFC 9110 §11.7.2 — Proxy-Authorization** (spec, n/a, n/a) https://www.rfc-editor.org/rfc/rfc9110.html#name-proxy-authorization
  - Hop-by-hop proxy credentials that MUST be stripped before forwarding — the standards-backed channel for carrying per-run identity/purpose to a sandbox proxy without leaking it to third-party destinations.

- **GitHub Copilot coding agent firewall** (docs, n/a, n/a) https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/customize-the-agent-firewall
  - Production default-on agent egress firewall: domain-vs-URL allowlist granularity via COPILOT_AGENT_FIREWALL_ALLOW_LIST_ADDITIONS, blocked-request warnings written into the PR body/comment with the offending address and command, explicit exfiltration warning on disabling.

- **OpenAI Codex cloud — internet access controls** (docs, n/a, n/a) https://learn.chatgpt.com/codex/cloud/internet-access
  - Default-off agent-phase internet, domain allowlist presets, and an HTTP-method restriction to GET/HEAD/OPTIONS — production precedent for method-level agent egress policy and its stated threat model (prompt injection, exfiltration, malicious dependencies).

- **Claude Code enterprise network configuration** (docs, n/a, n/a) https://code.claude.com/docs/en/network-config
  - Client-side contract for operating behind an enforcing/TLS-inspecting proxy (HTTPS_PROXY, NODE_EXTRA_CA_CERTS, CLAUDE_CODE_CERT_STORE, mTLS client cert env vars), the required destination allowlist, and the rule that repo-local settings must not be able to redirect the TLS/proxy path.

- **Unit 42 — DNS tunneling** (post, n/a, n/a) https://unit42.paloaltonetworks.com/dns-tunneling-how-dns-can-be-abused-by-malicious-actors/
  - Mechanics of subdomain-encoded exfiltration and TXT/A-record C2, why port 53 survives restrictive egress, named tools (iodine, dnscat2, dns2tcp), and detection signals (query string anomalies, length, volume, server logging).

- **OWASP SSRF Prevention Cheat Sheet** (docs, unverified, reference-only) https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
  - DNS pinning/rebinding bypasses, internal-resolver-first guidance, and the requirement to validate all A/AAAA results as public — the TOCTOU argument for dialing the validated IP rather than re-resolving at connect time.

- **Mozilla canary domain use-application-dns.net** (docs, n/a, n/a) https://support.mozilla.org/en-US/kb/canary-domain-use-application-dnsnet
  - Seen in search results with quoted mechanics (negative answer disables default DoH; does not apply to users who enabled DoH themselves); direct fetch of the SUMO page failed in this environment, so treat the quote as search-snippet-sourced and re-verify before citing in a binding document.

- **Chromium — DNS over HTTPS** (docs, n/a, n/a) https://www.chromium.org/developers/dns-over-https/
  - Chrome auto-upgrades to the current provider's DoH endpoint and states managed deployments should be automatically opted out — confirms browser DoH opt-out is cooperative rather than enforced.
