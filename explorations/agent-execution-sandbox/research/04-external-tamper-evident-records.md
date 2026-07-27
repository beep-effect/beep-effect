# External landscape — tamper-evident execution records & audit ledgers

> Research-stage artifact of `explorations/agent-execution-sandbox`, produced
> 2026-07-25 by the `agent-sandbox-research` workflow (ext-ledger sweep agent; structured
> output, verbatim). URLs were retrieved or seen in search results by the
> agent under a no-fabrication rule; license fields reflect what the agent
> verified (see per-source notes; unverified licenses are marked
> reference-only). Synthesis and caveats: [`../RESEARCH.md`](../RESEARCH.md);
> provenance ledger: [`SOURCES.md`](./SOURCES.md).
## findings

### [0] Merkle proof canon (RFC 9162)
RFC 9162 (Certificate Transparency v2.0) is the canonical spec for append-only Merkle-tree logs: it defines Merkle inclusion proofs (an entry is in a tree head) and consistency proofs (a later tree head is a superset of an earlier one), with the log modeled as a single append-only binary Merkle tree; the proof algorithms are small enough to reimplement directly from the spec.

*relevance:* The execution-record ledger should adopt RFC 9162 proof semantics rather than invent its own; the algorithms are simple, spec-defined, and portable to TypeScript for in-repo verification of agent execution records.

*urls:* https://www.rfc-editor.org/info/rfc9162/ | https://datatracker.ietf.org/doc/rfc9162/

### [1] What transparency proofs do NOT prove
CT's own framing is that transparency makes misissuance detectable, not prevented — logs prove presence and append-only evolution, and Rekor's guarantees are likewise structural (append-only, entries never mutated/removed, inclusion verifiable); neither system claims an inclusion proof validates that the recorded content was legitimate, accurate, or authorized.

*relevance:* Direct confirmation of the packet axiom: a hash/inclusion proof proves correspondence and ordering, not truth or authorization. Authorization must be decided outside the model and outside generated code; the ledger's job is to make the decision and its inputs tamper-evidently visible, not to be the authorizer.

*urls:* https://certificate.transparency.dev/howctworks/ | https://docs.sigstore.dev/logging/overview/

### [2] Tessera (current-generation tlog library)
Tessera (transparency-dev) is an Apache-2.0 Go library implementing the tlog-tiles API, declared production-ready since Beta v0.2.0 and now GA with stable APIs; it supports GCP, AWS, and POSIX-filesystem storage drivers and is explicitly positioned as what new transparency ecosystems should build on instead of Trillian v1.

*relevance:* Strongest OSS base for a self-hosted tamper-evident execution ledger, but it is a Go library — in the Effect-TS monorepo it would run as a sidecar service or the tile format would be reimplemented natively; the tile/spec layer is what should be adopted, not necessarily the binary.

*urls:* https://github.com/transparency-dev/tessera

### [3] Trillian maintenance status
Trillian (Apache-2.0) implements Google's Verifiable Data Structures design, is stable and used in production by large CT log operators, but the repo explicitly states it is in maintenance mode with no new features planned and directs new log operators to Tessera.

*relevance:* Do not build new infrastructure on Trillian v1; treat it as a design reference (multi-tree, log personality separation) and validation of the verifiable-log approach at scale.

*urls:* https://github.com/google/trillian

### [4] Rekor v2 / rekor-tiles architecture
Rekor v2 (Apache-2.0) rebuilt Sigstore's signature transparency log on Tessera tiles: the log is served as immutable content-addressed static tiles instead of a queried database, sharded annually (log<year>-<rev>) with old shards frozen as static archives, runs a productionized public instance with a 99.5% availability SLO, and integrates witnessing directly to strengthen append-only guarantees.

*relevance:* Reference architecture for the sandbox ledger: per-period (or per-matter) shards that freeze into static, cheaply-hosted archives fit legal-matter lifecycle (active → closed → retained), and built-in witnessing shows non-equivocation is now table stakes, not exotic.

