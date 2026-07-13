// cspell:ignore Condvar unreaped
use serde::Serialize;
use std::env;
use std::io::{BufRead, BufReader, Read, Write};
#[cfg(unix)]
use std::os::unix::process::ExitStatusExt;
use std::path::Path;
use std::process::{Child, ChildStdin, Stdio};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Condvar, Mutex, MutexGuard,
};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, RunEvent};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};
use tauri_plugin_shell::process::{CommandEvent, TerminatedPayload};
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RendererObservabilityConfig {
    build_commit: Option<String>,
    deployment_environment: String,
    launch_id: String,
    log_level: &'static str,
    otlp_url: Option<String>,
    qa_session_id: String,
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

#[derive(Clone)]
struct DesktopRuntimeMetadata {
    launch_id: String,
    session_id: String,
}

struct DesktopShutdownState {
    started: AtomicBool,
}

impl DesktopShutdownState {
    fn new() -> Self {
        Self {
            started: AtomicBool::new(false),
        }
    }
}

impl DesktopRuntimeMetadata {
    fn new() -> Self {
        Self {
            launch_id: Uuid::new_v4().to_string(),
            session_id: Uuid::new_v4().to_string(),
        }
    }
}

#[derive(Clone, Copy)]
struct NativeLoggingConfig {
    effect_level: &'static str,
    invalid_value: bool,
    native_level: log::LevelFilter,
}

const RPC_SESSION_TOKEN_ENV: &str = "BEEP_DESKTOP_RPC_SESSION_TOKEN";
const ONTOLOGY_WORKSPACE_ROOT_ENV: &str = "ONTOLOGY_WORKSPACE_ROOT";
const APP_LOG_LEVEL_ENV: &str = "APP_LOG_LEVEL";
const OTEL_RESOURCE_ATTRIBUTES_ENV: &str = "OTEL_RESOURCE_ATTRIBUTES";
const SAFE_OBSERVABILITY_ENV: [&str; 20] = [
    "OTEL_EXPORTER_OTLP_ENDPOINT",
    "OTEL_EXPORTER_OTLP_PROTOCOL",
    "OTEL_EXPORTER_OTLP_LOGS_ENDPOINT",
    "OTEL_EXPORTER_OTLP_LOGS_PROTOCOL",
    "OTEL_EXPORTER_OTLP_METRICS_ENDPOINT",
    "OTEL_EXPORTER_OTLP_METRICS_PROTOCOL",
    "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
    "OTEL_EXPORTER_OTLP_TRACES_PROTOCOL",
    "OTEL_LOGS_EXPORTER",
    "OTEL_TRACES_EXPORTER",
    "OTEL_METRICS_EXPORTER",
    "OTEL_EXPORTER_OTLP_COMPRESSION",
    "OTEL_EXPORTER_OTLP_TIMEOUT",
    "OTEL_EXPORTER_OTLP_LOGS_TIMEOUT",
    "OTEL_EXPORTER_OTLP_METRICS_TIMEOUT",
    "OTEL_EXPORTER_OTLP_TRACES_TIMEOUT",
    "DEVTOOLS",
    "DEVTOOLS_URL",
    "DEVTOOLS_ALLOW_REMOTE",
    "BEEP_BUILD_COMMIT",
];

fn native_logging_config() -> NativeLoggingConfig {
    let configured = env::var(APP_LOG_LEVEL_ENV).unwrap_or_default();
    parse_native_logging_config(&configured)
}

fn parse_native_logging_config(configured: &str) -> NativeLoggingConfig {
    let normalized = configured.trim().to_ascii_lowercase();
    let (effect_level, native_level, invalid_value) = match normalized.as_str() {
        "" | "info" => ("Info", log::LevelFilter::Info, false),
        "all" | "trace" => ("Trace", log::LevelFilter::Trace, false),
        "debug" => ("Debug", log::LevelFilter::Debug, false),
        "warn" | "warning" => ("Warn", log::LevelFilter::Warn, false),
        "error" | "fatal" => ("Error", log::LevelFilter::Error, false),
        "none" | "off" => ("None", log::LevelFilter::Off, false),
        _ => ("Info", log::LevelFilter::Info, true),
    };
    NativeLoggingConfig {
        effect_level,
        invalid_value,
        native_level,
    }
}

fn build_profile() -> &'static str {
    if cfg!(debug_assertions) {
        "debug"
    } else {
        "release"
    }
}

fn telemetry_enabled() -> bool {
    env::var("OTEL_EXPORTER_OTLP_ENDPOINT")
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
}

fn sidecar_resource_attributes(metadata: &DesktopRuntimeMetadata) -> String {
    let shell_attributes = format!(
        "beep.desktop.launch.id={},beep.desktop.session.id={},beep.desktop.build.profile={}",
        metadata.launch_id,
        metadata.session_id,
        build_profile()
    );
    env::var(OTEL_RESOURCE_ATTRIBUTES_ENV)
        .ok()
        .filter(|attributes| !attributes.trim().is_empty())
        .map(|attributes| format!("{attributes},{shell_attributes}"))
        .unwrap_or(shell_attributes)
}

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
    let transport = SidecarTransport {
        ipc: ipc_transport(),
        rpc_session_token: state.token.clone(),
    };
    log::debug!(
        "event=sidecar_transport_probed transport={}",
        if transport.ipc { "ipc" } else { "http" }
    );
    transport
}

