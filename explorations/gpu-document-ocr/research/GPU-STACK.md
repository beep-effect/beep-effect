# GPU stack: what is installed, and the safety gates

2026-10-06, one workstation. Home paths are written as `~`. Everything in the
"installed" section was read from package metadata and build caches without
initializing a GPU. The "proven on the cards" section is filled only by a run
that actually happened.

## Hardware and OS

- 2x AMD Radeon AI PRO R9700 (PCI device `0x7551`), 32 GB each
  (`mem_info_vram_total` 34,208,743,424 bytes per card).
- `card0` = PCI `23:00.0`, `boot_vga=0`: the free card. `card1` = PCI
  `c3:00.0`, `boot_vga=1`: drives the displays (about 3 GB of VRAM in use by
  the desktop).
- Kernel `7.2.9-1-cachyos`, Mesa / `vulkan-radeon` 26.2.4.
- At rest: card0 junction 36 C, 0% busy, 82 MB VRAM in use.

## Installed (static inventory)

| Component | Version | How it was read |
| --- | --- | --- |
| ROCm | 7.2.4 (`rocm-core`, `hip-runtime-amd`, `rocm-hip-sdk`, `miopen-hip`) | `pacman -Q`, `/opt/rocm/.info/version` |
| PyTorch | `2.15.0.dev20260827+rocm7.2` (HIP 7.2.53211), `torchvision 0.30.0.dev20260831+rocm7.2`, `transformers 5.18.0`, `accelerate 1.15.0`, `onnxruntime-gpu 1.29.0` | `torch/version.py` and dist-info in the image-generation app's virtualenv. It is the only ROCm PyTorch on the box; a second, CPU-only torch exists in a trainer cache. |
| llama.cpp | `0.5.0-dev`, build 1771, commit `926862e57`, built 2026-10-02 | `llama-server --version` |
| llama.cpp backend | `GGML_HIP=ON`, `GGML_VULKAN=OFF`, `GGML_HIP_RCCL=OFF`, Release | `CMakeCache.txt` of the current build directory |
| llama.cpp multimodal | `libmtmd.so.0.5.0` present; `llama-server` has `--mmproj`, `--image-min-tokens`, `--image-max-tokens` | build `bin/`, `llama-server --help` |
| Tesseract | 5.5.3, languages `eng`, `afr`, `osd` | `pacman -Q`, `tesseract --list-langs` |
| Tika | `tika-app-3.3.1.jar` | file name |
| Poppler | 26.08.0 (`pdftoppm`, `pdftotext`, `pdfimages`, `pdfseparate`) | `pacman -Q` |

Two corrections to the June notes this work started from:

1. **The llama.cpp build is ROCm/HIP, not Vulkan.** The Vulkan build
   directory is gone; five `build-rocm-*` directories exist and the current
   one has `GGML_VULKAN=OFF`. "The Vulkan server already works here" is no
   longer a statement about this machine.
2. **No vision-capable GGUF was on disk.** The chat models under the model
   directory have no `mmproj` file. Vision weights were downloaded for this
   work (see `SOURCES.md`).

## Safety gates

The brief listed three gates that must hold before any GPU load:

| Gate | State | Evidence |
| --- | --- | --- |
| `gpu-thermal-watchdog.service` active | present | `systemctl is-active` = `active`, running since boot |
| udev rule `30-amdgpu-d0-pin.rules` | present | in `/etc/udev/rules.d/`; pins device `0x7551` to D0 (`power/control=on`) |
| `iommu=pt` in `/proc/cmdline` | **absent** | see below |

Evidence for the third:

- `/proc/cmdline` ends with `iommu.passthrough=0 iommu.strict=1`. That is the
  opposite of `iommu=pt`.
- Kernel log: `iommu: Default domain type: Translated (set via kernel command
  line)` and `iommu: DMA domain TLB invalidation policy: strict mode (set via
  kernel command line)`.
