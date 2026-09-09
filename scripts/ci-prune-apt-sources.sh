#!/usr/bin/env bash
# Keep only the Ubuntu archive apt sources on a hosted Ubuntu runner.
#
# The ubuntu-24.04 and ubuntu-22.04 images preinstall third-party apt sources
# under /etc/apt/sources.list.d (Google Chrome's google-chrome.sources from the
# Chrome .deb, Microsoft's microsoft-prod.list from packages-microsoft-prod.deb)
# whose indexes fail `apt-get update` for many minutes at a time, so retries do
# not help:
#   E: Failed to fetch https://dl.google.com/linux/chrome-stable/deb/... Hash Sum mismatch
#   E: Failed to fetch https://packages.microsoft.com/ubuntu/24.04/prod/dists/noble/InRelease  403  Forbidden
# Nothing the lanes install comes from those repositories (Playwright ships its
# own Chromium; Tauri needs webkit2gtk and friends from the Ubuntu archive), so
# every .list/.sources file except the Ubuntu archive's ubuntu.sources (which
# points at the image's mirror list) is removed before apt-get update. On
# ubuntu-22.04 the archive lives in /etc/apt/sources.list instead, which this
# script never touches, so the ubuntu.sources exclusion is moot there. The
# listing before and after is printed so the job log records what the image
# shipped.
set -euo pipefail

sources_dir=/etc/apt/sources.list.d

echo "apt sources before pruning:"
ls -l "$sources_dir"
sudo find "$sources_dir" -maxdepth 1 -type f \( -name '*.list' -o -name '*.sources' \) \
  ! -name 'ubuntu.sources' -print -delete
echo "apt sources after pruning:"
ls -l "$sources_dir"
