import { nip19 } from "nostr-tools";
import type { Event, Filter } from "nostr-tools";
import { NostrService } from "./service";
import { formatPost, normalizeId, normalizePubkey } from "./utils";
import {
	createProfileEvent,
	fetchProfile,
	publishEvent,
	publishNote,
} from "./events";
import { getKeys } from "./key-manager";
import chalk from "chalk";

// Function to browse feed based on hashtag
export async function browseFeed(args: any) {
	console.log(
		chalk.cyan("📡 Fetching hashtag feed:"),
		chalk.gray(JSON.stringify(args, null, 2)),
	);
	const { hashtag, limit = 10, since = 0 } = args;

	if (!hashtag) {
		return {
			success: false,
			error: "hashtag is required for hashtag feed",
		};
	}

	const nostrService = NostrService.getInstance();

	let filter: Filter = {
		kinds: [1], // Text notes
		limit: Number(limit),
		"#t": [hashtag],
	};

	if (since > 0) {
		filter.since = Number(since);
	}

	console.log(`📡 Fetching hashtag #${hashtag} feed...`);

	return new Promise((resolve) => {
		const events: Event[] = [];

		const sub = nostrService.subscribe(filter, {
			onevent: (event: Event) => {
				console.log(
					chalk.cyan("📡 Received event:"),
					chalk.gray(JSON.stringify(event, null, 2)),
				);
				events.push(event);
			},
			eose: () => {
				sub.close();
				resolve({
					success: true,
					hashtag,
					events: events.sort((a, b) => b.created_at - a.created_at),
					event_count: events.length,
				});
			},
		});

		// Timeout in case EOSE never arrives
		setTimeout(() => {
			sub.close();

			if (events.length === 0) {
				resolve({
					success: true,
					hashtag,
					events: [],
					event_count: 0,
					message: "No events found or timeout occurred",
				});
			} else {
				resolve({
					success: true,
					hashtag,
					events: events.sort((a, b) => b.created_at - a.created_at),
					event_count: events.length,
					message: "Partial results due to timeout",
				});
			}
		}, 10000);
	});
}

// Function to view a complete thread
export async function viewThread(args: any) {
	console.log(
		chalk.cyan("📡 Fetching thread:"),
		chalk.gray(JSON.stringify(args, null, 2)),
	);
	const { note_id, limit = 20 } = args;
	const nostrService = NostrService.getInstance();

	if (!note_id) {
		return { success: false, error: "note_id is required" };
	}

	const normalizedId = normalizeId(note_id);

	console.log(`📡 Fetching thread for note: ${normalizedId}...`);

	// First, get the root post
	const rootEvent = await nostrService.getEvent({ ids: [normalizedId] });

	if (!rootEvent) {
		return { success: false, error: "Root post not found" };
	}

	// Then get all replies referencing this post
	return new Promise((resolve) => {
		const events: Event[] = [rootEvent];
		const profiles: Record<string, any> = {};
		const pubkeys = new Set<string>([rootEvent.pubkey]);

		const sub = nostrService.subscribe(
			{
				kinds: [1],
				"#e": [normalizedId],
				limit: limit,
			},
			{
				onevent: (event: Event) => {
					console.log(
						chalk.cyan("📡 Received event:"),
						chalk.gray(JSON.stringify(event, null, 2)),
					);
					events.push(event);
					pubkeys.add(event.pubkey);
				},
				eose: () => {
					// After receiving events, fetch profiles for the authors
					if (pubkeys.size > 0) {
						const profilesSub = nostrService.subscribe(
							{
								kinds: [0],
								authors: Array.from(pubkeys),
							},
							{
								onevent: (event: Event) => {
									try {
										profiles[event.pubkey] = JSON.parse(event.content);
									} catch (e) {
										profiles[event.pubkey] = {};
									}
								},
								eose: () => {
									profilesSub.close();

									// Format the results - root post first, then replies sorted by time
									const rootFormatted = formatPost(
										rootEvent,
										profiles[rootEvent.pubkey],
									);
									const repliesFormatted = events
										.filter((event) => event.id !== rootEvent.id)
										.sort((a, b) => a.created_at - b.created_at)
										.map((event) => formatPost(event, profiles[event.pubkey]));

									resolve({
										success: true,
										root_post: rootFormatted,
										replies: repliesFormatted,
										reply_count: repliesFormatted.length,
									});
								},
							},
						);

						// Timeout for profiles fetch
						setTimeout(() => {
							profilesSub.close();

							// Format the results with whatever profiles we have
							const rootFormatted = formatPost(
								rootEvent,
								profiles[rootEvent.pubkey],
							);
							const repliesFormatted = events
								.filter((event) => event.id !== rootEvent.id)
								.sort((a, b) => a.created_at - b.created_at)
								.map((event) => formatPost(event, profiles[event.pubkey]));

							resolve({
								success: true,
								root_post: rootFormatted,
								replies: repliesFormatted,
								reply_count: repliesFormatted.length,
							});
						}, 5000);
					} else {
						const rootFormatted = formatPost(rootEvent, {});

						resolve({
							success: true,
							root_post: rootFormatted,
							replies: [],
							reply_count: 0,
						});
					}

					sub.close();
				},
			},
		);

		// Timeout in case EOSE never arrives
		setTimeout(() => {
			sub.close();

			const rootFormatted = formatPost(
				rootEvent,
				profiles[rootEvent.pubkey] || {},
			);
			const repliesFormatted = events
				.filter((event) => event.id !== rootEvent.id)
				.sort((a, b) => a.created_at - b.created_at)
				.map((event) => formatPost(event, profiles[event.pubkey] || {}));

			resolve({
				success: true,
				root_post: rootFormatted,
				replies: repliesFormatted,
				reply_count: repliesFormatted.length,
				message: "Partial results due to timeout",
			});
		}, 10000);
	});
}

