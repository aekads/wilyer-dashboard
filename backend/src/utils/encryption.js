// // src/utils/encryption.js
// // ============================================================
// // AES-256-GCM Encryption Utilities for Device Communication
// // ============================================================
// const crypto = require('crypto');

// // AES-256-GCM constants
// const ALGORITHM = 'aes-256-gcm';
// const IV_LENGTH = 12; // 96 bits for GCM recommended
// const AUTH_TAG_LENGTH = 16; // 128 bits

// /**
//  * Generate a new AES-256 key
//  * @returns {Buffer} 32-byte key
//  */
// const generateAESKey = () => {
//   return crypto.randomBytes(32);
// };

// /**
//  * Generate a temporary auth key for pairing
//  * @returns {string} Hex string
//  */
// const generateTempAuthKey = () => {
//   return crypto.randomBytes(16).toString('hex');
// };

// /**
//  * Encrypt data for device using AES-256-GCM
//  * @param {Object|string} data - Data to encrypt
//  * @param {Buffer} key - 32-byte AES key
//  * @returns {Object} Encrypted payload with IV and auth tag
//  */
// const encryptForDevice = (data, key) => {
//   try {
//     // Convert data to buffer if needed
//     const plaintext = typeof data === 'string' 
//       ? Buffer.from(data, 'utf8')
//       : Buffer.from(JSON.stringify(data), 'utf8');
    
//     // Generate random IV
//     const iv = crypto.randomBytes(IV_LENGTH);
    
//     // Create cipher
//     const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
//       authTagLength: AUTH_TAG_LENGTH
//     });
    
//     // Encrypt
//     const encrypted = Buffer.concat([
//       cipher.update(plaintext),
//       cipher.final()
//     ]);
    
//     // Get auth tag
//     const authTag = cipher.getAuthTag();
    
//     // Return combined payload
//     return {
//       iv: iv.toString('base64'),
//       data: encrypted.toString('base64'),
//       tag: authTag.toString('base64'),
//       timestamp: Date.now()
//     };
//   } catch (err) {
//     throw new Error(`Encryption failed: ${err.message}`);
//   }
// };

// /**
//  * Decrypt data from device using AES-256-GCM
//  * @param {Object} encryptedPayload - { iv, data, tag }
//  * @param {Buffer} key - 32-byte AES key
//  * @returns {Object} Decrypted data
//  */
// const decryptFromDevice = (encryptedPayload, key) => {
//   try {
//     const { iv, data, tag } = encryptedPayload;
    
//     // Convert from base64
//     const ivBuffer = Buffer.from(iv, 'base64');
//     const dataBuffer = Buffer.from(data, 'base64');
//     const tagBuffer = Buffer.from(tag, 'base64');
    
//     // Create decipher
//     const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer, {
//       authTagLength: AUTH_TAG_LENGTH
//     });
    
//     // Set auth tag
//     decipher.setAuthTag(tagBuffer);
    
//     // Decrypt
//     const decrypted = Buffer.concat([
//       decipher.update(dataBuffer),
//       decipher.final()
//     ]);
    
//     // Try to parse as JSON, fallback to string
//     try {
//       return JSON.parse(decrypted.toString('utf8'));
//     } catch {
//       return decrypted.toString('utf8');
//     }
//   } catch (err) {
//     throw new Error(`Decryption failed: ${err.message}`);
//   }
// };

// /**
//  * Encrypt with additional authenticated data (AAD)
//  * @param {Object} data - Data to encrypt
//  * @param {Buffer} key - AES key
//  * @param {Buffer} aad - Additional authenticated data
//  * @returns {Object} Encrypted payload
//  */
// const encryptWithAAD = (data, key, aad) => {
//   try {
//     const plaintext = Buffer.from(JSON.stringify(data), 'utf8');
//     const iv = crypto.randomBytes(IV_LENGTH);
    
//     const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
//       authTagLength: AUTH_TAG_LENGTH
//     });
    
//     // Add AAD
//     if (aad) {
//       cipher.setAAD(aad);
//     }
    
//     const encrypted = Buffer.concat([
//       cipher.update(plaintext),
//       cipher.final()
//     ]);
    
//     const authTag = cipher.getAuthTag();
    
//     return {
//       iv: iv.toString('base64'),
//       data: encrypted.toString('base64'),
//       tag: authTag.toString('base64'),
//       aad: aad?.toString('base64')
//     };
//   } catch (err) {
//     throw new Error(`Encryption with AAD failed: ${err.message}`);
//   }
// };

// /**
//  * Rotate device key
//  * @param {string} screenId - Screen ID
//  * @param {Object} db - Database connection
//  * @returns {Promise<Buffer>} New AES key
//  */
// const rotateDeviceKey = async (screenId, db) => {
//   try {
//     const newKey = generateAESKey();
//     const newKeyVersion = await getNextKeyVersion(screenId, db);
    
//     // Store new key (encrypted in production)
//     await db.query(
//       `UPDATE wilyer_screens 
//        SET aes_secret_key = $1, 
//            encryption_key_version = $2,
//            updated_at = NOW()
//        WHERE id = $3`,
//       [newKey.toString('base64'), newKeyVersion, screenId]
//     );
    
