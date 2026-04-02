#!/usr/bin/env node

import { Command } from 'commander';
import { resolve, relative } from 'node:path';
import { sendRequest, isDaemonRunning, getDaemonPid } from './daemon/client.mjs';
import { formatOutput, formatTable } from './query/formatter.mjs';
import { VERSION } from './config.mjs';

const program = new Command();
const projectRoot = process.cwd();

program
  .name('code-memory')
  .description('Graph-based codebase memory daemon')
  .version(VERSION);

// --- index ---
program
  .command('index')
  .argument('[path]', 'path to index', '.')
  .option('--force', 're-index all files, ignoring cache')
  .option('--language <lang>', 'only index files of this language')
  .description('Index codebase into the knowledge graph')
  .action(async (path, opts) => {
    const fullPath = resolve(path);
    console.log('Indexing...');
    const result = await sendRequest(projectRoot, {
      method: 'index',
      params: { path: fullPath, force: opts.force, language: opts.language },
    }, { timeout: 60000 });
    console.log(`Indexed: ${result.indexed} files`);
    console.log(`Skipped: ${result.skipped} unchanged`);
    if (result.errors) console.log(`Errors: ${result.errors}`);
  });

// --- status ---
program
  .command('status')
  .description('Show graph stats and daemon info')
  .action(async () => {
    const result = await sendRequest(projectRoot, { method: 'status' });
    console.log(formatTable(
      ['Metric', 'Value'],
      [
        ['Version', result.version || VERSION],
        ['RepoID', result.repoId || '-'],
        ['Files', String(result.fileCount)],
        ['Symbols', String(result.symbolCount)],
        ['Edges', String(result.edgeCount)],
        ['Dirty', result.isDirty ? 'yes' : 'no'],
        ['PID', String(result.pid)],
        ['Project', result.projectRoot],
      ]
    ));
  });

// --- query ---
program
  .command('query')
  .argument('<term>', 'symbol name to search for')
  .option('--kind <kind>', 'filter by kind (function, class, struct, etc.)')
  .option('--exported', 'only show exported symbols')
  .option('--language <lang>', 'filter by language')
  .option('--format <fmt>', 'output format: flat, json', 'flat')
  .description('Search for symbols by name')
  .action(async (term, opts) => {
    const result = await sendRequest(projectRoot, {
      method: 'query',
      params: {
        term,
        kind: opts.kind,
        exported: opts.exported || undefined,
        language: opts.language,
      },
    });

    if (result.length === 0) {
      console.log('No symbols found.');
      return;
    }

    if (opts.format === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatTable(
        ['Name', 'Kind', 'File', 'Line', 'Exported'],
        result.map((s) => [
          s.name,
          s.kind,
          relative(projectRoot, s.file),
          String(s.line),
          s.exported ? 'yes' : '',
        ])
      ));
    }
  });

// --- deps ---
program
  .command('deps')
  .argument('<file>', 'file to analyze')
  .option('--depth <n>', 'max depth', '3')
  .option('--direction <dir>', 'in, out, or both', 'out')
  .option('--format <fmt>', 'output format: tree, json, flat', 'tree')
  .description('Show dependency tree for a file')
  .action(async (file, opts) => {
    const result = await sendRequest(projectRoot, {
      method: 'deps-tree',
      params: {
        file,
        depth: parseInt(opts.depth, 10),
        direction: opts.direction,
      },
    });
    console.log(formatOutput(result, opts.format, projectRoot));
  });

// --- hubs ---
program
  .command('hubs')
  .option('--top <n>', 'number of results', '10')
  .description('Show most-imported internal files')
  .action(async (opts) => {
    const result = await sendRequest(projectRoot, {
      method: 'hubs',
      params: { top: parseInt(opts.top, 10) },
    });

    if (result.length === 0) {
      console.log('No hubs found.');
      return;
    }

    console.log(formatTable(
      ['File', 'Importers'],
      result.map((h) => [
        relative(projectRoot, h.file),
        String(h.importerCount),
      ])
    ));
  });

// --- files ---
program
  .command('files')
  .argument('[glob]', 'glob pattern to filter')
  .option('--language <lang>', 'filter by language')
  .option('--format <fmt>', 'output format: flat, json', 'flat')
  .description('List indexed files')
  .action(async (glob, opts) => {
    const result = await sendRequest(projectRoot, {
      method: 'files',
      params: { glob, language: opts.language },
    });

    if (opts.format === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      for (const f of result) {
        console.log(relative(projectRoot, f.file));
      }
    }
  });

// --- exports ---
program
  .command('exports')
  .argument('<file>', 'file to inspect')
  .option('--format <fmt>', 'output format: flat, json', 'flat')
  .description('List exported symbols from a file')
  .action(async (file, opts) => {
    const result = await sendRequest(projectRoot, {
      method: 'exports',
      params: { file },
    });

    if (result.length === 0) {
      console.log('No exports found.');
      return;
    }

    if (opts.format === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatTable(
        ['Name', 'Kind', 'Line'],
        result.map((e) => [e.name, e.kind, String(e.line)])
      ));
    }
  });

// --- daemon ---
const daemon = program
  .command('daemon')
  .description('Manage the daemon process');

daemon
  .command('start')
  .description('Start the daemon')
  .action(async () => {
    if (isDaemonRunning()) {
      const pid = getDaemonPid();
      console.log(`Daemon already running (PID: ${pid})`);
      return;
    }
    console.log('Starting daemon...');
    const result = await sendRequest(projectRoot, { method: 'ping' }, { timeout: 15000 });
    console.log(`Daemon v${result.version} started (PID: ${result.pid})`);
  });

daemon
  .command('stop')
  .description('Stop the daemon')
  .action(async () => {
    if (!isDaemonRunning()) {
      console.log('Daemon is not running.');
      return;
    }
    try {
      await sendRequest(projectRoot, { method: 'shutdown' });
      console.log('Daemon stopping...');
    } catch {
      console.log('Daemon stopped.');
    }
  });

daemon
  .command('status')
  .description('Show daemon status')
  .action(async () => {
    if (!isDaemonRunning()) {
      console.log('Daemon is not running.');
      return;
    }
    try {
      const result = await sendRequest(projectRoot, { method: 'status' });
      console.log(formatTable(
        ['Metric', 'Value'],
        [
          ['Version', result.version || VERSION],
          ['RepoID', result.repoId || '-'],
          ['PID', String(result.pid)],
          ['Files', String(result.fileCount)],
          ['Symbols', String(result.symbolCount)],
          ['Edges', String(result.edgeCount)],
          ['Dirty', result.isDirty ? 'yes' : 'no'],
          ['Project', result.projectRoot],
        ]
      ));
    } catch {
      console.log('Daemon is not responding.');
    }
  });

daemon
  .command('repos')
  .description('List all loaded repositories')
  .action(async () => {
    if (!isDaemonRunning()) {
      console.log('Daemon is not running.');
      return;
    }
    try {
      const result = await sendRequest(projectRoot, { method: 'list-repos' });
      if (result.length === 0) {
        console.log('No repos loaded.');
        return;
      }
      console.log(formatTable(
        ['RepoID', 'Project', 'Files', 'Symbols', 'Last Activity'],
        result.map((r) => [
          r.repoId,
          r.projectRoot,
          String(r.fileCount),
          String(r.symbolCount),
          new Date(r.lastActivity).toLocaleTimeString(),
        ])
      ));
    } catch {
      console.log('Daemon is not responding.');
    }
  });

program.parseAsync().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
