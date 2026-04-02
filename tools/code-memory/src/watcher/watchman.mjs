import { Client } from 'fb-watchman';
import { resolve } from 'node:path';
import { SUPPORTED_EXTENSIONS, IGNORE_DIRS } from '../config.mjs';

/**
 * @typedef {Object} WatchmanSubscription
 * @property {() => void} close - Unsubscribe and close the client
 */

/**
 * Start watching a project with Watchman.
 * @param {string} projectRoot
 * @param {(filePath: string, eventType: 'change' | 'delete') => void} onChange
 * @param {(msg: string) => void} [log]
 * @returns {Promise<WatchmanSubscription>}
 */
export function startWatching(projectRoot, onChange, log = () => {}) {
  return new Promise((resolve_, reject) => {
    const client = new Client();

    client.on('error', (err) => {
      log(`Watchman error: ${err.message}`);
    });

    // Check capabilities
    client.capabilityCheck(
      { optional: [], required: ['relative_root'] },
      (err, resp) => {
        if (err) {
          log(`Watchman capability check failed: ${err.message}`);
          reject(err);
          return;
        }

        // Watch the project
        client.command(['watch-project', projectRoot], (err, resp) => {
          if (err) {
            log(`Watchman watch-project failed: ${err.message}`);
            reject(err);
            return;
          }

          const watch = resp.watch;
          const relativePath = resp.relative_path || '';

          log(`Watchman watching: ${watch}`);

          // Build suffix expression for supported file types
          const suffixes = SUPPORTED_EXTENSIONS.map((ext) => ext.slice(1)); // Remove leading dot
          const suffixExpr = ['anyof', ...suffixes.map((s) => ['suffix', s])];

          // Build exclusion expression
          const excludeExpr = [
            'not',
            [
              'anyof',
              ...IGNORE_DIRS.map((dir) => ['dirname', dir]),
            ],
          ];

          // Subscribe
          const sub = {
            expression: ['allof', suffixExpr, excludeExpr],
            fields: ['name', 'exists', 'type'],
          };

          if (relativePath) {
            sub.relative_root = relativePath;
          }

          client.command(
            ['subscribe', watch, 'code-memory', sub],
            (err, resp) => {
              if (err) {
                log(`Watchman subscribe failed: ${err.message}`);
                reject(err);
                return;
              }

              log('Watchman subscription active');

              // Handle file change notifications
              client.on('subscription', (resp) => {
                if (resp.subscription !== 'code-memory') return;

                for (const file of resp.files || []) {
                  const filePath = resolve(
                    projectRoot,
                    relativePath,
                    file.name
                  );
                  const eventType = file.exists ? 'change' : 'delete';
                  onChange(filePath, eventType);
                }
              });

              resolve_({
                close() {
                  client.command(
                    ['unsubscribe', watch, 'code-memory'],
                    () => {
                      client.end();
                    }
                  );
                },
              });
            }
          );
        });
      }
    );
  });
}
