use serde::Serialize;
use std::path::Path;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex, MutexGuard,
};
use tauri::{AppHandle, Emitter, Manager, RunEvent};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use uuid::Uuid;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProfessionalDesktopHealth {
    app: &'static str,
    desktop_shell: &'static str,
    runtime_connection: &'static str,
    slices: [&'static str; 4],
    status: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SidecarTransport {
    ipc: bool,
    rpc_session_token: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SidecarClosed {
    code: Option<i32>,
    kind: &'static str,
    message: Option<String>,
    signal: Option<i32>,
}

#[tauri::command]
fn professional_desktop_health() -> ProfessionalDesktopHealth {
    ProfessionalDesktopHealth {
        app: "@beep/professional-desktop",
        desktop_shell: "minimal",
        runtime_connection: "pending",
        slices: ["workspace", "agents", "epistemic", "law-practice"],
        status: "ready",
    }
}

#[derive(Clone)]
struct RpcSession {
    token: String,
}

const RPC_SESSION_TOKEN_ENV: &str = "BEEP_DESKTOP_RPC_SESSION_TOKEN";
const ONTOLOGY_WORKSPACE_ROOT_ENV: &str = "ONTOLOGY_WORKSPACE_ROOT";

fn ensure_private_directory(path: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(path)?;
    let metadata = std::fs::symlink_metadata(path)?;
    if !metadata.file_type().is_dir() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            format!(
                "private directory path is not a directory: {}",
                path.display()
            ),
        ));
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o700))?;
    }

    Ok(())
}

#[tauri::command]
fn sidecar_transport(state: tauri::State<'_, RpcSession>) -> SidecarTransport {
    // Threat model: this token is intentionally delivered to the trusted Tauri
    // webview so the frontend can authorize loopback HTTP and IPC calls to its
    // own sidecar. It is not an XSS boundary inside the app webview; it prevents
    // unrelated local processes or external web pages from reaching the
    // write-capable sidecar RPC surface.
    SidecarTransport {
        ipc: ipc_transport(),
        rpc_session_token: state.token.clone(),
    }
}

#[tauri::command]
async fn select_vault_directory(app: AppHandle) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .set_title("Select workspace vault")
            .blocking_pick_folder()
            .map(|path| {
                path.into_path()
                    .map(|path| path.to_string_lossy().to_string())
                    .map_err(|err| err.to_string())
            })
            .transpose()
    })
    .await
    .map_err(|err| err.to_string())?
}

/// The bundled rpc sidecar process, killed when the app exits.
struct Sidecar {
    child: SharedSidecarChild,
    ipc_ready: SharedIpcReady,
    pending_closed: SharedPendingClosed,
    pending_stdout_frames: SharedPendingStdoutFrames,
}

type SharedIpcReady = Arc<AtomicBool>;
type SharedPendingClosed = Arc<Mutex<Option<SidecarClosed>>>;
type SharedPendingStdoutFrames = Arc<Mutex<Vec<String>>>;
type SharedSidecarChild = Arc<Mutex<Option<CommandChild>>>;

/// Upper bound on a single IPC ndjson rpc frame, enforced in both directions: the
/// inbound stdout bridge buffer (which only ever holds one in-flight frame, see
/// `bridge_sidecar_events`) and outbound `sidecar_send` writes. A malformed/chatty
/// child that floods stdout without a terminator, or a webview that sends an
/// oversized frame, fails closed rather than growing memory without bound or
/// stalling the transport.
const MAX_IPC_FRAME_BYTES: usize = 8 * 1024 * 1024;

/// Packaged secrets story: prefer an exported AI_ANTHROPIC_API_KEY, fall back
/// to asking the 1Password CLI for the same secret reference `op run` resolves
/// in dev. Without either, the sidecar boots fine but assistant turns fail
/// until a key is provided.
fn anthropic_key() -> Option<String> {
    std::env::var("AI_ANTHROPIC_API_KEY").ok().or_else(|| {
        std::process::Command::new("op")
            .args([
                "read",
                "op://BEEP_SECRETS/BEEP_SECRETS/AI_ANTHROPIC_API_KEY",
            ])
            .output()
            .ok()
            .filter(|out| out.status.success())
            .map(|out| String::from_utf8_lossy(&out.stdout).trim().to_string())
    })
}

