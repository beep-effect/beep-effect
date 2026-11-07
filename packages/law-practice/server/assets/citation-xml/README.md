# Pinned annotation XML query

This kernel adapts eyecite 2.7.6 `utils.is_balanced_html` using unchanged libxml2
2.12.3. It consumes explicit source points and Unicode storage width, preserving
the original no-angle fast path and lxml's width-dependent surrogate treatment.
It returns only a complete boolean or closed ABI refusal. It is not a standalone
XML service or a production worker implementation.

Runtime/library attribution, complete licenses, the original converter source
and complete relinking archives are distributed alongside it in
`../citation-html/`. See the repository `THIRD_PARTY_NOTICES.md`. The XML wrapper
source is `kernel.c`. No modified upstream library is incorporated.

From the repository root, rebuild with an existing WASI SDK 34:

```sh
python goals/citation-extraction-engine/ops/build-annotation-xml.py \
  --sdk /path/to/wasi-sdk-34.0-x86_64-linux \
  --output-directory /tmp/citation-xml-build
```

The script authenticates `../citation-html/kernel-relink.tar.xz` against its
shipped build receipt, compiles only this wrapper and links the complete archived
libraries. It checks SDK version and records the compiler digest. No parser
library rebuild or package install is required. The resulting binary is bounded
to 512 MiB of unshared memory. The production host authenticates the entire
binary before loading it through the shared closed WASI implementation.

To relink with a modified GNU libiconv static archive, add
`--replacement-iconv /path/to/libiconv.a`. The receipt records that replacement.
No signing key is required. A modified application can update its asset hash
check. The original complete libiconv 1.17 source and license accompany the
existing HTML relink material.

The shared markup worker now supplies typed XML transport, captured annotation
deadlines and physical retirement. This asset alone supplies none of that
ownership and does not implement full annotation skip/wrap behavior.
