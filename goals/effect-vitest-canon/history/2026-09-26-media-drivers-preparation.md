# ExifTool and Face Detection preparation

This wave consumes the existing 61 inventory rows for seven files in
`@beep/exiftool` and `@beep/face-detection`. Five files changed since the frozen
census; current membership remains the same. Source preparation follows D12
and must preserve the real native resource subjects. No source migration is
included in this baseline checkpoint.

ExifTool 13.55 is installed. Its baseline includes real PNG/GIF metadata
roundtrips and video-container refusal in native temporary directories. The
three live cases passed and emitted no log-only skip message. The existing
availability helper can turn a typed version error into a successful log-only
return; that reviewed finding remains pending rather than being hidden by
these successful baseline runs.

The ONNX installer test exercises the installed script with mocked HTTPS
responses and real temporary files, symlinks and ZIP bytes. The reviewed
`installPackages` path does not invoke the child-process branch, download a
model or perform GPU inference. Native filesystem/rename behavior is the
subject and must remain native.

All four baseline runs passed with stable source hashes. Public raw reports
and runtime/load/pressure context are under the `media-drivers` baseline
timing directories. These samples do not establish a performance improvement.

- exiftool node: 17 passed, 0 skipped; 4.653 seconds
- exiftool bun: 17 passed, 0 skipped; 2.423 seconds
- face-detection node: 14 passed, 0 skipped; 4.471 seconds
- face-detection bun: 14 passed, 0 skipped; 2.612 seconds
