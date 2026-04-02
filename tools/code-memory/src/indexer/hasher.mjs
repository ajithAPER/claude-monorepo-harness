import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

/**
 * Compute SHA-256 hash of a file's contents.
 * @param {string} filePath - Absolute path to the file
 * @returns {Promise<string>} Hex-encoded SHA-256 hash
 */
export async function hashFile(filePath) {
  const content = await readFile(filePath);
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Compute SHA-256 hash of a string.
 * @param {string} content
 * @returns {string} Hex-encoded SHA-256 hash
 */
export function hashString(content) {
  return createHash('sha256').update(content).digest('hex');
}
