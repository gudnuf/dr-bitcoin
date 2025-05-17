import fs from 'fs';
import path from 'path';
import os from 'os';
import { InferenceGrid, Role } from 'inference-grid-sdk';

type RegistrationCredentials = {
  publicKey: string;
  privateKey: string;
};

type RegistrationStatus = {
  isRegistered: boolean;
  invoice?: string;
  needsPayment: boolean;
  client?: InferenceGrid;
};

export class RegistrationHandler {
  private credentialsPath: string;
  private client: InferenceGrid | null = null;
  private credentials: RegistrationCredentials | null = null;

  constructor() {
    // Store credentials in user's home directory
    const configDir = path.join(os.homedir(), '.dr-bitcoin');
    this.credentialsPath = path.join(configDir, 'credentials.json');
    
    // Ensure config directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Load credentials on init
    this.credentials = this.loadCredentials();
    
    // Initialize client if credentials exist
    if (this.credentials) {
      this.client = new InferenceGrid({
        privateKey: this.credentials.privateKey
      });
      console.log('client', this.client);
    }
  }

  public async ensureRegistered(): Promise<RegistrationStatus> {
    // Check if already registered
    if (this.credentials && this.client) {
      return { isRegistered: true, needsPayment: false };
    }

    // Start registration process
    try {
      console.log("Starting registration process...");
      const { invoice, publicKey, privateKey } = await InferenceGrid.registerClient();
      
      // Store the registration information temporarily
      this.credentials = { publicKey, privateKey };
      
      return {
        isRegistered: false,
        invoice,
        needsPayment: true
      };
    } catch (error) {
      console.error('Registration process failed:', error);
      return { isRegistered: false, needsPayment: false };
    }
  }

  public async confirmRegistration(): Promise<boolean> {
    if (!this.credentials) {
      console.error('No pending registration to confirm');
      return false;
    }
    
    try {
      // Save the credentials
      this.saveCredentials(this.credentials);
      


      // Initialize the client with the credentials
      this.client = new InferenceGrid({
        privateKey: this.credentials.privateKey
      });
      
      // Test the client to confirm it works
      await this.client.chat({
        messages: [{ role: Role.SYSTEM, content: 'Confirm registration' }],
        model: { modelIds: ['basic'], flags: [] }
      });
      
      return true;
    } catch (error) {
      console.error('Failed to confirm registration:', error);
      // Clear stored credentials if confirmation fails
      this.credentials = null;
      this.client = null;
      return false;
    }
  }

  /**
   * Gets an instance of InferenceGrid that is guaranteed to be registered.
   * This method checks if we're already registered, and if not, throws an error.
   * Use getOrRegisterClient() if you want to handle the registration process.
   */
  public getClient(): InferenceGrid {
    if (!this.client) {
      throw new Error('Client not registered. Call ensureRegistered() first.');
    }
    console.log('client', this.client);
    return this.client;
  }

  /**
   * Gets a registered InferenceGrid client, registering if necessary.
   * This method handles the entire registration flow - if registration is needed,
   * it will return the invoice that needs to be paid, and you should call
   * confirmRegistration() after payment is complete.
   * 
   * @returns An object containing the registered client (if already registered),
   * or registration information if registration is needed
   */
  public async getOrRegisterClient(): Promise<RegistrationStatus> {
    const registrationStatus = await this.ensureRegistered();
    
    if (registrationStatus.isRegistered && this.client) {
      return {
        client: this.client,
        ...registrationStatus
      };
    }
    
    return registrationStatus;
  }

  /**
   * Complete registration workflow - registers the client if needed, 
   * and provides a callback for handling payment.
   * 
   * @param paymentHandler A function that will be called with the invoice
   * if payment is needed. The function should handle showing the invoice 
   * to the user and waiting for payment confirmation.
   * @returns The registered InferenceGrid client if registration succeeds
   * @throws Error if registration fails
   */
  public async registerAndGetClient(
    paymentHandler: (invoice: string) => Promise<void>
  ): Promise<InferenceGrid> {
    const status = await this.getOrRegisterClient();
    
    if (status.isRegistered && status.client) {
      return status.client;
    }
    
    if (status.needsPayment && status.invoice) {
      // Wait for payment to be handled
      await paymentHandler(status.invoice);
      
      // Confirm registration after payment
      const confirmed = await this.confirmRegistration();
      if (!confirmed) {
        throw new Error('Registration confirmation failed');
      }
      
      // Now we should have a client
      return this.getClient();
    }
    
    throw new Error('Unable to register client');
  }

  public isRegistered(): boolean {
    return this.credentials !== null && this.client !== null;
  }

  private loadCredentials(): RegistrationCredentials | null {
    try {
      if (fs.existsSync(this.credentialsPath)) {
        const data = fs.readFileSync(this.credentialsPath, 'utf8');
        return JSON.parse(data) as RegistrationCredentials;
      }
    } catch (error) {
      console.error('Failed to load credentials:', error);
    }
    return null;
  }

  private saveCredentials(credentials: RegistrationCredentials): void {
    try {
      fs.writeFileSync(
        this.credentialsPath,
        JSON.stringify(credentials, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('Failed to save credentials:', error);
    }
  }
} 