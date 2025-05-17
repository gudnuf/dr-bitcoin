import { finalizeEvent } from 'nostr-tools/pure';
import { nip19 } from 'nostr-tools';
import type { Event } from 'nostr-tools';
import { getKeys } from './key-manager';
import { NostrService } from './service';

// Function to create and sign a note event
export function createNoteEvent(content: string, tags: string[][] = []): { event: any, noteId: string, nip19NoteId: string } {
  const { publicKey, privateKey } = getKeys();
  
  const eventTemplate = {
    kind: 1,  // Regular note
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content,
    pubkey: publicKey
  };
  
  // Sign the event
  const signedEvent = finalizeEvent(eventTemplate, privateKey);
  const noteId = signedEvent.id;
  const nip19NoteId = nip19.noteEncode(noteId);
  
  return { event: signedEvent, noteId, nip19NoteId };
}

// Function to create a profile event
export function createProfileEvent(profileData: any): { event: any } {
  const { publicKey, privateKey } = getKeys();
  
  const eventTemplate = {
    kind: 0,  // Metadata/profile
    created_at: Math.floor(Date.now() / 1000),
    tags: [] as string[][],
    content: JSON.stringify(profileData),
    pubkey: publicKey
  };
  
  // Sign the event
  const signedEvent = finalizeEvent(eventTemplate, privateKey);
  return { event: signedEvent };
}

// Function to publish a note with timeout
export async function publishNote(content: string, tags: string[][] = []) {
  try {
    const nostrService = NostrService.getInstance();
    const { event, noteId, nip19NoteId } = createNoteEvent(content, tags);
    const { publicKey, npub } = getKeys();
    
    console.log('📡 Broadcasting to nostr...');
    
    // Publish with timeout
    const publishPromise = nostrService.publishEvent(event);
    
    // Set a timeout for the whole operation
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Publishing timed out after 10 seconds")), 10000);
    });
    
    // Race the publish against the timeout
    await Promise.race([publishPromise, timeoutPromise]);
    
    console.log('🎉 Note published successfully!');
    console.log(`📝 Post ID (hex): ${noteId}`);
    console.log(`📝 Post ID (note): ${nip19NoteId}`);
    
    return {
      success: true,
      noteId,
      nip19NoteId,
      viewUrl: `https://primal.net/e/${nip19NoteId}`,
      publicKey,
      npub
    };
  } catch (error: any) {
    console.error('💥 Error during publishing:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Fetch existing profile
export async function fetchProfile(publicKey: string) {
  const nostrService = NostrService.getInstance();
  
  return new Promise<any>((resolve) => {
    let profileData: {
      name?: string;
      about?: string;
      picture?: string;
      nip05?: string;
      website?: string;
      lud16?: string;
    } | undefined;
    
    const sub = nostrService.subscribe(
      {
        kinds: [0],
        authors: [publicKey],
        limit: 1
      },
      {
        onevent: (event: Event) => {
          try {
            const content = event.content || '{}';
            profileData = JSON.parse(content);
          } catch (e) {
            console.log('⚠️ Could not parse profile content');
            profileData = {};
          }
        },
        eose: () => {
          sub.close();
          resolve(profileData);
        }
      }
    );
    
    // Timeout in case EOSE never arrives
    setTimeout(() => {
      sub.close();
      resolve(profileData);
    }, 5000);
  });
}

// Function for publishing general events
export async function publishEvent(kind: number, content: string, tags: string[][] = [], relays?: string[]) {
  try {
    const nostrService = NostrService.getInstance();
    const { privateKey, publicKey, npub } = getKeys();
    
    console.log(`📡 Creating kind ${kind} event...`);
    
    const eventTemplate = {
      kind,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content,
      pubkey: publicKey
    };
    
    // Sign the event
    const signedEvent = finalizeEvent(eventTemplate, privateKey);
    const eventId = signedEvent.id;
    
    console.log('📡 Broadcasting to nostr...');
    
    // Use specified relays or default
    const targetRelays = relays || nostrService.getRelayUrls();
    
    // Publish with timeout
    const publishPromise = nostrService.getPool().publish(targetRelays, signedEvent);
    
    // Set a timeout for the whole operation
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Publishing timed out after 10 seconds")), 10000);
    });
    
    // Race the publish against the timeout
    await Promise.race([publishPromise, timeoutPromise]);
    
    console.log('🎉 Event published successfully!');
    
    return {
      success: true,
      eventId,
      kind,
      publicKey,
      npub,
      relays: targetRelays
    };
  } catch (error: any) {
    console.error('💥 Error during publishing:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
} 