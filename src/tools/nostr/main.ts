// import type { Tool } from "../../types";
import { SimplePool, generateSecretKey, getPublicKey, finalizeEvent, nip19, type Event } from "nostr-tools";
import WebSocket from "ws";
import dotenv from "dotenv";
import { getOrGenerateKeyPair, hexToUint8Array } from "./key-manager";

// Load environment variables
dotenv.config();

// Make global.WebSocket available for nostr-tools
(global as any).WebSocket = WebSocket;

// Positive vibe messages
const vibeMessages = [
  "Just coding and vibing. Life's good! ✌️",
  "Sending positive energy to the nostr-verse today! 🌈",
  "Coffee, code, and good vibes. What more could I need? ☕",
  "Remember to take breaks and enjoy the sunshine! 🌞",
  "Building the future, one nostr note at a time. 🧱",
  "Today's vibe: relaxed productivity. 🧘‍♂️",
  "Grateful for this amazing community! 🙏",
  "Innovation happens at the intersection of fun and focus. 🎯",
  "Keep it simple, keep it vibing. 🕺",
  "The best code is written with good music and good vibes. 🎵"
];

// Get a random vibe message
function getRandomVibeMessage(): string {
  if (vibeMessages.length === 0) return "Spreading good vibes on Nostr! ✨";
  const index = Math.floor(Math.random() * vibeMessages.length);
  return vibeMessages[index] || "Spreading good vibes on Nostr! ✨";
}

// Define Tool type inline since import is commented out
type Tool = {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: string;
  };
};

// Tool definitions
export const PUBLISH_NOSTR_PROFILE_TOOL: Tool = {
  type: "nostr",
  function: {
    name: "publish_nostr_profile",
    description: "Create a social media profile on nostr",
    parameters: JSON.stringify({
      type: "object",
      properties: {
        name: { type: "string", description: "The display name for the profile" },
        about: { type: "string", description: "A short bio or description" },
        picture: { type: "string", description: "URL to profile picture" },
        nip05: { type: "string", description: "NIP-05 identifier (e.g. user@domain.com)" },
        website: { type: "string", description: "Personal website URL" },
        lud16: { type: "string", description: "Lightning address for payments" }
      },
      required: ["name", "lud16", "about"],
    }),
  },
};

export const PUBLISH_NOSTR_NOTE_TOOL: Tool = {
  type: "nostr",
  function: {
    name: "publish_nostr_note",
    description: "Publish a note to the nostr network",
    parameters: JSON.stringify({
      type: "object",
      properties: {
        content: { type: "string", description: "The content of the note to publish" },
        tags: {
          type: "array",
          description: "Optional tags to add to the note",
          items: {
            type: "array",
            items: { type: "string" }
          }
        }
      },
      required: ["content"],
    }),
  },
};

export const PUBLISH_RANDOM_VIBE_TOOL: Tool = {
  type: "nostr",
  function: {
    name: "publish_random_vibe",
    description: "Publish a random positive vibe message to nostr",
    parameters: JSON.stringify({
      type: "object",
      properties: {},
      required: [],
    }),
  },
};

// Generate key tool for creating new keys
export const GENERATE_NOSTR_KEYS_TOOL: Tool = {
  type: "nostr",
  function: {
    name: "generate_nostr_keys",
    description: "Generate a new Nostr key pair for Dr. Bitcoin and store it securely",
    parameters: JSON.stringify({
      type: "object",
      properties: {},
      required: [],
    }),
  },
};

// Pool for nostr connections
let pool: SimplePool | null = null;
// Array of relay URLs from environment
const relays = process.env.RELAYS || 'wss://relay.damus.io,wss://relay.snort.social';
const relayUrls: string[] = relays.split(',');

// Initialize the nostr connection pool
function initNostrPool(): SimplePool {
  if (!pool) {
    pool = new SimplePool();
    console.log(`🌊 Connected to relays: ${relayUrls.join(', ')}`);
  }
  return pool;
}

