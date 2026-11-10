---
"@beep/palantiri": minor
---

Add the `github-headroom` parcel: the `GithubHeadroom.models` input and item schemas, the
`GithubHeadroomSpec` (15-minute bound) with its reducer, the `GithubHeadroomSource` port wired into
`Parcels`, the `github-headroom` parcel id and the `github-ledger` and `github-rate-limit-sample`
parcel sources. A missing or stale ledger is served as `Unknown`, never as headroom.