#[tauri::command]
fn renderer_observability_config(
    metadata: tauri::State<'_, DesktopRuntimeMetadata>,
) -> RendererObservabilityConfig {
    RendererObservabilityConfig {
        build_commit: env::var("BEEP_BUILD_COMMIT").ok(),
        deployment_environment: env::var("BEEP_DEPLOYMENT_ENVIRONMENT")
            .unwrap_or_else(|_| "qa".to_string()),
        launch_id: metadata.launch_id.clone(),
        log_level: native_logging_config().effect_level,
        otlp_url: env::var("OTEL_EXPORTER_OTLP_ENDPOINT")
            .ok()
            .filter(|value| !value.trim().is_empty()),
        qa_session_id: env::var("BEEP_QA_SESSION_ID")
            .unwrap_or_else(|_| metadata.session_id.clone()),
    }
}

#[tauri::command]
async fn select_vault_directory(app: AppHandle) -> Result<Option<String>, String> {
    let started_at = Instant::now();
    let result = tauri::async_runtime::spawn_blocking(move || {
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
    .map_err(|err| err.to_string())?;
    let duration_ms = started_at.elapsed().as_millis();
    match &result {
        Ok(Some(_)) => log::info!(
            "event=vault_directory_picker_completed outcome=selected duration_ms={duration_ms}"
        ),
        Ok(None) => log::info!(
            "event=vault_directory_picker_completed outcome=cancelled duration_ms={duration_ms}"
        ),
        Err(error) => log::warn!(
            "event=vault_directory_picker_completed outcome=failed duration_ms={duration_ms} error={error}"
        ),
    }
    result
}

/// The bundled rpc sidecar process, killed when the app exits.
struct Sidecar {
    ipc_ready: SharedIpcReady,
    pending_closed: SharedPendingClosed,
    pending_stdout_frames: SharedPendingStdoutFrames,
    process: SidecarProcess,
}

type SharedIpcReady = Arc<AtomicBool>;
type SharedPendingClosed = Arc<Mutex<Option<SidecarClosed>>>;
type SharedPendingStdoutFrames = Arc<Mutex<Vec<String>>>;

/// Own stdin independently from the process handle so a full pipe cannot prevent
/// liveness probes or forced shutdown. The monitor is the sole child reaper.
#[derive(Clone)]
struct SidecarProcess {
    child: Arc<Mutex<Option<Child>>>,
    lifecycle: Arc<SidecarLifecycle>,
    pid: u32,
    stdin: Arc<Mutex<Option<ChildStdin>>>,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum SidecarLifecycleState {
    Running,
    Stopping,
    Exited,
    Closed,
}

struct SidecarLifecycle {
    changed: Condvar,
    state: Mutex<SidecarLifecycleState>,
}

impl SidecarLifecycle {
    fn new() -> Self {
        Self {
            changed: Condvar::new(),
            state: Mutex::new(SidecarLifecycleState::Running),
        }
    }

    fn accepts_writes(&self) -> bool {
        *recover_lock(&self.state) == SidecarLifecycleState::Running
    }

    fn begin_shutdown(&self) {
        let mut state = recover_lock(&self.state);
        if *state == SidecarLifecycleState::Running {
            *state = SidecarLifecycleState::Stopping;
        }
    }

    fn has_exited(&self) -> bool {
        matches!(
            *recover_lock(&self.state),
            SidecarLifecycleState::Exited | SidecarLifecycleState::Closed
        )
    }

    fn mark_exited(&self) {
        let mut state = recover_lock(&self.state);
        if *state != SidecarLifecycleState::Closed {
            *state = SidecarLifecycleState::Exited;
        }
        self.changed.notify_all();
    }

    fn mark_closed(&self) {
        *recover_lock(&self.state) = SidecarLifecycleState::Closed;
        self.changed.notify_all();
    }

    #[cfg(test)]
    fn wait_for_exit(&self, timeout: Duration) -> bool {
        let state = recover_lock(&self.state);
        let (state, _) = self
            .changed
            .wait_timeout_while(state, timeout, |state| {
                !matches!(
                    *state,
                    SidecarLifecycleState::Exited | SidecarLifecycleState::Closed
                )
            })
            .unwrap_or_else(|error| error.into_inner());
        matches!(
            *state,
            SidecarLifecycleState::Exited | SidecarLifecycleState::Closed
        )
    }

    fn wait_for_close(&self, timeout: Duration) -> bool {
        let state = recover_lock(&self.state);
        let (state, _) = self
            .changed
            .wait_timeout_while(state, timeout, |state| {
                *state != SidecarLifecycleState::Closed
            })
            .unwrap_or_else(|error| error.into_inner());
        *state == SidecarLifecycleState::Closed
    }
}

impl SidecarProcess {
    fn new(child: Child, stdin: ChildStdin) -> Self {
        let pid = child.id();
        Self {
            child: Arc::new(Mutex::new(Some(child))),
            lifecycle: Arc::new(SidecarLifecycle::new()),
            pid,
            stdin: Arc::new(Mutex::new(Some(stdin))),
        }
    }
}

enum SidecarProcessPoll {
    Exited(TerminatedPayload),
    Missing,
    Running,
}

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
    if let Err(error) = handle.emit("sidecar://closed", payload) {
        log::error!("event=sidecar_emit_failed channel=sidecar://closed error={error}");
    }
}

fn emit_or_buffer_sidecar_closed(
    handle: &AppHandle,
    ready: &SharedIpcReady,
    pending_closed: &SharedPendingClosed,
    payload: SidecarClosed,
) {
    let kind = payload.kind;
    let code = payload.code;
    let signal = payload.signal;
    if ready.load(Ordering::SeqCst) {
        log::warn!("event=sidecar_close_emitted kind={kind} code={code:?} signal={signal:?}");
        emit_sidecar_closed(handle, payload);
        return;
    }

    let mut pending = recover_lock(pending_closed);
    if pending.is_none() {
        *pending = Some(payload);
        log::warn!("event=sidecar_close_buffered kind={kind} code={code:?} signal={signal:?}");
    } else {
        log::warn!(
            "event=sidecar_close_dropped kind={kind} code={code:?} signal={signal:?} reason=already-buffered"
        );
    }
}

fn emit_or_buffer_ipc_stdout_frame(
    handle: &AppHandle,
    ready: &SharedIpcReady,
    pending_closed: &SharedPendingClosed,
    pending_stdout_frames: &SharedPendingStdoutFrames,
    frame: Vec<u8>,
) -> bool {
    if frame.len() > MAX_IPC_FRAME_BYTES {
        let message = format!(
            "sidecar stdout frame of {} bytes exceeds the {MAX_IPC_FRAME_BYTES}-byte limit",
            frame.len()
        );
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
        return false;
    }

    if is_blank_ipc_stdout_frame(&frame) {
        log::warn!(
            "event=sidecar_ipc_frame_dropped direction=inbound reason=blank bytes={}",
            frame.len()
        );
        return true;
    }

    match String::from_utf8(frame) {
        Ok(frame) => {
            let mut pending = recover_lock(pending_stdout_frames);
            if ready.load(Ordering::SeqCst) {
                drop(pending);
                if let Err(error) = handle.emit("sidecar://rx", frame) {
                    log::error!("event=sidecar_emit_failed channel=sidecar://rx error={error}");
                    return false;
                }
            } else {
                pending.push(frame);
                log::debug!(
                    "event=sidecar_ipc_frame_buffered direction=inbound buffered_frames={}",
                    pending.len()
                );
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

fn kill_sidecar(process: &SidecarProcess, reason: &'static str) {
    process.lifecycle.begin_shutdown();
    let mut child = recover_lock(&process.child);
    if let Some(child) = child.as_mut() {
        let pid = child.id();
        match child.kill() {
            Ok(()) => log::info!("event=sidecar_stopped mode=forced reason={reason} pid={pid}"),
            Err(error) => log::error!(
                "event=sidecar_stop_failed mode=forced reason={reason} pid={pid} error={error}"
            ),
        }
    } else {
        log::debug!("event=sidecar_stop_skipped reason={reason} state=not-running");
    }
}

#[cfg(any(not(unix), test))]
fn running_sidecar_pid(process: &SidecarProcess) -> Option<u32> {
    if process.lifecycle.has_exited() {
        return None;
    }
    recover_lock(&process.child).as_ref().map(Child::id)
}

#[cfg(unix)]
fn request_graceful_sidecar_stop(process: &SidecarProcess) -> Result<Option<u32>, String> {
    process.lifecycle.begin_shutdown();
    let (pid, result) = {
        let child = recover_lock(&process.child);
        let Some(child) = child.as_ref() else {
            return Ok(None);
        };
        let pid = child.id();
        // SAFETY: the child lock prevents the monitor from reaping this process,
        // so its PID cannot be reused while SIGTERM is sent. The signal borrows
        // no process memory.
        let result = unsafe { libc::kill(pid as libc::pid_t, libc::SIGTERM) };
        (pid, result)
    };
    if result == 0 {
        Ok(Some(pid))
    } else if process.lifecycle.has_exited() {
        Ok(None)
    } else {
        Err(std::io::Error::last_os_error().to_string())
    }
}

#[cfg(not(unix))]
fn request_graceful_sidecar_stop(process: &SidecarProcess) -> Result<Option<u32>, String> {
    process.lifecycle.begin_shutdown();
    if running_sidecar_pid(process).is_none() {
        Ok(None)
    } else {
        Err("graceful sidecar shutdown is not supported on this platform".to_string())
    }
}

fn write_sidecar_frame(process: &SidecarProcess, frame: &[u8]) -> Result<(), String> {
    if !process.lifecycle.accepts_writes() {
        return Err("sidecar is stopping or not running".to_string());
    }

    let mut stdin = recover_lock(&process.stdin);
    if !process.lifecycle.accepts_writes() {
        return Err("sidecar is stopping or not running".to_string());
    }
    stdin
        .as_mut()
        .ok_or_else(|| "sidecar is not running".to_string())?
        .write_all(frame)
        .map_err(|error| error.to_string())
}

fn poll_sidecar_process(process: &SidecarProcess) -> std::io::Result<SidecarProcessPoll> {
    let mut child = recover_lock(&process.child);
    let Some(active_child) = child.as_mut() else {
        return Ok(SidecarProcessPoll::Missing);
    };
    let Some(status) = active_child.try_wait()? else {
        return Ok(SidecarProcessPoll::Running);
    };

    let payload = TerminatedPayload {
        code: status.code(),
        #[cfg(unix)]
        signal: status.signal(),
        #[cfg(not(unix))]
        signal: None,
    };
    child.take();
    Ok(SidecarProcessPoll::Exited(payload))
}

fn pump_raw_sidecar_output<R: Read + Send + 'static>(
    mut reader: R,
    sender: tauri::async_runtime::Sender<CommandEvent>,
    event: fn(Vec<u8>) -> CommandEvent,
) -> JoinHandle<()> {
    std::thread::spawn(move || {
        let mut buffer = [0_u8; 8 * 1024];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => return,
                Ok(read) => {
                    if sender
                        .blocking_send(event(buffer[..read].to_vec()))
                        .is_err()
                    {
                        return;
                    }
                }
                Err(error) => {
                    let _ = sender.blocking_send(CommandEvent::Error(error.to_string()));
                    return;
                }
            }
        }
    })
}

fn read_bounded_sidecar_line<R: BufRead>(
    reader: &mut R,
    limit: usize,
) -> std::io::Result<Option<Vec<u8>>> {
    let mut line = Vec::new();
    loop {
        let available = reader.fill_buf()?;
        if available.is_empty() {
            return if line.is_empty() {
                Ok(None)
            } else {
                Ok(Some(line))
            };
        }

        let read = available
            .iter()
            .position(|byte| *byte == b'\n')
            .map_or(available.len(), |index| index + 1);
        let line_length = line.len().checked_add(read).ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "sidecar output line length overflowed",
            )
        })?;
        if line_length > limit {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("sidecar output line exceeds the {limit}-byte limit before newline or EOF"),
            ));
        }

        line.extend_from_slice(&available[..read]);
        reader.consume(read);
        if line.last() == Some(&b'\n') {
            return Ok(Some(line));
        }
    }
}

