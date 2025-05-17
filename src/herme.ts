import {
	InferenceGrid,
	Role,
	type ChatOptions,
	type Message,
	type Tool,
} from "inference-grid-sdk";
import { ToolRegistry } from "./agent";
import { nwc } from "@getalby/sdk";
import * as fs from "fs";
import * as path from "path";
import { NostrService } from "./tools/nostr/service";
import { getProfile } from "./tools/nostr/handlers";
import {
	type Event,
	finalizeEvent,
	nip19,
	generateSecretKey,
	getPublicKey,
} from "nostr-tools";
import chalk from 'chalk';
import boxen from 'boxen';

// Sci-fi themed logger
class Logger {
	static info(message: string) {
		console.log(chalk.cyan(`[⚡] ${message}`));
	}

	static success(message: string) {
		console.log(chalk.green(`[✓] ${message}`));
	}

	static warn(message: string) {
		console.log(chalk.yellow(`[⚠] ${message}`));
	}

	static error(message: string, error?: any) {
		console.error(chalk.red(`[✗] ${message}`));
		if (error) console.error(chalk.dim(error));
	}

	static box(title: string, message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') {
		const colors = {
			info: chalk.cyan,
			success: chalk.green,
			warn: chalk.yellow,
			error: chalk.red
		};
		
		console.log(boxen(colors[type](message), {
			title: colors[type](title),
			titleAlignment: 'center',
			padding: 1,
			margin: 1,
			borderStyle: 'round',
			borderColor: type === 'info' ? 'cyan' : 
			             type === 'success' ? 'green' : 
			             type === 'warn' ? 'yellow' : 'red'
		}));
	}

	static debug(obj: any, title?: string) {
		if (title) {
			console.log(chalk.magenta(`[🔍] ${title}:`));
		}
		console.log(chalk.dim(JSON.stringify(obj, null, 2)));
	}
}

type InferenceGridKeys = {
	privateKey: string;
	publicKey: string;
};

type NostrKeys = {
	privateKey: Uint8Array;
	publicKey: string;
};

type Keys = {
	inferenceGrid: InferenceGridKeys;
	nostr: NostrKeys;
};

type SerializedKeys = {
	inferenceGrid: InferenceGridKeys;
	nostr: {
		privateKey: string; // Hex encoded for storage
		publicKey: string;
	};
};

class KeyManager {
	private keys: Keys;
	private readonly KEYS_FILE_PATH: string;

	constructor(keysFilePath: string) {
		this.KEYS_FILE_PATH = keysFilePath;
		// Initialize with empty values
		this.keys = {
			inferenceGrid: {
				privateKey: "",
				publicKey: "",
			},
			nostr: {
				privateKey: new Uint8Array(),
				publicKey: "",
			},
		};
	}

	public async loadPersistedKeys(): Promise<boolean> {
		try {
			if (fs.existsSync(this.KEYS_FILE_PATH)) {
				const serializedKeys = JSON.parse(
					fs.readFileSync(this.KEYS_FILE_PATH, "utf-8"),
				) as Partial<SerializedKeys>;

				// Handle case where inferenceGrid keys exist
				if (serializedKeys.inferenceGrid) {
					this.keys.inferenceGrid = serializedKeys.inferenceGrid;
				}

				// Handle case where nostr keys exist
				if (serializedKeys.nostr) {
					this.keys.nostr = {
						privateKey: serializedKeys.nostr.privateKey
							? new Uint8Array(
									Buffer.from(serializedKeys.nostr.privateKey, "hex"),
								)
							: new Uint8Array(),
						publicKey: serializedKeys.nostr.publicKey || "",
					};
				}
				return true;
			}
			return false;
		} catch (error) {
			Logger.error("Error loading persisted keys:", error);
			return false;
		}
	}

