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
Run on 2026-10-06 after the extraction finished, on the non-display card
only, guard script green before each step.

| Step | Result |
| --- | --- |
| PyTorch enumeration (no device pin) | `torch.cuda.is_available()` true, 2 devices, each 31.9 GiB |
| 2048x2048 half-precision matmul, `HIP_VISIBLE_DEVICES=1` | ok in 0.2 s, 116 MiB allocated; the free card's VRAM counter moved, the display card's did not |
| `llama-server` (HIP build) with a vision GGUF and its projector | loads in 1.0 s, serves `/v1/chat/completions` with an image; 58 pages read, no errors |
| PyTorch + `transformers` vision model | not run |

So both paths work on one card: ROCm PyTorch sees and can use the cards, and
the HIP llama.cpp build serves a vision model.

**Heat is the open problem.** A 0.9B OCR model reading one page every four
seconds drove the junction temperature from 50 C to a peak of 94 C; 17 of 58
samples were at or above 90 C. The fan peaked at 2,339 rpm against a reported
maximum of 5,100 rpm. Limits on this card: thermal watchdog 100 C, driver
critical 110 C, driver emergency 115 C. Nothing tripped and the kernel logged
no new GPU errors, but the run crossed the 90 C stop line set for this work,
and GPU work was stopped there. A fan curve or a power cap (the cap reads
300 W) has to be in place before any run longer than a few pages. Both need
root and are the operator's to set.
<!-- /GPU-RESULTS -->