*urls:* https://github.com/sigstore/rekor-tiles | https://blog.sigstore.dev/rekor-v2-ga/ | https://blog.sigstore.dev/rekor-v2-alpha/

### [5] tlog-tiles / C2SP spec family
C2SP's tlog-tiles spec serves an entire log as static assets — 256-hash (8 KiB) Merkle tiles, entry bundles, and a signed 'checkpoint' (signed tree head, Ed25519) — so all resources except the checkpoint are immutable, CDN-cacheable, and require no server-side proof computation; companion specs cover tlog-checkpoint, tlog-witness (HTTP cosignature protocol), and signed-note; specs are CC BY 4.0, C2SP code is BSD 1-Clause.

*relevance:* Cheapest credible embedding path: append execution-record hashes, publish tiles + checkpoint to object storage, and let any client (tenant, auditor, court expert) verify offline. Spec licensing (CC BY 4.0) permits a clean TypeScript implementation.

*urls:* https://github.com/C2SP/C2SP/blob/main/tlog-tiles.md | https://github.com/C2SP/C2SP

### [6] Split-view attacks and witnessing
A log operator can equivocate by showing different tree heads to different verifiers (split-view/alternate-history attack); the field's working countermeasure is witness cosigning — independent witnesses verify consistency proofs and countersign checkpoints, so a client requiring k cosignatures cannot be split-viewed unless k witnesses collude — implemented by transparency-dev/witness (Apache-2.0, tlog-witness spec, omniwitness deployment, Armored Witness hardware).

*relevance:* A single-operator internal execution ledger proves nothing about non-equivocation to a tenant or court on its own. Minimum viable countermeasure for beep: periodically anchor checkpoint digests into a second trust domain (WORM bucket, customer-visible endpoint, or external witness); the threat is the platform itself rewriting agent history after an incident.

*urls:* https://github.com/transparency-dev/witness | https://blog.transparency.dev/can-i-get-a-witness-network | https://technology.a-sit.at/en/split-view-attack-protection-for-transparency-systems/

### [7] Hash chains vs history trees; forward-secure logging
Crosby & Wallach (USENIX Security 2009) showed plain hash chains need linear-size evidence (≈800 MB trace to prove one event in an 80M-entry log) while their Merkle history tree yields ~3 KB O(log n) membership and consistency proofs; the older Schneier–Kelsey line uses evolving MAC keys (hash chains + key erasure) so entries written before a host compromise cannot be silently forged afterward (forward integrity).

*relevance:* Design choice: use a Merkle/history-tree structure, not a naive hash chain, for per-run execution records; forward-secure keying matters specifically because the logging process may share a host with semi-trusted model-generated code — pre-compromise records must stay provable.

*urls:* https://www.usenix.org/conference/usenixsecurity09/technical-sessions/presentation/efficient-data-structures-tamper-evident | http://tamperevident.cs.rice.edu/Logging.html | https://www.semanticscholar.org/paper/Cryptographic-Support-for-Secure-Logs-on-Untrusted-Schneier-Kelsey/aa1facd833110693d54240123d1142a02d48720a

### [8] immudb (verifiable database)
immudb (Codenotary) is a mature tamper-evident KV/SQL database (Merkle-tree commit log, client-side verification without trusting the server, SQL verification functions like immudb_verify_row(); 1.11 added built-in immutable audit logging and PostgreSQL compatibility, announced May 2026), but its GitHub LICENSE is now Business Source License 1.1 — not the Apache-2.0 it historically carried.

*relevance:* Closest turnkey 'verifiable execution ledger' but BUSL 1.1 makes it copyleft-cleanroom territory for a commercial legal-tech product: usable as a design reference (client-verified proofs, parallel Merkle tree over a commit log) but risky as a shipped dependency without a commercial license review.

*urls:* https://github.com/codenotary/immudb | https://www.businesswire.com/news/home/20260505298955/en/Open-Source-Tamper-Proof-Database-Adds-Immutable-Audit-Logging-and-Expands-PostgreSQL-Compatibility | https://immudb.io/

