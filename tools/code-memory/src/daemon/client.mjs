import { connect } from 'node:net';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { getSocketPath, CLIENT_TIMEOUT_MS, VERSION } from '../config.mjs';
import { validateResponse } from './protocol.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Send a request to the daemon and get a response.
 * Auto-starts the daemon if it's not running.
 * Auto-injects projectRoot into request params.
 * @param {string} projectRoot
 * @param {import('../types.mjs').DaemonRequest} request
 * @param {Object} [options]
 * @param {number} [options.timeout]
 * @returns {Promise<any>}
 */
export async function sendRequest(projectRoot, request, options = {}) {
  const { timeout = CLIENT_TIMEOUT_MS } = options;
  const socketPath = getSocketPath();

  // Ensure daemon version matches
  await ensureDaemonVersion();

  // Inject projectRoot into params
  const enrichedRequest = {
    ...request,
    params: { ...request.params, projectRoot: resolve(projectRoot) },
  };

  // Try to connect; if daemon is not running, start it
  try {
    return await doRequest(socketPath, enrichedRequest, timeout);
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOENT') {
      await spawnDaemon();
      await waitForSocket(socketPath, 15000);
      return await doRequest(socketPath, enrichedRequest, timeout);
    }
    throw err;
  }
}

/**
 * Check if the daemon is running.
 * @returns {boolean}
 */
export function isDaemonRunning() {
  return existsSync(getSocketPath());
}

/**
 * Get the daemon PID.
 * @returns {number | null}
 */
export function getDaemonPid() {
  const pidPath = getSocketPath() + '.pid';
  if (!existsSync(pidPath)) return null;
  try {
    const content = readFileSync(pidPath, 'utf-8').trim();
    const firstLine = content.split('\n')[0];
    return parseInt(firstLine, 10);
  } catch {
    return null;
  }
}

/**
 * Get the running daemon's version from PID file.
 * @returns {string | null}
 */
export function getDaemonVersion() {
  const pidPath = getSocketPath() + '.pid';
  if (!existsSync(pidPath)) return null;
  try {
    const content = readFileSync(pidPath, 'utf-8').trim();
    const lines = content.split('\n');
    return lines[1] || null;
  } catch {
    return null;
  }
}

/**
 * Ensure the running daemon matches the current package version.
 * If there's a version mismatch, shut down the old daemon.
 */
async function ensureDaemonVersion() {
  const socketPath = getSocketPath();
  if (!existsSync(socketPath)) return;

  // Check if socket's PID is actually running
  const pid = getDaemonPid();
  if (pid !== null) {
    try {
      process.kill(pid, 0); // test if process exists
    } catch {
      // Process not running — clean up stale socket
      cleanupStaleSocket(socketPath);
      return;
    }
  }

  // Check version
  const runningVersion = getDaemonVersion();
  if (runningVersion && runningVersion !== VERSION) {
    // Version mismatch — shut down old daemon
    try {
      await doRequest(socketPath, { method: 'shutdown' }, 3000);
    } catch {
      // Daemon might already be dead
    }

    // Wait for socket to be cleaned up
    const start = Date.now();
    while (existsSync(socketPath) && Date.now() - start < 5000) {
      await new Promise((r) => setTimeout(r, 100));
    }

    // Force cleanup if still there
    if (existsSync(socketPath)) {
      cleanupStaleSocket(socketPath);
    }
  }
}

/**
 * @param {string} socketPath
 */
function cleanupStaleSocket(socketPath) {
  try {
    if (existsSync(socketPath)) unlinkSync(socketPath);
    const pidPath = socketPath + '.pid';
    if (existsSync(pidPath)) unlinkSync(pidPath);
  } catch {
    // ignore
  }
}

/**
 * @param {string} socketPath
 * @param {import('../types.mjs').DaemonRequest} request
 * @param {number} timeout
 * @returns {Promise<any>}
 */
function doRequest(socketPath, request, timeout) {
  return new Promise((resolve, reject) => {
    const socket = connect(socketPath);
    let buffer = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        socket.destroy();
        reject(new Error('Request timed out'));
      }
    }, timeout);

    socket.on('connect', () => {
      socket.write(JSON.stringify(request) + '\n');
    });

    socket.on('data', (data) => {
      buffer += data.toString();
      const newlineIdx = buffer.indexOf('\n');
      if (newlineIdx !== -1) {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          socket.destroy();
          try {
            const raw = JSON.parse(buffer.slice(0, newlineIdx));
            const validation = validateResponse(raw);
            if (!validation.ok) {
              reject(new Error(validation.error));
              return;
            }
            const response = validation.response;
            if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve(response.result);
            }
          } catch (err) {
            reject(err);
          }
        }
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
  });
}

/**
 * Spawn the daemon as a detached background process.
 */
async function spawnDaemon() {
  const serverScript = resolve(__dirname, 'server-entry.mjs');
  const child = spawn(process.execPath, [serverScript], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env },
  });
  child.unref();
}

/**
 * Wait for the socket file to appear.
 * @param {string} socketPath
 * @param {number} timeoutMs
 * @returns {Promise<void>}
 */
function waitForSocket(socketPath, timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (existsSync(socketPath)) {
        setTimeout(resolve, 200);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error('Timed out waiting for daemon to start'));
        return;
      }
      setTimeout(check, 100);
    };
    check();
  });
}
