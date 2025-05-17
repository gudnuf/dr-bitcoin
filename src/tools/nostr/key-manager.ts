import { generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { nip19 } from "nostr-tools";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// Define paths for key storage
const KEYS_DIR = path.join(process.cwd(), ".nostr-keys");
const KEY_FILE = path.join(KEYS_DIR, "dr-bitcoin-keys.json");

interface KeyPair {
	privateKeyHex: string;
	publicKeyHex: string;
	npub: string;
	createdAt: string;
}

/**
 * Ensure the keys directory exists
 */
function ensureKeyDirExists(): void {
	if (!fs.existsSync(KEYS_DIR)) {
		fs.mkdirSync(KEYS_DIR, { recursive: true });
	}
}

/**
 * Load existing key pair if it exists
 */
export function loadKeyPair(): KeyPair | null {
	try {
		if (fs.existsSync(KEY_FILE)) {
			const data = fs.readFileSync(KEY_FILE, "utf-8");
			return JSON.parse(data);
		}
	} catch (error) {
		console.error("Error loading key pair:", error);
	}
	return null;
}

/**
 * Generate and save a new key pair
 */
export function generateAndSaveKeyPair(): KeyPair {
	// Generate new keys
	const privateKey = generateSecretKey();
	const privateKeyHex = Buffer.from(privateKey).toString("hex");
	const publicKeyHex = getPublicKey(privateKey);
	const npub = nip19.npubEncode(publicKeyHex);

	const keyPair: KeyPair = {
		privateKeyHex,
		publicKeyHex,
		npub,
		createdAt: new Date().toISOString(),
	};

	// Ensure directory exists
	ensureKeyDirExists();

	// Save to file
	fs.writeFileSync(KEY_FILE, JSON.stringify(keyPair, null, 2));

	return keyPair;
}

/**
 * Get existing key pair or generate a new one
 */
export function getOrGenerateKeyPair(): KeyPair {
	const existingKeys = loadKeyPair();
	if (existingKeys) {
		return existingKeys;
	}
	return generateAndSaveKeyPair();
}

/**
 * Convert hex private key to Uint8Array for nostr-tools
 */
export function hexToUint8Array(hex: string): Uint8Array {
	return new Uint8Array(Buffer.from(hex, "hex"));
}

/**
 * Print key information to console
 */
export function printKeyInfo(keyPair: KeyPair): void {
	console.log("\n🔑 Dr. Bitcoin's Nostr Identity");
	console.log("==============================");
	console.log(`Public Key (hex): ${keyPair.publicKeyHex}`);
	console.log(`Public Key (npub): ${keyPair.npub}`);
	console.log(`Created: ${keyPair.createdAt}`);
	console.log(`View profile: https://primal.net/p/${keyPair.npub}`);
	console.log("==============================\n");
}

export function getKeys() {
	const keyPair = getOrGenerateKeyPair();
	const privateKey = hexToUint8Array(keyPair.privateKeyHex);
	const publicKey = keyPair.publicKeyHex;
	const npub = keyPair.npub;
	return { privateKey, publicKey, npub };
}
