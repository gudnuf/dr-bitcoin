import { InferenceGrid, Role, type Message } from "inference-grid-sdk";
import { ToolRegistry } from "./tool-registry";

export type AgentConfig = {
	systemPrompt: string;
	model: string;
	maxTokens: number;
	temperature: number;
};

export class AgentWorkflow {
	private messages: Message[] = [];
	private client: InferenceGrid;
	private toolRegistry: ToolRegistry;
	private config: AgentConfig;

	constructor(toolRegistry: ToolRegistry, config: AgentConfig) {
		this.client = new InferenceGrid();
		this.toolRegistry = toolRegistry;
		this.config = config;

		// Initialize with system message
		this.messages = [
			{
				role: Role.SYSTEM,
				content: config.systemPrompt,
			},
		];
	}

	public resetConversation(): void {
		// Keep only the system message
		this.messages.splice(1);
	}

	public async processUserInput(userInput: string): Promise<{
		message: string;
		invoice?: string | null;
		needsPayment: boolean;
		toolCalls?: any[];
	}> {
		// Add user message to conversation
		this.messages.push({ role: Role.USER, content: userInput });

		// Get LLM response
		const response = await this.client.chat({
			maxTokens: this.config.maxTokens,
			temperature: this.config.temperature,
			model: { modelIds: [this.config.model], flags: [] },
			messages: this.messages,
			tools: this.toolRegistry.getTools(),
		});

		// Add assistant response to conversation history
		this.messages.push({ role: Role.ASSISTANT, content: response.message });

		return {
			message: response.message,
			invoice: response.invoice,
			needsPayment: !!response.invoice,
			toolCalls: response.toolCalls,
		};
	}

	public async handleToolCalls(toolCalls: any[]): Promise<string> {
		if (!toolCalls || toolCalls.length === 0) return "";

		for (const toolCall of toolCalls) {
			const toolName = toolCall.function.name;
			const args = JSON.parse(toolCall.function.arguments);

			try {
				const result = await this.toolRegistry.executeTool(toolName, args);

				// Add tool result to conversation
				this.messages.push({
					role: Role.TOOL,
					content: JSON.stringify(result),
					tool_call_id: toolCall.id,
				});
			} catch (error: any) {
				this.messages.push({
					role: Role.TOOL,
					content: JSON.stringify({
						error: `Failed to execute tool: ${error.message}`,
					}),
					tool_call_id: toolCall.id,
				});
			}
		}

		// Get follow-up response from LLM after tool execution
		const followUpResponse = await this.client.chat({
			maxTokens: this.config.maxTokens,
			temperature: this.config.temperature,
			model: { modelIds: [this.config.model], flags: [] },
			messages: this.messages,
			tools: this.toolRegistry.getTools(),
		});

		// Add assistant response to conversation history
		this.messages.push({
			role: Role.ASSISTANT,
			content: followUpResponse.message,
		});

		return followUpResponse.message;
	}
}
