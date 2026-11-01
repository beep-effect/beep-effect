# Dankserver source delivery review

Astra accepted clean Dankserver HEAD
`470ddf6594762203e4181c06eb621d62cdaa2ed4` for bounded content-final source
review. It verified all 25 hashes and nine artifacts in
`../ops/dankserver-current-verification.json`. The delta from the prior
three-model panel snapshot `d319f846` contains only the sustained-pause
alert and three timing cases, preserving the other health scenarios.

The alert remains opt-in and requires 15 continuous minutes paused. It calls
for owner inspection and explicit resumption, preserving intentional holds.
Short and resumed pauses remain quiet. Current installed proof independently
scraped the worker and delivered its stopped-worker alert using the current
probe and rules; the sustained-pause condition is qualified separately by
Prometheus test scenarios.

Seven of nine collector migration receipt source hashes match current source.
The two changed files are the reviewed alert and test files; their previous
bytes match the prior panel snapshot and migration receipt. Default legacy
4318 routing, loopback-only exposure and explicit metadata selection remain.
The pinned legacy-to-metadata-to-legacy test preserves the synthetic queue
files on reversal. This is not arbitrary production backlog recovery or
older-collector compatibility proof.

Reviewed hashes:
- Alert template: `adc0e9b1113c4a0ae3798b504fefa30d283324f0d21f9f107e94111c1a6952ab`
- Health tests: `6b59d29dfec307a408d4e84be777676e804b6b518b52e92a29137eadc17c98f2`
- Probe: `0d00370d3e510cd9a18e8ad2b80422c5b2d82e30f8cc941f785dd9a66044ff6b`
- Collector: `20bce80b8a5dd72030facdb46e60822720fd1bff57f94c1bb38bbff708658526`
- Compose: `a251dd71ecf0d77650eff8a56e4c121f7fdbd43596e72b9f91997d0c3f9d5b3c`

No source defect remains from this bounded review. PR3 has no hosted test
job; a skipped review bot is not proof. Live enrollment, production transport,
human notifications and deployment remain separate, unqualified boundaries.
The historical recovery hold is preserved.
