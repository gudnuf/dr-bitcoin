import readline from "readline";
import chalk from "chalk";
import { SparkWallet } from "@buildonspark/spark-sdk";
import bip39 from "bip39"
import "dotenv/config";

export interface IInvoiceHandler {
  handleInvoice(invoice: string): Promise<boolean>;
}

type WalletType = Awaited<ReturnType<typeof SparkWallet.initialize>>["wallet"];

export class ConsoleInvoiceHandler implements IInvoiceHandler {
  private rl: readline.Interface;
  private mnemonic: string;

  constructor(rl: readline.Interface) {
    this.rl = rl;

    const envMnemonic = process.env.MNEMONIC;
    if (!envMnemonic) {
      throw new Error("MNEMONIC is not set in the environment");
    }
  
    this.mnemonic = envMnemonic;
  }

  public async handleInvoice(invoice: string): Promise<boolean> {

    console.log(chalk.yellow("Payment required:"));
    console.log(chalk.blue("Invoice:"), invoice);
    
    console.log("Invoice:", invoice);

   // Get the result from initializeWallet
    const result = await initializeWallet(this.mnemonic, "MAINNET");

    // Check if the result is undefined
    if (!result) {
      console.error("Wallet initialization failed.");
      return false;
    }

    // Now that we've ensured result isn't undefined, destructure safely
    const { wallet: activeWallet, balance } = result;

    console.log("Wallet initialized successfully with balance:", balance);

    // Ensuring the activeWallet exists before using it
    if (!activeWallet) {
      console.error("Wallet initialization failed.");
      return false;
    } else {
      // Now, proceed to pay invoice (if necessary)
       payInvoice(activeWallet, invoice);

      // Confirm payment
      return await this.confirmPayment();
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

export async function initializeWallet(
  mnemonic: string,
  network: "MAINNET" | "TESTNET" | "REGTEST" = "MAINNET"
): Promise<{ wallet: WalletType; balance: string } | undefined> {
  console.log("Wallet initializing...");
  if (!bip39.validateMnemonic(mnemonic)) {
    console.log("Invalid mnemonic");
    return;
  }
  console.log("Wallet Mnemomic assigned...");
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const hexString = seed.toString("hex");

  try {
    const { wallet } = await SparkWallet.initialize({
      mnemonicOrSeed: hexString,
      options: { network },
    });
    console.log("Wallet Mnemomic initialized...");
    const balance = await wallet.getBalance();
    console.log("Wallet initialized successfully:", mnemonic.split(" ")[0]);
    console.log("Balance:", balance);

    return {
      wallet,
      balance: balance.balance.toString(),
    };
  } catch (error) {
    console.error("Error initializing wallet:", error);
  }
}

// ⚡ Pay Lightning Invoice Function
export async function payInvoice(wallet: WalletType, lightningInvoice: string): Promise<void> {
  try {
    await wallet.payLightningInvoice({
      invoice: lightningInvoice,
      maxFeeSats: 1,
    });
  } catch (error) {
    console.log("paymentFailed");
    console.error(error);
  }
}

