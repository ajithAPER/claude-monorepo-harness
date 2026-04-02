import Database from 'better-sqlite3';
import { gzipSync, gunzipSync } from 'node:zlib';
import Graph from 'graphology';
import { createGraph } from '../graph/model.mjs';

const SCHEMA_VERSION = '1';

/**
 * @typedef {Object} Persistence
 * @property {() => Graph} load - Load graph from SQLite
 * @property {(graph: Graph) => void} save - Save graph to SQLite
 * @property {() => void} close - Close the database connection
 * @property {boolean} isDirty - Whether graph has unsaved changes
 * @property {() => void} markDirty - Mark graph as having unsaved changes
 * @property {() => void} markClean - Mark graph as saved
 */

/**
 * Create a persistence manager for the graph.
 * @param {string} dbPath - Path to the SQLite database file
 * @returns {Persistence}
 */
export function createPersistence(dbPath) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Initialize schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS graph_snapshot (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data BLOB NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Set schema version
  const upsertMeta = db.prepare(
    'INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)'
  );
  upsertMeta.run('schema_version', SCHEMA_VERSION);

  let dirty = false;

  return {
    get isDirty() {
      return dirty;
    },

    markDirty() {
      dirty = true;
    },

    markClean() {
      dirty = false;
    },

    load() {
      const row = /** @type {{ data: Buffer, updated_at: number } | undefined} */ (
        db.prepare('SELECT data, updated_at FROM graph_snapshot WHERE id = 1').get()
      );

      if (!row) {
        return createGraph();
      }

      const json = gunzipSync(row.data).toString('utf-8');
      const serialized = JSON.parse(json);
      const graph = createGraph();
      graph.import(serialized);
      return graph;
    },

    save(graph) {
      const serialized = JSON.stringify(graph.export());
      const compressed = gzipSync(Buffer.from(serialized, 'utf-8'));
      const now = Date.now();

      const upsert = db.prepare(
        'INSERT OR REPLACE INTO graph_snapshot (id, data, updated_at) VALUES (1, ?, ?)'
      );
      upsert.run(compressed, now);
      upsertMeta.run('last_flush_at', String(now));
      upsertMeta.run('file_count', String(graph.order));
      upsertMeta.run('edge_count', String(graph.size));
      dirty = false;
    },

    close() {
      db.close();
    },
  };
}