fn pump_line_sidecar_output<R: Read + Send + 'static>(
    reader: R,
    sender: tauri::async_runtime::Sender<CommandEvent>,
    stream: &'static str,
    event: fn(Vec<u8>) -> CommandEvent,
) -> JoinHandle<()> {
    std::thread::spawn(move || {
        let mut reader = BufReader::new(reader);
        loop {
            match read_bounded_sidecar_line(&mut reader, MAX_IPC_FRAME_BYTES) {
                Ok(None) => return,
                Ok(Some(line)) => {
                    if sender.blocking_send(event(line)).is_err() {
                        return;
                    }
                }
                Err(error) => {
                    let _ = sender.blocking_send(CommandEvent::Error(format!(
                        "sidecar {stream} line reader failed: {error}"
                    )));
                    return;
                }
            }
        }
    })
}

fn monitor_sidecar_process(
    process: SidecarProcess,
    readers: [JoinHandle<()>; 2],
    sender: tauri::async_runtime::Sender<CommandEvent>,
) {
    std::thread::spawn(move || loop {
        match poll_sidecar_process(&process) {
            Ok(SidecarProcessPoll::Running) => {
                std::thread::sleep(Duration::from_millis(25));
            }
            Ok(SidecarProcessPoll::Exited(payload)) => {
                process.lifecycle.mark_exited();
                recover_lock(&process.stdin).take();
                for reader in readers {
                    if reader.join().is_err() {
                        let _ = sender.blocking_send(CommandEvent::Error(
                            "sidecar output reader panicked".to_string(),
                        ));
                    }
                }
                let _ = sender.blocking_send(CommandEvent::Terminated(payload));
                return;
            }
            Ok(SidecarProcessPoll::Missing) => {
                process.lifecycle.mark_exited();
                let _ = sender.blocking_send(CommandEvent::Error(
                    "sidecar process handle disappeared before termination".to_string(),
                ));
                return;
            }
            Err(error) => {
                let _ = sender.blocking_send(CommandEvent::Error(format!(
                    "sidecar liveness probe failed: {error}"
                )));
                return;
            }
        }
    });
}

