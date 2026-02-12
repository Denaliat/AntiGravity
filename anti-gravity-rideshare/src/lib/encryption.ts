import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

// In a real app, this should be in an environment variable
// For this prototype, we'll generate a consistent key or use a hardcoded one if needed for persistence across restarts
const ALGORITHM = 'aes-256-cbc';
const ENCODING = 'hex';
// 32 bytes for AES-256
const SECRET_KEY = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
const IV_LENGTH = 16;

export const EncryptionService = {
    encrypt: (text: string): string => {
        const iv = randomBytes(IV_LENGTH);
        const cipher = createCipheriv(ALGORITHM, SECRET_KEY, iv);
        let encrypted = cipher.update(text, 'utf8', ENCODING);
        encrypted += cipher.final(ENCODING);
        // Return IV + Encrypted data
        return `${iv.toString(ENCODING)}:${encrypted}`;
    },

    decrypt: (encryptedText: string): string => {
        const [ivHex, encryptedData] = encryptedText.split(':');
        if (!ivHex || !encryptedData) throw new Error('Invalid encrypted format');

        const iv = Buffer.from(ivHex, ENCODING);
        const decipher = createDecipheriv(ALGORITHM, SECRET_KEY, iv);
        let decrypted = decipher.update(encryptedData, ENCODING, 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
};
