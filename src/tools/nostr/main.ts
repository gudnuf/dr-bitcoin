import dotenv from "dotenv";
import WebSocket from "ws";
import type { Tool } from '../../types';
import { NostrService } from "./service";
import {
  manageNostrProfile,
  browseFeed as nostrBrowseFeed,
  viewThread as nostrViewThread,
  postNote as nostrPostNote,
  postReply as nostrReply,
  getProfile as nostrGetProfile
} from "./handlers";
import { createProfileEvent, publishEvent, publishNote } from "./events";
import { generateAndSaveKeyPair, printKeyInfo, getKeys } from "./key-manager";

// Load environment variables
dotenv.config();

// Make global.WebSocket available for nostr-tools
(global as any).WebSocket = WebSocket;

// Tool definitions
export const MANAGE_NOSTR_PROFILE: Tool = {
  type: "nostr",
  function: {
    name: "manage_nostr_profile",
    description: "Create, read, update, or delete a social media profile on nostr",
    parameters: JSON.stringify({
      type: "object",
      properties: {
        operation: { 
          type: "string", 
          description: "The operation to perform on the profile (create, read, update, delete)", 
          enum: ["create", "read", "update", "delete"]
        },
        name: { type: "string", description: "The display name for the profile" },
        about: { type: "string", description: "A short bio or description" },
        picture: { type: "string", description: "URL to profile picture" },
        nip05: { type: "string", description: "NIP-05 identifier (e.g. user@domain.com)" },
        website: { type: "string", description: "Personal website URL" },
        lud16: { type: "string", description: "Lightning address for payments" },
        publicKey: { type: "string", description: "Optional public key for operations on profiles other than the default one" }
      },
      required: ["operation"],
    }),
  },
};

export const NOSTR_BROWSE_FEED: Tool = {
  type: "nostr",
  function: {
    name: "nostr_browse_feed",
    description: "Browse a feed of short text notes that may also have threads or comments",
    parameters: JSON.stringify({
      type: "object",
      properties: {
        feed_type: {
          type: "string",
          description: "Type of feed to browse",
          enum: ["global", "user", "hashtag", "search"],
          default: "global"
        },
        pubkey: {
          type: "string",
          description: "Public key of user to view posts from (required for 'user' feed type)"
        },
        hashtag: {
          type: "string",
          description: "Hashtag to filter by (required for 'hashtag' feed type, without the # symbol)"
        },
        search_term: {
          type: "string",
          description: "Term to search for (required for 'search' feed type)"
        },
        limit: {
          type: "integer",
          description: "Maximum number of posts to return",
          default: 10,
          minimum: 1,
          maximum: 50
        },
        since: {
          type: "integer",
          description: "Unix timestamp (in seconds) to fetch posts from",
          default: 0
        }
      },
      required: ["feed_type"]
    }),
  },
};

export const NOSTR_VIEW_THREAD: Tool = {
  type: "nostr",
  function: {
    name: "nostr_view_thread",
    description: "View a complete thread including the original post and all replies",
    parameters: JSON.stringify({
      type: "object",
      properties: {
        note_id: {
          type: "string",
          description: "ID of the note/post to view the thread of (hex or note1...)"
        },
        limit: {
          type: "integer",
          description: "Maximum number of replies to return",
          default: 20,
          minimum: 1,
          maximum: 100
        }
      },
      required: ["note_id"]
    }),
  },
};

export const NOSTR_POST_NOTE: Tool = {
  type: "nostr",
  function: {
    name: "nostr_post_note",
    description: "Post a new text note to the Nostr network",
    parameters: JSON.stringify({
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The text content of the note to post"
        },
        mentions: {
          type: "array",
          description: "Array of pubkeys to mention in the note",
          items: {
            type: "string"
          }
        },
        hashtags: {
          type: "array",
          description: "Array of hashtags to include (without # symbol)",
          items: {
            type: "string"
          }
        },
        geohash: {
          type: "string",
          description: "Optional geohash to attach to the note"
        }
      },
      required: ["content"]
    }),
  },
};

export const NOSTR_REPLY: Tool = {
  type: "nostr",
  function: {
    name: "nostr_reply",
    description: "Reply to an existing note/post in a conversation thread",
    parameters: JSON.stringify({
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The text content of the reply"
        },
        reply_to: {
          type: "string",
          description: "ID of the note being replied to (hex or note1...)"
        },
        root: {
          type: "string",
          description: "ID of the root note in the thread if different from reply_to (hex or note1...)"
        }
      },
      required: ["content", "reply_to"]
    }),
  },
};

export const NOSTR_GET_PROFILE: Tool = {
  type: "nostr",
  function: {
    name: "nostr_get_profile",
    description: "Get a user's profile information from their pubkey",
    parameters: JSON.stringify({
      type: "object",
      properties: {
        pubkey: {
          type: "string",
          description: "Public key of the user (hex or npub1...)"
        }
      },
      required: ["pubkey"]
    }),
  },
};

// Legacy function for backward compatibility
export async function publishNostrProfile(args: any) {
  // Add default operation for backward compatibility
  const updatedArgs = { ...args, operation: "update" };
  return manageNostrProfile(updatedArgs);
}

export async function publishNostrEvent(args: any) {
  const { kind, content, tags = [], relays } = args;
  return await publishEvent(kind, content, tags, relays);
}

export async function publishNostrNote(args: any) {
  const { content, tags = [] } = args;
  return await publishNote(content, tags);
}

export async function generateNostrKeys() {
  // Generate new keys
  const keyPair = generateAndSaveKeyPair();

  // Print key info to console
  printKeyInfo(keyPair);
  
  return {
    success: true,
    message: "New Nostr keys generated and stored securely",
    publicKey: keyPair.publicKeyHex,
    npub: keyPair.npub,
    profileUrl: `https://primal.net/p/${keyPair.npub}`,
    createdAt: keyPair.createdAt
  };
}

// Export public tool implementation functions
export { 
  manageNostrProfile,
  nostrBrowseFeed,
  nostrViewThread,
  nostrPostNote,
  nostrReply,
  nostrGetProfile
};

// Export cleanup function that uses the singleton
export function cleanup() {
  NostrService.getInstance().cleanup();
}