- `/sys/kernel/iommu_groups/*/type`: 52 groups `DMA`, 2 `identity`.
- `/etc/default/limine` still has `iommu=pt` in its default kernel line, but a
  per-kernel drop-in, `/etc/limine-entry-tool.d/91-main-cachyos-protected-dma.conf`
  (dated 2026-09-16, comment "Preserve explicit DMA translation for main
  linux-cachyos"), sets the full command line for this kernel with
  `iommu.passthrough=0 iommu.strict=1`. A sibling drop-in does the same for
  the LTS kernel. The drop-in wins by design, so the two files do not
  conflict.
- Shell history shows the operator ran a script on 2026-09-22 that re-enabled
  that drop-in and regenerated the boot entries. That is the day a network
  card fault (bulk-transfer corruption, AMD-Vi `IO_PAGE_FAULT` lines) was
  diagnosed. Translated DMA is what contains that fault.
- A backup of the boot defaults named `...bak-pre-p2p` has no iommu flag:
  `iommu=pt` was added for GPU-to-GPU peer-to-peer transfers. The local
  tensor-parallel notes list it as a multi-GPU prerequisite. The GPU safety
  checklist does not mention iommu.

### Gate re-scoped (2026-10-06)

Ruling by the orchestrator session, on the evidence above: `iommu=pt` is a
prerequisite for two-card peer-to-peer work (RCCL, tensor parallel), not a
thermal or power safeguard, and the operator deliberately replaced it with
translated, strict DMA on 2026-09-22. The gate therefore applies only to
two-card P2P work. The boot entry is not to be changed back.

Single-card runs are allowed when all of these hold:

1. the long corpus extraction is not running (it cannot resume after a crash);
2. one card only, the non-display card, no P2P, no RCCL, one model loaded at a
   time;
3. watchdog active and D0-pin rule present, re-checked right before the run;
4. every run under 10 minutes, temperatures sampled throughout, stop at 90 C
   junction or on any new `amdgpu` / `AMD-Vi` kernel error;
5. the first run is a trivial tensor operation or a single page.

Reverse it by restoring the three-gate rule in the brief. The June note that
lists `iommu=pt` beside the thermal gates should be corrected at its source.

### Device index trap

`rocm-smi` and HIP order the two cards in opposite ways on this box: the free
card is `GPU[0]` in `rocm-smi` and device `1` for `HIP_VISIBLE_DEVICES`. Pin
by watching which PCI device's `mem_info_vram_used` moves, never by index.

## Proven on the cards

<!-- GPU-RESULTS -->
Runs of 2026-10-06 after the extraction finished, non-display card only,
launched through the heavy-work queue, no root, no sysfs writes.

| Step | Result |
| --- | --- |
| PyTorch enumeration (no device pin) | `torch.cuda.is_available()` true, 2 devices, each 31.9 GiB |
| 2048x2048 half-precision matmul, `HIP_VISIBLE_DEVICES=1` | ok in 0.2 s, 116 MiB; the free card's VRAM counter moved, the display card's did not |
| `llama-server` (HIP build), 0.9B vision GGUF + projector | loads in 1.0 s; pages read across six runs with no request errors |
| `llama-server` (HIP build), 3B vision GGUF + projector | loads in 1.5 s; 42 s per page; killed on temperature |
| PyTorch + `transformers`, 0.9B vision model | loads in 6 s; generates at 3.6 tokens per second |

Both paths work on one card. No run produced a new kernel `amdgpu` or
`AMD-Vi` error, and the thermal watchdog never fired.

### Temperature

Operator decision relayed by the orchestrator session on 2026-10-06: run at
stock settings (no power cap, no fan change), with a kill line at 98 C
junction or 100 C memory enforced by a 1 Hz background sampler. This replaced
the earlier 90 C between-page check, which had let a run reach 94 C.

History of this card under sustained load, from the workstation's own notes
(not measured here):

| Date | Load | Junction | Memory | Fan | Source |
| --- | --- | --- | --- | --- | --- |
| 2026-08-30 | image model, about 10 min | 96 C | 92 C | 65% | `~/ai/docs/howto/comfy/comfyui-rdna4.md` |
| 2026-09-27 | video jobs, 12 min each | 97 C on every run | 92 C | not recorded | `~/ai/docs/research/env-room-2026-09-27/l2-motion.md` |
| 2026-09-29 to 09-30 | sustained | 299 watchdog trips at 100 to 103 C | n/a | n/a | watchdog journal, per `~/ai/docs/reference/gpu-fan-investigation-2026-10-06.md` |

That investigation concluded the fan is under firmware control and working
as designed: it responds to load, stops well short of its reported 5,100 rpm
maximum, and the card settles at 96 to 97 C at 300 W. Driver limits are 110 C
critical and 115 C emergency (memory 108 / 113 C). The watchdog forces a low
performance level at 100 C. The standing guidance in
`~/ai/docs/howto/workstation/runtime-ops.md` is to keep long GPU jobs
attended.

Traces from this packet's runs (1 Hz, GLM-OCR unless noted):

| Run | Seconds | Junction peak / median | Seconds at >= 90 C / >= 95 C | Memory peak | Edge peak | Fan peak / median | Power peak / mean | Ended |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 90 s trial, continuous | 93 | 95 / 82 C | 23 / 3 | 82 C | 64 C | 3,021 / 2,109 rpm | 302 / 257 W | time budget |
| 58 pages, continuous | 141 | 98 / 90 C | 74 / 44 | 86 C | 67 C | 3,231 / 2,837 rpm | 301 / 259 W | killed at 98 C |
| 200 pages, junction gate only | 73 | 98 / 88 C | 34 / 25 | 86 C | 67 C | 3,010 / 2,780 rpm | 301 / 241 W | killed at 98 C |
| 200 pages, junction and edge gate | 2,136 | 96 / 62 C | 430 / 276 | 84 C | 65 C | 2,145 / 1,357 rpm | 304 / 108 W | complete |
| dots.ocr, 2 pages | 63 | 98 / 95 C | 50 / 35 | 84 C | 64 C | 3,587 / 3,321 rpm | 301 / 267 W | killed at 98 C |
| PaddleOCR-VL, 1 page, stopped by hand | 412 | 91 / 87 C | 5 / 0 | 91 C | 71 C | 3,049 / 2,400 rpm | 320 / 237 W (median) | stopped by hand |

What the traces show:

- **An OCR model saturates the card.** A 0.9B model draws the full 300 W while
  a page is being read. Continuous reading is the same thermal load as the
  video jobs above and lands on the same 95 to 98 C plateau.
- **The plateau is reached in under a minute**: 89 C within 15 s of the first
  page, 94 to 97 C from 45 s on. It does not run away; it flattens. A 98 C
  line sits inside the plateau's own noise, so a continuous run trips it
  within a few minutes every time.
- **The junction sensor is the wrong thing to gate on.** It drops below 80 C
  within a second of idle. The edge sensor follows the heatsink (47 C cold,
  64 to 67 C at the plateau) and is the one a duty cycle has to watch.
- **The fan follows the slow signal.** It rose to about 3,000 rpm over two
  minutes of continuous load and fell back to its idle 1,230 rpm during
  duty-cycle pauses, which is why the pauses are long.
- **Memory temperature climbs slowly and keeps climbing**: 91 C after seven
  minutes at about 237 W in the PyTorch run, with the junction at 88 C. On a
  long continuous run the memory line could be the one that trips.

**Is a sustained pass safe at stock settings?** Under the 98 C line, only with
a duty cycle: the gated 35-minute run stayed at or under 96 C with no kill
and no errors, at a cost of 64% idle time. A continuous pass is not possible
under that line. Whether the line should move to 100 C, or the card be
capped at 210 W, is with the operator; neither was changed here.
<!-- /GPU-RESULTS -->
