// --- Tool Registry ---
type Tool = {
	type: string;
	function: {
		name: string;
		description: string;
		parameters: string;
	};
};

export class ToolRegistry {
	private toolMap: Map<string, (args: any) => Promise<any>> = new Map();
	public tools: Tool[] = [];

	registerTool(tool: Tool, executor: (args: any) => Promise<any>) {
		this.toolMap.set(tool.function.name, executor);
		this.tools.push(tool);
	}

	getToolExecutor(name: string): ((args: any) => Promise<any>) | undefined {
		return this.toolMap.get(name);
	}
}

// --- Context Management ---
interface Context {
	data: Record<string, any>;
}

export class TaskManager {
	constructor(
		private toolRegistry: ToolRegistry,
		private context: Context,
	) {}
	async executeTool(toolName: string, args: any) {
		const executor = this.toolRegistry.getToolExecutor(toolName);
		if (!executor) throw new Error(`Tool ${toolName} not found.`);
		const result = await executor(args);
		this.context.data[toolName] = result;
		return result;
	}
}
