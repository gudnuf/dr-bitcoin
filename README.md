# Dr. Bitcoin Chat CLI

A simple chat CLI application that uses the Inference Grid to interact with an LLM and process payments through Lightning Network invoices.

## Features

- Chat with an AI assistant specialized in Bitcoin and cryptocurrency
- Autonomous agent capabilities for more complex interactions
- Payment handling through Lightning Network invoices
- Real-time streaming of AI responses

## Setup

1. Install dependencies:

```bash
npm install
```

2. Build the project:

```bash
npm run build
```

3. Run the application:

```bash
npm start
```

## Usage

Once running, you can interact with Dr. Bitcoin by typing messages. The following commands are also available:

- `exit` - Quit the conversation
- `reset` - Start over with a new conversation
- `status` - View the agent's current status

## Configuration

You can configure the application by modifying the config object in `src/index.ts`:

```typescript
const chatCli = new ChatCLI(toolRegistry, {
  privateKey: "your-private-key", // Your Inference Grid private key
  modelId: 'openai/gpt-4o',      // The model to use
  systemPrompt: "Custom system prompt", // Custom instructions for the AI
  maxTokens: 1000,               // Maximum tokens in the response
  temperature: 0.7,              // Response randomness (0-1)
  verbose: false                 // Enable verbose logging
});
```

## License

MIT

# Dr. Bitcoin Autonomous Agent

An autonomous agent with a life goal that runs on intervals to continue making progress towards achieving its goal.

## Overview

The Dr. Bitcoin autonomous agent is designed to:

1. Operate with a defined "life goal"
2. Break down this goal into smaller objectives
3. Run on a regular schedule to make progress
4. Maintain memory between runs to build on previous work
5. Allow human oversight and intervention

## How It Works

The autonomous agent operates on a cycle:

1. At each interval, the agent prompts itself with:
   - Its life goal
   - Current objectives
   - Completed objectives
   - Context from previous runs
   - Recent history of actions and results

2. The agent then:
   - Reviews its progress
   - Updates objectives
   - Takes actions using available tools
   - Records its findings and results

## Running the Agent

### Interactive CLI Mode

Run the CLI to interact with the agent:

```bash
npm start
```

In this mode, you can:
- Set a life goal
- Add/complete objectives
- Start/stop the agent's automated cycles
- Send direct messages to the agent
- Check the agent's status

### Commands

- `goal <text>` - Set the agent's life goal
- `start` - Start the autonomous agent cycles
- `stop` - Stop the autonomous agent
- `status` - Check agent status
- `objective add <text>` - Add a new objective
- `objective complete <text>` - Mark an objective as complete
- `talk <text>` - Send a message to the agent
- `exit` - Quit the CLI

### Automated Mode

For fully automated operation with a predefined goal:

```bash
npm run autonomous
```

This will start the agent with a preset life goal and run it continuously until stopped.

#### Command Line Options

The autonomous mode supports several command-line options:

```bash
# Run with custom interval (in minutes)
npm run autonomous -- --interval=5

# Run in quiet mode (less verbose output)
npm run autonomous -- --quiet

# Explicitly enable verbose mode
npm run autonomous -- --verbose
```

## Status Updates

The agent provides detailed status updates:

1. **Real-time logs with timestamps**: Every action the agent takes is logged with a timestamp.

2. **Periodic status summaries**: The agent prints a comprehensive status summary at regular intervals, showing:
   - Running status
   - Cycles completed
   - Current and completed objectives
   - Last run timestamp
   - Time until next run

3. **Automatic objective detection**: The agent automatically detects when it has completed objectives or created new ones.

4. **Cycle information**: Each cycle includes detailed status information:
   - Start and end notifications
   - Number of tools executed
   - Truncated thought process (full version in verbose mode)

## Customization

You can customize the agent by:

1. Registering additional tools
2. Modifying the system prompt
3. Changing the run interval
4. Adjusting model parameters
5. Setting the verbosity level

## Memory

The agent maintains a persistent memory file (`agent-memory.json`) that stores:

- The life goal
- Current and completed objectives
- Context data
- Action history
- Timestamp of the last run

This allows the agent to maintain continuity between restarts.

# dr-bitcoin

## Setup

### With Nix (ideal)
> or you can just [install bun](https://bun.sh/docs/installation) directly.

Install nix with. Reccommended to use Dereminate systems installer: https://determinate.systems/posts/determinate-nix-installer/

You can just run this command from derterminate systems:
```bash
https://determinate.systems/posts/determinate-nix-installer/
```

Optionally [install direnv](https://direnv.net/docs/installation.html) to load your environment everytime, then [add a shell hook](https://direnv.net/docs/hook.html).

Or just enter this directory and run:
```bash
nix develop
```

## Usage

Run the agent and start a CLI chat with:

```
bun agent
```

