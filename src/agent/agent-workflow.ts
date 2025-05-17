import { InferenceGrid, Role, type Message } from "inference-grid-sdk";
import { ToolRegistry } from "./tool-registry";
import { RegistrationHandler } from "./registration-handler";

export type AgentConfig = {
  systemPrompt: string;
  model: string;
  maxTokens: number;
  temperature: number;
};

export class AgentWorkflow {
  private messages: Message[] = [];
  private client: InferenceGrid | null = null;
  private toolRegistry: ToolRegistry;
  private config: AgentConfig;
  private registrationHandler: RegistrationHandler;

  constructor(
    toolRegistry: ToolRegistry, 
    config: AgentConfig
  ) {
    this.registrationHandler = new RegistrationHandler();
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

  /**
   * Initializes the agent by checking registration status and setting up the client
   * @returns Object with registration status and invoice if payment is needed
   */
  public async initialize(): Promise<{
    isRegistered: boolean;
    invoice?: string;
    needsPayment: boolean;
  }> {
    const status = await this.registrationHandler.getOrRegisterClient();
    
    if (status.isRegistered && status.client) {
      this.client = status.client;
    }
    
    return status;
  }

  /**
   * Confirms registration after payment has been processed
   * @returns boolean indicating if registration was confirmed successfully
   */
  public async confirmRegistration(): Promise<boolean> {
    const confirmed = await this.registrationHandler.confirmRegistration();
    
    if (confirmed) {
      this.client = this.registrationHandler.getClient();
    }
    
    return confirmed;
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
    if (!this.client) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }
    
    // Add user message to conversation
    this.messages.push({ role: Role.USER, content: userInput });

    console.log('sending req', this.config)

    // Get LLM response
    const response = await this.client.chat({
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
      model: { modelIds: [this.config.model], flags: [] },
      messages: this.messages,
      tools: this.toolRegistry.getTools(),
    });

    console.log('response', response);

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
    if (!this.client) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }
    
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