import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { BackupAdapter, BackupRoot } from "@backblaze-labs/agent-backup-core";

/**
 * OpenHands (All-Hands-AI) persists conversations to a local state dir, default
 * `~/.openhands`, overridable via `OH_PERSISTENCE_DIR`. Two on-disk layouts exist:
 *   - V1/SDK (current): `~/.openhands/conversations/<id>/{base_state.json,events/}`
 *   - V0 (legacy):      `~/.openhands/sessions/<id>/events/*.json` + `secrets.json`
 * plus `settings.json` in both. Persistence is JSON files — no SQLite in local mode.
 *
 * IMPORTANT — secrets are entangled: API keys live INSIDE `base_state.json` (V1)
 * and `settings.json`/`secrets.json` (V0). They cannot be isolated by path, so
 * this adapter does not try to exclude them — the engine encrypts the whole
 * mirror at rest. Setting OpenHands' own `OH_SECRET_KEY` additionally Fernet-
 * encrypts secrets on disk before we ever read them (defense in depth).
 *
 * Verified against github.com/OpenHands/software-agent-sdk
 * (conversation/state.py, persistence_const.py, utils/cipher.py) and docs.openhands.dev.
 */
export function openhandsCandidateRoots(env: NodeJS.ProcessEnv): BackupRoot[] {
  const home = os.homedir();
  const stateDir = env.OH_PERSISTENCE_DIR || path.join(home, ".openhands");
  const roots: BackupRoot[] = [{ label: "home", dir: stateDir }];
  // V0 local FILE_STORE, only when explicitly pointed somewhere persistent.
  if (env.FILE_STORE_PATH) {
    roots.push({ label: "filestore", dir: env.FILE_STORE_PATH });
  }
  return roots;
}

export const openhandsAdapter: BackupAdapter = {
  id: "openhands",

  resolveRoots(env) {
    return openhandsCandidateRoots(env).filter((r) => {
      try {
        return fs.statSync(r.dir).isDirectory();
      } catch {
        return false;
      }
    });
  },

  // Mirror the whole state dir — covers both V1 (conversations/) and V0
  // (sessions/, settings.json, secrets.json) layouts without guessing.
  include: [/^home\//, /^filestore\//],

  exclude: [
    // Scope cache exclusion to the state-dir roots — a blanket `cache/` match
    // anywhere could drop legitimate conversation content named "cache".
    /^(?:home|filestore)\/\.?cache\//,
    /\.lock$/,
    /\.tmp$/,
    /(^|\/)\.DS_Store$/,
  ],

  // No SQLite in local OSS mode; matched defensively in case a deployment adds one.
  sqlite: [/\.(db|sqlite)$/],

  // Secrets are embedded in backed-up JSON and cannot be path-isolated; the
  // encrypted full mirror is the protection layer (see file header).
  secretExclude: [],
};
