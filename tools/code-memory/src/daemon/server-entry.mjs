#!/usr/bin/env node

/**
 * Entry point for the daemon process.
 * Called by the client when spawning a new daemon.
 * The daemon is global — no project-specific arguments needed.
 */

import { startDaemon } from './server.mjs';

startDaemon();
