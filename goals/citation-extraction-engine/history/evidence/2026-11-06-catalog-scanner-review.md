# Production catalog source-digest scanner review

PR #2737 Check run 42262373886, Secret Scanning job 128045511113,
reports one finding. Reproduction using main's scanner configuration finds
only generic-api-key in parser-catalog.data, introduced by 940fd92d62.
The matched value is the public canonical-tokenizer.json source SHA-256:
7f624597ee68176326cd8252a9858acd48faa7be27f1dc3e986119140a4080f3.
It authenticates public Free Law Project eyecite data, not a credential.
The citation exporter independently recomputes this source digest.

The hosted scanner deliberately reads configuration from the PR base. The
exception already proposed in #2737 therefore cannot approve itself. This
separate main-based change publishes only those exact exceptions and this
receipt. It contains no parser asset, runtime code or workflow change.
After independent review and merge, #2737 must merge main and rerun the gate.
No protected base-policy mechanism is bypassed.

The allowlist requires all of the exact file path, exact digest and
specific generic-api-key detector. Gitleaks controls demonstrate:

- Main's configuration detects the original public digest at the target path.
- The proposed configuration exempts that exact occurrence.
- The same digest at another path remains detected under both configurations.
- A changed digest at the target path remains detected under both.
- The complete citation PR commit range has exactly one baseline finding and
  zero findings with the candidate configuration. Scans use redacted reports.

The source projection verifier also passes, confirming 6,805 extractors,
2,533 editions, 2,430 reporter payloads and byte-identical production data.
This is local scanner/source proof; hosted confirmation remains pending.

Cache audit on base e66013fb6c reports existing repo-cli test/test:property
configuration drift. This scanner-only change does not modify those inputs;
no cache baseline or quality threshold is updated.

The subsequent helper-configurations.data production projection also matches
generic-api-key for its exact public reference-token.json source SHA-256.
The complete digest appears verbatim in the corresponding policy rule.
The helper exporter independently authenticates that source before projection.
This amendment includes its own exact digest/path/detector exception. The same
baseline/candidate, changed-value and other-path controls pass. No runtime asset
is included in this policy PR. Both source digests remain available verbatim.
