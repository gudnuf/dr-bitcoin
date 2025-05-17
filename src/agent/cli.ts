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
      // Initialize agent and handle registration if needed
      const registrationResult = await this.initializeAgent();
      if (!registrationResult) {
        console.log(chalk.red("Initialization failed. Exiting..."));
        this.stop();
        return;
      }
      
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

  private async initializeAgent(): Promise<boolean> {
    console.log(chalk.cyan("Initializing Dr. Bitcoin..."));
    
    // Initialize the agent and check registration status
    const { isRegistered, invoice, needsPayment } = await this.agent.initialize();
    
    if (isRegistered) {
      console.log(chalk.green("Client is registered and ready to use!"));
      return true;
    }
    
    if (needsPayment && invoice) {
      console.log(chalk.yellow("Registration required. Please pay the invoice to proceed:"));
      
      const paymentConfirmed = await this.invoiceHandler.handleInvoice(invoice);
      if (!paymentConfirmed) {
        console.log(chalk.red("Registration cancelled: Payment not confirmed"));
        return false;
      }
      
      console.log(chalk.yellow("Confirming registration..."));
      const registrationConfirmed = await this.agent.confirmRegistration();
      
      if (registrationConfirmed) {
        console.log(chalk.green("Registration successful!"));
        return true;
      } else {
        console.log(chalk.red("Registration confirmation failed."));
        return false;
      }
    }
    
    console.log(chalk.red("Unable to register client."));
    return false;
  }

  private async runConversationLoop(): Promise<void> {
    const welcomeMessage = boxen(
      chalk.cyan("Dr. Bitcoin is ready to help!") + "\n\n" +
      chalk.yellow("Commands:") + "\n" +
      chalk.green("• exit") + " - Quit the conversation\n" +
      chalk.green("• reset") + " - Start over",
      {
        padding: 1,
        margin: 1,
        borderStyle: "round",
        borderColor: "cyan"
      }
    );
    console.log(welcomeMessage);

    while (this.isRunning) {
      const userInput = await this.promptUser(
        chalk.cyan("Enter a command: ")
      );

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

      console.log('userInput', userInput);

      // Process user input
      const { message, invoice, needsPayment, toolCalls } = await this.agent.processUserInput(userInput);
      
      console.log(chalk.blue("Response:"), message);

      // Handle payment if needed
      if (needsPayment && invoice) {
        const paymentConfirmed = await this.invoiceHandler.handleInvoice(invoice);
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