//     return newKey;
//   } catch (err) {
//     throw new Error(`Key rotation failed: ${err.message}`);
//   }
// };

// const getNextKeyVersion = async (screenId, db) => {
//   const result = await db.query(
//     'SELECT encryption_key_version FROM wilyer_screens WHERE id = $1',
//     [screenId]
//   );
//   return (result.rows[0]?.encryption_key_version || 0) + 1;
// };

// module.exports = {
//   generateAESKey,
//   generateTempAuthKey,
//   encryptForDevice,
//   decryptFromDevice,
//   encryptWithAAD,
//   rotateDeviceKey
// };

// src/utils/encryption.js
// ============================================================
// AES-256-GCM Encryption Utilities for Device Communication
// UPDATED: Handles Base64 keys and JSON string message format
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
 * @param {Buffer|string} key - 32-byte AES key (Buffer or Base64 string)
 * @returns {string} Encrypted payload as JSON string with IV and auth tag
 */
const encryptForDevice = (data, key) => {
  try {
    // Convert key if it's a Base64 string
    const keyBuffer = typeof key === 'string'
      ? Buffer.from(key, 'base64')
      : key;

    // Verify key length
    if (keyBuffer.length !== 32) {
      throw new Error(`Invalid key length: expected 32 bytes, got ${keyBuffer.length}`);
    }

    // Convert data to buffer if needed
    const plaintext = typeof data === 'string'
      ? Buffer.from(data, 'utf8')
      : Buffer.from(JSON.stringify(data), 'utf8');

    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv, {
      authTagLength: AUTH_TAG_LENGTH
    });

    // Encrypt
    const encrypted = Buffer.concat([
      cipher.update(plaintext),
      cipher.final()
    ]);

    // Get auth tag
    const authTag = cipher.getAuthTag();

    // Return combined payload as JSON STRING (matching Android client format)
    return JSON.stringify({
      iv: iv.toString('base64'),
      data: encrypted.toString('base64'),
      tag: authTag.toString('base64'),
      timestamp: Date.now()
    });
  } catch (err) {
    throw new Error(`Encryption failed: ${err.message}`);
  }
};

/**
 * Decrypt data from device using AES-256-GCM
 * @param {Object|string} encryptedPayload - { iv, data, tag } (object or JSON string)
 * @param {Buffer|string} key - 32-byte AES key (Buffer or Base64 string)
 * @returns {Object|string} Decrypted data
 */
const decryptFromDevice = (encryptedPayload, key) => {
  try {
    // Convert key if it's a Base64 string
    const keyBuffer = typeof key === 'string'
      ? Buffer.from(key, 'base64')
      : key;

    // Verify key length
    if (keyBuffer.length !== 32) {
      throw new Error(`Invalid key length: expected 32 bytes, got ${keyBuffer.length}`);
    }

    // Parse payload if it's a JSON string (from Android client)
    const payload = typeof encryptedPayload === 'string'
      ? JSON.parse(encryptedPayload)
      : encryptedPayload;

    const { iv, data, tag } = payload;

    if (!iv || !data || !tag) {
      throw new Error('Missing encryption components: iv, data, or tag');
    }

    // Convert from base64
    const ivBuffer = Buffer.from(iv, 'base64');
    const dataBuffer = Buffer.from(data, 'base64');
    const tagBuffer = Buffer.from(tag, 'base64');

    // Verify sizes
    if (ivBuffer.length !== IV_LENGTH) {
      throw new Error(`Invalid IV length: expected ${IV_LENGTH}, got ${ivBuffer.length}`);
    }
    if (tagBuffer.length !== AUTH_TAG_LENGTH) {
      throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH}, got ${tagBuffer.length}`);
    }

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, ivBuffer, {
      authTagLength: AUTH_TAG_LENGTH
    });

    // Set auth tag BEFORE decrypting (critical for GCM)
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
 * @param {Buffer|string} key - AES key (Buffer or Base64 string)
 * @param {Buffer|string} aad - Additional authenticated data
 * @returns {string} Encrypted payload as JSON string
 */
const encryptWithAAD = (data, key, aad) => {
  try {
    // Convert key if it's a Base64 string
    const keyBuffer = typeof key === 'string'
      ? Buffer.from(key, 'base64')
      : key;

    if (keyBuffer.length !== 32) {
      throw new Error(`Invalid key length: expected 32 bytes, got ${keyBuffer.length}`);
    }

    const plaintext = Buffer.from(JSON.stringify(data), 'utf8');
    const iv = crypto.randomBytes(IV_LENGTH);

    // Convert AAD if needed
    const aadBuffer = typeof aad === 'string'
      ? Buffer.from(aad, 'utf8')
      : aad;

    const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv, {
      authTagLength: AUTH_TAG_LENGTH
    });

    // Add AAD
    if (aadBuffer) {
      cipher.setAAD(aadBuffer);
    }

    const encrypted = Buffer.concat([
      cipher.update(plaintext),
      cipher.final()
    ]);

    const authTag = cipher.getAuthTag();

    // Return as JSON STRING
    return JSON.stringify({
      iv: iv.toString('base64'),
      data: encrypted.toString('base64'),
      tag: authTag.toString('base64'),
      aad: aadBuffer?.toString('base64')
    });
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

    // Store new key as Base64 in database
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