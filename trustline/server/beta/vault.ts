import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * The vault encrypts every access key (Figma tokens, later Gmail/Wise keys)
 * with AES-256-GCM before it touches the database. The master key comes from
 * TRUSTLINE_SECRET (64 hex chars) or, on a laptop, a key file created once
 * next to the database. A stolen database alone is useless without it.
 */
export interface Vault {
  seal(plain: string): string;
  open(sealed: string): string;
}

function masterKey(): Buffer {
  const env = process.env.TRUSTLINE_SECRET?.trim();
  if (env) {
    if (!/^[0-9a-fA-F]{64}$/.test(env)) throw new Error("TRUSTLINE_SECRET must be 64 hex characters (32 bytes)");
    return Buffer.from(env, "hex");
  }
  const file = process.env.TRUSTLINE_DB_PATH && process.env.TRUSTLINE_DB_PATH !== ":memory:" ? join(dirname(process.env.TRUSTLINE_DB_PATH), "vault.key") : join(process.cwd(), "data", "vault.key");
  if (existsSync(file)) return Buffer.from(readFileSync(file, "utf8").trim(), "hex");
  mkdirSync(dirname(file), { recursive: true });
  const key = randomBytes(32);
  writeFileSync(file, key.toString("hex"), { mode: 0o600 });
  return key;
}

export function createVault(key: Buffer = masterKey()): Vault {
  if (key.length !== 32) throw new Error("Vault key must be 32 bytes");
  return {
    seal(plain) {
      const iv = randomBytes(12);
      const c = createCipheriv("aes-256-gcm", key, iv);
      const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
      return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), data.toString("base64")].join(".");
    },
    open(sealed) {
      const [v, iv, tag, data] = sealed.split(".");
      if (v !== "v1") throw new Error("Unknown vault format");
      const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
      d.setAuthTag(Buffer.from(tag, "base64"));
      return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
    },
  };
}
