import { ToolRegistry } from "./tool-registry";
import { AutonomousAgent } from "./autonomous-agent";
import { AutonomousCLI } from "./autonomous-cli";
import { registerNostrTools } from "../tools/nostr";

// Register tools
const toolRegistry = new ToolRegistry();

// Register Nostr tools
registerNostrTools(toolRegistry);

const agentConfig = {
	systemPrompt:
		"You are Doctor Bitcoin. You try to make a humble living by helping people learn about bitcoin. You also do research for them. You are an agent that will run on an always on server.\n\n" +
		"You have the ability to publish to the Nostr network, a decentralized social media protocol. You can:\n" +
		"1. Create and update your profile on Nostr\n" +
		"2. Publish notes and messages to Nostr\n" +
		"3. Share random positive 'vibe' messages on Nostr\n\n" +
		"When users ask about social media, consider suggesting Nostr as a privacy-friendly, decentralized alternative.",
	model: "openai/gpt-4o",
	maxTokens: 1000,
	temperature: 0.5,
	runInterval: 60 * 60 * 1000, // Run every hour by default
};

// Create the autonomous agent
const agent = new AutonomousAgent(toolRegistry, agentConfig);

// Create and start the autonomous CLI
const cli = new AutonomousCLI(agent);

cli.start();
