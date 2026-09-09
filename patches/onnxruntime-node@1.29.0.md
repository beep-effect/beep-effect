# ONNX Runtime installer ZIP replacement

`onnxruntime-node@1.29.0` uses `adm-zip@0.6.0` only in its native-library
installer. That dependency is affected by
[GHSA-vwc7-r8mq-g2x9](https://github.com/advisories/GHSA-vwc7-r8mq-g2x9),
which follows pre-existing destination symlinks during extraction. No patched
release is listed as of September 8, 2026.

The root override maps **only this version of ONNX Runtime's** `adm-zip`
dependency to `fflate@0.8.3`. The companion Bun patch changes the installer to
use fflate's byte-only `unzipSync` API. The alias, patch, and lockfile must be
updated together: fflate does not implement adm-zip's API. The lockfile records
the actual fflate package and integrity; vulnerable adm-zip code is removed.
There is no scanner exception for this advisory.

The patched installer selects only manifest entries, downloads into a private
`mkdtemp` directory, and stages each output in a private directory on the
destination filesystem. Renaming the staged file replaces an existing binary
or symlink without following the final symlink. ONNX Runtime and its native
bindings remain at 1.29.0.

The scoped override requires lockfile version 3, supported by the repository's
pinned Bun 1.4.2. The existing OSV scanner can read this lockfile format.

`packages/drivers/face-detection/test/OnnxRuntimeInstall.test.ts` exercises the
installed installer against real ZIPs and filesystem operations with mocked
NuGet responses. It covers installation, replacement, planted extraction and
destination symlinks, unselected archive paths, missing entries, corrupt
archives, and cleanup. Run it through the package's test command.

Remove the override and patch together when an upstream ONNX Runtime release
eliminates the vulnerable extraction path or consumes a patched ZIP dependency.
Check installation behavior and the OSV scan before removing the regression
tests or updating the version asserted there.
