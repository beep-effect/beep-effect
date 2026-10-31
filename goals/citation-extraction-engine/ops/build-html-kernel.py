#!/usr/bin/env python3
"""Rebuild the private HTML WASM asset from verified local source/SDK archives."""
import argparse
import hashlib
import io
import json
import os
import re
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile

SOURCE_SHA = '8c8f1092340a89ff32bc44ad5c9693aff9bc8a7a3e161bb239666e5d15ac9aaa'
SDK_SHA = 'b761e3a0721dbae9c09a0059e5fdb2bf917d1b4a8a7b430fb3b5aafb0984b2c4'
ICONV_SHA = '8f74213b56238c85a50a5329f77e06198771e70dd9a739779f4c02f65d971313'
EXPORTS = ['html_clean', 'html_output', 'html_output_length', 'html_output_units', 'html_release', 'html_version', 'html_iconv_version', 'html_iconv_inventory', 'html_iconv_inventory_length', 'malloc', 'free']
FEATURES = {'C14N': True, 'CATALOG': False, 'DEBUG': True, 'FTP': False, 'HTML': True, 'HTTP': False, 'ICONV': True, 'ICU': False, 'ISO8859X': True, 'LEGACY': False, 'LZMA': False, 'MEM_DEBUG': False, 'MODULES': False, 'OUTPUT': True, 'PATTERN': True, 'PROGRAMS': False, 'PUSH': True, 'PYTHON': False, 'READER': True, 'REGEXPS': True, 'SAX1': True, 'SCHEMAS': True, 'SCHEMATRON': True, 'TESTS': False, 'THREADS': False, 'THREAD_ALLOC': False, 'TLS': False, 'TREE': True, 'VALID': True, 'WRITER': True, 'XINCLUDE': True, 'XPATH': True, 'XPTR': True, 'XPTR_LOCS': False, 'ZLIB': False}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-archive', type=Path, required=True)
    parser.add_argument('--iconv-archive', type=Path, required=True)
    parser.add_argument('--sdk-archive', type=Path, required=True)
    parser.add_argument('--work-root', type=Path, required=True)
    parser.add_argument('--output-directory', type=Path, required=True)
    args = parser.parse_args()
    assert digest(args.source_archive) == SOURCE_SHA
    assert digest(args.sdk_archive) == SDK_SHA
    assert digest(args.iconv_archive) == ICONV_SHA
    args.work_root.mkdir(parents=True, exist_ok=True)
    args.output_directory.mkdir(parents=True, exist_ok=True)
    repo = Path(__file__).resolve().parents[3]
    kernel = repo / 'packages/law-practice/server/assets/citation-html/kernel.c'
    ninja = shutil.which('ninja')
    assert ninja, 'Ninja must already be installed'
    with tempfile.TemporaryDirectory(prefix='html-kernel-', dir=args.work_root) as temp:
        work = Path(temp).resolve()
        for archive in [args.source_archive, args.sdk_archive, args.iconv_archive]:
            with tarfile.open(archive) as source:
                source.extractall(work, filter='data')
        sdk = work / 'wasi-sdk-34.0-x86_64-linux'
        source = work / 'libxml2-2.12.3'
        build = work / 'build'
        local_kernel = work / 'kernel.c'
        shutil.copyfile(kernel, local_kernel)
        prefix = f'-ffile-prefix-map={work}=/citation-build'
        iconv_source = work / 'libiconv-1.17'
        iconv_build = work / 'iconv-build'
        iconv_build.mkdir()
        env = {**os.environ, 'CC': str(sdk / 'bin/clang') + ' --target=wasm32-wasip1 --no-wasm-opt', 'AR': str(sdk / 'bin/llvm-ar'), 'RANLIB': str(sdk / 'bin/llvm-ranlib'), 'CFLAGS': '-O2 ' + prefix}
        iconv_configure = [str(iconv_source / 'configure'), '--host=wasm32-unknown-wasi', '--build=x86_64-pc-linux-gnu', '--disable-shared', '--enable-static', '--disable-nls', '--prefix=/citation-runtime']
        subprocess.run(iconv_configure, cwd=iconv_build, env=env, check=True)
        iconv_includes = [iconv_build / 'include', iconv_build / 'lib', iconv_source / 'lib', iconv_build, iconv_source, iconv_build / 'libcharset/include']
        iconv_compile = [str(sdk / 'bin/clang'), '--target=wasm32-wasip1', '-O2', prefix, '-DHAVE_CONFIG_H', '-DBUILDING_LIBICONV', '-DBUILDING_LIBCHARSET']
        iconv_compile.extend('-I' + str(p) for p in iconv_includes)
        subprocess.run(iconv_compile + ['-c', str(iconv_source / 'lib/iconv.c'), '-o', str(iconv_build / 'iconv.o')], check=True)
        iconv_library = iconv_build / 'libiconv.a'
        subprocess.run([str(sdk / 'bin/llvm-ar'), 'rcs', str(iconv_library), str(iconv_build / 'iconv.o')], check=True)
        configure = ['cmake', '-S', str(source), '-B', str(build), '-G', 'Ninja', '-DCMAKE_MAKE_PROGRAM=' + ninja, '-DCMAKE_TOOLCHAIN_FILE=' + str(sdk / 'share/cmake/wasi-sdk-p1.cmake'), '-DCMAKE_BUILD_TYPE=Release', '-DBUILD_SHARED_LIBS=OFF', '-DCMAKE_C_FLAGS=' + prefix, '-DIconv_IS_BUILT_IN=FALSE', '-DIconv_INCLUDE_DIR=' + str(iconv_build / 'include'), '-DIconv_LIBRARY=' + str(iconv_library)]
        configure.extend('-DLIBXML2_WITH_' + name + '=' + ('ON' if enabled else 'OFF') for name, enabled in FEATURES.items())
        subprocess.run(configure, check=True)
        subprocess.run(['cmake', '--build', str(build), '-j2'], check=True)
        output = work / 'kernel.wasm'
        kernel_object = work / 'kernel.o'
        subprocess.run([str(sdk / 'bin/clang'), '--target=wasm32-wasip1', '-O2', prefix, '-I' + str(source / 'include'), '-I' + str(build), '-I' + str(iconv_build / 'include'), '-c', str(local_kernel), '-o', str(kernel_object)], check=True)
        link = [str(sdk / 'bin/clang'), '--target=wasm32-wasip1', '--no-wasm-opt', '-O2', '-mexec-model=reactor', str(kernel_object), str(build / 'libxml2.a'), str(iconv_library)]
        link.extend('-Wl,--export=' + name for name in EXPORTS)
        link.extend(['-Wl,--max-memory=536870912', '-Wl,-Map,' + str(work / 'kernel.map'), '-o', str(output)])
        subprocess.run(link, check=True)
        raw = output.read_bytes()
        assert b'/home/' not in raw and str(work).encode() not in raw
        (args.output_directory / 'kernel.wasm').write_bytes(raw)
        (args.output_directory / 'kernel.map').write_text((work / 'kernel.map').read_text().replace(str(work), '/citation-build'))
        # Provide the complete linked application objects, exact system objects,
        # original converter and deterministic replacement-library relink recipe.
        relink = work / 'relink'
        relink.mkdir()
        inventory = (work / 'kernel.map').read_text()
        member_inventory = {}
        def selected_archive(archive):
            used = set(re.findall(re.escape(archive.name) + r'\(([^)]+)\)', inventory))
            order = subprocess.check_output([str(sdk / 'bin/llvm-ar'), 't', str(archive)], text=True).splitlines()
            selected = [name for name in order if name in used]
            assert used and set(selected) == used
            # Keep original archive symbol indices and debug records. Rebuilding
            # a reduced archive changes lazy extraction order and cannot relink
            # the exact distributed binary. Record linked members separately.
            shutil.copyfile(archive, relink / archive.name)
            member_inventory[archive.name] = selected
        selected_archive(build / 'libxml2.a')
        selected_archive(iconv_library)
        libc = Path(subprocess.check_output([str(sdk / 'bin/clang'), '--target=wasm32-wasip1', '--print-file-name=libc.a'], text=True).strip())
        builtins = Path(subprocess.check_output([str(sdk / 'bin/clang'), '--target=wasm32-wasip1', '--print-libgcc-file-name'], text=True).strip())
        crt = Path(subprocess.check_output([str(sdk / 'bin/clang'), '--target=wasm32-wasip1', '--print-file-name=crt1-reactor.o'], text=True).strip())
        selected_archive(libc)
        selected_archive(builtins)
        shutil.copyfile(crt, relink / 'crt1-reactor.o')
        shutil.copyfile(kernel_object, relink / 'kernel.o')
        exports = ' '.join('-Wl,--export=' + name for name in EXPORTS)
        relink_script = '#!/bin/sh\nset -eu\ncd "$(dirname "$0")"\nsdk_dir=$1\nreplacement_library=${2:-./libiconv.a}\noutput_file=${3:-./kernel.wasm}\n"$sdk_dir/bin/clang" --target=wasm32-wasip1 --no-wasm-opt -O2 -mexec-model=reactor -nostdlib ./crt1-reactor.o ./kernel.o ./libxml2.a "$replacement_library" ./libc.a ./libclang_rt.builtins.a ' + exports + ' -Wl,--max-memory=536870912 -o "$output_file"\n'
        (relink / 'link.sh').write_text(relink_script)
        subprocess.run(['sh', str(relink / 'link.sh'), str(sdk)], check=True)
        if (relink / 'kernel.wasm').read_bytes() != raw:
            shutil.copyfile(relink / 'kernel.wasm', args.output_directory / 'relinked-debug.wasm')
            with tarfile.open(args.output_directory / 'relink-debug.tar', 'w') as debug:
                debug.add(relink, arcname='relink')
            raise AssertionError('relink material must reproduce the exact binary')
        (relink / 'kernel.wasm').unlink()
        (relink / 'README.txt').write_text('LGPL relinking material for citation HTML kernel.\nRun: sh link.sh /path/to/wasi-sdk-34.0-x86_64-linux [replacement-libiconv.a] [output.wasm]\nThe default library is the original GNU libiconv 1.17 converter.\nUnmodified complete converter source ships alongside as sources/libiconv-1.17.tar.gz.\nThe source recipe build-html-kernel.py records its configuration and archive digest.\nThe authored locale_charset glue is compiled into kernel.o; kernel.c is shipped beside the asset.\nComplete original archives retain symbol indices and debug information; the receipt separately records linked members.\nAll retained license texts accompany these objects in licenses/.\nNo signing key or proprietary linker is required. A modified engine may update its source hash guard.\n')
        for license_file in (kernel.parent / 'licenses').iterdir():
            if license_file.is_file():
                (relink / 'licenses').mkdir(exist_ok=True)
                shutil.copyfile(license_file, relink / 'licenses' / license_file.name)
        relink_archive = args.output_directory / 'kernel-relink.tar.xz'
        with tarfile.open(relink_archive, 'w:xz', format=tarfile.USTAR_FORMAT, preset=9) as bundle:
            for path in sorted(relink.rglob('*')):
                if not path.is_file(): continue
                content = path.read_bytes()
                entry = tarfile.TarInfo(path.relative_to(relink).as_posix())
                entry.size = len(content); entry.mode = 0o755 if path.name == 'link.sh' else 0o644
                entry.uid = entry.gid = entry.mtime = 0
                bundle.addfile(entry, io.BytesIO(content))
        shutil.copyfile(args.iconv_archive, args.output_directory / 'libiconv-1.17.tar.gz')
        receipt = {'schemaVersion': 'citation-html-kernel-build/v1', 'sourceArchive': {'name': 'libxml2-2.12.3.tar.xz', 'sha256': SOURCE_SHA}, 'sdkArchive': {'name': 'wasi-sdk-34.0-x86_64-linux.tar.gz', 'sha256': SDK_SHA}, 'sdkVersion': (sdk / 'VERSION').read_text().strip(), 'iconvArchive': {'name': 'libiconv-1.17.tar.gz', 'sha256': ICONV_SHA}, 'iconvConfiguration': 'default encodings; conversion unit only; fixed UTF-8 source locale; no localcharset/relocation I/O', 'features': FEATURES, 'relinkArchiveSha256': digest(relink_archive), 'relinkArchiveMembers': member_inventory, 'relinkedWasmSha256': hashlib.sha256(raw).hexdigest(), 'kernelSourceSha256': digest(kernel), 'producerSha256': digest(Path(__file__)), 'target': 'wasm32-wasip1', 'libraryOptimization': 'Release', 'kernelOptimization': '-O2 --no-wasm-opt', 'canonicalBuildPrefix': '/citation-build', 'memoryMaximumBytes': 536870912, 'exports': EXPORTS, 'wasmSha256': hashlib.sha256(raw).hexdigest(), 'wasmBytes': len(raw)}
        (args.output_directory / 'build-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
        print('Built pinned private HTML kernel:', receipt['wasmSha256'], len(raw), 'bytes')


if __name__ == '__main__':
    main()
