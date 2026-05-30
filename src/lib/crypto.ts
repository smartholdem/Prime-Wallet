import CryptoJS from "crypto-js";

/** Derive an encryption key from PIN — combines PIN with its own SHA-384 (matches wallet-pro). */
function derive(pin: string): string {
  const hash = CryptoJS.SHA384(pin).toString();
  return pin + hash;
}

export function pinHash(pin: string): string {
  return CryptoJS.SHA384(pin).toString();
}

export function encryptSecret(plain: string, pin: string): string {
  return CryptoJS.AES.encrypt(plain, derive(pin)).toString();
}

export function decryptSecret(cipher: string, pin: string): string {
  const bytes = CryptoJS.AES.decrypt(cipher, derive(pin));
  return bytes.toString(CryptoJS.enc.Utf8);
}

/** Verify a PIN can decrypt a stored secret. Returns the plain secret on success. */
export function verifyPin(cipher: string, pin: string): string | null {
  try {
    const plain = decryptSecret(cipher, pin);
    if (!plain) return null;
    return plain;
  } catch {
    return null;
  }
}