// Function to post a new note
export async function postNote(args: any) {
	console.log(
		chalk.cyan("📝 Creating new note:"),
		chalk.gray(JSON.stringify(args, null, 2)),
	);
	const { content, mentions = [], hashtags = [], geohash } = args;

	if (!content) {
		return { success: false, error: "content is required" };
	}

	console.log("📝 Creating new note...");

	const tags: string[][] = [];

	// Add mentions as 'p' tags
	if (mentions && mentions.length > 0) {
		for (const mention of mentions) {
			const normalizedPubkey = normalizePubkey(mention);
			tags.push(["p", normalizedPubkey]);
		}
	}

	// Add hashtags as 't' tags
	if (hashtags && hashtags.length > 0) {
		for (const tag of hashtags) {
			tags.push(["t", tag]);
		}
	}

	// Add geohash if provided
	if (geohash) {
		tags.push(["g", geohash]);
	}

	return await publishNote(content, tags);
}

// Function to post a reply
export async function postReply(args: any) {
	const { content, reply_to, root } = args;

	if (!content) {
		return { success: false, error: "content is required" };
	}

	if (!reply_to) {
		return { success: false, error: "reply_to is required" };
	}

	console.log("📝 Creating reply...");

	const normalizedReplyId = normalizeId(reply_to);
	let normalizedRootId = root ? normalizeId(root) : normalizedReplyId;

	const nostrService = NostrService.getInstance();

	// Get the event we're replying to
	const replyEvent = await nostrService.getEvent({ ids: [normalizedReplyId] });

	if (!replyEvent) {
		return { success: false, error: "Reply target event not found" };
	}

	// Construct tags for the reply - following NIP-10
	const tags: string[][] = [];

	// Create 'e' tags for root and reply - using the marker format
	if (normalizedRootId !== normalizedReplyId) {
		// If we have both root and reply, mark them accordingly
		tags.push(["e", normalizedRootId, "", "root"]);
		tags.push(["e", normalizedReplyId, "", "reply"]);
	} else {
		// If reply is the root, only mark it as root
		tags.push(["e", normalizedReplyId, "", "root"]);
	}

	// Add author of the post we're replying to
	tags.push(["p", replyEvent.pubkey]);

	// Add any 'p' tags from the event we're replying to - following the thread participants
	for (const tag of replyEvent.tags) {
		if (tag[0] === "p" && tag[1] && tag[1] !== replyEvent.pubkey) {
			tags.push(["p", tag[1]]);
		}
	}

	return await publishNote(content, tags);
}

