import { ToolRegistry } from "../../agent/tool-registry";
import {
  PUBLISH_NOSTR_PROFILE_TOOL,
  PUBLISH_NOSTR_NOTE_TOOL,
  PUBLISH_RANDOM_VIBE_TOOL,
  GENERATE_NOSTR_KEYS_TOOL,
  publishNostrProfile,
  publishNostrNote,
  publishRandomVibe,
  generateNostrKeys,
  cleanup
} from "./main";

export function registerNostrTools(registry: ToolRegistry): void {
  registry.registerTool(PUBLISH_NOSTR_PROFILE_TOOL, publishNostrProfile);
  registry.registerTool(PUBLISH_NOSTR_NOTE_TOOL, publishNostrNote);
  registry.registerTool(PUBLISH_RANDOM_VIBE_TOOL, publishRandomVibe);
  registry.registerTool(GENERATE_NOSTR_KEYS_TOOL, generateNostrKeys);

  // Register cleanup for SIGINT handling
  process.on('SIGINT', cleanup);
}

export {
  PUBLISH_NOSTR_PROFILE_TOOL,
  PUBLISH_NOSTR_NOTE_TOOL,
  PUBLISH_RANDOM_VIBE_TOOL,
  GENERATE_NOSTR_KEYS_TOOL
};