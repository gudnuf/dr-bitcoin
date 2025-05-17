import readline from "readline";
import chalk from "chalk";

export interface IInvoiceHandler {
  handleInvoice(invoice: string): Promise<boolean>;
}

export class ConsoleInvoiceHandler implements IInvoiceHandler {
  private rl: readline.Interface;

  constructor(rl: readline.Interface) {
    this.rl = rl;
  }

  public async handleInvoice(invoice: string): Promise<boolean> {
    // console.log(chalk.bgGray("Not paying: "), invoice);
    // return true;
    console.log(chalk.yellow("Payment required:"));
    console.log(chalk.blue("Invoice:"), invoice);
    
    const answer = await this.promptUser(chalk.cyan("Confirm payment? (yes/no): "));
    return answer.toLowerCase() === "yes";
  }

  private async promptUser(prompt: string): Promise<string> {
    return new Promise<string>((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer);
      });
    });
  }
} 