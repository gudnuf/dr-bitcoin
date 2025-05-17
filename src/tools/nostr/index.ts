import { ToolRegistry } from "../../agent/tool-registry";
import {
	MANAGE_NOSTR_PROFILE,
	NOSTR_BROWSE_FEED,
	NOSTR_VIEW_THREAD,
	NOSTR_POST_NOTE,
	NOSTR_REPLY,
	NOSTR_GET_PROFILE,
	manageNostrProfile,
	nostrBrowseFeed,
	nostrViewThread,
	nostrPostNote,
	nostrReply,
	nostrGetProfile,
	publishNostrProfile,
	publishNostrNote,
	generateNostrKeys,
	cleanup,
} from "./main";

export {
	MANAGE_NOSTR_PROFILE,
	NOSTR_BROWSE_FEED,
	NOSTR_VIEW_THREAD,
	NOSTR_POST_NOTE,
	NOSTR_REPLY,
	NOSTR_GET_PROFILE,
	manageNostrProfile,
	nostrBrowseFeed,
	nostrViewThread,
	nostrPostNote,
	nostrReply,
	nostrGetProfile,
	publishNostrProfile,
	publishNostrNote,
	generateNostrKeys,
};

export function registerNostrTools(registry: ToolRegistry): void {
	registry.registerTool(MANAGE_NOSTR_PROFILE, manageNostrProfile);
	registry.registerTool(NOSTR_BROWSE_FEED, nostrBrowseFeed);
	// registry.registerTool(NOSTR_VIEW_THREAD, nostrViewThread);
	// registry.registerTool(NOSTR_POST_NOTE, nostrPostNote);
	// registry.registerTool(NOSTR_REPLY, nostrReply);
	// registry.registerTool(NOSTR_GET_PROFILE, nostrGetProfile);

	// Register cleanup for SIGINT handling
	process.on("SIGINT", cleanup);
}