/// Whether the webview talks to the sidecar over Tauri IPC (a stdio bridge)
/// rather than the default loopback HTTP transport. Mirrors the sidecar's own
/// `CHAT_TRANSPORT` switch (see `server/main.ts`); anything other than `ipc`
/// keeps the HTTP transport.
fn ipc_transport() -> bool {
    std::env::var("CHAT_TRANSPORT")
        .map(|value| value == "ipc")
        .unwrap_or(false)
}

fn rpc_session_token() -> String {
    std::env::var(RPC_SESSION_TOKEN_ENV).unwrap_or_else(|_| Uuid::new_v4().to_string())
}

fn authorize_sidecar_send(
    ipc_enabled: bool,
    provided_token: &str,
    expected_token: &str,
) -> Result<(), String> {
    if !ipc_enabled {
        return Err("sidecar IPC transport is not enabled".to_string());
    }

    if provided_token != expected_token {
        return Err("unauthorized sidecar rpc session".to_string());
    }

    Ok(())
}

fn recover_lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|err| err.into_inner())
}

fn emit_sidecar_closed(handle: &AppHandle, payload: SidecarClosed) {
    let _ = handle.emit("sidecar://closed", payload);
}

fn emit_or_buffer_sidecar_closed(
    handle: &AppHandle,
    ready: &SharedIpcReady,
    pending_closed: &SharedPendingClosed,
    payload: SidecarClosed,
) {
    if ready.load(Ordering::SeqCst) {
        emit_sidecar_closed(handle, payload);
        return;
    }

    let mut pending = recover_lock(pending_closed);
    if pending.is_none() {
        *pending = Some(payload);
    }
}

fn emit_or_buffer_ipc_stdout_frame(
    handle: &AppHandle,
    ready: &SharedIpcReady,
    pending_closed: &SharedPendingClosed,
    pending_stdout_frames: &SharedPendingStdoutFrames,
    frame: Vec<u8>,
) -> bool {
    if is_blank_ipc_stdout_frame(&frame) {
        log::warn!("sidecar stdout emitted a blank IPC frame; dropping it");
        return true;
    }

    match String::from_utf8(frame) {
        Ok(frame) => {
            let mut pending = recover_lock(pending_stdout_frames);
            if ready.load(Ordering::SeqCst) {
                drop(pending);
                let _ = handle.emit("sidecar://rx", frame);
            } else {
                pending.push(frame);
            }
            true
        }
        Err(err) => {
            let message = format!("sidecar stdout was not valid utf-8: {err}");
            log::error!("{message}");
            emit_or_buffer_sidecar_closed(
                handle,
                ready,
                pending_closed,
                SidecarClosed {
                    code: None,
                    kind: "error",
                    message: Some(message),
                    signal: None,
                },
            );
            false
        }
    }
}

fn is_blank_ipc_stdout_frame(frame: &[u8]) -> bool {
    frame
        .iter()
        .all(|byte| matches!(*byte, b'\n' | b'\r' | b'\t' | b' '))
}

fn kill_sidecar(sidecar: &SharedSidecarChild) {
    let mut guard = recover_lock(sidecar);
    if let Some(child) = guard.take() {
        let _ = child.kill();
    }
}

