import readline from "readline";
import { AutonomousAgent } from "./autonomous-agent";
import chalk from "chalk";
import boxen from "boxen";

export class AutonomousCLI {
	private rl: readline.Interface;
	private agent: AutonomousAgent;
	private isRunning: boolean = false;

	constructor(agent: AutonomousAgent) {
		this.rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		this.agent = agent;
	}

	public async start(): Promise<void> {
		this.isRunning = true;

		try {
			await this.runCommandLoop();
		} catch (error: any) {
			console.error(chalk.red("Error in autonomous CLI:"), error);
		} finally {
			this.rl.close();
		}
	}

	public stop(): void {
		this.isRunning = false;
	}

	private async runCommandLoop(): Promise<void> {
		const welcomeMessage = boxen(
			chalk.cyan("Autonomous Agent Control") +
				"\n\n" +
				chalk.yellow("Commands:") +
				"\n" +
				chalk.green("• goal <text>") +
				" - Set the agent's life goal\n" +
				chalk.green("• start") +
				" - Start the autonomous agent\n" +
				chalk.green("• stop") +
				" - Stop the autonomous agent\n" +
				chalk.green("• status") +
				" - Check agent status\n" +
				chalk.green("• objective add <text>") +
				" - Add a new objective\n" +
				chalk.green("• objective complete <text>") +
				" - Mark an objective as complete\n" +
				chalk.green("• talk <text>") +
				" - Send a message to the agent\n" +
				chalk.green("• exit") +
				" - Quit the CLI",
			{
				padding: 1,
				margin: 1,
				borderStyle: "round",
				borderColor: "cyan",
			},
		);
		console.log(welcomeMessage);

		while (this.isRunning) {
			const input = await this.promptUser(chalk.cyan("Enter a command: "));
			const parts = input.split(" ");
			const command = parts[0] || ""; // Default to empty string if undefined
			const args = parts.slice(1);

			switch (command.toLowerCase()) {
				case "goal":
					if (args.length === 0) {
						console.log(chalk.red("Please provide a goal"));
						break;
					}
					const goal = args.join(" ");
					this.agent.setLifeGoal(goal);
					console.log(chalk.green(`Life goal set: ${goal}`));
					break;

				case "start":
					try {
						this.agent.start();
						console.log(chalk.green("Agent started"));
					} catch (error: any) {
						console.error(chalk.red("Failed to start agent:"), error.message);
					}
					break;

				case "stop":
					this.agent.stop();
					console.log(chalk.yellow("Agent stopped"));
					break;

				case "status":
					const status = this.agent.getStatus();
					const statusBox = boxen(
						chalk.cyan("Agent Status") +
							"\n\n" +
							chalk.yellow("Running: ") +
							(status.isRunning ? chalk.green("Yes") : chalk.red("No")) +
							"\n" +
							chalk.yellow("Life Goal: ") +
							chalk.white(status.memory.goals.lifeGoal || "Not set") +
							"\n\n" +
							chalk.yellow("Current Objectives:") +
							"\n" +
							(status.memory.goals.currentObjectives.length > 0
								? status.memory.goals.currentObjectives
										.map((obj: string) => chalk.white(`- ${obj}`))
										.join("\n")
								: chalk.gray("No current objectives")) +
							"\n\n" +
							chalk.yellow("Completed Objectives:") +
							"\n" +
							(status.memory.goals.completedObjectives.length > 0
								? status.memory.goals.completedObjectives
										.map((obj: string) => chalk.gray(`- ${obj}`))
										.join("\n")
								: chalk.gray("No completed objectives")) +
							"\n\n" +
							chalk.yellow("Last Run: ") +
							chalk.white(
								status.memory.lastRun
									? new Date(status.memory.lastRun).toLocaleString()
									: "Never",
							),
						{
							padding: 1,
							margin: 1,
							borderStyle: "round",
							borderColor: "blue",
						},
					);
					console.log(statusBox);
					break;

				case "objective":
					if (args.length < 2) {
						console.log(
							chalk.red(
								"Invalid objective command. Use 'objective add <text>' or 'objective complete <text>'",
							),
						);
						break;
					}

					const action = args[0]?.toLowerCase() ?? "";
					const objectiveText = args.slice(1).join(" ");

					if (action === "add") {
						this.agent.setObjective(objectiveText);
						console.log(chalk.green(`Objective added: ${objectiveText}`));
					} else if (action === "complete") {
						this.agent.completeObjective(objectiveText);
						console.log(chalk.green(`Objective completed: ${objectiveText}`));
					} else {
						console.log(chalk.red(`Unknown objective action: ${action}`));
					}
					break;

				case "talk":
					if (args.length === 0) {
						console.log(
							chalk.red("Please provide a message to send to the agent"),
						);
						break;
					}
					const message = args.join(" ");
					await this.agent.processInput(message);
					break;

				case "exit":
					console.log(chalk.yellow("Exiting..."));
					this.agent.stop();
					this.stop();
					break;

				case "":
					// Handle empty input
					break;

				default:
					console.log(chalk.red(`Unknown command: ${command}`));
					break;
			}
		}
	}

	private async promptUser(prompt: string): Promise<string> {
		return new Promise<string>((resolve) => {
			this.rl.question(prompt, (answer) => {
				resolve(answer);
			});
		});
	}
}
