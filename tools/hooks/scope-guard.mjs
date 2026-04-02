#!/usr/bin/env node
/**
 * Scope Guard — PreToolUse hook that enforces Scope.Owns file ownership.
 *
 * When a task is active (in tasks/active/), this hook blocks Write/Edit/MultiEdit
 * operations on files outside the task's Scope.Owns paths.
 *
 * If no active tasks exist, all writes are allowed (no enforcement).
 * If a file matches ANY active task's Scope.Owns, the write is allowed.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { execSync } from 'node:child_process';

const GUARDED_TOOLS = new Set(['Write', 'Edit', 'MultiEdit']);

/**
 * Find the repo root via git.
 */
function repoRoot() {
  return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
}

/**
 * Parse the ### Owns section from a task file's markdown body.
 * Returns an array of glob patterns.
 */
function parseOwnsSection(content) {
  const lines = content.split('\n');
  const owns = [];
  let inOwnsSection = false;

  for (const line of lines) {
    if (/^###\s+Owns/.test(line)) {
      inOwnsSection = true;
      continue;
    }
    if (inOwnsSection) {
      // Stop at next heading
      if (/^##/.test(line)) break;
      // Collect bullet items
      const match = line.match(/^\s*-\s+`?([^`\s(]+)`?/);
      if (match) {
        const pattern = match[1].replace(/\s*\(.*$/, '').trim();
        if (pattern && pattern !== 'TBD') owns.push(pattern);
      }
    }
  }
  return owns;
}

/**
 * Simple glob matching that supports * and ** patterns.
 * - `*` matches any characters except `/`
 * - `**` matches any characters including `/`
 * - Patterns without wildcards are treated as prefix matches
 */
function globMatch(pattern, filePath) {
  // Normalize: remove leading ./ from both
  const normPattern = pattern.replace(/^\.\//, '');
  const normPath = filePath.replace(/^\.\//, '');

  // If pattern has no wildcards, treat as prefix match
  if (!normPattern.includes('*')) {
    return normPath === normPattern || normPath.startsWith(normPattern + '/') || normPath.startsWith(normPattern);
  }

  // Convert glob to regex
  let regex = normPattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape special regex chars (not * and ?)
    .replace(/\*\*/g, '{{GLOBSTAR}}')        // Placeholder for **
    .replace(/\*/g, '[^/]*')                  // * matches anything except /
    .replace(/{{GLOBSTAR}}/g, '.*')           // ** matches anything including /
    .replace(/\?/g, '[^/]');                  // ? matches single char except /

  return new RegExp('^' + regex + '$').test(normPath);
}

/**
 * Get all owned paths from all active tasks.
 */
function getAllActiveOwns(root) {
  const activeDir = join(root, 'tasks', 'active');
  let files;
  try {
    files = readdirSync(activeDir).filter(f => f.endsWith('.md'));
  } catch {
    return []; // No active directory or no tasks
  }

  const allOwns = [];
  for (const file of files) {
    try {
      const content = readFileSync(join(activeDir, file), 'utf-8');
      const owns = parseOwnsSection(content);
      allOwns.push(...owns);
    } catch {
      // Skip unreadable task files
    }
  }
  return allOwns;
}

// --- Main ---

try {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const inputData = JSON.parse(Buffer.concat(chunks).toString());

  const toolName = inputData.tool_name || '';

  // Only guard Write/Edit/MultiEdit
  if (!GUARDED_TOOLS.has(toolName)) {
    process.stdout.write(JSON.stringify({}));
    process.exit(0);
  }

  const toolInput = inputData.tool_input || {};
  const filePath = toolInput.file_path || '';

  if (!filePath) {
    process.stdout.write(JSON.stringify({}));
    process.exit(0);
  }

  const root = repoRoot();
  const allOwns = getAllActiveOwns(root);

  // No active tasks = no enforcement
  if (allOwns.length === 0) {
    process.stdout.write(JSON.stringify({}));
    process.exit(0);
  }

  // Make file path relative to repo root for matching
  const absPath = resolve(filePath);
  const relPath = relative(root, absPath);

  // Check if file matches any owned pattern
  const allowed = allOwns.some(pattern => globMatch(pattern, relPath));

  if (allowed) {
    process.stdout.write(JSON.stringify({}));
  } else {
    const msg = `**[scope-guard]** File \`${relPath}\` is outside the active task's \`Scope.Owns\`.\n\nAllowed paths:\n${allOwns.map(p => '- `' + p + '`').join('\n')}\n\nIf this file needs modification, update the task's Scope.Owns or coordinate with the orchestrator.`;
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
      },
      systemMessage: msg,
    }));
  }
} catch (e) {
  // On error, allow the operation (fail open) and report
  process.stdout.write(JSON.stringify({
    systemMessage: `scope-guard warning: ${e.message}`,
  }));
}
