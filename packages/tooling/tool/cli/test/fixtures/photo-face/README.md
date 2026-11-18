# Photo-face parity fixtures

`astronaut.png` is scikit-image's NASA photograph of astronaut Eileen Collins.
NASA's image is public domain. Source bytes:
https://raw.githubusercontent.com/scikit-image/scikit-image/v0.25.2/skimage/data/astronaut.png

The upstream description and public-domain attribution are in
https://scikit-image.org/docs/0.25.x/api/skimage.data.html#skimage.data.astronaut.
`astronaut-small.png` is a 384x384 resize made with sharp. No private photographs
are used. These two sizes exercise interpolation while keeping identity fixed;
they do not establish accuracy across identities or demographic groups.

`python-reference.json` records the pinned worker's CPU outputs for both
backends at detection threshold 0.5 and minimum face area 0.5%. It includes
normalized embeddings, boxes, detector scores, DFA confidence, landmarks,
brightness, Laplacian variance, face area, and quality flags. The reference
worker was copied outside the repo and run through its unchanged frozen uv lock.
No Python source or generated ONNX artifacts belong in this fixture directory.

Run the gated parity tests with `BEEP_PHOTO_FACE_PARITY_MODELS` set to a directory
containing the checksum-pinned `det_10g.onnx`, `w600k_r50.onnx`,
`aligner.safetensors`, and `recognizer.safetensors`. The tests compile the graphs
in TypeScript, verify pins before loading, and never download models implicitly.

`adaface-aligner-shapes.json` contains tensor names, dtypes and dimensions from
only the header of the pinned CVLFace DFA checkpoint (SHA-256
`80b6e922e4c76c10d5e24061fe47cd96112d18689bf5ae7e34af52e641c18c4a`).
It contains no trained weights. The model-free ONNX tests allocate synthetic
zero weights and unit normalization scales from these shapes, compile the full
DFA graph and execute it on CPU. The same tests use a 4x4 patch grid, two blocks
and two attention heads to exercise the KP-RPE builder without ViT-Base weights.
The production defaults remain the pinned 14x14 grid and 24-block topology.
CVLFace source attribution and MIT license are retained in the CLI's photo-face
documentation and graph module.