// Get private and public keys using the key manager
function getKeys() {
  // Get or generate the key pair
  const keyPair = getOrGenerateKeyPair();

  // Convert the hex private key to Uint8Array
  const privateKey = hexToUint8Array(keyPair.privateKeyHex);
  const publicKey = keyPair.publicKeyHex;
  const npub = keyPair.npub;

  return { privateKey, publicKey, npub };
}

// Function to publish a note
async function publishNote(content: string, tags: string[][] = []) {
  try {
    const pool = initNostrPool();
    const { privateKey, publicKey, npub } = getKeys();

    // Construct the event
    const eventData = {
      kind: 1,  // Regular note
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content,
      pubkey: publicKey
    };

    // Sign the event
    const signedEvent = finalizeEvent(eventData, privateKey);
    const noteId = signedEvent.id;
    const nip19NoteId = nip19.noteEncode(noteId);

    // Send to all connected relays
    console.log('📡 Broadcasting to nostr...');

    // Simple publishing with timeout
    const publishPromise = pool.publish(relayUrls, signedEvent);

    // Set a timeout for the whole operation
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Publishing timed out after 10 seconds")), 10000);
    });

    // Race the publish against the timeout
    await Promise.race([
      Promise.allSettled(publishPromise),
      timeoutPromise
    ]);

    console.log('🎉 Note published successfully!');
    console.log(`📝 Post ID (hex): ${noteId}`);
    console.log(`📝 Post ID (note): ${nip19NoteId}`);

    // Clean up connections after publishing
    cleanup();

    return {
      success: true,
      noteId,
      nip19NoteId,
      viewUrl: `https://primal.net/e/${nip19NoteId}`,
      publicKey: publicKey,
      npub
    };
  } catch (error: any) {
    console.error('💥 Error during publishing:', error.message);
    // Clean up connections even if there's an error
    cleanup();
    return {
      success: false,
      error: error.message
    };
  }
}

// Tool implementation functions
export async function publishNostrProfile(args: any) {
  const { name, about, picture, nip05, website, lud16 } = args;
  console.log("Publishing nostr profile", args);

  try {
    const pool = initNostrPool();
    const { privateKey, publicKey, npub } = getKeys();

    // Create a metadata event (kind 0)
    const eventData = {
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      tags: [] as string[][],
      content: JSON.stringify({
        name,
        about,
        picture,
        nip05,
        website,
        lud16
      }),
      pubkey: publicKey
    };

    // Sign the event
    const signedEvent = finalizeEvent(eventData, privateKey);

    // Publish to relays
    await pool.publish(relayUrls, signedEvent);

    // Clean up connections after publishing
    cleanup();

    return {
      success: true,
      message: "Profile published successfully",
      publicKey,
      npub,
      profileUrl: `https://primal.net/p/${npub}`
    };
  } catch (error: any) {
    // Clean up connections even if there's an error
    cleanup();
    return {
      success: false,
      error: error.message
    };
  }
}

export async function publishNostrNote(args: any) {
  const { content, tags = [] } = args;
  return await publishNote(content, tags);
}

export async function publishRandomVibe(args: any) {
  const message = getRandomVibeMessage();
  return await publishNote(message);
}

export async function generateNostrKeys() {
  // Import dynamically to avoid circular dependencies
  const { generateAndSaveKeyPair, printKeyInfo } = await import('./key-manager');

  // Generate new keys
  const keyPair = generateAndSaveKeyPair();

  // Print key info to console
  printKeyInfo(keyPair);

  // If the pool is initialized, make sure to clean it up
  if (pool) {
    cleanup();
  }

  return {
    success: true,
    message: "New Nostr keys generated and stored securely",
    publicKey: keyPair.publicKeyHex,
    npub: keyPair.npub,
    profileUrl: `https://primal.net/p/${keyPair.npub}`,
    createdAt: keyPair.createdAt
  };
}

// Process cleanup function
export function cleanup() {
  if (pool) {
    console.log('👋 Closing nostr connections to relays...');
    pool.close(relayUrls);
    pool = null;
    console.log('✅ Nostr connections closed successfully.');
  }
}

// Handle process exit
process.on('SIGINT', () => {
  cleanup();
  // Don't call process.exit here as the agent will handle that
});