fn spawn_sidecar_process(
    command: tauri_plugin_shell::process::Command,
    ipc: bool,
) -> std::io::Result<(tauri::async_runtime::Receiver<CommandEvent>, SidecarProcess)> {
    let mut command: std::process::Command = command.into();
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = command.spawn()?;
    let handles = (child.stdin.take(), child.stdout.take(), child.stderr.take());
    let (Some(stdin), Some(stdout), Some(stderr)) = handles else {
        let _ = child.kill();
        let _ = child.wait();
        return Err(std::io::Error::other(
            "sidecar process did not expose piped stdio",
        ));
    };

    let process = SidecarProcess::new(child, stdin);
    let (sender, events) = tauri::async_runtime::channel(1);
    let stdout_reader = if ipc {
        pump_raw_sidecar_output(stdout, sender.clone(), CommandEvent::Stdout)
    } else {
        pump_line_sidecar_output(stdout, sender.clone(), "stdout", CommandEvent::Stdout)
    };
    let stderr_reader =
        pump_line_sidecar_output(stderr, sender.clone(), "stderr", CommandEvent::Stderr);
    monitor_sidecar_process(process.clone(), [stdout_reader, stderr_reader], sender);
    Ok((events, process))
}

fn log_sidecar_output(stream: &'static str, bytes: &[u8]) {
    let output = String::from_utf8_lossy(bytes);
    for line in output.lines().filter(|line| !line.trim().is_empty()) {
        if line.contains("level=ERROR") || line.contains("level=FATAL") {
            log::error!("event=sidecar_log stream={stream} {line}");
        } else if line.contains("level=WARN") || line.contains("level=WARNING") {
            log::warn!("event=sidecar_log stream={stream} {line}");
        } else if line.contains("level=DEBUG") {
            log::debug!("event=sidecar_log stream={stream} {line}");
        } else if line.contains("level=TRACE") {
            log::trace!("event=sidecar_log stream={stream} {line}");
        } else {
            log::info!("event=sidecar_log stream={stream} {line}");
        }
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
    sidecar: &Sidecar,
    launch_id: String,
) {
    let handle = app.clone();
    let ipc_ready = Arc::clone(&sidecar.ipc_ready);
    let pending_closed = Arc::clone(&sidecar.pending_closed);
    let pending_stdout_frames = Arc::clone(&sidecar.pending_stdout_frames);
    let sidecar_process = sidecar.process.clone();
    tauri::async_runtime::spawn(async move {
        let mut stdout_buffer: Vec<u8> = Vec::new();
        let mut closed_emitted = false;
        let mut inbound_bytes: u64 = 0;
        let mut inbound_frames: u64 = 0;

        log::info!(
            "event=sidecar_bridge_started launch_id={launch_id} transport={}",
            if ipc { "ipc" } else { "http" }
        );

        while let Some(event) = events.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    if ipc {
                        inbound_bytes = inbound_bytes.saturating_add(bytes.len() as u64);
                        stdout_buffer.extend(bytes);
                        while let Some(newline_index) =
                            stdout_buffer.iter().position(|byte| *byte == b'\n')
                        {
                            let frame: Vec<u8> = stdout_buffer.drain(..=newline_index).collect();
                            inbound_frames = inbound_frames.saturating_add(1);
                            if !emit_or_buffer_ipc_stdout_frame(
                                &handle,
                                &ipc_ready,
                                &pending_closed,
                                &pending_stdout_frames,
                                frame,
                            ) {
                                closed_emitted = true;
                                kill_sidecar(&sidecar_process, "ipc-frame-emit-failed");
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
                            kill_sidecar(&sidecar_process, "ipc-frame-limit");
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
                        log_sidecar_output("stdout", &bytes);
                    }
                }
                CommandEvent::Stderr(bytes) => {
                    log_sidecar_output("stderr", &bytes);
                }
                CommandEvent::Error(err) => {
                    log::error!("event=sidecar_process_error launch_id={launch_id} error={err}");
                    closed_emitted = true;
                    kill_sidecar(&sidecar_process, "process-error");
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
                        sidecar_process.lifecycle.mark_closed();
                        continue;
                    }
                    log::warn!(
                        "event=sidecar_terminated launch_id={launch_id} code={:?} signal={:?} inbound_frames={inbound_frames} inbound_bytes={inbound_bytes}",
                        payload.code,
                        payload.signal
                    );
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
                    sidecar_process.lifecycle.mark_closed();
                }
                _ => {}
            }
        }

        if !closed_emitted {
            log::warn!(
                "event=sidecar_event_stream_closed launch_id={launch_id} inbound_frames={inbound_frames} inbound_bytes={inbound_bytes}"
            );
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
        if sidecar_process.lifecycle.has_exited() {
            sidecar_process.lifecycle.mark_closed();
        }
    });
}

