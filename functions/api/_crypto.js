// Web Crypto AES-GCM-256 Helper for Cloudflare Workers

const DEFAULT_SALT = "psy_privacy_vault_2026_salt_olefirenko";

async function getKey(envSecret) {
  const secret = envSecret || "psy_vault_master_key_olefirenko_therapeutic_secret_2026";
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(DEFAULT_SALT),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptText(plainText, envSecret) {
  if (!plainText || typeof plainText !== 'string') return plainText;
  try {
    const key = await getKey(envSecret);
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      enc.encode(plainText)
    );

    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
    const cipherHex = Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('');

    return `enc:v1:${ivHex}:${cipherHex}`;
  } catch (err) {
    console.error('Encryption failed:', err);
    return plainText;
  }
}

export async function decryptText(cipherText, envSecret) {
  if (!cipherText || typeof cipherText !== 'string' || !cipherText.startsWith('enc:v1:')) {
    return cipherText; // Return as-is if not encrypted
  }

  try {
    const parts = cipherText.split(':');
    if (parts.length !== 4) return cipherText;

    const ivHex = parts[2];
    const cipherHex = parts[3];

    const iv = new Uint8Array(ivHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const cipherBuffer = new Uint8Array(cipherHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

    const key = await getKey(envSecret);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      cipherBuffer
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
  } catch (err) {
    console.error('Decryption failed:', err);
    return cipherText;
  }
}
