import CryptoJS from "crypto-js";

/**
 * SmartHoldem Oxid encrypted-vault primitives — mirrors the Smart2FA reference
 * (PBKDF2(SHA256, 25_000) → AES-256-CBC + PKCS7, random IV per envelope).
 *
 * File extension: `.sth` (UTF-8 JSON with the envelope below).
 *
 * Envelope shape (decryptable across versions):
 * {
 *   magic: "STH_OXID_VAULT",
 *   version: 1,
 *   createdAt: <ms>,
 *   appVersion: "1.3.0",
 *   v: 1,                     // crypto scheme version
 *   iv: "<hex>",
 *   ct: "<base64>"
 * }
 *
 * The decrypted ciphertext is a JSON object with `{ auth, settings }`.
 */
const SALT = "smartholdem-oxid-vault-v1-salt";
const VERIFY_SALT = SALT + "-verify";
const ITERATIONS = 25_000;
const KEY_SIZE_BITS = 256;

export const VAULT_MAGIC = "STH_OXID_VAULT";
export const VAULT_VERSION = 1;

function deriveKey(pin: string, salt = SALT): CryptoJS.lib.WordArray {
  return CryptoJS.PBKDF2(String(pin), salt, {
    keySize: KEY_SIZE_BITS / 32,
    iterations: ITERATIONS,
    hasher: CryptoJS.algo.SHA256,
  });
}

export function hashPin(pin: string): string {
  return deriveKey(pin, VERIFY_SALT).toString();
}

export interface VaultEnvelope {
  magic: string;
  version: number;
  createdAt: number;
  appVersion: string;
  v: number;
  iv: string;
  ct: string;
}

export function encryptJSON(obj: unknown, pin: string): VaultEnvelope {
  const key = deriveKey(pin);
  const iv = CryptoJS.lib.WordArray.random(16);
  const plaintext = CryptoJS.enc.Utf8.parse(JSON.stringify(obj));
  const cipher = CryptoJS.AES.encrypt(plaintext, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return {
    magic: VAULT_MAGIC,
    version: VAULT_VERSION,
    createdAt: Date.now(),
    appVersion: "1.3.0",
    v: 1,
    iv: iv.toString(CryptoJS.enc.Hex),
    ct: cipher.toString(), // base64
  };
}

export function decryptJSON<T = unknown>(env: VaultEnvelope, pin: string): T {
  if (!env || env.magic !== VAULT_MAGIC) {
    throw new Error("Not an Oxid vault file");
  }
  if (env.version !== VAULT_VERSION) {
    throw new Error(`Unsupported vault version ${env.version}`);
  }
  const key = deriveKey(pin);
  const iv = CryptoJS.enc.Hex.parse(env.iv);
  try {
    const decrypted = CryptoJS.AES.decrypt(env.ct, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    const plain = decrypted.toString(CryptoJS.enc.Utf8);
    if (!plain) throw new Error("empty");
    return JSON.parse(plain) as T;
  } catch {
    throw new Error("Invalid PIN or corrupted vault");
  }
}

/** Trigger a browser file download for a JSON envelope. */
export function downloadVault(env: VaultEnvelope, filename?: string) {
  const stamp = new Date(env.createdAt)
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);
  const name = filename ?? `smartholdem-oxid-${stamp}.sth`;
  const blob = new Blob([JSON.stringify(env, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

export async function readVaultFile(file: File): Promise<VaultEnvelope> {
  const text = await file.text();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("File is not valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || parsed.magic !== VAULT_MAGIC) {
    throw new Error("Not an Oxid vault file");
  }
  return parsed as VaultEnvelope;
}
