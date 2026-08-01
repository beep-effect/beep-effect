// cspell:words pthread Werror Wextra
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

const WEB_EXTENSION_SOURCE: &str = "web-extension/youtube_referrer.c";
const WEB_EXTENSION_TEST_SOURCE: &str = "web-extension/youtube_referrer_test.c";
const WEBKIT_EXTENSION_PACKAGE: &str = "webkit2gtk-web-extension-4.1";

fn compile(
    compiler: &cc::Tool,
    webkit: &pkg_config::Library,
    source: &Path,
    output: &Path,
    shared: bool,
) {
    let mut command = compiler.to_command();
    command
        .arg("-std=c11")
        .arg("-Wall")
        .arg("-Wextra")
        .arg("-Werror")
        .arg("-pthread");

    if shared {
        command.arg("-fPIC").arg("-shared").arg("-Wl,-z,defs");
    }

    let mut defines = webkit.defines.iter().collect::<Vec<_>>();
    defines.sort_by_key(|(name, _)| *name);
    for (name, value) in defines {
        command.arg(match value {
            Some(value) => format!("-D{name}={value}"),
            None => format!("-D{name}"),
        });
    }
    for path in &webkit.include_paths {
        command.arg("-I").arg(path);
    }
    command.arg(source).arg("-o").arg(output);
    for path in &webkit.link_paths {
        command.arg("-L").arg(path);
    }
    for path in &webkit.link_files {
        command.arg(path);
    }
    for library in &webkit.libs {
        command.arg(format!("-l{library}"));
    }
    for args in &webkit.ld_args {
        command.arg(format!("-Wl,{}", args.join(",")));
    }

    let status = command
        .status()
        .unwrap_or_else(|error| panic!("failed to invoke the WebKit extension compiler: {error}"));
    assert!(status.success(), "failed to compile {}", source.display());
}

fn fnv1a(bytes: &[u8]) -> u64 {
    bytes.iter().fold(0xcbf29ce484222325, |hash, byte| {
        (hash ^ u64::from(*byte)).wrapping_mul(0x100000001b3)
    })
}

fn build_linux_web_extension() {
    let manifest_dir = PathBuf::from(
        env::var_os("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR must be set by Cargo"),
    );
    let output_dir = PathBuf::from(env::var_os("OUT_DIR").expect("OUT_DIR must be set by Cargo"))
        .join("web-extensions");
    fs::create_dir_all(&output_dir)
        .expect("failed to create the WebKit extension output directory");

    let webkit = pkg_config::Config::new()
        .cargo_metadata(false)
        .probe(WEBKIT_EXTENSION_PACKAGE)
        .unwrap_or_else(|error| {
            panic!("{WEBKIT_EXTENSION_PACKAGE} is required to build the Linux desktop app: {error}")
        });
    let compiler = cc::Build::new().get_compiler();
    let extension_path = output_dir.join("libbeep_youtube_referrer.so");
    let test_path = output_dir.join("youtube_referrer_test");

    compile(
        &compiler,
        &webkit,
        &manifest_dir.join(WEB_EXTENSION_SOURCE),
        &extension_path,
        true,
    );
    compile(
        &compiler,
        &webkit,
        &manifest_dir.join(WEB_EXTENSION_TEST_SOURCE),
        &test_path,
        false,
    );

    let extension_bytes =
        fs::read(&extension_path).expect("failed to read the compiled WebKit extension");
    println!(
        "cargo:rustc-env=BEEP_WEB_EXTENSION_PATH={}",
        extension_path.display()
    );
    println!(
        "cargo:rustc-env=BEEP_WEB_EXTENSION_REVISION={:016x}",
        fnv1a(&extension_bytes)
    );
    println!(
        "cargo:rustc-env=BEEP_WEB_EXTENSION_TEST_PATH={}",
        test_path.display()
    );
}

fn main() {
    println!("cargo:rerun-if-changed={WEB_EXTENSION_SOURCE}");
    println!("cargo:rerun-if-changed={WEB_EXTENSION_TEST_SOURCE}");
    if env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("linux") {
        build_linux_web_extension();
    }
    tauri_build::build()
}