	public async persistKeys(keys: Partial<Keys>): Promise<void> {
		try {
			// Update only the provided keys
			if (keys.inferenceGrid) {
				this.keys.inferenceGrid = keys.inferenceGrid;
			}
			if (keys.nostr) {
				this.keys.nostr = keys.nostr;
			}

			// Serialize for storage
			const serializedKeys: SerializedKeys = {
				inferenceGrid: this.keys.inferenceGrid,
				nostr: {
					privateKey: Buffer.from(this.keys.nostr.privateKey).toString("hex"),
					publicKey: this.keys.nostr.publicKey,
				},
			};

			fs.writeFileSync(
				this.KEYS_FILE_PATH,
				JSON.stringify(serializedKeys, null, 2),
			);
		} catch (error) {
			Logger.error("Error persisting keys:", error);
			throw error;
		}
	}

	public getKeys(): Keys {
		return this.keys;
	}

	public getInferenceGridKeys(): InferenceGridKeys {
		return this.keys.inferenceGrid;
	}

	public getNostrKeys(): NostrKeys {
		return this.keys.nostr;
	}

	public async generateNostrKeys(): Promise<NostrKeys> {
		const privateKey = generateSecretKey();
		const publicKey = getPublicKey(privateKey);
		return {
			privateKey,
			publicKey,
		};
	}
}

class Herme {
	private wallet: HermeWallet;
	private llm: InferenceGrid = new InferenceGrid();
	private toolRegistry: ToolRegistry;
	private keyManager: KeyManager;
	private nostrService: NostrService;
	private model: ChatOptions["model"] = {
		modelIds: ["openai/gpt-4o"],
		flags: [],
	};
	private paymentQueue: Array<string> = [];
	private isProcessingPayments: boolean = false;

	constructor({
		wallet,
		toolRegistry,
	}: {
		wallet: HermeWallet;
		toolRegistry: ToolRegistry;
	}) {
		this.wallet = wallet;
		this.toolRegistry = toolRegistry;
		this.keyManager = new KeyManager(
			path.join(process.cwd(), ".herme-keys.json"),
		);
		this.nostrService = NostrService.getInstance();
	}

	private async registerAndPay(): Promise<void> {
		const { invoice, publicKey, privateKey } =
			await InferenceGrid.registerClient();
		
		Logger.box("REGISTRATION REQUIRED", `Please pay this invoice to register:\n${invoice}`, 'info');

		if (invoice) {
			// Registration is critical, so we don't queue this payment
			await this.wallet.payInvoice(invoice);
			Logger.info("Payment initiated. Waiting 45 seconds to confirm payment...");
			await new Promise((resolve) => setTimeout(resolve, 45000));
		}

		await this.keyManager.persistKeys({
			inferenceGrid: { publicKey, privateKey },
		});
		Logger.success("Registration complete! Keys successfully stored.");
	}

	private enqueuePayment(invoice: string): void {
		Logger.info(`Payment queued: ${invoice.substring(0, 20)}...`);
		this.paymentQueue.push(invoice);
		
		// Start processing the queue if it's not already running
		if (!this.isProcessingPayments) {
			this.processPaymentQueue();
		}
	}

	private async processPaymentQueue(): Promise<void> {
		if (this.isProcessingPayments) return;
		
		this.isProcessingPayments = true;
		
		try {
			while (this.paymentQueue.length > 0) {
				const invoice = this.paymentQueue.shift();
				if (invoice) {
					Logger.info(`Processing queued payment: ${invoice.substring(0, 20)}...`);
					try {
						await this.wallet.payInvoice(invoice);
						Logger.success("Queued payment completed successfully");
					} catch (error) {
						Logger.error("Failed to process queued payment:", error);
					}
				}
			}
		} finally {
			this.isProcessingPayments = false;
		}
	}

	private async fetchProfile(): Promise<any> {
		const nostrKeys = this.keyManager.getNostrKeys();
		const npub = nip19.npubEncode(nostrKeys.publicKey);
		Logger.info(`Fetching profile for ${chalk.bold(npub)}`);
		
		return new Promise<any>((resolve) => {
			let profileData:
				| {
						name?: string;
						about?: string;
						picture?: string;
						nip05?: string;
						website?: string;
						lud16?: string;
				  }
				| undefined;

			const sub = this.nostrService.subscribe(
				{
					kinds: [0],
					authors: [nostrKeys.publicKey],
				},
				{
					onevent: (event: Event) => {
						try {
							const content = event.content || "{}";
							profileData = JSON.parse(content);
						} catch (e) {
							Logger.warn("Could not parse profile content");
							profileData = {};
						}
					},
					eose: () => {
						sub.close();
						resolve(profileData);
					},
				},
			);

			// Timeout in case EOSE never arrives
			setTimeout(() => {
				sub.close();
				resolve(profileData);
			}, 5000);
		});
	}

