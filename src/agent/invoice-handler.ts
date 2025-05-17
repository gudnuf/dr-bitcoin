import readline from "readline";

export type IInvoiceHandler = {
  handleInvoice(invoice: string): Promise<boolean>;
};

export class ConsoleInvoiceHandler implements IInvoiceHandler {
  private rl: readline.Interface;

  constructor(rl: readline.Interface) {
    this.rl = rl;
  }

  public async handleInvoice(invoice: string): Promise<boolean> {
    console.log("Invoice:", invoice);
    
    return await this.confirmPayment();
  }

  private async confirmPayment(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.rl.question("Has the invoice been paid? (yes/no): ", (answer) => {
        resolve(answer.toLowerCase() === "yes");
      });
    });
  }
} 