### [9] Managed ledger DB risk (QLDB retirement)
AWS retired Amazon QLDB with end of support on July 31, 2025, recommending migration to Aurora PostgreSQL — a path that community and Microsoft migration write-ups note loses cryptographic verifiability entirely (pgAudit/activity streams replace the journal but provide no proofs).

*relevance:* Cautionary precedent: do not couple the sandbox's tamper-evidence guarantees to a proprietary managed ledger service. Own the verifiable structure via open specs (RFC 9162 / tlog-tiles) over commodity storage so the guarantee survives any vendor's product decisions.

*urls:* https://www.infoq.com/news/2024/07/aws-kill-qldb | https://techcommunity.microsoft.com/blog/azuresqlblog/moving-from-amazon-quantum-ledger-database-qldb-to-ledger-in-azure-sql/4246237

### [10] Digest-anchoring pattern (Azure SQL ledger)
SQL Server 2022+/Azure SQL 'ledger' hashes each transaction's rows into a Merkle root, chains blocks by hashing each block root with the previous block's root, and periodically exports the resulting 'database digest' to external tamper-proof storage (immutable blob storage, Azure Confidential Ledger, or WORM devices); the docs explicitly state ledger cannot prevent a storage-level admin from tampering — it only guarantees detection when verification recomputes hashes against the externally stored digests.

*relevance:* The most directly portable pattern for beep: keep execution records in Postgres, build the Merkle/block structure in application code, and anchor periodic checkpoint digests to S3 Object Lock — tamper-evidence against insiders without new database infrastructure, with the honest 'detect, not prevent' threat model stated up front.

*urls:* https://learn.microsoft.com/en-us/sql/relational-databases/security/ledger/ledger-overview

### [11] WORM retention (S3 Object Lock)
S3 Object Lock provides WORM per object version (requires versioning): compliance mode is undeletable by any principal including account root (only deleting the AWS account removes it) and retention can be extended but never shortened; governance mode is bypassable only with s3:BypassGovernanceRetention plus an explicit header; legal hold is an indefinite, independently-toggled lock with no expiry; the feature is Cohasset-assessed for SEC 17a-4, CFTC, and FINRA environments.

*relevance:* Ready-made storage substrate for checkpoint digests and sealed execution-record archives; its governance/compliance/legal-hold trichotomy maps cleanly to the packet's grant vocabulary (policy revision, expiry, escalation): governance = operationally overridable with a named permission, compliance = matter-closure retention, legal hold = litigation preservation flag.

*urls:* https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html

### [12] Redactable signatures
Redactable signature schemes (Merkle-tree constructions per Johnson et al.; policy-based RSS, IACR ePrint 2022/1485) let a third party remove designated message parts while the remaining signature still verifies, with audit-log redaction a named application; but the area remains largely academic — implementations are scattered research libraries (e.g. Romern/redactionschemes in Go, license unverified) with no production-grade standard.

*relevance:* The theoretically clean answer to disclosing execution records with secrets removed while integrity still verifies — but too immature to depend on. Use as a design reference; the pragmatic substitute is hash-commitment of each field plus storage-class separation, which yields Merkle-style redaction for free (reveal a subset, prove against root).

*urls:* https://eprint.iacr.org/2022/1485.pdf | https://yaogroup.cs.vt.edu/papers/asiaccs08.pdf | https://github.com/Romern/redactionschemes

### [13] Crypto-shredding
Crypto-shredding is an established event-sourcing/Kafka pattern: encrypt each principal's or record's sensitive fields under a dedicated DEK (envelope encryption); destroying the key renders the ciphertext indistinguishable from random while row counts, hashes, join structure, and timestamps stay intact — satisfying GDPR Art. 17 erasure over immutable logs and backups without touching the log structure.

*relevance:* Resolves the packet's redaction-vs-immutability tension: the tamper-evident class stores hashes and typed outcomes forever; secret-bearing payloads live in an encrypted class keyed per matter/principal; 'deletion' is key destruction, which is itself a loggable, attributable event — and legal hold must suspend key destruction, not just retention expiry.