	private async chat({
		messages,
		model = this.model,
		maxTokens = 1000,
		temperature = 0.5,
	}: {
		messages: Message[];
		model?: ChatOptions["model"];
		maxTokens?: number;
		temperature?: number;
	}): Promise<{ message: string }> {
		const { invoice, message } = await this.llm.chat({
			messages,
			model,
			maxTokens,
			temperature,
		});

		if (invoice) {
			Logger.info(`Payment required for inference. Queueing payment...`);
			// Instead of waiting for payment, just enqueue it
			this.enqueuePayment(invoice);
		}

		// Return message immediately without waiting for payment
		return { message };
	}

	private async publishProfile(): Promise<void> {
		const nostrKeys = this.keyManager.getNostrKeys();

		try {
			const prompt =
				"Generate a short profile description that can go in a social media profile. You are a community helper and motivated to provide nostr related value for a small zap. Make it short and concise, but also give it some personality to make doctor bitcoin unique. Only return the description, no other text. Don't mention crypto that will make you lose buisness. You are a hardcore bitcoin maximalist.";

			Logger.info("Generating profile description...");
			const { message } = await this.chat({
				messages: [{ role: Role.USER, content: prompt }],
			});

			const profileData = {
				name: "Herme PhD",
				about: message,
				picture:
					"https://www.pinterest.com/ideas/satoshi-nakamoto/920314160439/",
				lud16: "daim@getalby.com",
			};

			const eventTemplate = {
				kind: 0, // Metadata/profile
				created_at: Math.floor(Date.now() / 1000),
				tags: [] as string[][],
				content: JSON.stringify(profileData),
				pubkey: nostrKeys.publicKey,
			};

			const signedEvent = finalizeEvent(eventTemplate, nostrKeys.privateKey);
			
			const res = await this.nostrService.publishEvent(signedEvent);
			Logger.success("Profile published successfully!");
		} catch (error) {
			Logger.error("Error publishing profile:", error);
			throw error; // Re-throw to allow higher-level error handling
		}
	}
    
	private async publishDeepThoughts(): Promise<void> {
		const nostrKeys = this.keyManager.getNostrKeys();

		try {
			const prompt =
				"You are Herme, a professor of bitcoin with deep insights into the technology and its implications. Write a thoughtful, philosophical reflection about bitcoin that would resonate with the nostr community. Focus on one key insight or perspective that challenges conventional thinking. Keep it concise but profound. Only return the reflection, no other text.";

			Logger.info("Generating deep thoughts...");
			const { message } = await this.chat({
				messages: [{ role: Role.USER, content: prompt }],
			});

			const eventTemplate = {
				kind: 1, // Text note
				created_at: Math.floor(Date.now() / 1000),
				tags: [] as string[][],
				content: message,
				pubkey: nostrKeys.publicKey,
			};

			const signedEvent = finalizeEvent(eventTemplate, nostrKeys.privateKey);
			const res = await this.nostrService.publishEvent(signedEvent);
			Logger.success("Deep thoughts published to the noosphere");
		} catch (error) {
			Logger.error("Error publishing deep thoughts:", error);
			throw error; // Re-throw to allow higher-level error handling
		}
	}

