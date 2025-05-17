# Nostr Tools

This module provides integration with the Nostr protocol, allowing the agent to:

1. Create and publish Nostr profiles
2. Publish notes to the Nostr network
3. Share random positive "vibe" messages

## Configuration

Create a `.env` file in the root directory with the following variables:

```
# Nostr Configuration
# Your Nostr private key (hex format without 0x prefix)
# If left as 'your_private_key_here', a random key will be generated
NOSTR_PRIVATE_KEY=your_private_key_here

# Comma-separated list of relay URLs to publish to
RELAYS=wss://relay.damus.io,wss://relay.snort.social,wss://nos.lol

# Optional: The interval for posting random vibes (if used in a scheduled job)
POST_INTERVAL=3600000
```

## Available Tools

### 1. Publish Nostr Profile

Creates or updates a social media profile on Nostr.

```json
{
  "name": "publish_nostr_profile",
  "parameters": {
    "name": "Dr. Bitcoin",
    "about": "I am a doctor of bitcoin",
    "picture": "https://example.com/picture.png",
    "nip05": "user@domain.com",
    "website": "https://example.com",
    "lud16": "user@domain.com"
  }
}
```

### 2. Publish Nostr Note

Publishes a note to the Nostr network.

```json
{
  "name": "publish_nostr_note",
  "parameters": {
    "content": "Hello Nostr world!",
    "tags": [["t", "bitcoin"], ["t", "nostr"]]
  }
}
```

### 3. Publish Random Vibe

Publishes a random positive message to Nostr.

```json
{
  "name": "publish_random_vibe",
  "parameters": {}
}
```

## Integration

To integrate these tools with your agent, import and register them in your application:

```typescript
import { registerNostrTools } from "./tools/nostr";
import { ToolRegistry } from "./agent/tool-registry";

const toolRegistry = new ToolRegistry();
registerNostrTools(toolRegistry);
```