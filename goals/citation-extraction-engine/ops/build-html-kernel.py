#!/usr/bin/env python3
"""Rebuild the private HTML WASM asset from verified local source/SDK archives."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile

SOURCE_SHA = '8c8f1092340a89ff32bc44ad5c9693aff9bc8a7a3e161bb239666e5d15ac9aaa'
SDK_SHA = 'b761e3a0721dbae9c09a0059e5fdb2bf917d1b4a8a7b430fb3b5aafb0984b2c4'
EXPORTS = ['html_clean', 'html_output', 'html_output_length', 'html_output_units', 'html_release', 'html_version', 'malloc', 'free']
FEATURES = {'C14N': True, 'CATALOG': False, 'DEBUG': True, 'FTP': False, 'HTML': True, 'HTTP': False, 'ICONV': True, 'ICU': False, 'ISO8859X': True, 'LEGACY': False, 'LZMA': False, 'MEM_DEBUG': False, 'MODULES': False, 'OUTPUT': True, 'PATTERN': True, 'PROGRAMS': False, 'PUSH': True, 'PYTHON': False, 'READER': True, 'REGEXPS': True, 'SAX1': True, 'SCHEMAS': True, 'SCHEMATRON': True, 'TESTS': False, 'THREADS': False, 'THREAD_ALLOC': False, 'TLS': False, 'TREE': True, 'VALID': True, 'WRITER': True, 'XINCLUDE': True, 'XPATH': True, 'XPTR': True, 'XPTR_LOCS': False, 'ZLIB': False}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-archive', type=Path, required=True)
    parser.add_argument('--sdk-archive', type=Path, required=True)
    parser.add_argument('--work-root', type=Path, required=True)
    parser.add_argument('--output-directory', type=Path, required=True)
    args = parser.parse_args()
    assert digest(args.source_archive) == SOURCE_SHA
    assert digest(args.sdk_archive) == SDK_SHA
    args.work_root.mkdir(parents=True, exist_ok=True)
    args.output_directory.mkdir(parents=True, exist_ok=True)
    repo = Path(__file__).resolve().parents[3]
    kernel = repo / 'packages/law-practice/server/assets/citation-html/kernel.c'
    ninja = shutil.which('ninja')
    assert ninja, 'Ninja must already be installed'
    with tempfile.TemporaryDirectory(prefix='html-kernel-', dir=args.work_root) as temp:
        work = Path(temp).resolve()
        for archive in [args.source_archive, args.sdk_archive]:
            with tarfile.open(archive) as source:
                source.extractall(work, filter='data')
        sdk = work / 'wasi-sdk-34.0-x86_64-linux'
        source = work / 'libxml2-2.12.3'
        build = work / 'build'
        local_kernel = work / 'kernel.c'
        shutil.copyfile(kernel, local_kernel)
        prefix = f'-ffile-prefix-map={work}=/citation-build'
        configure = ['cmake', '-S', str(source), '-B', str(build), '-G', 'Ninja', '-DCMAKE_MAKE_PROGRAM=' + ninja, '-DCMAKE_TOOLCHAIN_FILE=' + str(sdk / 'share/cmake/wasi-sdk-p1.cmake'), '-DCMAKE_BUILD_TYPE=Release', '-DBUILD_SHARED_LIBS=OFF', '-DCMAKE_C_FLAGS=' + prefix, '-DIconv_IS_BUILT_IN=TRUE', '-DIconv_INCLUDE_DIR=' + str(sdk / 'share/wasi-sysroot/include/wasm32-wasip1')]
        configure.extend('-DLIBXML2_WITH_' + name + '=' + ('ON' if enabled else 'OFF') for name, enabled in FEATURES.items())
        subprocess.run(configure, check=True)
        subprocess.run(['cmake', '--build', str(build), '-j2'], check=True)
        output = work / 'kernel.wasm'
        link = [str(sdk / 'bin/clang'), '--target=wasm32-wasip1', '--no-wasm-opt', '-O2', '-mexec-model=reactor', prefix, '-I' + str(source / 'include'), '-I' + str(build), str(local_kernel), str(build / 'libxml2.a')]
        link.extend('-Wl,--export=' + name for name in EXPORTS)
        link.extend(['-Wl,--max-memory=536870912', '-Wl,-Map,' + str(work / 'kernel.map'), '-o', str(output)])
        subprocess.run(link, check=True)
        raw = output.read_bytes()
        assert b'/home/' not in raw and str(work).encode() not in raw
        (args.output_directory / 'kernel.wasm').write_bytes(raw)
        (args.output_directory / 'kernel.map').write_text((work / 'kernel.map').read_text().replace(str(work), '/citation-build'))
        receipt = {'schemaVersion': 'citation-html-kernel-build/v1', 'sourceArchive': {'name': 'libxml2-2.12.3.tar.xz', 'sha256': SOURCE_SHA}, 'sdkArchive': {'name': 'wasi-sdk-34.0-x86_64-linux.tar.gz', 'sha256': SDK_SHA}, 'sdkVersion': (sdk / 'VERSION').read_text().strip(), 'features': FEATURES, 'kernelSourceSha256': digest(kernel), 'producerSha256': digest(Path(__file__)), 'target': 'wasm32-wasip1', 'libraryOptimization': 'Release', 'kernelOptimization': '-O2 --no-wasm-opt', 'canonicalBuildPrefix': '/citation-build', 'memoryMaximumBytes': 536870912, 'exports': EXPORTS, 'wasmSha256': hashlib.sha256(raw).hexdigest(), 'wasmBytes': len(raw)}
        (args.output_directory / 'build-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
        print('Built pinned private HTML kernel:', receipt['wasmSha256'], len(raw), 'bytes')


if __name__ == '__main__':
    main()
