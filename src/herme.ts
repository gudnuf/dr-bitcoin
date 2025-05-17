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
import { browseFeed, getProfile } from "./tools/nostr/handlers";
import {
	type Event,
	finalizeEvent,
	nip19,
	generateSecretKey,
	getPublicKey,
} from "nostr-tools";
import chalk from 'chalk';
import boxen from 'boxen';
import { NOSTR_BROWSE_FEED } from "./tools/nostr";

// Define a type for post data with metadata
type PostWithMetadata = {
	id: string;
	content: string;
	pubkey: string;
	created_at: number;
	hashtag: string;
};

// Define type for browseFeed response
type BrowseFeedResponse = {
	success: boolean;
	hashtag: string;
	events: Event[];
	event_count: number;
	message?: string;
};

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

	// List of relevant hashtags for posts
	private readonly HASHTAGS = [
		"bitcoin",
		"nostr",
		"lightning",
		"ai",
		"privacy",
		"btc",
		"sats",
		"zap",
		"p2p",
		"decentralized",
		"cryptography",
		"opensource",
		"freedom",
		"education",
		"tech"
	];

	// Helper function to get random hashtags
	private getRandomHashtags(count: number = 2): string[] {
		const shuffled = [...this.HASHTAGS].sort(() => 0.5 - Math.random());
		return shuffled.slice(0, Math.min(count, this.HASHTAGS.length));
	}

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

	// List of relevant hashtags for posts
	private readonly HASHTAGS = [
		"bitcoin",
		"nostr",
		"lightning",
		"ai",
		"privacy",
		"btc",
		"sats",
		"zap",
		"p2p",
		"decentralized",
		"cryptography",
		"opensource",
		"freedom",
		"education",
		"tech"
	];

	// Helper function to get random hashtags
	private getRandomHashtags(count: number = 2): string[] {
		const shuffled = [...this.HASHTAGS].sort(() => 0.5 - Math.random());
		return shuffled.slice(0, Math.min(count, this.HASHTAGS.length));
	}

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
				"Generate a tweet-length (max 280 chars) profile description. You are a community helper providing nostr value for zaps. Give it personality to make doctor bitcoin unique. Only return the description. Don't mention crypto. You are a hardcore bitcoin maximalist.";

			Logger.info("Generating profile description...");
			const { message } = await this.chat({
				messages: [{ role: Role.USER, content: prompt }],
			});

			const profileData = {
				name: "Herme PhD",
				about: message,
				picture:
					"https://blossom.primal.net/b1e0308bf7f5cc44ee7ce6c65a34712813c39dfd46bc004d7039a71185039d30.png",
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
				"You are Herme, a bitcoin professor. Write a tweet-length (max 280 chars) philosophical insight about bitcoin that would resonate with the nostr community. Make it thought-provoking yet concise. Only return the reflection.";

			Logger.info("Generating deep thoughts...");
			const { message } = await this.chat({
				messages: [{ role: Role.USER, content: prompt }],
			});

			// Get random hashtags and format them
			const selectedHashtags = this.getRandomHashtags(2);
			const hashtagString = selectedHashtags.map(tag => `#${tag}`).join(' ');
			const contentWithHashtags = `${message}\n\n${hashtagString}`;

			const eventTemplate = {
				kind: 1, // Text note
				created_at: Math.floor(Date.now() / 1000),
				tags: [
					...selectedHashtags.map(tag => ["t", tag])
				],
				content: contentWithHashtags,
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
						const prompt = `You are Herme, a bitcoin professor responding to: "${replyContent}"
                            
                            Write a tweet-length (max 280 chars) response that's helpful and knowledgeable.
                            Be passionate about bitcoin and education. Use plain text only, no formatting.`;

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

						// Get random hashtags and format them
						const selectedHashtags = this.getRandomHashtags(2);
						const hashtagString = selectedHashtags.map(tag => `#${tag}`).join(' ');
						const contentWithHashtags = `${message}\n\n${hashtagString}`;

						// Add hashtag tags
						selectedHashtags.forEach(tag => {
							tags.push(["t", tag]);
						});

						try {
							// Create and publish the response event
							const responseEvent = {
								kind: event.kind, // Match the kind of the event we're replying to
								created_at: Math.floor(Date.now() / 1000),
								tags,
								content: contentWithHashtags,
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
						const prompt = `You are Herme, a bitcoin professor. Someone just sent you a ${amountSats} zap.
                            Write a tweet-length (max 280 chars) response that:
                            1. Starts with "@user" (I'll replace this)
                            2. Briefly thanks them for the zap
                            3. Teaches one interesting fact about Bitcoin/Nostr
                            Use plain text only.`;

						Logger.info("Generating zap acknowledgment...");
						const { message } = await this.chat({
							messages: [{ role: Role.USER, content: prompt }],
						});

						// Replace @user with the proper nostr: mention format
						const contentWithMention = message.replace("@user", mentionUrl);

						// Get random hashtags and format them
						const selectedHashtags = this.getRandomHashtags(2);
						const hashtagString = selectedHashtags.map(tag => `#${tag}`).join(' ');
						const contentWithHashtags = `${contentWithMention}\n\n${hashtagString}`;

						// Create a new post tagging the sender
						const tags: string[][] = [
							// Tag the person who zapped us
							["p", senderPubkey],
							// Add hashtag tags
							...selectedHashtags.map(tag => ["t", tag])
						];

						// Create and publish the response event
						const responseEvent = {
							kind: 1, // Text note
							created_at: Math.floor(Date.now() / 1000),
							tags,
							content: contentWithHashtags,
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

	private async monitorHashtags(): Promise<() => void> {
		const nostrKeys = this.keyManager.getNostrKeys();
		Logger.box("HASHTAG MONITOR", "Activating hashtag surveillance system", 'info');

		// Track event IDs that we've already responded to
		const RESPONDED_HASHTAGS_FILE = path.join(
			process.cwd(),
			".herme-responded-hashtags.json",
		);
		let respondedEvents = new Set<string>();

		// Load previously responded events
		try {
			if (fs.existsSync(RESPONDED_HASHTAGS_FILE)) {
				const savedEvents = JSON.parse(
					fs.readFileSync(RESPONDED_HASHTAGS_FILE, "utf-8"),
				) as string[];
				respondedEvents = new Set(savedEvents);
				Logger.info(`Loaded ${chalk.bold(respondedEvents.size)} previously responded hashtag events`);
			}
		} catch (error) {
			Logger.error("Error loading responded hashtag events:", error);
		}

		// Function to persist responded events
		const saveRespondedEvents = () => {
			try {
				fs.writeFileSync(
					RESPONDED_HASHTAGS_FILE,
					JSON.stringify(Array.from(respondedEvents), null, 2),
				);
			} catch (error) {
				Logger.error("Error saving responded hashtag events:", error);
			}
		};

		// Extract JSON from LLM response, handling various formats
		const extractJsonFromResponse = (text: string): any => {
			// First try direct JSON parsing
			try {
				return JSON.parse(text);
			} catch (e) {
				// Not valid JSON, continue to extraction methods
			}
			
			// Try to extract JSON from markdown code blocks
			const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
			if (codeBlockMatch && codeBlockMatch[1]) {
				try {
					return JSON.parse(codeBlockMatch[1].trim());
				} catch (e) {
					// Not valid JSON, continue
				}
			}
			
			// Try to find anything that looks like JSON objects
			const jsonObjectMatch = text.match(/\{[\s\S]*\}/);
			if (jsonObjectMatch) {
				try {
					return JSON.parse(jsonObjectMatch[0]);
				} catch (e) {
					// Not valid JSON, continue
				}
			}
			
			// If all parsing attempts fail, return null
			return null;
		};

		// Function to find and respond to hashtag posts
		const findAndRespondToHashtagPosts = async () => {
			const currentTime = Math.floor(Date.now() / 1000);
			const lookbackPeriod = 3600; // Look back 1 hour
			const since = currentTime - lookbackPeriod;
			
			// Randomly select three hashtags to check this cycle
			const selectedHashtags = this.getRandomHashtags(3);
				
			Logger.info(`Scanning for hashtags: ${chalk.bold(selectedHashtags.join(', '))}`);
			
			// Collect events for all selected hashtags
			const allEvents: PostWithMetadata[] = [];
			
			// Get posts for each hashtag
			for (const hashtag of selectedHashtags) {
				try {
					// Use browseFeed directly with simplified API
					const result = await browseFeed({
						hashtag: hashtag,
						limit: 3,
						since: since
					}) as BrowseFeedResponse;
					
					if (result && result.success && result.events && result.events.length > 0) {
						// Process the events directly
						for (const event of result.events) {
							// Skip posts we've already responded to
							if (respondedEvents.has(event.id)) {
								continue;
							}
							
							// Add to our collection
							allEvents.push({
								id: event.id,
								content: event.content,
								pubkey: event.pubkey,
								created_at: event.created_at,
								hashtag
							});
						}
					}
				} catch (error) {
					Logger.error(`Error fetching ${hashtag} posts:`, error);
				}
			}
			
			// If we found any new events, evaluate them
			if (allEvents.length > 0) {
				// Only take first 3 events if we have more
				const eventsToEvaluate = allEvents.slice(0, 3);
				
				try {
					// Prepare the events for evaluation by the LLM
					const eventsForEvaluation = eventsToEvaluate.map(event => {
						return {
							id: event.id,
							content: event.content,
							hashtag: event.hashtag
						};
					});
					
					// Create a prompt for the LLM to select the most interesting post
					const selectionPrompt = `
						You are Herme, a professor of bitcoin monitoring the Nostr network.
						Below is a list of recent posts with hashtags I'm monitoring.
						Please analyze these posts and identify the SINGLE most interesting one to respond to.
						Focus on posts that:
						1. Ask thoughtful questions
						2. Present interesting ideas about bitcoin, nostr, or related technologies
						3. Could benefit from your expertise and knowledge
						
						Here are the recent posts:
						${JSON.stringify(eventsForEvaluation, null, 2)}
						
						Select the most interesting post and provide:
						1. The post ID
						2. A brief explanation why this post is interesting
						3. A suggested approach for your response
						
						IMPORTANT: You must respond with ONLY a JSON object in the following format:
						{
							"selectedPostId": "the-id-of-selected-post",
							"interestReason": "brief explanation why this is interesting",
							"responseApproach": "suggested approach for response"
						}
						
						Do not include any other text, markdown formatting, or explanations outside the JSON object.
					`;
					
					Logger.info("Evaluating posts for interestingness...");
					
					// Send to chat for evaluation
					const { message } = await this.chat({
						messages: [{ role: Role.USER, content: selectionPrompt }],
						temperature: 0.7
					});
					
					// Use our improved JSON extraction function
					const jsonResponse = extractJsonFromResponse(message);
					
					if (!jsonResponse) {
						Logger.error("Could not parse any valid JSON from response");
						Logger.debug(message, "Raw response");
						return;
					}
					
					if (!jsonResponse.selectedPostId) {
						Logger.error("JSON response missing required 'selectedPostId' field");
						Logger.debug(jsonResponse, "Parsed JSON");
						return;
					}
					
					// Find the selected post
					const selectedPost = allEvents.find(event => event.id === jsonResponse.selectedPostId);
					
					if (!selectedPost) {
						Logger.warn("Selected post ID not found in results");
						Logger.debug(jsonResponse, "Selection data");
						return;
					}
					
					Logger.box("INTERESTING POST", `Selected post with hashtag #${selectedPost.hashtag}:\n${chalk.italic(selectedPost.content.substring(0, 120))}${selectedPost.content.length > 120 ? '...' : ''}`, 'info');
					
					// Generate a response
					const responsePrompt = `
						You are Herme, a bitcoin professor responding to this post:
						"${selectedPost.content}"
						Tagged with: #${selectedPost.hashtag}
						
						Write a tweet-length (max 280 chars) response that:
						1. Shows understanding of their point
						2. Provides one valuable insight
						3. Maintains a professional but friendly tone
						
						Use plain text only, no formatting.
					`;
					
					Logger.info("Generating thoughtful response...");
					const { message: responseContent } = await this.chat({
						messages: [{ role: Role.USER, content: responsePrompt }],
						temperature: 0.7
					});
					
					// Create a reply
					const tags: string[][] = [
						// Reference the original post
						["e", selectedPost.id, "", "reply"],
						// Tag the author
						["p", selectedPost.pubkey],
						// Include the original hashtag
						["t", selectedPost.hashtag]
					];

					// Get additional random hashtags (excluding the original hashtag)
					const additionalHashtags = this.getRandomHashtags(2)
						.filter(tag => tag !== selectedPost.hashtag);
					
					// Add additional hashtag tags
					additionalHashtags.forEach(tag => {
						tags.push(["t", tag]);
					});

					// Format hashtags for content
					const hashtagString = [...additionalHashtags, selectedPost.hashtag]
						.map(tag => `#${tag}`)
						.join(' ');
					const contentWithHashtags = `${responseContent}\n\n${hashtagString}`;
					
					// Create and publish the response event
					const responseEvent = {
						kind: 1, // Text note
						created_at: Math.floor(Date.now() / 1000),
						tags,
						content: contentWithHashtags,
						pubkey: nostrKeys.publicKey,
					};
					
					const signedResponseEvent = finalizeEvent(
						responseEvent,
						nostrKeys.privateKey,
					);
					const res = await this.nostrService.publishEvent(signedResponseEvent);
					Logger.success("Response published successfully");
					
					// Mark this event as responded to
					respondedEvents.add(selectedPost.id);
					saveRespondedEvents();
					
				} catch (evalError) {
					Logger.error("Error evaluating posts:", evalError);
				}
			} else {
				Logger.info("No new relevant posts found in this scan");
			}
		};
		
		// Run immediately on startup
		await findAndRespondToHashtagPosts();
		
		// Then set up interval (20 seconds)
		const intervalId = setInterval(findAndRespondToHashtagPosts, 45000);
		
		// Return a cleanup function (for future use)
		return () => {
			clearInterval(intervalId);
			Logger.info("Hashtag monitoring stopped");
		};
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
			await this.monitorHashtags();

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

const registry = new ToolRegistry();
registry.registerTool(NOSTR_BROWSE_FEED, browseFeed)

const herme = new Herme({
	wallet: new HermeWallet(
		"nostr+walletconnect://dbdd231946ccea3f004766afc2ed8ce5950f3d69e9742caba2d1a5b20fb515d3?relay=wss://relay.getalby.com/v1&secret=7daff52358c7d9ad9aa449966d3bd9018d1915bd89fb98a64e5e843613023cff",
	),
	toolRegistry: registry,
});

Logger.box("HERME SYSTEM", "Initializing quantum AI assistant...", 'info');
const cleanup = await herme.start();

process.on("SIGINT", async () => {
	Logger.box("SHUTDOWN SIGNAL", "Termination sequence initiated", 'warn');
	await cleanup();
	process.exit(0);
});