/// Write one outbound ndjson rpc frame from the webview to the sidecar's stdin.
/// The frame already carries the ndjson serialization framing, so it is written
/// verbatim. The blocking pipe write runs on Tauri's blocking pool and owns only
/// the stdin lock, leaving process control available to shutdown and finalizers.
#[tauri::command]
async fn sidecar_send(
    state: tauri::State<'_, Sidecar>,
    session: tauri::State<'_, RpcSession>,
    metadata: tauri::State<'_, DesktopRuntimeMetadata>,
    frame: String,
    rpc_session_token: String,
) -> Result<(), String> {
    // The token check protects the sidecar from non-webview callers that can
    // reach the command/HTTP boundary. The legitimate webview client receives
    // the token from `sidecar_transport`; script integrity inside that webview
    // is handled by the Tauri app/CSP boundary, not by hiding this value.
    if let Err(error) = authorize_sidecar_send(ipc_transport(), &rpc_session_token, &session.token)
    {
        log::warn!(
            "event=sidecar_send_rejected launch_id={} reason={}",
            metadata.launch_id,
            if ipc_transport() {
                "unauthorized"
            } else {
                "ipc-disabled"
            }
        );
        return Err(error);
    }

    // Reject oversized frames before touching stdin, mirroring the inbound stdout
    // cap, so a buggy or hostile webview cannot block/kill the IPC transport.
    if frame.len() > MAX_IPC_FRAME_BYTES {
        log::warn!(
            "event=sidecar_send_rejected launch_id={} reason=frame-limit bytes={} limit={MAX_IPC_FRAME_BYTES}",
            metadata.launch_id,
            frame.len()
        );
        return Err(format!(
            "outbound ipc frame of {} bytes exceeds the {MAX_IPC_FRAME_BYTES}-byte limit",
            frame.len()
        ));
    }
    let frame_bytes = frame.len();
    let launch_id = metadata.launch_id.clone();
    let process = state.process.clone();
    let write_task = tauri::async_runtime::spawn_blocking(move || {
        write_sidecar_frame(&process, frame.as_bytes())
    })
    .await;
    let result = match write_task {
        Ok(result) => result,
        Err(error) => {
            log::error!(
                "event=sidecar_send_failed launch_id={launch_id} bytes={frame_bytes} phase=write-task error={error}"
            );
            return Err(error.to_string());
        }
    };
    match result {
        Ok(()) => {
            log::debug!(
                "event=sidecar_ipc_frame_sent launch_id={launch_id} direction=outbound bytes={frame_bytes}"
            );
            Ok(())
        }
        Err(error) => {
            log::error!(
                "event=sidecar_send_failed launch_id={launch_id} bytes={frame_bytes} error={error}"
            );
            Err(error)
        }
    }
}

