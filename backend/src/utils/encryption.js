// src/utils/encryption.js
// ============================================================
// AES-256-GCM Encryption Utilities for Device Communication
// ============================================================
const crypto = require('crypto');

// AES-256-GCM constants
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM recommended
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Generate a new AES-256 key
 * @returns {Buffer} 32-byte key
 */
const generateAESKey = () => {
  return crypto.randomBytes(32);
};

/**
 * Generate a temporary auth key for pairing
 * @returns {string} Hex string
 */
const generateTempAuthKey = () => {
  return crypto.randomBytes(16).toString('hex');
};

/**
 * Encrypt data for device using AES-256-GCM
 * @param {Object|string} data - Data to encrypt
 * @param {Buffer} key - 32-byte AES key
 * @returns {Object} Encrypted payload with IV and auth tag
 */
const encryptForDevice = (data, key) => {
  try {
    // Convert data to buffer if needed
    const plaintext = typeof data === 'string' 
      ? Buffer.from(data, 'utf8')
      : Buffer.from(JSON.stringify(data), 'utf8');
    
    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH
    });
    
    // Encrypt
    const encrypted = Buffer.concat([
      cipher.update(plaintext),
      cipher.final()
    ]);
    
    // Get auth tag
    const authTag = cipher.getAuthTag();
    
    // Return combined payload
    return {
      iv: iv.toString('base64'),
      data: encrypted.toString('base64'),
      tag: authTag.toString('base64'),
      timestamp: Date.now()
    };
  } catch (err) {
    throw new Error(`Encryption failed: ${err.message}`);
  }
};

/**
 * Decrypt data from device using AES-256-GCM
 * @param {Object} encryptedPayload - { iv, data, tag }
 * @param {Buffer} key - 32-byte AES key
 * @returns {Object} Decrypted data
 */
const decryptFromDevice = (encryptedPayload, key) => {
  try {
    const { iv, data, tag } = encryptedPayload;
    
    // Convert from base64
    const ivBuffer = Buffer.from(iv, 'base64');
    const dataBuffer = Buffer.from(data, 'base64');
    const tagBuffer = Buffer.from(tag, 'base64');
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer, {
      authTagLength: AUTH_TAG_LENGTH
    });
    
    // Set auth tag
    decipher.setAuthTag(tagBuffer);
    
    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(dataBuffer),
      decipher.final()
    ]);
    
    // Try to parse as JSON, fallback to string
    try {
      return JSON.parse(decrypted.toString('utf8'));
    } catch {
      return decrypted.toString('utf8');
    }
  } catch (err) {
    throw new Error(`Decryption failed: ${err.message}`);
  }
};

/**
 * Encrypt with additional authenticated data (AAD)
 * @param {Object} data - Data to encrypt
 * @param {Buffer} key - AES key
 * @param {Buffer} aad - Additional authenticated data
 * @returns {Object} Encrypted payload
 */
const encryptWithAAD = (data, key, aad) => {
  try {
    const plaintext = Buffer.from(JSON.stringify(data), 'utf8');
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH
    });
    
    // Add AAD
    if (aad) {
      cipher.setAAD(aad);
    }
    
    const encrypted = Buffer.concat([
      cipher.update(plaintext),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    return {
      iv: iv.toString('base64'),
      data: encrypted.toString('base64'),
      tag: authTag.toString('base64'),
      aad: aad?.toString('base64')
    };
  } catch (err) {
    throw new Error(`Encryption with AAD failed: ${err.message}`);
  }
};

/**
 * Rotate device key
 * @param {string} screenId - Screen ID
 * @param {Object} db - Database connection
 * @returns {Promise<Buffer>} New AES key
 */
const rotateDeviceKey = async (screenId, db) => {
  try {
    const newKey = generateAESKey();
    const newKeyVersion = await getNextKeyVersion(screenId, db);
    
    // Store new key (encrypted in production)
    await db.query(
      `UPDATE wilyer_screens 
       SET aes_secret_key = $1, 
           encryption_key_version = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [newKey.toString('base64'), newKeyVersion, screenId]
    );
    
    return newKey;
  } catch (err) {
    throw new Error(`Key rotation failed: ${err.message}`);
  }
};

const getNextKeyVersion = async (screenId, db) => {
  const result = await db.query(
    'SELECT encryption_key_version FROM wilyer_screens WHERE id = $1',
    [screenId]
  );
  return (result.rows[0]?.encryption_key_version || 0) + 1;
};

module.exports = {
  generateAESKey,
  generateTempAuthKey,
  encryptForDevice,
  decryptFromDevice,
  encryptWithAAD,
  rotateDeviceKey
};