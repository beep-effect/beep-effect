# Current runtime qualification baseline review

The repository declares Bun 1.4.4 and the real collector observes its binary
SHA-256 `10702245766b225e70bbf6235fd6b47214fd94b4760d00ffaed8ab0df57ac235`.
The retained physical runtime observation records the complete dependency and
startup-linker identities, with a real wrong-pin refusal and no qualification.
The current baseline still names Bun 1.4.2, so the public fingerprint command
correctly refuses to bind the new runtime to that historical profile.

Record a new baseline through the canonical compare-and-swap command: profile
`local-linux-x64-bun1.4.4`, epoch `qualification-v3`, the same four computation
subjects, and only the root review subject `//`. Require identical effective
configuration, task/cache flags, scope and all carried package reviews. Any
additional changed subject must reject this request for separate review.

This permits observations and proposals under a distinct current tuple. It
qualifies no computation, activates no cache flag, changes no HMAC namespace,
and transfers no older profile or epoch evidence. The existing qualification
ledger remains byte-identical. Current real-computation comparisons, semantic
input controls, portability, concurrency, safe logs and shadow decisions are
still required before promotion through the qualification transition API.

The previous baseline is retained in the private completion evidence bundle.
Reverse through the same reviewed compare-and-swap command using that prior
profile/epoch, after checking that no active current-epoch candidate has been
promoted. Never overwrite a newer baseline or replace the qualification ledger.
