import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { recoverBoardEscrows } from './board-stakes.mjs';

// No data from this file is served by the public HTTP asset handler.
export async function openMeritLedger(filename) {
  let accounts = new Map();
  try {
    const data = JSON.parse(await readFile(filename, 'utf8'));
    if (data.version !== 1 || !Array.isArray(data.accounts)) throw new Error('Invalid merit ledger');
    accounts = new Map(data.accounts);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
  recoverBoardEscrows(accounts);
  let queue = Promise.resolve();
  const persist = () => {
    const contents = JSON.stringify({ version: 1, accounts: [...accounts] });
    const task = queue.then(async () => {
      await writeFile(filename + '.tmp', contents, { mode: 0o600 });
      await rename(filename + '.tmp', filename);
    });
    queue = task.catch(() => {});
    return task;
  };
  await persist();
  return { accounts, persist };
}