	private async subscribeToReplies(): Promise<void> {
		const nostrKeys = this.keyManager.getNostrKeys();
		const npub = nip19.npubEncode(nostrKeys.publicKey);
		Logger.box("NOSTR REPLY MONITORING", `Activating reply surveillance for:\n${chalk.bold(npub)}`, 'info');

		// Track event IDs that we've already responded to - persist to disk
		const RESPONDED_EVENTS_FILE = path.join(
			process.cwd(),
			".herme-responded-events.json",
		);
		let respondedEvents = new Set<string>();

		// Load previously responded events
		try {
			if (fs.existsSync(RESPONDED_EVENTS_FILE)) {
				const savedEvents = JSON.parse(
					fs.readFileSync(RESPONDED_EVENTS_FILE, "utf-8"),
				) as string[];
				respondedEvents = new Set(savedEvents);
				Logger.info(`Loaded ${chalk.bold(respondedEvents.size)} previously responded events`);
			}
		} catch (error) {
			Logger.error("Error loading responded events:", error);
		}

		// Function to persist responded events
		const saveRespondedEvents = () => {
			try {
				fs.writeFileSync(
					RESPONDED_EVENTS_FILE,
					JSON.stringify(Array.from(respondedEvents), null, 2),
				);
			} catch (error) {
				Logger.error("Error saving responded events:", error);
			}
		};

		// Subscribe to events that have an e-tag referencing our pubkey
		this.nostrService.subscribe(
			{
				kinds: [1, 1111], // Text notes and Comments (NIP-22)
				"#p": [nostrKeys.publicKey],
				// We don't filter by e tag with our pubkey here because we need to check the actual event content
			},
			{
				onevent: async (event: Event) => {
					try {
						// Skip events from ourselves
						if (event.pubkey === nostrKeys.publicKey) {
							return;
						}

						// Skip events we've already responded to
						if (respondedEvents.has(event.id)) {
							return;
						}

						// Check if this event is a reply to one of our events
						const isReplyToUs = event.tags.some((tag) => {
							// Check for e tag with our pubkey as the referenced author
							return (
								(tag[0] === "e" &&
									tag.length >= 4 &&
									tag[3] === nostrKeys.publicKey) ||
								// Or check for p tag referencing our pubkey
								(tag[0] === "p" && tag[1] === nostrKeys.publicKey)
							);
						});

						if (!isReplyToUs) {
							return;
						}
						
						Logger.box("NEW REPLY", `Received incoming message:\n${chalk.italic(event.content.substring(0, 120))}${event.content.length > 120 ? '...' : ''}`, 'info');
						
						// Generate a response using the chat function
						const replyContent = event.content;
						const prompt = `You are Herme, a professor of bitcoin responding to someone on Nostr. 
                            The person said: "${replyContent}"
                            
                            Respond in a helpful, knowledgeable way. Keep your response concise but thoughtful. 
                            You are passionate about bitcoin and education. Format your response appropriately for 
                            the Nostr platform (plain text). Don't use any formatting or markdown. Do short tweet style responses.`;

						Logger.info("Generating thoughtful response...");
						const { message } = await this.chat({
							messages: [{ role: Role.USER, content: prompt }],
						});

						// Create event tags for the reply
						const tags: string[][] = [];

						// Add root event tag if present in the reply
						const rootTag = event.tags.find(
							(tag) => tag[0] === "e" && tag.length >= 4 && tag[3] === "root",
						);
						if (rootTag && rootTag[1]) {
							tags.push(["e", rootTag[1], rootTag[2] || "", "root"]);
						}

						// Add direct reply tag
						tags.push(["e", event.id, "", "reply"]);

						// Add p tag for the person we're replying to
						tags.push(["p", event.pubkey]);

						// Add p tags from the event we're replying to (as per NIP-10)
						event.tags.forEach((tag) => {
							if (
								tag[0] === "p" &&
								tag[1] !== nostrKeys.publicKey &&
								tag[1] !== event.pubkey
							) {
								// Make sure tag[1] is defined
								if (tag[1]) {
									tags.push(["p", tag[1]]);
								}
							}
						});

						try {
							// Create and publish the response event
							const responseEvent = {
								kind: event.kind, // Match the kind of the event we're replying to
								created_at: Math.floor(Date.now() / 1000),
								tags,
								content: message,
								pubkey: nostrKeys.publicKey,
							};

							const signedResponseEvent = finalizeEvent(
								responseEvent,
								nostrKeys.privateKey,
							);
							const res =
								await this.nostrService.publishEvent(signedResponseEvent);
							Logger.success("Response published successfully");

							// Mark this event as responded to
							respondedEvents.add(event.id);
							saveRespondedEvents();
						} catch (publishError) {
							Logger.error("Error publishing response:", publishError);
							// Don't mark as responded if publishing failed
						}
					} catch (error) {
						Logger.error("Error handling reply:", error);
					}
				},
				eose: () => {
					Logger.info("End of stored events, now listening for new replies in real-time");
				},
			},
		);

		Logger.success("Reply monitoring system active and ready");
	}

