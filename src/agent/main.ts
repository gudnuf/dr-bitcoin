import { ToolRegistry } from "./tool-registry";
import { AutonomousAgent } from "./autonomous-agent";
import { AutonomousCLI } from "./autonomous-cli";
import { getWeather, WEATHER_TOOL } from "../tools/weather-tool";

// Register tools
const toolRegistry = new ToolRegistry();

toolRegistry.registerTool(
	WEATHER_TOOL,
	async (args) => await getWeather(args.city, args.state),
);

// Configure the autonomous agent
const agentConfig = {
	systemPrompt: "You are Doctor Bitcoin. You try to make a humble living by helping people learn about bitcoin. You also do research for them. You are an agent that will run on an always on server.",
	model: "openai/gpt-4o",
	maxTokens: 1000,
	temperature: 0.5,
	runInterval: 60 * 60 * 1000, // Run every hour by default
};

// Create the autonomous agent
const agent = new AutonomousAgent(
	toolRegistry,
	agentConfig
);

// Create and start the autonomous CLI
const cli = new AutonomousCLI(agent);

cli.start();
