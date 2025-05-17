import dotenv from 'dotenv';
import { SimplePool, generateSecretKey, getPublicKey, finalizeEvent, nip19 } from 'nostr-tools';
import WebSocket from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Setup dotenv
dotenv.config({ path: '.env.test' });

// Make global.WebSocket available for nostr-tools
global.WebSocket = WebSocket;

// Relay URLs to connect to
const relayUrls = process.env.RELAYS
  ? process.env.RELAYS.split(',')
  : ['wss://relay.damus.io', 'wss://relay.snort.social'];

// Create a connection pool
const pool = new SimplePool();

// Generate or use private key
function getKeys() {
  const privateKey = process.env.NOSTR_PRIVATE_KEY === 'your_private_key_here' || !process.env.NOSTR_PRIVATE_KEY
    ? generateSecretKey() // creates a new key if none provided
    : Buffer.from(process.env.NOSTR_PRIVATE_KEY, 'hex');

  const publicKey = getPublicKey(privateKey);
  const npub = nip19.npubEncode(publicKey);

  return { privateKey, publicKey, npub };
}

// Create and publish a note
async function publishNote(content) {
  try {
    const { privateKey, publicKey, npub } = getKeys();

    console.log('\n🔑 User Public Key Info:');
    console.log(`- Hex: ${publicKey}`);
    console.log(`- Npub: ${npub}`);
    console.log(`- View profile: https://primal.net/p/${npub}\n`);

    // Construct the event
    let event = {
      kind: 1,  // Regular note
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: content,
      pubkey: publicKey
    };

    // Sign the event
    event = finalizeEvent(event, privateKey);

    // Get event ID in standard bech32 format
    const noteId = event.id;
    const nip19NoteId = nip19.noteEncode(noteId);

    // Send to all connected relays
    console.log('📡 Broadcasting to Nostr...');

    // Simple publishing with timeout
    const publishPromise = pool.publish(relayUrls, event);

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
    console.log(`🔍 View post: https://primal.net/e/${nip19NoteId}`);

    return { success: true, noteId, nip19NoteId, publicKey, npub };
  } catch (error) {
    console.error('💥 Error during publishing:', error.message);
    return { success: false, error: error.message };
  }
}

// Test the publishing functionality
async function testNostr() {
  console.log('🧪 Testing Nostr Publication');

  try {
    // Publish a test note
    const result = await publishNote("Hello from Dr. Bitcoin! Testing the Nostr integration. 🚀");

    console.log('\n✅ Test completed!');

    // Add a small delay before exiting
    setTimeout(() => {
      console.log('👋 Closing connections and exiting...');
      pool.close(relayUrls);
      process.exit(0);
    }, 2000);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testNostr().catch(console.error);