'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { initialState, validateState, migrateState } = require('./domain.js');

class RecoveryRequired extends Error {
  constructor(message, backupAvailable) { super(message); this.name = 'RecoveryRequired'; this.backupAvailable = backupAvailable; }
}
class Store {
  constructor(directory) { this.directory = directory; this.file = path.join(directory, 'camp.json'); this.backup = path.join(directory, 'camp.backup.json'); this.queue = Promise.resolve(); this.state = null; }
  async readDocument(file) {
    const raw = await fs.readFile(file);
    const parsed = JSON.parse(raw.toString('utf8'));
    return { state: migrateState(parsed), version: parsed.version };
  }
  async read(file) { return (await this.readDocument(file)).state; }
  async backupBeforeMigration() {
    const root = path.join(path.dirname(this.directory), 'backups');
    await fs.mkdir(root, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const directory = await fs.mkdtemp(path.join(root, `pre-v1.1.0-${stamp}-`));
    const hashes = {};
    for (const file of [this.file, this.backup]) {
      let original;
      try { original = await fs.readFile(file); }
      catch (e) { if (e.code === 'ENOENT') continue; throw e; }
      const name = path.basename(file), target = path.join(directory, name);
      await this.durableWrite(target, original);
      const copied = await fs.readFile(target);
      if (!original.equals(copied)) throw new Error('升级前备份核对失败，原记录已保留。');
      hashes[name] = crypto.createHash('sha256').update(copied).digest('hex');
    }
    if (!Object.keys(hashes).length) throw new Error('未找到可备份的旧记录，已停止升级。');
    await this.durableWrite(path.join(directory, 'SHA256.json'), JSON.stringify(hashes, null, 2));
    this.lastMigrationBackup = directory;
    return directory;
  }
  async load() {
    await fs.mkdir(this.directory, { recursive: true });
    let document;
    try { document = await this.readDocument(this.file); }
    catch (error) {
      let backup = null;
      try { backup = await this.read(this.backup); } catch {}
      if (error.code === 'ENOENT' && !backup) {
        // A damaged backup or interrupted temporary file is evidence of existing data.
        const files = await fs.readdir(this.directory);
        if (files.some(f => f.startsWith('camp.'))) throw new RecoveryRequired('主记录缺失，发现历史文件，请保留文件后恢复。', false);
        const empty = initialState(); await this.write(empty, false); this.state = empty;
      } else throw new RecoveryRequired('本地记录无法读取。原文件将保留，不会覆盖为空记录。', Boolean(backup));
    }
    // Migration failures are not corruption: do not offer recovery or publish new state.
    if (document) {
      if (document.version === 1) {
        await this.backupBeforeMigration();
        await this.write(document.state, false);
      }
      this.state = document.state;
    }
    return this.snapshot();
  }
  async recover() {
    const document = await this.readDocument(this.backup);
    if (document.version === 1) await this.backupBeforeMigration();
    try { await fs.copyFile(this.file, path.join(this.directory, `camp.damaged-${Date.now()}.json`)); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    await this.write(document.state, false); this.state = document.state; return this.snapshot();
  }
  snapshot() { return structuredClone(this.state); }
  async replace(from, to) {
    for (let attempt = 0; ; attempt++) {
      try { await fs.rename(from, to); return; }
      catch (e) { if (!['EPERM','EBUSY','EACCES'].includes(e.code) || attempt >= 4) throw e; await new Promise(r => setTimeout(r, 30 * (attempt + 1))); }
    }
  }
  async durableWrite(file, content) {
    const handle = await fs.open(file, 'w');
    try { await handle.writeFile(content, 'utf8'); await handle.sync(); } finally { await handle.close(); }
  }
  async write(state, preserve = true) {
    validateState(state);
    const content = JSON.stringify(state, null, 2);
    await this.durableWrite(`${this.file}.tmp`, content);
    if (preserve) {
      const previous = await this.read(this.file);
      await this.durableWrite(`${this.backup}.tmp`, JSON.stringify(previous, null, 2));
      await this.replace(`${this.backup}.tmp`, this.backup);
    }
    await this.replace(`${this.file}.tmp`, this.file);
  }
  transact(mutator) {
    const pending = this.queue.then(async () => {
      const next = this.snapshot();
      const result = await mutator(next);
      if (result?.changed !== false) { await this.write(next); this.state = next; }
      return { state: this.snapshot(), result };
    });
    this.queue = pending.catch(() => {});
    return pending;
  }
  idle() { return this.queue; }
}
module.exports = { Store, RecoveryRequired };
