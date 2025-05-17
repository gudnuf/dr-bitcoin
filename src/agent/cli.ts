import readline from "readline";
import { AgentWorkflow } from "./agent-workflow";
import { ConsoleInvoiceHandler, type IInvoiceHandler } from "./invoice-handler";
import chalk from "chalk";
import boxen from "boxen";

export class CLI {
	private rl: readline.Interface;
	private agent: AgentWorkflow;
	private invoiceHandler: IInvoiceHandler;
	private isRunning: boolean = false;

	constructor(agent: AgentWorkflow) {
		this.rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		this.agent = agent;
		this.invoiceHandler = new ConsoleInvoiceHandler(this.rl);
	}

	public async start(): Promise<void> {
		this.isRunning = true;

		try {
			await this.runConversationLoop();
		} catch (error: any) {
			console.error(chalk.red("Error in conversation:"), error);
		} finally {
			this.rl.close();
		}
	}

	public stop(): void {
		this.isRunning = false;
	}

	private async runConversationLoop(): Promise<void> {
		const welcomeMessage = boxen(
			chalk.cyan("Dr. Bitcoin is ready to help!") +
				"\n\n" +
				chalk.yellow("Commands:") +
				"\n" +
				chalk.green("• exit") +
				" - Quit the conversation\n" +
				chalk.green("• reset") +
				" - Start over",
			{
				padding: 1,
				margin: 1,
				borderStyle: "round",
				borderColor: "cyan",
			},
		);
		console.log(welcomeMessage);

		while (this.isRunning) {
			const userInput = await this.promptUser(chalk.cyan("Enter a command: "));

			if (userInput.toLowerCase() === "exit") {
				console.log(chalk.yellow("Conversation ended."));
				this.stop();
				break;
			}

			if (userInput.toLowerCase() === "reset") {
				this.agent.resetConversation();
				console.log(chalk.green("Conversation has been reset."));
				continue;
			}

			// Process user input
			const { message, invoice, needsPayment, toolCalls } =
				await this.agent.processUserInput(userInput);

			console.log(chalk.blue("Response:"), message);

			// Handle payment if needed
			if (needsPayment && invoice) {
				const paymentConfirmed =
					await this.invoiceHandler.handleInvoice(invoice);
				if (!paymentConfirmed) {
					console.log(chalk.red("Operation cancelled: Payment not confirmed"));
					continue;
				}
			}

			// Handle tool calls
			if (toolCalls && toolCalls.length > 0) {
				console.log(chalk.yellow("Executing tools..."));
				const followUpMessage = await this.agent.handleToolCalls(toolCalls);
				console.log(chalk.blue("Follow-up response:"), followUpMessage);
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
