# Inspection recipes

All read-only. `exiftool` 13.x, `ffprobe` from system ffmpeg.

## Images (PNG / JPEG / GIF)

```sh
# Everything, grouped by family (EXIF vs XMP vs PNG text chunks):
exiftool -G1 -a <file>

# Just our namespace (works without -config for reading; add
# -config resources/beepqa.ExifTool_config for canonical group names):
exiftool -G1 -a '-XMP-beepQA:*' <file>

# JSON for scripting (note: custom tag names come back Capitalized):
exiftool -j -G1 <file> | jq '.[0] | with_entries(select(.key | startswith("XMP-beepQA")))'

# Raw XMP packet as XML (see the RDF for yourself):
exiftool -b -XMP <file> | xmllint --format -

# Diff provenance across a strip:
exiftool -j -G1 frames/*.png | jq 'map({f: .["System:FileName"], t: .["XMP-beepQA:CapturedAtEpochMs"]})'
```

## Videos (webm / mkv / mp4)

```sh
# Container tags:
ffprobe -v error -show_entries format_tags -of json <file>

# Our tags only:
ffprobe -v error -show_entries format_tags -of json <file> | jq '.format.tags | with_entries(select(.key | startswith("BEEP_QA")))'

# Stream timing facts extraction depends on (r_frame_rate, start_time):
ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate,start_time,duration -of json <file>

# exiftool also READS Matroska (never writes):
exiftool -G1 -a <file.webm>
```

## Round-trip verification (after pipeline changes)

```sh
# 1. Any extracted frame must decode cleanly:
exiftool -j -G1 frames/<any>.png   # → feed to BeepQaProvenance decode in a test
# 2. Video must carry the same sessionId as its frames:
ffprobe -v error -show_entries format_tags=BEEP_QA_SESSION_ID -of default=nw=1 video/capture.*.mp4
# 3. GIF spot check (XMP survives the GIF89a application extension):
exiftool -G1 -a '-XMP-beepQA:*' clips/<any>.gif
```

Missing tags? Check step ORDER first — any ffmpeg re-encode after stamping
drops image XMP (see the primer's survival table).
