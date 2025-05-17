import { AgentWorkflow } from "./agent-workflow";
import type { AgentConfig } from "./agent-workflow";
import { ToolRegistry } from "./tool-registry";
import { MemoryManager } from "./memory";
import { Role } from "inference-grid-sdk";
import chalk from "chalk";

export type AutonomousAgentConfig = AgentConfig & {
	runInterval: number; // Interval in milliseconds
	memoryPath?: string;
	verbose?: boolean; // Optional verbosity level
};

export class AutonomousAgent extends AgentWorkflow {
	private memoryManager: MemoryManager;
	private isRunning: boolean = false;
	private intervalId: NodeJS.Timeout | null = null;
	private agentConfig: AutonomousAgentConfig;
	private statusIntervalId: NodeJS.Timeout | null = null;
	private cycleCount: number = 0;

	constructor(toolRegistry: ToolRegistry, config: AutonomousAgentConfig) {
		super(toolRegistry, config);
		this.agentConfig = config;
		this.memoryManager = new MemoryManager(config.memoryPath);
		this.log("Agent initialized");
	}

	public setLifeGoal(goal: string): void {
		this.memoryManager.setLifeGoal(goal);
		this.log(`Life goal set: ${chalk.yellow(goal)}`);
	}

	public start(): void {
		if (this.isRunning) {
			this.log("Agent is already running", "warn");
			return;
		}

		const lifeGoal = this.memoryManager.getMemory().goals.lifeGoal;
		if (!lifeGoal) {
			throw new Error(
				"Life goal must be set before starting the autonomous agent",
			);
		}

		this.isRunning = true;
		this.cycleCount = 0;

		// Schedule status updates (every 5 minutes or at half the cycle interval, whichever is shorter)
		const statusInterval = Math.min(
			5 * 60 * 1000,
			Math.floor(this.agentConfig.runInterval * 2),
		);
		this.statusIntervalId = setInterval(
			() => this.printStatusSummary(),
			statusInterval,
		);

		this.log(
			`${chalk.green("Autonomous agent started")} with life goal: ${chalk.yellow(lifeGoal)}`,
		);
		this.log(
			`Running on ${chalk.cyan(this.formatInterval(this.agentConfig.runInterval))} intervals`,
		);

		// Print initial status
		this.printStatusSummary();

		// Run the first cycle immediately instead of waiting for the first interval
		this.runCycle();
	}

	public stop(): void {
		if (!this.isRunning) {
			this.log("Agent is already stopped", "warn");
			return;
		}

		if (this.intervalId) {
			clearTimeout(this.intervalId);
			this.intervalId = null;
		}

		if (this.statusIntervalId) {
			clearInterval(this.statusIntervalId);
			this.statusIntervalId = null;
		}

		this.isRunning = false;
		this.log(
			`${chalk.yellow("Autonomous agent stopped")} after ${this.cycleCount} cycles`,
		);
	}

	private async runCycle(): Promise<void> {
		try {
			this.cycleCount++;
			const memory = this.memoryManager.getMemory();
			const objectiveCount = memory.goals.currentObjectives.length;
			const completedCount = memory.goals.completedObjectives.length;

			this.log(
				`${chalk.cyan("Starting cycle")} #${this.cycleCount} | Current objectives: ${objectiveCount} | Completed: ${completedCount}`,
			);

			// Create self-prompt with context
			const selfPrompt = this.generateSelfPrompt(memory);

			// Process the self-prompt
			const { message, toolCalls } = await this.processUserInput(selfPrompt);

			// Log the agent's thought process (truncated in regular logs, full in verbose)
			const truncatedMessage =
				message.length > 150 ? message.substring(0, 150) + "..." : message;

			this.log(`Agent thought process: ${chalk.gray(truncatedMessage)}`);
			if (this.agentConfig.verbose) {
				console.log(chalk.gray("Full thought process:"));
				console.log(chalk.gray(message));
			}

			// Record the action
			this.memoryManager.addHistoryEntry("self-prompt", message);

			// Check for objective updates
			this.checkForObjectiveUpdates(message, memory);

			// Handle any tool calls
			if (toolCalls && toolCalls.length > 0) {
				this.log(
					`Executing ${chalk.green(toolCalls.length.toString())} tools...`,
				);
				const followUpMessage = await this.handleToolCalls(toolCalls);

				const truncatedFollowUp =
					followUpMessage.length > 150
						? followUpMessage.substring(0, 150) + "..."
						: followUpMessage;

				this.log(`Tool execution result: ${chalk.gray(truncatedFollowUp)}`);
				if (this.agentConfig.verbose) {
					console.log(chalk.gray("Full tool execution result:"));
					console.log(chalk.gray(followUpMessage));
				}

				// Record the tool execution
				this.memoryManager.addHistoryEntry("tool-execution", followUpMessage);
			}

			// Update last run timestamp
			this.memoryManager.updateLastRun();
			this.log(
				`${chalk.green("Cycle completed")} #${this.cycleCount} | Next cycle in ${this.formatInterval(this.agentConfig.runInterval)}`,
			);
		} catch (error) {
			this.log(`${chalk.red("Error in autonomous cycle:")} ${error}`, "error");
			this.memoryManager.addHistoryEntry("error", JSON.stringify(error));
		}

		// Schedule the next cycle if the agent is still running
		if (this.isRunning) {
			this.scheduleNextCycle();
		}
	}

