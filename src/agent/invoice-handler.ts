import readline from "readline";
import { IInvoiceHandler } from './IInvoiceHandler';  // Assuming you have this interface

export class ConsoleInvoiceHandler implements IInvoiceHandler {
  private rl: readline.Interface;
  private mnemonic: string;

  constructor(rl: readline.Interface, mnemonic: string) {
    this.rl = rl;
    this.mnemonic = mnemonic;  // Using the mnemonic passed in, no SparkWallet
  }

  public async handleInvoice(invoice: string): Promise<boolean> {
    console.log("Invoice:", invoice);

    // Call the functions you need for the payment system, assuming `payInvoice` and `paymentCheckSuccess` are defined elsewhere
    const paymentResult = await this.payInvoice(invoice);

    // Confirm the payment status
    return paymentResult;
  }

  // Function to handle the payment of the invoice
  private async payInvoice(invoice: string): Promise<boolean> {
    console.log(`Attempting to pay invoice: ${invoice}`);
    // Implement the logic for paying an invoice here (you can replace this with actual logic like calling a payment gateway)
    
    // Simulating success
    return true;  // Return true or false depending on the success of the payment
  }

  // Function to check if payment was successful
  private async paymentCheckSuccess(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.rl.question("Has the invoice been paid? (yes/no): ", (answer) => {
        resolve(answer.toLowerCase() === "yes");
      });
    });
  }
}