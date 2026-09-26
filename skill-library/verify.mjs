// Offline archive integrity check. Does not import or execute any source package.
import { readFileSync, readdirSync, lstatSync, realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const library = dirname(fileURLToPath(import.meta.url));
const root = resolve(library, '..');
const files = new Map();
const ids = new Set();
const errors = [];
let entries = 0;
function localPath(value) {
  if (typeof value !== 'string' || !value || isAbsolute(value) || value.includes('\\') || value.split('/').includes('..')) throw new Error(`Invalid repository-relative path: ${value}`);
  const result = resolve(root, value);
  const inside = relative(root, realpathSync(result));
  if (inside.startsWith('..') || isAbsolute(inside)) throw new Error(`Path outside repository: ${value}`);
  if (!lstatSync(result).isFile()) throw new Error(`Not a regular file: ${value}`);
  return result;
}
for (const name of ['github-manifest.json', 'jiuwen-manifest.json']) {
  try {
    const manifest = JSON.parse(readFileSync(resolve(library, name), 'utf8'));
    if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.entries) || !manifest.entries.length) throw new Error('Invalid manifest schema');
    for (const entry of manifest.entries) {
      entries++;
      try {
        for (const key of ['id', 'name', 'sourceUrl', 'version', 'localPath', 'licenseStatus', 'completeness']) if (!entry[key]) throw new Error(`Missing ${key}`);
        if (ids.has(entry.id)) throw new Error(`Duplicate ID: ${entry.id}`);
        ids.add(entry.id);
        localPath(entry.localPath);
        if (!Array.isArray(entry.files) || !entry.files.some(file => file.path === entry.localPath)) throw new Error('Entry point missing from file inventory');
        if (entry.archiveSha256 && entry.archiveSha256 !== entry.hubArchiveSha256) throw new Error('Recorded Hub checksum mismatch');
        for (const file of entry.files) {
          if (!/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isInteger(file.bytes) || file.bytes < 0) throw new Error(`Invalid file record: ${file.path}`);
          const previous = files.get(file.path);
          if (previous && (previous.sha256 !== file.sha256 || previous.bytes !== file.bytes)) throw new Error(`Conflicting record: ${file.path}`);
          files.set(file.path, file);
        }
      } catch (error) { errors.push(`${name}/${entry.id ?? entries}: ${error.message}`); }
    }
  } catch (error) { errors.push(`${name}: ${error.message}`); }
}
let bytes = 0;
for (const file of files.values()) {
  try {
    const data = readFileSync(localPath(file.path));
    const hash = createHash('sha256').update(data).digest('hex');
    if (data.length !== file.bytes || hash !== file.sha256) throw new Error('SHA-256 or byte size mismatch');
    if (file.gitBlobSha1) {
      const gitHash = createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
      if (gitHash !== file.gitBlobSha1) throw new Error('Git blob SHA-1 mismatch');
    }
    bytes += data.length;
  } catch (error) { errors.push(`${file.path}: ${error.message}`); }
}
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) errors.push(`Unexpected symlink: ${relative(root, path)}`);
    else if (entry.isDirectory()) walk(path);
    else if (!files.has(relative(root, path).replaceAll('\\', '/'))) errors.push(`Unlisted source file: ${relative(root, path)}`);
  }
}
walk(resolve(library, 'sources'));
if (errors.length) {
  console.error(JSON.stringify({ status: 'failed', entries, uniqueFiles: files.size, errors }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ status: 'passed', entries, uniqueFiles: files.size, bytes, check: 'Manifest structure, local entries, complete source inventory, byte sizes, SHA-256, recorded Git blob SHA-1 and Hub archive checksums; offline only.' }, null, 2));
}
