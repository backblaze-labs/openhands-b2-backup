# openhands-b2-backup

**Encrypted, incremental, off-site backups for your AI coding agent — powered by [Backblaze B2 cloud storage](https://blze.ai/storage).**

Incremental, **encrypted** backup of your [OpenHands](https://github.com/All-Hands-AI/OpenHands) conversations, settings, and secrets to [Backblaze B2](https://www.backblaze.com/cloud-storage).

Built on [`@backblaze-labs/agent-backup-core`](https://github.com/backblaze-labs/agent-backup-core).

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

## FAQ

**How do I get Backblaze B2 credentials?**

Create a free [Backblaze B2](https://blze.ai/storage) account, make a bucket, then create an Application Key. Use the keyID and applicationKey as `B2_KEY_ID` and `B2_APPLICATION_KEY`, and the bucket name as `B2_BUCKET`.

**Is my data encrypted?**

Yes — AES-256-GCM at rest. Set `B2_ENCRYPTION_KEY` to a long random passphrase. If you don't, it falls back to deriving a key from your B2 application key and prints a warning; setting a dedicated key means a leaked bucket credential can't decrypt your backups.

**How often does it back up, and can I change the schedule?**

By default it backs up immediately on start and then daily. Set `B2_SCHEDULE` to `daily`, `weekly`, or any cron expression.

**Does it re-upload everything each time?**

No. Backups are incremental — only files that changed since the last run are uploaded (SHA-256 diffing); unchanged files are carried forward server-side, so each snapshot still restores on its own.

**How do I restore OpenHands on a new machine?**

Install and run `openhands-b2-backup` on the new machine. If local state is empty and snapshots exist in your bucket, it auto-restores the latest snapshot on first run. (You can also point it at a fresh bucket prefix to keep machines separate.)

**How many snapshots are kept?**

The 10 most recent by default; older ones are pruned. Change with `B2_KEEP_SNAPSHOTS`.

**How do I run it automatically in the background?**

`openhands-b2-backup --install` writes an OS service (launchd on macOS, systemd user unit on Linux, Task Scheduler on Windows). Because a background service can't see your shell's exported variables, put your credentials in `~/.config/openhands-b2-backup/config.json` (chmod 600) before activating it.

**Can I back up several machines to one bucket?**

Yes — give each machine a distinct `B2_PREFIX` so their snapshots don't mix.

**How do I check it's actually working?**

Run `openhands-b2-backup --once` and watch the output; it logs what it uploaded and the snapshot id. You can also browse the bucket in the B2 web UI.

**How much does this cost?**

Only your Backblaze B2 storage, which is priced per GB-month — see [blze.ai/storage](https://blze.ai/storage). The tool itself is free and open source (MIT).

**It says there's nothing to back up — why?**

OpenHands persistence is opt-in (`FILE_STORE` defaults to in-memory). If nothing is written under `~/.openhands`, there's nothing to mirror. Enable file persistence in OpenHands first.

**Why is encryption effectively mandatory here?**

OpenHands stores API keys *inside* conversation JSON (`base_state.json`/`settings.json`), so they can't be excluded by path. The encrypted mirror is the only thing protecting them — keep encryption on and set `B2_ENCRYPTION_KEY` (and ideally OpenHands' own `OH_SECRET_KEY`).

**Does it support both the old and new layouts?**

Yes — both the legacy `sessions/` layout and the current `conversations/<id>/` (SDK) layout are mirrored.

## Learn more

- [Backblaze B2 Cloud Storage](https://blze.ai/storage) — affordable, S3-compatible object storage
- [agent-backup-core](https://github.com/backblaze-labs/agent-backup-core) — the shared backup engine powering this tool

## License

MIT
