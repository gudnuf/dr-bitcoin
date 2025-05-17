# Dr. Bitcoin with Nostr Integration

This extension to Dr. Bitcoin adds social media capabilities via the Nostr protocol, allowing the AI agent to interact with the decentralized social network.

## Features

- **Profile Management**: Create and update Dr. Bitcoin's profile on Nostr
- **Note Publishing**: Share messages and content on the Nostr network
- **Positive Vibes**: Send random positive messages to brighten people's day
- **Key Management**: Generate and store persistent Nostr identity

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Generate Dr. Bitcoin's Nostr identity:
   ```
   npm run nostr-keys generate
   ```
   This creates a persistent key pair that Dr. Bitcoin will use consistently.

3. Run the Nostr demo agent:
   ```
   npm run nostr-demo
   ```

## Key Management

Dr. Bitcoin now maintains persistent Nostr keys that are stored securely. The keys are used across sessions to maintain a consistent identity on the Nostr network.

Managing keys:
```
# Generate new keys (overwrites existing ones)
npm run nostr-keys generate

# Show current keys
npm run nostr-keys show

# Check if keys exist
npm run nostr-keys status

# Delete keys
npm run nostr-keys delete
```

You can also ask Dr. Bitcoin to generate new keys with the prompt:
```
Please generate new Nostr keys for yourself
```

## Usage Examples

Here are some example prompts you can use with the agent:

### Creating a Profile

```
Can you create a Nostr profile for Dr. Bitcoin that includes information about
my Bitcoin expertise and a link to my lightning address?
```

### Publishing Content

```
Please post a note to Nostr explaining how Lightning Network works in simple terms.
```

### Sharing a Positive Vibe

```
Share a positive vibe message on Nostr about the future of Bitcoin.
```

## Viewing Your Posts

After publishing, the agent will provide links to view your posts on Nostr web clients like:

- [Primal](https://primal.net/)
- [Snort](https://snort.social/)
- [Iris](https://iris.to/)

## About Nostr

Nostr (Notes and Other Stuff Transmitted by Relays) is a decentralized protocol that enables global, censorship-resistant social media. Unlike traditional social platforms, Nostr:

- Has no central server
- Gives users control of their data
- Is open and permissionless
- Allows monetization via Lightning Network

To learn more about Nostr, visit [nostr.com](https://nostr.com/).

## Technical Details

The implementation uses:
- nostr-tools library for Nostr communication
- WebSocket for relay connections
- dotenv for environment configuration

The agent's tools are defined in `src/tools/nostr/` and include:
- `publish_nostr_profile`: Create/update social profiles
- `publish_nostr_note`: Publish notes to the network
- `publish_random_vibe`: Share positive messages
- `generate_nostr_keys`: Create new key pairs for identity management

Dr. Bitcoin's keys are stored in the `.nostr-keys` directory in the project root.