*urls:* https://www.conduktor.io/glossary/crypto-shredding-for-kafka | https://event-driven.io/en/gdpr_in_event_driven_architecture/ | https://patchlevel.de/blog/mastering-sensitive-data-handling-and-gdpr-compliant-secure-data-removal-with-event-sourcing

### [14] PII-in-log lesson (Sigstore privacy)
Sigstore's own privacy write-up concedes that putting identity (email SANs from Fulcio certs) into a public append-only log is permanent and problematic — a signer comfortable with disclosure today cannot retract it later — illustrating that anything placed in the tamper-evident class is effectively unerasable.

*relevance:* Hard design rule for the ledger's storage classes: the tamper-evident record must contain only hashes, opaque principal/purpose/grant identifiers, and typed outcomes — never raw prompts, tool outputs, client documents, or secrets. Attorney-client material must only ever be committed-to, never embedded.

*urls:* https://blog.sigstore.dev/privacy-in-sigstore-57cac15af0d0/ | https://techgdpr.com/blog/gdpr-right-to-be-forgotten-blockchain/

### [15] SOC 2 obligations for execution logs
SOC 2 Trust Services Criteria mandate no specific retention durations; auditors instead require demonstrable operating effectiveness over the observation period via evidence — access logs, permission-change history, incident records — and Confidentiality criteria C1.1/C1.2 require identifying confidential information and disposing of it securely when no longer needed.

*relevance:* Agent execution records are themselves SOC 2 evidence: typed outcomes (denial, escalation, budget exhaustion, secret-egress attempt) map directly to auditable control operation, and C1.2's secure-disposal requirement is what the crypto-shredding class satisfies — immutability and disposal obligations coexist only via storage-class separation.

*urls:* https://drata.com/learn/soc-2/trust-services-criteria | https://www.konfirmity.com/blog/soc-2-evidence-requirements | https://www.konfirmity.com/blog/soc-2-data-retention-guide

### [16] Legal hold / FRCP 37(e)
Under FRCP 37(e) (2015 amendment, codifying Zubulake), the duty to preserve ESI attaches when litigation is reasonably anticipated — often pre-complaint — requiring suspension of ordinary retention/deletion practices, with sanctions calibrated to intent and prejudice and an adverse-inference risk for intentional deletion under hold.

*relevance:* For a legal-tech product, execution records about a matter are discoverable ESI. The ledger needs a first-class per-matter/per-principal legal-hold flag that (a) suspends retention expiry, (b) freezes crypto-shred key destruction, and (c) is itself an immutable, attributable ledger event — mirroring S3 legal-hold semantics at the application layer.

*urls:* https://www.relativity.com/blog/what-every-e-discovery-professional-should-know-about-frcp-37e/ | https://www.exterro.com/frcp-e-discovery-guide/rule-37e-just-be-reasonable-when-it-comes-to-electronically-stored-information | https://www.wardandsmith.com/article/spoiler-alert-amended-federal-rule-37e-addresses-standards-and-sanctions-for-the-spoliation-of-electronically-stored-information

### [17] Replay protection / idempotency keys
The IETF HTTPAPI working-group draft (draft-ietf-httpapi-idempotency-key-header, at -07; still a draft, not an RFC — recheck status before citing normatively) standardizes client-generated Idempotency-Key semantics: a retry after completion MUST return the original operation's stored result, a concurrent retry MUST get a conflict error, and a key MUST NOT be reused with a different payload.

*relevance:* Every side-effecting tool invocation in the sandbox should carry an idempotency key recorded in the execution ledger: retries deduplicate instead of double-executing, replayed responses are attributable to the original grant/budget, and 'duplicate/replay detected' becomes one of the visible typed outcomes rather than a silent re-run.

*urls:* https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/ | https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07

### [18] TypeScript verification path (sigstore-js)
sigstore-js (Apache-2.0) ships production TypeScript packages for Sigstore workflows — including @sigstore/rekor-types (typed Rekor API) and verification libraries — demonstrating that transparency-log client verification is viable natively in the TS ecosystem without a Go sidecar.

*relevance:* Permissive-port source for the Effect-TS side: Merkle inclusion/consistency verification and checkpoint (signed note) parsing can be ported or depended on directly, so tenants and internal services verify execution-record proofs in-process in the monorepo's native language.

