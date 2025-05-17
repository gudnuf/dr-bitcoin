// Define types for Nostr tools

// Profile data type
export type ProfileData = {
  name?: string;
  about?: string;
  picture?: string;
  nip05?: string;
  website?: string;
  lud16?: string;
};

// Feed filter parameters
export type FeedFilterParams = {
  feed_type: 'global' | 'user' | 'hashtag' | 'search';
  pubkey?: string;
  hashtag?: string;
  search_term?: string;
  limit?: number;
  since?: number;
};

// Thread parameters
export type ThreadParams = {
  note_id: string;
  limit?: number;
};

// Note posting parameters
export type NoteParams = {
  content: string;
  mentions?: string[];
  hashtags?: string[];
  geohash?: string;
};

// Reply parameters
export type ReplyParams = {
  content: string;
  reply_to: string;
  root?: string;
};

// Profile parameters
export type ProfileParams = {
  pubkey: string;
};

// Profile management parameters
export type ProfileManagementParams = {
  operation: 'create' | 'read' | 'update' | 'delete';
  name?: string;
  about?: string;
  picture?: string;
  nip05?: string;
  website?: string;
  lud16?: string;
  publicKey?: string;
};

// Event publishing parameters
export type EventPublishParams = {
  kind: number;
  content: string;
  tags?: string[][];
  relays?: string[];
};

// API response base type
export type ApiResponse = {
  success: boolean;
  error?: string;
  message?: string;
};

// Feed response
export type FeedResponse = ApiResponse & {
  feed_type?: string;
  posts?: string[];
  post_count?: number;
};

// Thread response
export type ThreadResponse = ApiResponse & {
  root_post?: string;
  replies?: string[];
  reply_count?: number;
};

// Note response
export type NoteResponse = ApiResponse & {
  noteId?: string;
  nip19NoteId?: string;
  viewUrl?: string;
  publicKey?: string;
  npub?: string;
};

// Profile response
export type ProfileResponse = ApiResponse & {
  pubkey?: string;
  npub?: string;
  name?: string;
  about?: string;
  picture?: string;
  nip05?: string;
  website?: string;
  lud16?: string;
  profile_url?: string;
  profileData?: ProfileData;
  profileUrl?: string;
  action?: string;
};

// Event response
export type EventResponse = ApiResponse & {
  eventId?: string;
  kind?: number;
  publicKey?: string;
  npub?: string;
  relays?: string[];
};

// Key generation response
export type KeyGenerationResponse = ApiResponse & {
  publicKey?: string;
  npub?: string;
  profileUrl?: string;
  createdAt?: string;
}; 