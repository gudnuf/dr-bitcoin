import type { Tool } from "../types";

export type ToolExecutor = (args: any) => Promise<any>;

export class ToolRegistry {
  private toolMap: Map<string, ToolExecutor> = new Map();
  private toolDefinitions: Tool[] = [];

  constructor() {}

  public registerTool(tool: Tool, executor: ToolExecutor): void {
    this.toolMap.set(tool.function.name, executor);
    this.toolDefinitions.push(tool);
  }

  public async executeTool(toolName: string, args: any): Promise<any> {
    const executor = this.toolMap.get(toolName);
    if (!executor) {
      throw new Error(`Tool ${toolName} not found`);
    }
    return await executor(args);
  }

  public getTools(): Tool[] {
    return [...this.toolDefinitions];
  }
} 