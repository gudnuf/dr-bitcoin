import { ToolRegistry } from "./agent/tool-registry";
import { AutonomousAgent } from "./agent/autonomous-agent";
import chalk from "chalk";
import { registerNostrTools } from "./tools/nostr";

// Parse command line arguments
const args = process.argv.slice(2);
const intervalArg = args.find((arg) => arg.startsWith("--interval="));
const verboseArg = args.includes("--verbose");
const quietArg = args.includes("--quiet");

// Register tools
const toolRegistry = new ToolRegistry();

registerNostrTools(toolRegistry);

// Parse interval if provided
let runInterval = 15 * 1000; // Default: 15 seconds
if (intervalArg) {
	const intervalValue = intervalArg.split("=")[1] || "";
	try {
		// Parse as minutes and convert to milliseconds
		runInterval = parseInt(intervalValue) * 60 * 1000;
		if (isNaN(runInterval) || runInterval < 1000) {
			console.error(chalk.red(`Invalid interval value: ${intervalValue}`));
			runInterval = 15 * 60 * 1000;
		}
	} catch (error) {
		console.error(chalk.red(`Error parsing interval: ${error}`));
	}
}

// Configure the autonomous agent
const agentConfig = {
	systemPrompt:
		"You are Doctor Bitcoin. You try to make a humble living by helping people learn about bitcoin and you use nostr to do it.",
	model: "openai/gpt-4o",
	maxTokens: 1000,
	temperature: 0.5,
	runInterval: runInterval,
	verbose: !quietArg, // Enable verbose by default unless --quiet is specified
};

// Create the autonomous agent
const agent = new AutonomousAgent(toolRegistry, agentConfig);

// Set the life goal
const lifeGoal =
	"Educate people about Bitcoin by researching and organizing knowledge about Bitcoin technology, history, and best practices. Use nostr to post my thoughts and research and also search nostr to perform research.";
agent.setLifeGoal(lifeGoal);

// Add initial objectives
agent.setObjective("Create a profile on nostr if you don't already have one");
agent.setObjective(
	"Identify key topics that people new to Bitcoin need to understand",
);
agent.setObjective("Summarize what people are saying on nostr about bitcoin");

console.log(chalk.cyan("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
console.log(chalk.cyan("🤖 DR. BITCOIN AUTONOMOUS AGENT"));
console.log(chalk.cyan("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
console.log(`${chalk.yellow("Life Goal:")}`);
console.log(`  ${chalk.white(lifeGoal)}`);
console.log(`${chalk.yellow("Run Interval:")} ${formatInterval(runInterval)}`);
console.log(
	`${chalk.yellow("Verbose Mode:")} ${agentConfig.verbose ? chalk.green("Enabled") : chalk.red("Disabled")}`,
);
console.log(chalk.cyan("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));

// Start the agent
agent.start();

// Handle graceful shutdown
process.on("SIGINT", () => {
	console.log(chalk.yellow("\nStopping autonomous agent..."));
	agent.stop();
	console.log(chalk.green("Agent stopped successfully. Goodbye!"));
	process.exit(0);
});

console.log(chalk.cyan("Agent is running. Press Ctrl+C to stop."));

// Helper function to format time intervals
function formatInterval(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
	if (ms < 3600000)
		return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
	return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}
