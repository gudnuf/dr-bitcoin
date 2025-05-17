import { ToolRegistry } from "./agent/tool-registry";
import { AgentWorkflow } from "./agent/agent-workflow";
import { registerNostrTools } from "./tools/nostr";
import readline from "readline";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function main() {
	console.log("🤖 Starting Dr. Bitcoin Agent with Nostr Integration");
	console.log("==================================================");

	// Create tool registry and register Nostr tools
	const toolRegistry = new ToolRegistry();
	registerNostrTools(toolRegistry);

	// Create agent with Nostr-specific prompt
	const agentConfig = {
		systemPrompt:
			"You are Dr. Bitcoin, a helpful assistant focused on Bitcoin education and using Nostr for social media.\n\n" +
			"CAPABILITIES:\n" +
			"1. You can create and update your Nostr profile\n" +
			"2. You can publish notes to the Nostr network\n" +
			"3. You can share random positive vibes on Nostr\n\n" +
			"Always try to be helpful. If users ask about social media, recommend Nostr as a decentralized alternative to centralized platforms.",
		model: "openai/gpt-4o",
		maxTokens: 1000,
		temperature: 0.7,
	};

	const agent = new AgentWorkflow(toolRegistry, agentConfig);

	// Create CLI interface
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	console.log("\n🌟 Dr. Bitcoin is ready to help you with Bitcoin and Nostr!");
	console.log("Try asking questions like:");
	console.log('- "Can you create a Nostr profile for Dr. Bitcoin?"');
	console.log('- "Please post a message about Bitcoin basics to Nostr"');
	console.log('- "Share a positive vibe on Nostr"\n');

	// Main interaction loop
	const promptUser = () => {
		rl.question("You: ", async (input) => {
			if (input.toLowerCase() === "exit" || input.toLowerCase() === "quit") {
				console.log("Goodbye! 👋");
				rl.close();
				process.exit(0);
				return;
			}

			try {
				// Process user input with agent
				const response = await agent.processUserInput(input);

				// Display agent's response
				console.log(`\nDr. Bitcoin: ${response.message}\n`);

				// Handle tool calls if any
				if (response.toolCalls && response.toolCalls.length > 0) {
					console.log("⚙️ Dr. Bitcoin is taking action...");
					const followUp = await agent.handleToolCalls(response.toolCalls);
					if (followUp) {
						console.log(`\nDr. Bitcoin: ${followUp}\n`);
					}
				}
			} catch (error: any) {
				console.error("Error:", error.message || error);
			}

			// Continue the conversation
			promptUser();
		});
	};

	// Start the conversation
	promptUser();
}

// Run the demo
main().catch(console.error);