	private scheduleNextCycle(): void {
		// Clear any existing timeout
		if (this.intervalId) {
			clearTimeout(this.intervalId);
		}

		// Schedule the next cycle to run after the configured interval
		this.intervalId = setTimeout(
			() => this.runCycle(),
			this.agentConfig.runInterval,
		) as unknown as NodeJS.Timeout;
	}

	private checkForObjectiveUpdates(message: string, memory: any): void {
		// Simple detection of objective completion mentions in the agent's response
		const completionPhrases = [
			"completed objective",
			"objective complete",
			"finished objective",
			"objective is done",
			"objective accomplished",
			"task completed",
			"completed task",
		];

		// Simple detection of new objective mentions
		const newObjectivePhrases = [
			"new objective",
			"adding objective",
			"adding a new objective",
			"should add objective",
			"create objective",
			"adding the objective",
		];

		// Check for completions (very basic detection)
		for (const obj of memory.goals.currentObjectives) {
			const objLower = obj.toLowerCase();
			for (const phrase of completionPhrases) {
				if (
					message.toLowerCase().includes(`${phrase}`) &&
					message.toLowerCase().includes(objLower)
				) {
					this.completeObjective(obj);
					this.log(`${chalk.green("Detected objective completion:")} ${obj}`);
					break;
				}
			}
		}

		// Very basic new objective detection (this is a simple heuristic)
		for (const phrase of newObjectivePhrases) {
			if (message.toLowerCase().includes(phrase)) {
				const startIndex =
					message.toLowerCase().indexOf(phrase) + phrase.length;
				let endIndex = message.indexOf(".", startIndex);
				if (endIndex === -1) endIndex = message.indexOf("\n", startIndex);
				if (endIndex === -1) endIndex = message.length;

				const possibleObjective = message
					.substring(startIndex, endIndex)
					.trim()
					.replace(/^[:"'-\s]+|[:"'-\s]+$/g, "");

				if (possibleObjective.length > 10 && possibleObjective.length < 200) {
					this.setObjective(possibleObjective);
					this.log(
						`${chalk.green("Detected new objective:")} ${possibleObjective}`,
					);
				}
			}
		}
	}

	private printStatusSummary(): void {
		if (!this.isRunning) return;

		const memory = this.memoryManager.getMemory();
		const now = new Date();
		const lastRun = memory.lastRun ? new Date(memory.lastRun) : null;
		const timeSinceLastRun = lastRun
			? Math.floor((now.getTime() - lastRun.getTime()) / 1000)
			: null;

		const nextRunIn = this.intervalId
			? Math.max(
					0,
					this.agentConfig.runInterval -
						(timeSinceLastRun ? timeSinceLastRun * 1000 : 0),
				)
			: null;

		console.log("\n" + chalk.cyan("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
		console.log(chalk.cyan("📊 AGENT STATUS SUMMARY"));
		console.log(chalk.cyan("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
		console.log(
			`${chalk.yellow("Running:")} ${this.isRunning ? chalk.green("Yes") : chalk.red("No")}`,
		);
		console.log(`${chalk.yellow("Cycles completed:")} ${this.cycleCount}`);
		console.log(
			`${chalk.yellow("Current objectives:")} ${memory.goals.currentObjectives.length}`,
		);
		console.log(
			`${chalk.yellow("Completed objectives:")} ${memory.goals.completedObjectives.length}`,
		);

		if (lastRun) {
			console.log(
				`${chalk.yellow("Last run:")} ${lastRun.toLocaleString()} (${timeSinceLastRun}s ago)`,
			);
		} else {
			console.log(`${chalk.yellow("Last run:")} Never`);
		}

		if (nextRunIn !== null) {
			console.log(
				`${chalk.yellow("Next run in:")} ${this.formatInterval(nextRunIn)}`,
			);
		}

		if (memory.goals.currentObjectives.length > 0) {
			console.log(chalk.yellow("\nCurrent objectives:"));
			memory.goals.currentObjectives.forEach((obj: string, i: number) => {
				console.log(`  ${i + 1}. ${chalk.white(obj)}`);
			});
		}

		if (
			memory.goals.completedObjectives.length > 0 &&
			memory.goals.completedObjectives.length <= 5
		) {
			console.log(chalk.yellow("\nRecently completed objectives:"));
			memory.goals.completedObjectives
				.slice(-5)
				.forEach((obj: string, i: number) => {
					console.log(`  ${i + 1}. ${chalk.gray(obj)}`);
				});
		}

		console.log(chalk.cyan("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));
	}

	private generateSelfPrompt(memory: any): string {
		const { goals, context, history, lastRun } = memory;

		const recentHistory = history
			.slice(-5)
			.map(
				(entry: any) =>
					`${new Date(entry.timestamp).toLocaleString()}: ${entry.action} - ${entry.result}`,
			)
			.join("\n");

		return `
You are an autonomous agent with the following life goal:
"${goals.lifeGoal}"

Current objectives:
${goals.currentObjectives.map((obj: string) => `- ${obj}`).join("\n")}

Completed objectives:
${goals.completedObjectives.map((obj: string) => `- ${obj}`).join("\n")}

Current context:
${JSON.stringify(context, null, 2)}

Recent history:
${recentHistory}

Last run: ${lastRun ? new Date(lastRun).toLocaleString() : "Never"}

Based on this information:
1. Review your progress toward your life goal
2. Update your objectives if needed (add new ones or mark existing ones as complete)
3. Determine what action to take next to make progress
4. Execute that action using available tools if needed
5. Update your context with any new information

Respond with your thoughts and next steps. When you want to mark an objective as complete, explicitly say "Completed objective: [objective text]". When you want to add a new objective, explicitly say "Adding objective: [new objective]".
`;
	}

	public async processInput(input: string): Promise<void> {
		try {
			this.log(
				`${chalk.blue("Processing user input")}: ${input.substring(0, 50)}${input.length > 50 ? "..." : ""}`,
			);

			const { message, toolCalls } = await this.processUserInput(input);

			this.log(
				`Response: ${chalk.white(message.substring(0, 100))}${message.length > 100 ? "..." : ""}`,
			);
			if (this.agentConfig.verbose) {
				console.log(chalk.white("Full response:"));
				console.log(chalk.white(message));
			}

			// Handle any tool calls
			if (toolCalls && toolCalls.length > 0) {
				this.log(
					`Executing ${chalk.green(toolCalls.length.toString())} tools from user input...`,
				);
				const followUpMessage = await this.handleToolCalls(toolCalls);
				this.log(
					`Tool execution result: ${chalk.white(followUpMessage.substring(0, 100))}${followUpMessage.length > 100 ? "..." : ""}`,
				);
			}

			this.memoryManager.addHistoryEntry("user-input", message);
		} catch (error) {
			this.log(`${chalk.red("Error processing input:")} ${error}`, "error");
		}
	}

	public setObjective(objective: string): void {
		this.memoryManager.addObjective(objective);
		this.log(`${chalk.green("Added objective:")} ${objective}`);
	}

	public completeObjective(objective: string): void {
		this.memoryManager.completeObjective(objective);
		this.log(`${chalk.green("Completed objective:")} ${objective}`);
	}

	public getStatus(): any {
		return {
			isRunning: this.isRunning,
			cycleCount: this.cycleCount,
			memory: this.memoryManager.getMemory(),
		};
	}

	private log(
		message: string,
		level: "info" | "warn" | "error" = "info",
	): void {
		const timestamp = new Date().toLocaleTimeString();
		const prefix = `[${timestamp}] 🤖 `;

		switch (level) {
			case "warn":
				console.warn(chalk.yellow(prefix + message));
				break;
			case "error":
				console.error(chalk.red(prefix + message));
				break;
			default:
				console.log(prefix + message);
		}
	}

	private formatInterval(ms: number): string {
		if (ms < 1000) return `${ms}ms`;
		if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
		if (ms < 3600000)
			return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
		return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
	}
}