/// Mark the IPC event listeners ready and replay frames buffered during sidecar
/// boot. Tauri events are not durable, so the Rust bridge waits for this command
/// before emitting stdout frames that may arrive before the webview subscribes.
#[tauri::command]
fn sidecar_ipc_ready(
    app: AppHandle,
    state: tauri::State<'_, Sidecar>,
    metadata: tauri::State<'_, DesktopRuntimeMetadata>,
) -> Result<(), String> {
    let mut replayed_frames = 0_u64;
    {
        let mut frames = recover_lock(&state.pending_stdout_frames);
        for frame in frames.drain(..) {
            app.emit("sidecar://rx", frame)
                .map_err(|error| {
                    log::error!(
                        "event=sidecar_emit_failed launch_id={} channel=sidecar://rx phase=replay error={error}",
                        metadata.launch_id
                    );
                    error.to_string()
                })?;
            replayed_frames = replayed_frames.saturating_add(1);
        }
        state.ipc_ready.store(true, Ordering::SeqCst);
    }

    if let Some(payload) = recover_lock(&state.pending_closed).take() {
        app.emit("sidecar://closed", payload)
            .map_err(|error| {
                log::error!(
                    "event=sidecar_emit_failed launch_id={} channel=sidecar://closed phase=replay error={error}",
                    metadata.launch_id
                );
                error.to_string()
            })?;
    }

    log::info!(
        "event=sidecar_ipc_ready launch_id={} replayed_frames={replayed_frames}",
        metadata.launch_id
    );

    Ok(())
}

/// Ask the configured update server whether a newer version is available.
/// Returns the available version when there is one, `None` otherwise. Download
/// and install are intentionally left to a follow-up; this is the check half of
/// the updater scaffold.
async fn run_update_check(app: &AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_updater::UpdaterExt;
    let started_at = Instant::now();
    let result = match app.updater() {
        Err(error) => Err(error.to_string()),
        Ok(updater) => match updater.check().await {
            Ok(Some(update)) => Ok(Some(update.version)),
            Ok(None) => Ok(None),
            Err(error) => Err(error.to_string()),
        },
    };
    let duration_ms = started_at.elapsed().as_millis();
    match &result {
        Ok(Some(version)) => {
            log::info!(
                "event=update_check_completed outcome=available version={version} duration_ms={duration_ms}"
            );
        }
        Ok(None) => {
            log::info!("event=update_check_completed outcome=current duration_ms={duration_ms}");
        }
        Err(error) => {
            log::warn!(
                "event=update_check_completed outcome=failed duration_ms={duration_ms} error={error}"
            );
        }
    }
    result
}