	private async subscribeToZaps(): Promise<void> {
		const nostrKeys = this.keyManager.getNostrKeys();
		const npub = nip19.npubEncode(nostrKeys.publicKey);
		Logger.box("ZAP MONITORING", `Activating zap detection for:\n${chalk.bold(npub)}`, 'info');

		// Track event IDs that we've already responded to - persist to disk
		const RESPONDED_ZAPS_FILE = path.join(
			process.cwd(),
			".herme-responded-zaps.json",
		);
		let respondedZaps = new Set<string>();

		// Load previously responded zaps
		try {
			if (fs.existsSync(RESPONDED_ZAPS_FILE)) {
				const savedEvents = JSON.parse(
					fs.readFileSync(RESPONDED_ZAPS_FILE, "utf-8"),
				) as string[];
				respondedZaps = new Set(savedEvents);
				Logger.info(`Loaded ${chalk.bold(respondedZaps.size)} previously responded zaps`);
			}
		} catch (error) {
			Logger.error("Error loading responded zaps:", error);
		}

		// Function to persist responded zaps
		const saveRespondedZaps = () => {
			try {
				fs.writeFileSync(
					RESPONDED_ZAPS_FILE,
					JSON.stringify(Array.from(respondedZaps), null, 2),
				);
			} catch (error) {
				Logger.error("Error saving responded zaps:", error);
			}
		};

		// Subscribe to zap receipt events (kind 9735) where we're the recipient
		this.nostrService.subscribe(
			{
				kinds: [9735], // Zap receipts (NIP-57)
				"#p": [nostrKeys.publicKey],
			},
			{
				onevent: async (event: Event) => {
					try {
						// Skip events we've already responded to
						if (respondedZaps.has(event.id)) {
							return;
						}

						// Extract the sender's pubkey from the P tag
						const senderTag = event.tags.find(
							(tag) => tag[0] === "P" && tag.length > 1,
						);
						
						if (!senderTag || !senderTag[1]) {
							Logger.warn("No valid sender pubkey found in zap receipt");
							return;
						}
						
						const senderPubkey = senderTag[1];
						
						// Extract the payment amount from the bolt11 invoice
						const bolt11Tag = event.tags.find(
							(tag) => tag[0] === "bolt11" && tag.length > 1,
						);
						
						let amountSats = "unknown amount";
						if (bolt11Tag && bolt11Tag[1]) {
							// For a real implementation, parse the bolt11 to get the amount
							// This is a simplification
							amountSats = "some sats";
						}

						Logger.box("ZAP RECEIVED", `Lightning zap detected from user:\n${chalk.bold(nip19.npubEncode(senderPubkey))}`, 'success');

						// Convert sender pubkey to npub for content mention
						const senderNpub = nip19.npubEncode(senderPubkey);
						const mentionUrl = `nostr:${senderNpub}`;

						// Generate educational content as a thank you for the zap
						const prompt = `You are Herme, a professor of bitcoin responding to someone who just sent you a tip (zap) of ${amountSats} on Nostr. 
                            Create a short, educational post teaching this person something interesting about Bitcoin or Nostr that they might not know.
                            Start your message with "@user" which I will replace with a proper mention.
                            Be conversational and appreciative of their tip, but focus mainly on delivering one valuable insight.
                            Keep your response concise but thoughtful (under 280 characters if possible).
                            Don't use any formatting or markdown.`;

						Logger.info("Generating zap acknowledgment...");
						const { message } = await this.chat({
							messages: [{ role: Role.USER, content: prompt }],
						});

						// Replace @user with the proper nostr: mention format
						const contentWithMention = message.replace("@user", mentionUrl);

						// Create a new post tagging the sender
						const tags: string[][] = [
							// Tag the person who zapped us
							["p", senderPubkey],
						];

						// Create and publish the response event
						const responseEvent = {
							kind: 1, // Text note
							created_at: Math.floor(Date.now() / 1000),
							tags,
							content: contentWithMention,
							pubkey: nostrKeys.publicKey,
						};

						const signedResponseEvent = finalizeEvent(
							responseEvent,
							nostrKeys.privateKey,
						);
						const res = await this.nostrService.publishEvent(signedResponseEvent);
						Logger.success("Zap acknowledgment published");

						// Mark this zap as responded to
						respondedZaps.add(event.id);
						saveRespondedZaps();
					} catch (error) {
						Logger.error("Error handling zap:", error);
					}
				},
				eose: () => {
					Logger.info("End of stored zap events, now listening for new zaps in real-time");
				},
			},
		);

		Logger.success("Zap monitoring system active and ready");
	}

