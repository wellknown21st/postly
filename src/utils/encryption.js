const CryptoJS = require('crypto-js');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default_key_change_in_production!!';

/**
 * Encrypt a plaintext string using AES-256
 */
const encrypt = (plaintext) => {
  if (!plaintext) return null;
  const encrypted = CryptoJS.AES.encrypt(plaintext, ENCRYPTION_KEY).toString();
  return encrypted;
};

/**
 * Decrypt an AES-256 encrypted string
 */
const decrypt = (ciphertext) => {
  if (!ciphertext) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    return null;
  }
};

module.exports = { encrypt, decrypt };
