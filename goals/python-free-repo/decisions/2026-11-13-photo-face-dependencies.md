---
title: "Add native CPU inference and bounded ZIP decoding dependencies"
date: 2026-11-13
lane: "t3/python-free-photo-face"
reversal: "Revert the lane catalog, dependency and lockfile changes together."
---

Pin onnxruntime-node 1.31.1 in the root catalog and add it to repo-cli. Reuse catalog sharp and fflate 0.8.3; fflate extracts only the bounded checksum-pinned Buffalo entries from the original verified ZIP. No new model hosting or model artifact is introduced. Python implementation scripts are package-owned implementation hooks rather than generated task aliases; remove those two dead hooks and regenerate the remaining scripts through package-scripts --write.