/// Frontend-callable update check (see [`run_update_check`]).
#[tauri::command]
async fn check_for_update(app: AppHandle) -> Result<Option<String>, String> {
    run_update_check(&app).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let logging = native_logging_config();
    let metadata = DesktopRuntimeMetadata::new();
    tauri::Builder::default()
        .manage(metadata)
        .manage(DesktopShutdownState::new())
        .manage(RpcSession {
            token: rpc_session_token(),
        })
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(logging.native_level)
                .rotation_strategy(RotationStrategy::KeepSome(5))
                .max_file_size(5_000_000)
                .targets([
                    Target::new(TargetKind::Stderr),
                    Target::new(TargetKind::LogDir { file_name: None }),
                ])
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            professional_desktop_health,
            renderer_observability_config,
            sidecar_transport,
            select_vault_directory,
            sidecar_ipc_ready,
            sidecar_send,
            check_for_update
        ])
        .setup(move |app| {
            let metadata = app.state::<DesktopRuntimeMetadata>();
            let app_version = app.package_info().version.to_string();
            if logging.invalid_value {
                log::warn!(
                    "event=logging_config_invalid key={APP_LOG_LEVEL_ENV} fallback=Info"
                );
            }

            let ipc = ipc_transport();
            log::info!(
                "event=desktop_started launch_id={} session_id={} version={} build_profile={} transport={} log_level={} telemetry_enabled={}",
                metadata.launch_id,
                metadata.session_id,
                app_version,
                build_profile(),
                if ipc { "ipc" } else { "http" },
                logging.effect_level,
                telemetry_enabled()
            );

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
                if let Err(error) = ensure_private_directory(&ontology_workspace_root) {
                    log::error!(
                        "event=sidecar_setup_failed launch_id={} phase=ontology-workspace error={error}",
                        metadata.launch_id
                    );
                    return Err(error.into());
                }
                command = command.env(
                    ONTOLOGY_WORKSPACE_ROOT_ENV,
                    ontology_workspace_root.to_string_lossy().to_string(),
                );

                for name in SAFE_OBSERVABILITY_ENV {
                    if let Ok(value) = env::var(name) {
                        command = command.env(name, value);
                    }
                }
                command = command
                    .env(APP_LOG_LEVEL_ENV, logging.effect_level)
                    .env(
                        OTEL_RESOURCE_ATTRIBUTES_ENV,
                        sidecar_resource_attributes(&metadata),
                    )
                    .env("OTEL_SERVICE_VERSION", &app_version)
                    .env("BEEP_LAUNCH_ID", &metadata.launch_id)
                    .env(
                        "BEEP_QA_SESSION_ID",
                        env::var("BEEP_QA_SESSION_ID")
                            .unwrap_or_else(|_| metadata.session_id.clone()),
                    )
                    .env(
                        "BEEP_DEPLOYMENT_ENVIRONMENT",
                        env::var("BEEP_DEPLOYMENT_ENVIRONMENT")
                            .unwrap_or_else(|_| "qa".to_string()),
                    )
                    .env("BEEP_DESKTOP_LAUNCH_ID", &metadata.launch_id)
                    .env("BEEP_DESKTOP_SESSION_ID", &metadata.session_id)
                    .env("BEEP_DESKTOP_BUILD_VERSION", &app_version)
                    .env("BEEP_DESKTOP_BUILD_PROFILE", build_profile());

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

                let (events, process) = match spawn_sidecar_process(command, ipc) {
                    Ok(spawned) => spawned,
                    Err(error) => {
                        log::error!(
                            "event=sidecar_spawn_failed launch_id={} transport={} error={error}",
                            metadata.launch_id,
                            if ipc { "ipc" } else { "http" }
                        );
                        return Err(error.into());
                    }
                };
                let child_pid = process.pid;
                let sidecar = Sidecar {
                    ipc_ready: Arc::new(AtomicBool::new(!ipc)),
                    pending_closed: Arc::new(Mutex::new(None)),
                    pending_stdout_frames: Arc::new(Mutex::new(Vec::new())),
                    process,
                };
                bridge_sidecar_events(
                    app.handle(),
                    events,
                    ipc,
                    &sidecar,
                    metadata.launch_id.clone(),
                );
                log::info!(
                    "event=sidecar_spawned launch_id={} pid={child_pid} transport={} telemetry_enabled={} log_level={}",
                    metadata.launch_id,
                    if ipc { "ipc" } else { "http" },
                    telemetry_enabled(),
                    logging.effect_level
                );
                app.manage(sidecar);
            } else {
                log::info!(
                    "event=sidecar_spawn_skipped launch_id={} reason=external-dev-sidecar transport=http",
                    metadata.launch_id
                );
            }

            // Best-effort update check on launch (packaged only); logs the result.
            // Surfacing/installing updates in the UI is a follow-up.
            if !cfg!(debug_assertions) {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    let _ = run_update_check(&handle).await;
                });
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building professional desktop")
        .run(|app, event| match event {
            RunEvent::ExitRequested { api, code, .. } => {
                let Some(sidecar) = app.try_state::<Sidecar>() else {
                    return;
                };
                let shutdown = app.state::<DesktopShutdownState>();
                if shutdown.started.swap(true, Ordering::SeqCst) {
                    return;
                }

                api.prevent_exit();
                let app = app.clone();
                let sidecar_process = sidecar.process.clone();
                let launch_id = app.state::<DesktopRuntimeMetadata>().launch_id.clone();
                tauri::async_runtime::spawn(async move {
                    let shutdown_launch_id = launch_id.clone();
                    let shutdown_result = tauri::async_runtime::spawn_blocking(move || {
                        match request_graceful_sidecar_stop(&sidecar_process) {
                            Ok(Some(pid)) => {
                                log::info!(
                                    "event=desktop_stopping launch_id={shutdown_launch_id} shutdown_mode=sigterm pid={pid} timeout_ms=4000"
                                );
                                if sidecar_process
                                    .lifecycle
                                    .wait_for_close(Duration::from_secs(4))
                                {
                                    log::info!(
                                        "event=sidecar_graceful_stop_completed launch_id={shutdown_launch_id} pid={pid}"
                                    );
                                } else if sidecar_process.lifecycle.has_exited() {
                                    log::warn!(
                                        "event=sidecar_graceful_stop_drain_timeout launch_id={shutdown_launch_id} pid={pid} timeout_ms=4000"
                                    );
                                } else {
                                    log::warn!(
                                        "event=sidecar_graceful_stop_timeout launch_id={shutdown_launch_id} pid={pid} timeout_ms=4000"
                                    );
                                    kill_sidecar(&sidecar_process, "graceful-timeout");
                                }
                            }
                            Ok(None) => {
                                if !sidecar_process
                                    .lifecycle
                                    .wait_for_close(Duration::from_secs(4))
                                {
                                    log::warn!(
                                        "event=sidecar_graceful_stop_drain_timeout launch_id={shutdown_launch_id} pid={} timeout_ms=4000",
                                        sidecar_process.pid
                                    );
                                }
                                log::info!(
                                    "event=desktop_stopping launch_id={shutdown_launch_id} shutdown_mode=no-running-sidecar"
                                );
                            }
                            Err(error) => {
                                log::warn!(
                                    "event=sidecar_graceful_stop_failed launch_id={shutdown_launch_id} error={error} fallback=forced"
                                );
                                kill_sidecar(&sidecar_process, "graceful-signal-failed");
                            }
                        }
                    })
                    .await;
                    if let Err(error) = shutdown_result {
                        log::error!(
                            "event=sidecar_shutdown_task_failed launch_id={launch_id} error={error}"
                        );
                    }
                    app.exit(code.unwrap_or(0));
                });
            }
            RunEvent::Exit => {
                if let Some(sidecar) = app.try_state::<Sidecar>() {
                    kill_sidecar(&sidecar.process, "desktop-exit-finalizer");
                }
            }
            _ => {}
        });
}

