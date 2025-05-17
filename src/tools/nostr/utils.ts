import { nip19, type Event } from "nostr-tools";

// Function to normalize ID (convert note1 to hex if needed)
export function normalizeId(id: string): string {
	if (id.startsWith("note1")) {
		try {
			const { data } = nip19.decode(id);
			return data as string;
		} catch (e) {
			throw new Error(`Invalid note1 ID: ${id}`);
		}
	}
	return id;
}

// Function to normalize pubkey (convert npub1 to hex if needed)
export function normalizePubkey(pubkey: string): string {
	if (pubkey.startsWith("npub1")) {
		try {
			const { data } = nip19.decode(pubkey);
			return data as string;
		} catch (e) {
			throw new Error(`Invalid npub1: ${pubkey}`);
		}
	}
	return pubkey;
}

// Function to format an author's information for display
export function formatAuthor(pubkey: string, metadata?: any): string {
	const npub = nip19.npubEncode(pubkey);
	const shortNpub = `${npub.slice(0, 8)}...${npub.slice(-4)}`;

	if (metadata && metadata.name) {
		return `${metadata.name} (${shortNpub})`;
	}

	return shortNpub;
}

// Function to format a post for display
export function formatPost(event: Event, metadata?: any): string {
	const author = formatAuthor(event.pubkey, metadata);
	const date = new Date(event.created_at * 1000).toLocaleString();
	const noteId = nip19.noteEncode(event.id);

	return `ID: ${noteId}
Author: ${author}
Time: ${date}
Content: ${event.content}`;
}
