# openhands-b2-backup

Incremental, **encrypted** backup of your [OpenHands](https://github.com/All-Hands-AI/OpenHands) conversations, settings, and secrets to [Backblaze B2](https://www.backblaze.com/cloud-storage).

Built on [`@backblaze-labs/agent-backup-core`](https://github.com/backblaze-b2-samples/agent-backup-core).

## Why

OpenHands stores every conversation locally as JSON (`base_state.json` + an append-only `events/` log) under `~/.openhands`. There's no official cloud backup — only single-conversation export. This mirrors all of it to B2 on a schedule. (`FILE_STORE=s3` points *primary* storage at the cloud; it is not an encrypted, versioned backup.)

## Install & configure

```bash
npm install -g @backblaze-labs/openhands-b2-backup
export B2_KEY_ID=004... B2_APPLICATION_KEY=K004... B2_BUCKET=my-openhands-backups
export B2_ENCRYPTION_KEY="a long random passphrase"   # important — see Security
```

Or `~/.config/openhands-b2-backup/config.json`. Optional: `B2_REGION`, `B2_PREFIX`, `B2_SCHEDULE`, `B2_KEEP_SNAPSHOTS`, `OH_PERSISTENCE_DIR`, `FILE_STORE_PATH`.

> Persistence is **opt-in** in OpenHands (`FILE_STORE` defaults to `memory`). If nothing is on disk under `~/.openhands`, there's nothing to back up — the daemon will say so.

## Run

```bash
openhands-b2-backup            # daemon: auto-restore on first run, then scheduled backups
openhands-b2-backup --once     # single backup then exit
openhands-b2-backup --install  # install an OS service (launchd / systemd / Task Scheduler)
```

## What gets backed up

Mirrors `~/.openhands` (or `OH_PERSISTENCE_DIR`), covering both layouts:
- **V1 (current):** `conversations/<id>/base_state.json` + `events/`
- **V0 (legacy):** `sessions/<id>/events/*.json`, plus `settings.json` and `secrets.json`

Caches and lock/temp files are excluded. No SQLite is used in local mode, so no database-snapshot concerns.

## Security — read this

**OpenHands embeds secrets *inside* the files you must back up.** API keys live in fields within `base_state.json` (V1) and `settings.json`/`secrets.json` (V0) — they cannot be separated out by path. This tool therefore does **not** attempt selective secret exclusion; instead:

- **Set `B2_ENCRYPTION_KEY`.** The entire mirror is encrypted at rest with AES-256-GCM, separate from your B2 credentials. This is the protection layer for the embedded secrets.
- **Also set OpenHands' own `OH_SECRET_KEY`** if you can — it Fernet-encrypts secrets on disk before this tool ever reads them (defense in depth). Without it, OpenHands redacts secrets on save and they won't restore.

If you need backups with secrets fully stripped (e.g. to share), that requires field-level redaction, which this version does not do.

## License

MIT