#[cfg(test)]
mod tests {
    use super::{
        authorize_sidecar_send, ensure_private_directory, is_blank_ipc_stdout_frame,
        parse_native_logging_config, read_bounded_sidecar_line,
    };
    #[cfg(unix)]
    use super::{
        kill_sidecar, monitor_sidecar_process, poll_sidecar_process, running_sidecar_pid,
        write_sidecar_frame, SidecarProcess, SidecarProcessPoll, MAX_IPC_FRAME_BYTES,
    };
    use std::io::Cursor;
    #[cfg(unix)]
    use std::process::{Command, Stdio};
    #[cfg(unix)]
    use std::sync::mpsc::{self, TryRecvError};
    #[cfg(unix)]
    use std::time::{Duration, Instant};
    use uuid::Uuid;

    #[cfg(unix)]
    fn spawn_test_sidecar(script: &str) -> SidecarProcess {
        let mut child = Command::new("sh")
            .args(["-c", script])
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("test sidecar should spawn");
        let stdin = child
            .stdin
            .take()
            .expect("test sidecar should expose stdin");
        SidecarProcess::new(child, stdin)
    }

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

    #[test]
    fn maps_effect_log_levels_to_native_filters() {
        let debug = parse_native_logging_config("Debug");
        assert_eq!(debug.effect_level, "Debug");
        assert_eq!(debug.native_level, log::LevelFilter::Debug);
        assert!(!debug.invalid_value);

        let warning = parse_native_logging_config("warn");
        assert_eq!(warning.effect_level, "Warn");
        assert_eq!(warning.native_level, log::LevelFilter::Warn);

        let invalid = parse_native_logging_config("verbose");
        assert_eq!(invalid.effect_level, "Info");
        assert_eq!(invalid.native_level, log::LevelFilter::Info);
        assert!(invalid.invalid_value);
    }

    #[test]
    fn preserves_delimited_and_eof_terminated_bounded_lines() {
        let mut reader = Cursor::new(b"first\nlast");

        assert_eq!(
            read_bounded_sidecar_line(&mut reader, 8).expect("first line should decode"),
            Some(b"first\n".to_vec())
        );
        assert_eq!(
            read_bounded_sidecar_line(&mut reader, 8).expect("EOF line should decode"),
            Some(b"last".to_vec())
        );
        assert_eq!(
            read_bounded_sidecar_line(&mut reader, 8).expect("reader should reach EOF"),
            None
        );
    }

    #[test]
    fn rejects_delimiter_terminated_line_over_limit() {
        let mut reader = Cursor::new(b"12345678\n");

        let error = read_bounded_sidecar_line(&mut reader, 8)
            .expect_err("newline must count toward the line limit");
        assert_eq!(error.kind(), std::io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("8-byte limit"));
    }

    #[test]
    fn rejects_eof_terminated_line_over_limit() {
        let mut reader = Cursor::new(b"123456789");

        let error = read_bounded_sidecar_line(&mut reader, 8)
            .expect_err("EOF must not permit an oversized line");
        assert_eq!(error.kind(), std::io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("8-byte limit"));
    }

    #[cfg(unix)]
    #[test]
    fn reports_actual_exit_before_event_bridge_cleanup() {
        let process = spawn_test_sidecar("exit 0");
        let (sender, mut events) = tauri::async_runtime::channel(1);
        monitor_sidecar_process(
            process.clone(),
            [std::thread::spawn(|| {}), std::thread::spawn(|| {})],
            sender,
        );

        assert!(process.lifecycle.wait_for_exit(Duration::from_secs(2)));
        assert_eq!(running_sidecar_pid(&process), None);
        let event = tauri::async_runtime::block_on(events.recv())
            .expect("termination event should follow the liveness transition");
        match event {
            tauri_plugin_shell::process::CommandEvent::Terminated(payload) => {
                assert_eq!(payload.code, Some(0));
                assert_eq!(payload.signal, None);
            }
            event => panic!("expected termination event, received {event:?}"),
        }
    }

    #[cfg(unix)]
    #[test]
    fn forced_stop_does_not_wait_for_blocked_stdin() {
        let process = spawn_test_sidecar("sleep 30");
        let writer_process = process.clone();
        let (started_sender, started_receiver) = mpsc::channel();
        let (result_sender, result_receiver) = mpsc::channel();
        let writer = std::thread::spawn(move || {
            started_sender
                .send(())
                .expect("writer start should be observed");
            let frame = vec![b'x'; MAX_IPC_FRAME_BYTES];
            result_sender
                .send(write_sidecar_frame(&writer_process, &frame))
                .expect("writer result should be observed");
        });

        started_receiver
            .recv_timeout(Duration::from_secs(1))
            .expect("writer should start");
        std::thread::sleep(Duration::from_millis(50));
        assert_eq!(result_receiver.try_recv(), Err(TryRecvError::Empty));

        let started_at = Instant::now();
        kill_sidecar(&process, "blocked-stdin-test");
        assert!(started_at.elapsed() < Duration::from_secs(1));
        let write_result = result_receiver
            .recv_timeout(Duration::from_secs(2))
            .expect("killing the child should unblock stdin");
        assert!(write_result.is_err());
        writer.join().expect("writer thread should finish");

        let deadline = Instant::now() + Duration::from_secs(2);
        loop {
            match poll_sidecar_process(&process).expect("liveness probe should succeed") {
                SidecarProcessPoll::Exited(_) | SidecarProcessPoll::Missing => break,
                SidecarProcessPoll::Running if Instant::now() < deadline => {
                    std::thread::sleep(Duration::from_millis(10));
                }
                SidecarProcessPoll::Running => panic!("killed test sidecar did not exit"),
            }
        }
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
