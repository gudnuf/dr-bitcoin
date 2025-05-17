import type { IInvoiceHandler } from './IInvoiceHandler';  // Assuming you have this interface
import { nwc } from "@getalby/sdk";
import * as dotenv from 'dotenv';

// Load environment variables from the .env file
dotenv.config();

// Payment handling class
export class ConsoleInvoiceHandler implements IInvoiceHandler {

  private nwcClient: nwc.NWCClient;

  constructor() {
    // Initialize NWCClient with the NWC URL
    this.nwcClient = new nwc.NWCClient({
      nostrWalletConnectUrl: loadNWCUrl(),
    });
  }

  // Function to handle the invoice payment
  public async handleInvoice(invoice: string): Promise<boolean> {
    try {
      const response = await this.nwcClient.payInvoice({ invoice });

      // Check the response for success criteria (you might need to check for a specific field)
      if (response) {
        console.log("Payment successful, response:", response);
        return true;
      } else {
        console.error("Payment failed.", response);
        return false;
      }
    } catch (error) {
      console.error("Error paying invoice:", error);
      return false;
    }
}

  // Function to pay the invoice using NWCClient
  private async payInvoice(invoice: string): Promise<boolean> {
    try {
      const response = await this.nwcClient.payInvoice({ invoice });

      // Check the response for a successful payment
      if (response) {
        console.log("Payment successful!");
        return true;
      } else {
        console.error("Payment failed.", response);
        return false;
      }
    } catch (error) {
      console.error("Error paying invoice:", error);
      return false;
    }
  }

  // Optional: A function to check payment success (you can customize this as per your needs)
  private async paymentCheckSuccess(): Promise<boolean> {
    // Placeholder function for additional checks
    return true; // Here, just return true to indicate success
  }
}

// Utility function to load NWC URL from environment variables
function loadNWCUrl(): string {
  // Return NWC_URL from process.env
  const url = process.env.NWC_URL;

  if (!url) {
    throw new Error('NWC_URL is not set in the environment');
  }

  return url;
}