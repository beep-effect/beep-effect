#!/usr/bin/env python3
"""Build the unchanged pinned DMP header with the private source-point ABI."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile

SOURCE_SHA = 'ec335bbd9780d2182c351b5c486e5c80d8975ea91772eaf02014dfe9e9907a5d'
SDK_SHA = 'b761e3a0721dbae9c09a0059e5fdb2bf917d1b4a8a7b430fb3b5aafb0984b2c4'
EXPORTS = ['citation_diff_version', 'citation_diff_run', 'citation_diff_output',
           'citation_diff_steps', 'citation_diff_release', 'malloc', 'free']


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sdk-archive', required=True, type=Path)
    parser.add_argument('--work-root', required=True, type=Path)
    parser.add_argument('--output-directory', required=True, type=Path)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[3]
    assets = repo / 'packages/law-practice/server/assets/citation-diff'
    source = assets / 'sources/fast_diff_match_patch-2.0.1.tar.gz'
    assert sha(source) == SOURCE_SHA
    assert sha(args.sdk_archive) == SDK_SHA
    args.work_root.mkdir(parents=True, exist_ok=True)
    args.output_directory.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='diff-kernel-', dir=args.work_root) as temporary:
        work = Path(temporary).resolve()
        for archive in [source, args.sdk_archive]:
            with tarfile.open(archive) as bundle:
                bundle.extractall(work, filter='data')
        sdk = work / 'wasi-sdk-34.0-x86_64-linux'
        header = work / 'fast_diff_match_patch-2.0.1/diff-match-patch-cpp-stl/diff_match_patch.h'
        shutil.copyfile(assets / 'kernel.cpp', work / 'kernel.cpp')
        command = [str(sdk / 'bin/clang++'), str(work / 'kernel.cpp'), '-I' + str(header.parent),
                   '--target=wasm32-wasip1', '-mexec-model=reactor', '-std=c++17',
                   '-fwasm-exceptions', '-mllvm', '-wasm-use-legacy-eh=false',
                   '-lunwind', '-O2', '--no-wasm-opt',
                   '-ffile-prefix-map=' + str(work) + '=/citation-diff-build',
                   '-Wl,--max-memory=536870912']
        command.extend('-Wl,--export=' + name for name in EXPORTS)
        output = args.output_directory / 'kernel.wasm'
        subprocess.run(command + ['-o', str(output.resolve())], check=True)
        receipt = {'schemaVersion': 'citation-diff-kernel-build/v1',
                   'sourceArchiveSha256': SOURCE_SHA, 'headerSha256': sha(header),
                   'sdkArchiveSha256': SDK_SHA, 'sdkVersion': (sdk / 'VERSION').read_text().strip(),
                   'kernelSourceSha256': sha(assets / 'kernel.cpp'), 'producerSha256': sha(Path(__file__)),
                   'target': 'wasm32-wasip1', 'optimization': '-O2 --no-wasm-opt',
                   'exceptions': 'WebAssembly exceptions (non-legacy); libc++abi and libunwind',
                   'canonicalBuildPrefix': '/citation-diff-build', 'memoryMaximumBytes': 536870912,
                   'exports': EXPORTS, 'wcharBytes': 4, 'diffTimeout': 0,
                   'checklines': False, 'cleanup': 'No',
                   'wasmBytes': output.stat().st_size, 'wasmSha256': sha(output)}
        (args.output_directory / 'build-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
        print(json.dumps({'wasmSha256': sha(output), 'wasmBytes': output.stat().st_size}))


if __name__ == '__main__':
    main()