*urls:* https://github.com/sigstore/sigstore-js


## sources

- **RFC 9162: Certificate Transparency Version 2.0** (spec, n/a, n/a) https://www.rfc-editor.org/info/rfc9162/
  - Canonical Merkle inclusion/consistency proof definitions; TransItem leaf structure. IETF experimental-track successor to RFC 6962.

- **How CT Works (certificate.transparency.dev)** (docs, n/a, n/a) https://certificate.transparency.dev/howctworks/
  - Primary-source statement that transparency makes misissuance detectable, not preventable; roles: logs, monitors, user agents.

- **Tessera** (repo, Apache-2.0, permissive-port) https://github.com/transparency-dev/tessera
  - Verified via repo page. Go library, tlog-tiles native, GA/stable APIs; GCP/AWS/POSIX drivers; recommended successor to Trillian. Embedding in TS monorepo = sidecar service or spec reimplementation.

- **Trillian** (repo, Apache-2.0, permissive-port) https://github.com/google/trillian
  - Verified via repo page. Production-proven verifiable log but explicitly in maintenance mode; use as design reference only.

- **sigstore/rekor-tiles (Rekor v2)** (repo, Apache-2.0, permissive-port) https://github.com/sigstore/rekor-tiles
  - Verified via repo page. Tile-backed signature transparency log; annual frozen shards; public instance with 99.5% SLO; SigningConfig rollout planned end-2025/early-2026 (staleness: recheck current status).

- **Rekor v2 GA announcement** (post, n/a, n/a) https://blog.sigstore.dev/rekor-v2-ga/
  - GA claims: cheaper static-tile serving, integrated witnessing, shard-and-freeze lifecycle.

- **C2SP spec family (tlog-tiles, tlog-checkpoint, tlog-witness, signed-note)** (spec, CC-BY-4.0, n/a) https://github.com/C2SP/C2SP
  - Specs CC BY 4.0; repo code/data BSD 1-Clause. tlog-tiles fetched at https://github.com/C2SP/C2SP/blob/main/tlog-tiles.md (c2sp.org redirects there): 256-hash 8KiB tiles, Ed25519-signed checkpoint, static-asset serving. Clean basis for a TS implementation.

- **transparency-dev/witness (omniwitness)** (repo, Apache-2.0, permissive-port) https://github.com/transparency-dev/witness
  - Verified via repo page. Verifies append-only evolution and cosigns checkpoints; tlog-witness spec compliant; runs on Armored Witness hardware; omniwitness preconfigured for known logs.

- **Crosby & Wallach, Efficient Data Structures for Tamper-Evident Logging (USENIX Sec 2009)** (paper, n/a, n/a) https://www.usenix.org/conference/usenixsecurity09/technical-sessions/presentation/efficient-data-structures-tamper-evident
  - History tree: O(log n) membership + consistency proofs; ~3KB proof vs ~800MB hash-chain trace at 80M entries. Companion project page: http://tamperevident.cs.rice.edu/Logging.html

- **Schneier & Kelsey, Cryptographic Support for Secure Logs on Untrusted Machines** (paper, n/a, n/a) https://www.semanticscholar.org/paper/Cryptographic-Support-for-Secure-Logs-on-Untrusted-Schneier-Kelsey/aa1facd833110693d54240123d1142a02d48720a
  - Foundational forward-secure audit logging: evolving MAC keys + hash chain + key erasure; protects pre-compromise entries. Seen in search results; full PDF not fetched.

- **immudb** (repo, BUSL-1.1, copyleft-cleanroom) https://github.com/codenotary/immudb
  - Repo LICENSE reported as Business Source License 1.1 (historically Apache-2.0 — relicense; verify effective date and Additional Use Grant before any dependency decision). Mature: client-verified Merkle proofs, SQL verify functions, 1.11 built-in audit logging (May 2026).

