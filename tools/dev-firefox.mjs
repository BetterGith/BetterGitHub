import { spawn, spawnSync } from 'node:child_process';
import { watch } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
function build() {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-File', resolve(root, 'build.ps1'), '-Target', 'firefox'], { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) throw new Error('Firefox build failed');
}
build();
const browser = spawn(process.execPath, [resolve(root, 'node_modules/web-ext/bin/web-ext.js'), 'run', '--source-dir', resolve(root, 'dist/firefox'), '--firefox', process.env.FIREFOX_BINARY || 'C:\\Program Files\\Mozilla Firefox\\firefox.exe', '--start-url', 'https://github.com/'], { cwd: root, stdio: 'inherit', windowsHide: true });
let timer;
const changed = (_, filename) => {
  if (!filename || !/\.(js|css|html|json|png|woff2)$/i.test(String(filename))) return;
  clearTimeout(timer);
  timer = setTimeout(() => { try { build(); } catch (error) { console.error(error.message); } }, 250);
};
const watchers = [root, resolve(root, 'fonts'), resolve(root, 'icons')].map(path => watch(path, changed));
browser.on('exit', code => { watchers.forEach(watcher => watcher.close()); clearTimeout(timer); process.exitCode = code || 0; });
browser.on('error', error => { console.error(error); watchers.forEach(watcher => watcher.close()); process.exitCode = 1; });
process.on('SIGINT', () => { browser.kill(); watchers.forEach(watcher => watcher.close()); });
