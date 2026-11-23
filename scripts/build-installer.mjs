import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const { productName, version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const executable = 'ISCC.exe';
const systemRoots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'],
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Programs')].filter(Boolean);
const compiler = process.env.INNO_ISCC || [
  ...systemRoots.flatMap((directory) => ['Inno Setup 7', 'Inno Setup 6'].map((name) => join(directory, name, executable))),
  ...(process.env.PATH ?? '').split(delimiter).filter(Boolean).map((directory) => join(directory, executable)),
].find((candidate) => existsSync(candidate));

if (process.platform !== 'win32' || !compiler) {
  throw new Error('Build on Windows with Inno Setup 7 or 6.6+. Set INNO_ISCC to ISCC.exe if it is installed in a custom folder.');
}

const packageDir = join(root, 'out', `${productName}-win32-x64`);
if (!existsSync(join(packageDir, 'ab-sign.exe')) || !existsSync(join(packageDir, 'resources', 'app.asar'))) {
  throw new Error('The Windows x64 app package is missing. Run npm run installer to package it first.');
}

const result = spawnSync(compiler, [
  `/DAppVersion=${version}`, `/DPackagedApp=${packageDir}`, join(root, 'installer', 'ab-sign.iss'),
], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