- **InfoQ: AWS to kill QLDB** (post, n/a, n/a) https://www.infoq.com/news/2024/07/aws-kill-qldb
  - QLDB end of support July 31, 2025; Aurora PostgreSQL migration path loses cryptographic verifiability. Corroborated by Microsoft migration blog.

- **Microsoft: Moving from Amazon QLDB to ledger in Azure SQL** (post, n/a, n/a) https://techcommunity.microsoft.com/blog/azuresqlblog/moving-from-amazon-quantum-ledger-database-qldb-to-ledger-in-azure-sql/4246237
  - Vendor migration pitch; useful for the verifiability-loss framing of AWS's recommended path.

- **Azure SQL / SQL Server Ledger overview** (docs, n/a, n/a) https://learn.microsoft.com/en-us/sql/relational-databases/security/ledger/ledger-overview
  - Per-transaction Merkle roots chained into blocks; digests exported to immutable blob/Confidential Ledger/WORM; explicit detect-not-prevent threat model vs privileged admins; updatable vs append-only ledger tables.

- **Amazon S3 Object Lock user guide** (docs, n/a, n/a) https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html
  - Compliance vs governance modes, legal hold semantics, retention extend-only, versioning requirement, Cohasset SEC 17a-4/CFTC/FINRA assessment.

- **Kissel, Policy-Based Redactable Signatures (IACR ePrint 2022/1485)** (paper, n/a, n/a) https://eprint.iacr.org/2022/1485.pdf
  - Recent RSS line; with Merkle-tree RSS constructions (https://yaogroup.cs.vt.edu/papers/asiaccs08.pdf) shows the area is real but academic — no production-grade standard.

- **Romern/redactionschemes** (repo, unverified, reference-only) https://github.com/Romern/redactionschemes
  - Go library for redactable signatures seen in search results; license not fetched — treat as reference-only research code.

- **Conduktor: Crypto Shredding for Kafka** (post, n/a, n/a) https://www.conduktor.io/glossary/crypto-shredding-for-kafka
  - Per-user DEK envelope-encryption pattern; key destruction = erasure over immutable topics and backups. Corroborated by https://event-driven.io/en/gdpr_in_event_driven_architecture/ and patchlevel.de.

- **Privacy in Sigstore (Sigstore blog)** (post, n/a, n/a) https://blog.sigstore.dev/privacy-in-sigstore-57cac15af0d0/
  - First-party acknowledgment that identity data in a public append-only log is permanent and consent is not retractable — the PII-in-log lesson for storage-class design.

- **Drata: SOC 2 Trust Services Criteria** (post, n/a, n/a) https://drata.com/learn/soc-2/trust-services-criteria
  - Secondary source (vendor). TSC overview incl. C1.1/C1.2 confidentiality identification and secure disposal; no mandated retention durations (corroborated by konfirmity.com guides). AICPA TSC document itself is paywalled/not fetched — note as gap.

- **Relativity: What eDiscovery professionals should know about FRCP 37(e)** (post, n/a, n/a) https://www.relativity.com/blog/what-every-e-discovery-professional-should-know-about-frcp-37e/
  - Secondary legal commentary on FRCP 37(e): trigger on reasonable anticipation, reasonable-steps standard, intent-calibrated sanctions. Corroborated by exterro.com and wardandsmith.com. Rule text itself not fetched from uscourts.gov — verify exact language before citing in legal prose.

- **IETF draft-ietf-httpapi-idempotency-key-header** (spec, n/a, n/a) https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/
  - WG draft at -07; NOT an RFC — semantics (replay returns stored result, concurrent retry conflicts, no key reuse across payloads) are stable but recheck status before normative citation.

- **sigstore-js** (repo, Apache-2.0, permissive-port) https://github.com/sigstore/sigstore-js
  - Verified via repo page. TypeScript monorepo: sigstore client, @sigstore/rekor-types, sign/verify/bundle/tuf packages — TS-native path for transparency proof verification.

- **Sigstore Rekor logging overview** (docs, n/a, n/a) https://docs.sigstore.dev/logging/overview/
  - Official framing of Rekor guarantees as structural (append-only, immutable, inclusion-provable) with no claim of content trustworthiness.