/// Drain the bundled sidecar's output stream so child pipes can never fill.
/// In IPC mode stdout is ndjson rpc and is forwarded to the webview only after
/// a complete newline-delimited UTF-8 frame arrives. In HTTP mode stdout/stderr
/// are logs, so both streams are simply pumped into the desktop log.
fn bridge_sidecar_events(
    app: &AppHandle,
    mut events: tauri::async_runtime::Receiver<CommandEvent>,
    ipc: bool,
    sidecar: SharedSidecarChild,
    ipc_ready: SharedIpcReady,
    pending_closed: SharedPendingClosed,
    pending_stdout_frames: SharedPendingStdoutFrames,
) {
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut stdout_buffer: Vec<u8> = Vec::new();
        let mut closed_emitted = false;

        while let Some(event) = events.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    if ipc {
                        stdout_buffer.extend(bytes);
                        while let Some(newline_index) =
                            stdout_buffer.iter().position(|byte| *byte == b'\n')
                        {
                            let frame: Vec<u8> = stdout_buffer.drain(..=newline_index).collect();
                            if !emit_or_buffer_ipc_stdout_frame(
                                &handle,
                                &ipc_ready,
                                &pending_closed,
                                &pending_stdout_frames,
                                frame,
                            ) {
                                closed_emitted = true;
                                kill_sidecar(&sidecar);
                                break;
                            }
                        }
                        if closed_emitted {
                            break;
                        }
                        // Fail closed if the sidecar floods stdout without a frame
                        // terminator so a malformed/chatty child can never grow the
                        // buffer without bound or stall delivery of later frames.
                        if stdout_buffer.len() > MAX_IPC_FRAME_BYTES {
                            let message = format!(
                                "sidecar stdout exceeded {MAX_IPC_FRAME_BYTES} bytes without a complete frame; closing transport"
                            );
                            log::error!("{message}");
                            closed_emitted = true;
                            kill_sidecar(&sidecar);
                            emit_or_buffer_sidecar_closed(
                                &handle,
                                &ipc_ready,
                                &pending_closed,
                                SidecarClosed {
                                    code: None,
                                    kind: "error",
                                    message: Some(message),
                                    signal: None,
                                },
                            );
                            break;
                        }
                    } else {
                        log::info!("sidecar: {}", String::from_utf8_lossy(&bytes).trim_end());
                    }
                }
                CommandEvent::Stderr(bytes) => {
                    log::info!("sidecar: {}", String::from_utf8_lossy(&bytes).trim_end());
                }
                CommandEvent::Error(err) => {
                    log::error!("sidecar error: {err}");
                    closed_emitted = true;
                    kill_sidecar(&sidecar);
                    emit_or_buffer_sidecar_closed(
                        &handle,
                        &ipc_ready,
                        &pending_closed,
                        SidecarClosed {
                            code: None,
                            kind: "error",
                            message: Some(err),
                            signal: None,
                        },
                    );
                }
                CommandEvent::Terminated(payload) => {
                    closed_emitted = true;
                    if ipc && !stdout_buffer.is_empty() {
                        let message = format!(
                            "sidecar terminated with {} buffered stdout byte(s)",
                            stdout_buffer.len()
                        );
                        log::error!("{message}");
                        emit_or_buffer_sidecar_closed(
                            &handle,
                            &ipc_ready,
                            &pending_closed,
                            SidecarClosed {
                                code: payload.code,
                                kind: "error",
                                message: Some(message),
                                signal: payload.signal,
                            },
                        );
                        kill_sidecar(&sidecar);
                        continue;
                    }
                    log::warn!(
                        "sidecar terminated: code={:?} signal={:?}",
                        payload.code,
                        payload.signal
                    );
                    kill_sidecar(&sidecar);
                    emit_or_buffer_sidecar_closed(
                        &handle,
                        &ipc_ready,
                        &pending_closed,
                        SidecarClosed {
                            code: payload.code,
                            kind: "terminated",
                            message: None,
                            signal: payload.signal,
                        },
                    );
                }
                _ => {}
            }
        }

        if !closed_emitted {
            emit_or_buffer_sidecar_closed(
                &handle,
                &ipc_ready,
                &pending_closed,
                SidecarClosed {
                    code: None,
                    kind: "event-stream-closed",
                    message: Some("sidecar event stream closed before termination".to_string()),
                    signal: None,
                },
            );
        }
    });
}

/// Write one outbound ndjson rpc frame from the webview to the sidecar's stdin.
/// The frame already carries the ndjson serialization framing, so it is written
/// verbatim. `async` so Tauri runs it off the UI thread — `CommandChild::write`
/// blocks on a full stdin pipe, which must never stall the webview.
#[tauri::command]
async fn sidecar_send(
    state: tauri::State<'_, Sidecar>,
    session: tauri::State<'_, RpcSession>,
    frame: String,
    rpc_session_token: String,
) -> Result<(), String> {
    // The token check protects the sidecar from non-webview callers that can
    // reach the command/HTTP boundary. The legitimate webview client receives
    // the token from `sidecar_transport`; script integrity inside that webview
    // is handled by the Tauri app/CSP boundary, not by hiding this value.
    authorize_sidecar_send(ipc_transport(), &rpc_session_token, &session.token)?;

    // Reject oversized frames before touching stdin, mirroring the inbound stdout
    // cap, so a buggy or hostile webview cannot block/kill the IPC transport.
    if frame.len() > MAX_IPC_FRAME_BYTES {
        return Err(format!(
            "outbound ipc frame of {} bytes exceeds the {MAX_IPC_FRAME_BYTES}-byte limit",
            frame.len()
        ));
    }
    let mut guard = recover_lock(&state.child);
    match guard.as_mut() {
        Some(child) => child.write(frame.as_bytes()).map_err(|err| err.to_string()),
        None => Err("sidecar is not running".to_string()),
    }
}

