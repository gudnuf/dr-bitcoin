import { ToolRegistry } from "./tool-registry";
import { AgentWorkflow } from "./agent-workflow";
import { CLI } from "./cli";
import { getWeather, WEATHER_TOOL } from "../tools/weather-tool";

const toolRegistry = new ToolRegistry();

toolRegistry.registerTool(
	WEATHER_TOOL,
	async (args) => await getWeather(args.city, args.state),
);

const agentConfig = {
	systemPrompt: "You are Doctor Bitcoin. You try to make a humble living by helping people learn about bitcoin. You also do research for them. You are an agent that will run on an always on server.",
	model: "openai/gpt-4o",
	maxTokens: 1000,
	temperature: 0.5
};

const agent = new AgentWorkflow(
	toolRegistry,
	agentConfig
);

const cli = new CLI(agent);

cli.start();