// Function to get a user's profile
export async function getProfile(pubkey: string) {
	const normalizedPubkey = normalizePubkey(pubkey);
	console.log(`🔍 Fetching profile for: ${normalizedPubkey}`);

	const profile = await fetchProfile(normalizedPubkey);
	const npub = nip19.npubEncode(normalizedPubkey);

	if (!profile) {
		return {
			success: false,
			message: "Profile not found",
			pubkey: normalizedPubkey,
			npub,
		};
	}

	const { name, about, picture, nip05, website, lud16 } = profile;

	return {
		success: true,
		pubkey: normalizedPubkey,
		npub,
		name: name || "",
		about: about || "",
		picture: picture || "",
		nip05: nip05 || "",
		website: website || "",
		lud16: lud16 || "",
		profile_url: `https://primal.net/p/${npub}`,
	};
}

// Function to manage a Nostr profile
export async function manageNostrProfile(args: any) {
	const {
		operation,
		name,
		about,
		picture,
		nip05,
		website,
		lud16,
		publicKey: targetPublicKey,
	} = args;
	console.log(`Managing nostr profile with operation: ${operation}`, args);

	try {
		const nostrService = NostrService.getInstance();
		const { publicKey: defaultPublicKey, npub: defaultNpub } = getKeys();

		// Use provided publicKey or default to current user's publicKey
		const publicKey = targetPublicKey || defaultPublicKey;
		const npub = targetPublicKey
			? nip19.npubEncode(targetPublicKey)
			: defaultNpub;

		// Handle different operations
		switch (operation) {
			case "read":
				// Try to fetch existing profile
				console.log(`🔍 Reading profile for ${npub}...`);
				const profileData = await fetchProfile(publicKey);

				if (!profileData) {
					return {
						success: false,
						message: "Profile not found",
						publicKey,
						npub,
					};
				}

				return {
					success: true,
					message: "Profile fetched successfully",
					publicKey,
					npub,
					profileUrl: `https://primal.net/p/${npub}`,
					profileData,
				};

			case "delete":
				// For Nostr, we can't truly delete, but we can publish an empty profile
				console.log(`🗑️ Deleting profile for ${npub}...`);

				// Create and sign empty profile event
				const { event: deleteEvent } = createProfileEvent({});

				if (targetPublicKey && targetPublicKey !== defaultPublicKey) {
					return {
						success: false,
						message: "Cannot delete profiles other than your own",
						publicKey,
						npub,
					};
				}

				// Publish to relays
				await nostrService.publishEvent(deleteEvent);

				return {
					success: true,
					message: "Profile reset successfully",
					publicKey,
					npub,
					profileUrl: `https://primal.net/p/${npub}`,
				};

			case "create":
			case "update":
			default:
				// Try to fetch existing profile
				console.log(`🔍 Checking for existing profile for ${npub}...`);
				const existingProfile = await fetchProfile(publicKey);

				const isUpdate = existingProfile !== null && operation !== "create";
				console.log(
					isUpdate
						? "✅ Found existing profile, will update"
						: "📝 No existing profile found, will create new one",
				);

				if (targetPublicKey && targetPublicKey !== defaultPublicKey) {
					return {
						success: false,
						message: "Cannot create or update profiles other than your own",
						publicKey,
						npub,
					};
				}

				// Merge existing content with new values
				const mergedContent = {
					...(existingProfile || {}),
					...(name !== undefined ? { name } : {}),
					...(about !== undefined ? { about } : {}),
					...(picture !== undefined ? { picture } : {}),
					...(nip05 !== undefined ? { nip05 } : {}),
					...(website !== undefined ? { website } : {}),
					...(lud16 !== undefined ? { lud16 } : {}),
				};

				// Create and sign profile event
				const { event } = createProfileEvent(mergedContent);

				// Publish to relays
				await nostrService.publishEvent(event);

				return {
					success: true,
					message: isUpdate
						? "Profile updated successfully"
						: "Profile created successfully",
					publicKey,
					npub,
					profileUrl: `https://primal.net/p/${npub}`,
					profileData: mergedContent,
					action: isUpdate ? "updated" : "created",
				};
		}
	} catch (error: any) {
		return {
			success: false,
			error: error.message,
		};
	}
}