/// Mark the IPC event listeners ready and replay frames buffered during sidecar
/// boot. Tauri events are not durable, so the Rust bridge waits for this command
/// before emitting stdout frames that may arrive before the webview subscribes.
#[tauri::command]
fn sidecar_ipc_ready(app: AppHandle, state: tauri::State<'_, Sidecar>) -> Result<(), String> {
    {
        let mut frames = recover_lock(&state.pending_stdout_frames);
        for frame in frames.drain(..) {
            app.emit("sidecar://rx", frame)
                .map_err(|err| err.to_string())?;
        }
        state.ipc_ready.store(true, Ordering::SeqCst);
    }

    if let Some(payload) = recover_lock(&state.pending_closed).take() {
        app.emit("sidecar://closed", payload)
            .map_err(|err| err.to_string())?;
    }

    Ok(())
}

/// Ask the configured update server whether a newer version is available.
/// Returns the available version when there is one, `None` otherwise. Download
/// and install are intentionally left to a follow-up; this is the check half of
/// the updater scaffold.
async fn run_update_check(app: &AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_updater::UpdaterExt;
    let updater = app.updater().map_err(|err| err.to_string())?;
    match updater.check().await {
        Ok(Some(update)) => Ok(Some(update.version)),
        Ok(None) => Ok(None),
        Err(err) => Err(err.to_string()),
    }
}

