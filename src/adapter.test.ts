import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { shouldInclude } from "@backblaze-labs/agent-backup-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openhandsAdapter, openhandsCandidateRoots } from "./adapter.js";

describe("openhandsCandidateRoots", () => {
  it("uses ~/.openhands by default and honors OH_PERSISTENCE_DIR", () => {
    expect(openhandsCandidateRoots({} as NodeJS.ProcessEnv)[0]).toEqual({
      label: "home",
      dir: path.join(os.homedir(), ".openhands"),
    });
    expect(openhandsCandidateRoots({ OH_PERSISTENCE_DIR: "/oh" } as NodeJS.ProcessEnv)[0].dir).toBe("/oh");
  });

  it("adds a filestore root only when FILE_STORE_PATH is set", () => {
    expect(openhandsCandidateRoots({} as NodeJS.ProcessEnv).map((r) => r.label)).toEqual(["home"]);
    expect(
      openhandsCandidateRoots({ FILE_STORE_PATH: "/var/fs" } as NodeJS.ProcessEnv).map((r) => r.label),
    ).toEqual(["home", "filestore"]);
  });
});

describe("openhandsAdapter.resolveRoots", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "oh-"));
  });
  afterEach(async () => {
    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  it("returns the state dir when it exists", () => {
    const roots = openhandsAdapter.resolveRoots({ OH_PERSISTENCE_DIR: dir } as NodeJS.ProcessEnv);
    expect(roots).toEqual([{ label: "home", dir }]);
  });

  it("returns nothing when the state dir is absent (persistence off)", () => {
    const roots = openhandsAdapter.resolveRoots({
      OH_PERSISTENCE_DIR: path.join(dir, "nope"),
    } as NodeJS.ProcessEnv);
    expect(roots).toEqual([]);
  });
});

describe("openhandsAdapter include/exclude patterns", () => {
  const patterns = {
    include: openhandsAdapter.include,
    exclude: openhandsAdapter.exclude,
    secretExclude: openhandsAdapter.secretExclude,
  };

  it("includes V1 and V0 layouts incl. secret-bearing files (encrypted by policy)", () => {
    for (const p of [
      "home/conversations/abc/base_state.json", // V1 — contains secrets, included
      "home/conversations/abc/events/event-00000-x.json",
      "home/settings.json", // contains LLM api_key, included
      "home/sessions/xyz/events/0.json", // V0
      "home/secrets.json", // V0 secrets, included (encrypted)
    ]) {
      expect(shouldInclude(p, patterns)).toBe(true);
    }
  });

  it("excludes caches and junk", () => {
    for (const p of ["home/.cache/x", "home/cache/y", "home/.DS_Store"]) {
      expect(shouldInclude(p, patterns)).toBe(false);
    }
  });
});
