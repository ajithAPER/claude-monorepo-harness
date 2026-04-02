import { createServer } from 'node:net';
import { unlinkSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import {
  getSocketPath,
  getBaseDir,
  DAEMON_TIMEOUT_MS,
  INACTIVITY_CHECK_MS,
  VERSION,
} from '../config.mjs';
import {
  createDaemonManager,
  touchGlobalActivity,
  shutdownManager,
} from './lifecycle.mjs';
import { handleRequest } from './handler.mjs';

/**
 * Start the global daemon server.
 * @param {Object} [options]
 * @param {number} [options.timeout] - Global inactivity timeout in ms
 */
export function startDaemon(options = {}) {
  const { timeout = DAEMON_TIMEOUT_MS } = options;
  const socketPath = getSocketPath();

  const log = (/** @type {string} */ msg) => {
    const ts = new Date().toISOString();
    process.stderr.write(`[code-memory ${ts}] ${msg}\n`);
  };

  // Ensure base directory exists
  mkdirSync(getBaseDir(), { recursive: true, mode: 0o700 });

  // Clean up stale socket
  if (existsSync(socketPath)) {
    try {
      unlinkSync(socketPath);
    } catch {
      // ignore
    }
  }

  // Initialize daemon manager (multi-repo)
  const manager = createDaemonManager({ log });

  // Create server
  const server = createServer((socket) => {
    let buffer = '';

    socket.on('data', (data) => {
      touchGlobalActivity(manager);
      buffer += data.toString();

      // Process complete JSON lines
      let newlineIdx;
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIdx);
        buffer = buffer.slice(newlineIdx + 1);

        if (!line.trim()) continue;

        try {
          const rawRequest = JSON.parse(line);
          const response = handleRequest(manager, rawRequest, log);
          socket.write(JSON.stringify(response) + '\n');
        } catch (err) {
          socket.write(
            JSON.stringify({
              error: { code: -32700, message: `Parse error: ${err.message}` },
            }) + '\n'
          );
        }
      }
    });

    socket.on('error', () => {
      // Client disconnected, ignore
    });
  });

  server.listen(socketPath, () => {
    log(`Daemon v${VERSION} listening on ${socketPath}`);
    log(`PID: ${process.pid}`);
    log(`Inactivity timeout: ${timeout / 1000}s`);

    // Write PID file with version
    const pidPath = socketPath + '.pid';
    writeFileSync(pidPath, `${process.pid}\n${VERSION}`);
  });

  // Global inactivity check
  const inactivityCheck = setInterval(() => {
    const elapsed = Date.now() - manager.globalLastActivity;
    if (elapsed > timeout) {
      log(`Inactive for ${Math.round(elapsed / 1000)}s, shutting down...`);
      cleanup();
    }
  }, INACTIVITY_CHECK_MS);

  manager.inactivityTimer = inactivityCheck;

  function cleanup() {
    clearInterval(inactivityCheck);
    server.close();
    shutdownManager(manager, log);

    // Clean up socket and PID file
    try {
      if (existsSync(socketPath)) unlinkSync(socketPath);
      const pidPath = socketPath + '.pid';
      if (existsSync(pidPath)) unlinkSync(pidPath);
    } catch {
      // ignore
    }

    process.exit(0);
  }

  // Graceful shutdown handlers
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);

  server.on('error', (err) => {
    log(`Server error: ${err.message}`);
    cleanup();
  });
}
