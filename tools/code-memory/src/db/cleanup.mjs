import Database from 'better-sqlite3';
import { readdirSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getReposDir, RETENTION_DAYS } from '../config.mjs';

/**
 * @typedef {Object} CleanupResult
 * @property {string[]} deleted - Repo IDs that were deleted
 * @property {string[]} kept - Repo IDs that were kept
 */

/**
 * Scan the repos directory and delete DBs with no writes for longer than retentionDays.
 * @param {Object} [options]
 * @param {number} [options.retentionDays]
 * @param {(msg: string) => void} [options.log]
 * @param {boolean} [options.dryRun]
 * @returns {CleanupResult}
 */
export function cleanupStaleRepos(options = {}) {
  const {
    retentionDays = RETENTION_DAYS,
    log = () => {},
    dryRun = false,
  } = options;

  const reposDir = getReposDir();
  const deleted = [];
  const kept = [];

  if (!existsSync(reposDir)) {
    return { deleted, kept };
  }

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let files;

  try {
    files = readdirSync(reposDir).filter((f) => f.endsWith('.db'));
  } catch {
    return { deleted, kept };
  }

  for (const file of files) {
    const dbPath = join(reposDir, file);
    const repoId = file.replace(/\.db$/, '');

    try {
      const lastWrite = getLastWriteTime(dbPath);

      if (lastWrite !== null && lastWrite < cutoff) {
        if (!dryRun) {
          deleteDbFiles(dbPath);
        }
        log(`Cleaned up stale repo ${repoId} (last write: ${new Date(lastWrite).toISOString()})`);
        deleted.push(repoId);
      } else {
        kept.push(repoId);
      }
    } catch {
      // Corrupt or unreadable DB — delete it
      if (!dryRun) {
        deleteDbFiles(dbPath);
      }
      log(`Cleaned up corrupt repo DB: ${repoId}`);
      deleted.push(repoId);
    }
  }

  return { deleted, kept };
}

/**
 * Read the last_flush_at timestamp from a repo DB.
 * @param {string} dbPath
 * @returns {number | null} Unix timestamp in ms, or null if no metadata
 */
function getLastWriteTime(dbPath) {
  const db = new Database(dbPath, { readonly: true });
  try {
    const row = /** @type {{ value: string } | undefined} */ (
      db.prepare("SELECT value FROM metadata WHERE key = 'last_flush_at'").get()
    );
    return row ? parseInt(row.value, 10) : null;
  } finally {
    db.close();
  }
}

/**
 * Delete a DB file and its WAL/SHM companions.
 * @param {string} dbPath
 */
function deleteDbFiles(dbPath) {
  for (const suffix of ['', '-wal', '-shm']) {
    const p = dbPath + suffix;
    if (existsSync(p)) {
      try {
        unlinkSync(p);
      } catch {
        // ignore
      }
    }
  }
}
