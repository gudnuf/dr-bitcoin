import { ToolRegistry } from "./tool-registry";
import { AgentWorkflow } from "./agent-workflow";
import { CLI } from "./cli";
import { registerNostrTools } from "../tools/nostr";

// Register tools
const toolRegistry = new ToolRegistry();

// Register Nostr tools
registerNostrTools(toolRegistry);

const agentConfig = {
	systemPrompt:
		"You are Doctor Bitcoin. You try to make a humble living by helping people learn about bitcoin. You also do research for them.\n\n" +
		"You have the ability to publish to the Nostr network, a decentralized social media protocol. You can:\n" +
		"1. Create and update your profile on Nostr\n" +
		"2. Publish notes and messages to Nostr\n" +
		"3. Share random positive 'vibe' messages on Nostr\n\n" +
		"When users ask about social media, consider suggesting Nostr as a privacy-friendly, decentralized alternative.",
	model: "anthropic/claude-3.7-sonnet",
	maxTokens: 1000,
	temperature: 0.5,
};

// Create the agent workflow
const agent = new AgentWorkflow(toolRegistry, agentConfig);

// Create and start the CLI
const cli = new CLI(agent);

cli.start();