/// Frontend-callable update check (see [`run_update_check`]).
#[tauri::command]
async fn check_for_update(app: AppHandle) -> Result<Option<String>, String> {
    run_update_check(&app).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(RpcSession {
            token: rpc_session_token(),
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            professional_desktop_health,
            sidecar_transport,
            select_vault_directory,
            sidecar_ipc_ready,
            sidecar_send,
            check_for_update
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let ipc = ipc_transport();

            // HTTP transport (default): dev runs the sidecar separately
            // (`bun run dev:sidecar`, fixture kernel); only the packaged app owns
            // the bundled binary. IPC transport: Rust always owns the sidecar so
            // it can bridge the child's stdio to the webview — in dev and packaged
            // alike (dev requires `bun run build:sidecar` first so the externalBin
            // exists).
            if ipc || !cfg!(debug_assertions) {
                let mut command = app.shell().sidecar("sidecar")?;
                let rpc_session_token = app.state::<RpcSession>().token.clone();
                let data_dir = app.path().app_data_dir()?;
                let ontology_workspace_root = data_dir.join("ontology-workspace");
                ensure_private_directory(&ontology_workspace_root)?;
                command = command.env(
                    ONTOLOGY_WORKSPACE_ROOT_ENV,
                    ontology_workspace_root.to_string_lossy().to_string(),
                );

                if cfg!(debug_assertions) {
                    // Dev + ipc: keyless fixture kernel; the sidecar falls back to
                    // its repo-local PGlite dir when CHAT_DB_PATH is unset.
                    command = command.env("CHAT_AGENT", "fixture");
                } else {
                    std::fs::create_dir_all(&data_dir)?;
                    // CHAT_DB_PATH is a directory PGlite persists into (see the
                    // sidecar's ChatDbConfig), not a single file.
                    command = command
                        .env(
                            "CHAT_DB_PATH",
                            data_dir.join("chat-db").to_string_lossy().to_string(),
                        )
                        .env("CHAT_AGENT", "anthropic");
                    if let Some(key) = anthropic_key() {
                        command = command.env("AI_ANTHROPIC_API_KEY", key);
                    }
                }

                if ipc {
                    command = command.env("CHAT_TRANSPORT", "ipc");
                } else {
                    command = command.env("CHAT_TRANSPORT", "http");
                }
                command = command.env(RPC_SESSION_TOKEN_ENV, rpc_session_token);

                let (events, child) = command.spawn()?;
                let sidecar = Sidecar {
                    child: Arc::new(Mutex::new(Some(child))),
                    ipc_ready: Arc::new(AtomicBool::new(!ipc)),
                    pending_closed: Arc::new(Mutex::new(None)),
                    pending_stdout_frames: Arc::new(Mutex::new(Vec::new())),
                };
                bridge_sidecar_events(
                    app.handle(),
                    events,
                    ipc,
                    Arc::clone(&sidecar.child),
                    Arc::clone(&sidecar.ipc_ready),
                    Arc::clone(&sidecar.pending_closed),
                    Arc::clone(&sidecar.pending_stdout_frames),
                );
                app.manage(sidecar);
            }

            // Best-effort update check on launch (packaged only); logs the result.
            // Surfacing/installing updates in the UI is a follow-up.
            if !cfg!(debug_assertions) {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    match run_update_check(&handle).await {
                        Ok(Some(version)) => log::info!("update available: {version}"),
                        Ok(None) => log::info!("no update available"),
                        Err(err) => log::warn!("update check failed: {err}"),
                    }
                });
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building professional desktop")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                if let Some(sidecar) = app.try_state::<Sidecar>() {
                    kill_sidecar(&sidecar.child);
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::{authorize_sidecar_send, ensure_private_directory, is_blank_ipc_stdout_frame};
    use uuid::Uuid;

    #[test]
    fn creates_private_ontology_workspace_directory() {
        let root = std::env::temp_dir().join(format!("beep-ontology-root-{}", Uuid::new_v4()));
        let workspace = root.join("ontology-workspace");

        ensure_private_directory(&workspace)
            .expect("ontology workspace directory should be created");
        assert!(workspace.is_dir());

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;

            let permissions = std::fs::metadata(&workspace)
                .expect("ontology workspace metadata should be readable")
                .permissions();
            assert_eq!(permissions.mode() & 0o777, 0o700);
        }

        std::fs::remove_dir_all(root).expect("ontology workspace fixture should be removed");
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlinked_ontology_workspace_directory() {
        use std::os::unix::fs::{symlink, PermissionsExt};

        let root = std::env::temp_dir().join(format!("beep-ontology-symlink-{}", Uuid::new_v4()));
        let target = root.join("target");
        let workspace = root.join("ontology-workspace");
        std::fs::create_dir_all(&target).expect("ontology symlink target should be created");
        std::fs::set_permissions(&target, std::fs::Permissions::from_mode(0o755))
            .expect("ontology symlink target permissions should be set");
        symlink(&target, &workspace).expect("ontology workspace symlink should be created");

        let error = ensure_private_directory(&workspace)
            .expect_err("symlinked ontology workspace should be rejected");
        assert_eq!(error.kind(), std::io::ErrorKind::InvalidInput);
        let target_permissions = std::fs::metadata(&target)
            .expect("ontology symlink target metadata should be readable")
            .permissions();
        assert_eq!(target_permissions.mode() & 0o777, 0o755);

        std::fs::remove_dir_all(root).expect("ontology workspace fixture should be removed");
    }

    #[test]
    fn detects_blank_ipc_stdout_frames() {
        assert!(is_blank_ipc_stdout_frame(b"\n"));
        assert!(is_blank_ipc_stdout_frame(b"\r\n"));
        assert!(is_blank_ipc_stdout_frame(b" \t\r\n"));
    }

    #[test]
    fn preserves_ndjson_ipc_stdout_frames() {
        assert!(!is_blank_ipc_stdout_frame(br#"{"jsonrpc":"2.0"}"#));
        assert!(!is_blank_ipc_stdout_frame(b"{\"jsonrpc\":\"2.0\"}\n"));
    }

    #[test]
    fn authorizes_sidecar_send_only_for_ipc_with_matching_token() {
        assert!(authorize_sidecar_send(true, "token", "token").is_ok());
        assert_eq!(
            authorize_sidecar_send(false, "token", "token"),
            Err("sidecar IPC transport is not enabled".to_string())
        );
        assert_eq!(
            authorize_sidecar_send(true, "wrong", "token"),
            Err("unauthorized sidecar rpc session".to_string())
        );
    }
}
