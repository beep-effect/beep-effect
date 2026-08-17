---
{}
---

No release: full-history CI checkouts in check.yml now use `filter: blob:none`
so lanes stop downloading ~1.4GB of historical pack data per job. The
`secrets` (gitleaks-in-docker) lane keeps a full clone until the blobless
posture is proven green elsewhere.