	public async start() {
		try {
			Logger.box("HERME SYSTEM", "Initializing quantum intelligence matrix...", 'info');
			
			const hasKeys = await this.keyManager.loadPersistedKeys();

			// Initialize nostr keys if they don't exist
			if (!hasKeys || !this.keyManager.getNostrKeys().publicKey) {
				Logger.info("No existing keys detected. Generating new cryptographic identity...");
				const nostrKeys = await this.keyManager.generateNostrKeys();
				await this.keyManager.persistKeys({ nostr: nostrKeys });
				Logger.success("New identity successfully generated");
			}

			const profile = await this.fetchProfile();

			if (!profile) {
				Logger.info("No profile detected. Creating digital persona...");
				await this.publishProfile();
				Logger.success("Digital persona established");

				const updatedProfile = await this.fetchProfile();
				if (updatedProfile) {
					Logger.success("Profile verification complete");
				}
			}

			Logger.box("SYSTEM ONLINE", "All neural networks initialized\nCommencing real-time monitoring protocols", 'success');

			await this.subscribeToReplies();
			await this.subscribeToZaps();

			return async () => {
				// Process any remaining payments before shutdown
				await this.processRemainingPayments();
				
				Logger.box("SYSTEM SHUTDOWN", "Deactivating neural matrices...", 'warn');
				this.nostrService.cleanup();
				Logger.success("Shutdown complete");
			};
		} catch (error) {
			Logger.box("SYSTEM FAILURE", "Critical error detected in primary systems", 'error');
			Logger.error("Error details:", error);
			
			// Still return the cleanup function even if there was an error
			return async () => {
				// Try to process any remaining payments
				await this.processRemainingPayments();
				
				Logger.info("Performing emergency cleanup procedures...");
				this.nostrService.cleanup();
				Logger.success("Emergency shutdown complete");
			};
		}
	}
	
	private async processRemainingPayments(): Promise<void> {
		if (this.paymentQueue.length > 0) {
			Logger.info(`Processing ${this.paymentQueue.length} remaining payments before shutdown...`);
			await this.processPaymentQueue();
		}
	}
}

class HermeWallet {
	private client: nwc.NWCClient;

	constructor(nostrWalletConnectUrl: string) {
		this.client = new nwc.NWCClient({
			nostrWalletConnectUrl,
		});
	}

	async payInvoice(invoice: string): Promise<string> {
		const res = await this.client.payInvoice({
			invoice,
		});
		if (res.preimage) {
			Logger.success("Invoice paid successfully");
			return res.preimage;
		} else {
			Logger.error("Invoice payment failed");
			throw new Error("Invoice payment failed");
		}
	}

	async getBalance(): Promise<number> {
		const res = await this.client.getBalance();
		return res.balance;
	}
}

const herme = new Herme({
	wallet: new HermeWallet(
		"nostr+walletconnect://dbdd231946ccea3f004766afc2ed8ce5950f3d69e9742caba2d1a5b20fb515d3?relay=wss://relay.getalby.com/v1&secret=7daff52358c7d9ad9aa449966d3bd9018d1915bd89fb98a64e5e843613023cff",
	),
	toolRegistry: new ToolRegistry(),
});

Logger.box("HERME SYSTEM", "Initializing quantum AI assistant...", 'info');
const cleanup = await herme.start();

process.on("SIGINT", async () => {
	Logger.box("SHUTDOWN SIGNAL", "Termination sequence initiated", 'warn');
	await cleanup();
	process.exit(0);
});
