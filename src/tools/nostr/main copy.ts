import type { Tool } from "../../types";

export const PUBLISH_NOSTR_PROFILE_TOOL: Tool = {
  type: "nostr",
  function: {
    name: "publish_nostr_profile",
    description: "Create a social media profile on nostr",
    parameters: JSON.stringify({
      type: "object",
      properties: {
        name: { type: "string", description: "The display name for the profile" },
        about: { type: "string", description: "A short bio or description" },
        picture: { type: "string", description: "URL to profile picture" },
        nip05: { type: "string", description: "NIP-05 identifier (e.g. user@domain.com)" },
        website: { type: "string", description: "Personal website URL" },
        lud16: { type: "string", description: "Lightning address for payments" }
      },
      required: ["name", "lud16","about"],
    }),
  },
};

export async function publishNostrProfile(args: any) {
  const { name, about, picture, nip05, website, lud16 } = args;

  console.log("Publishing nostr profile", args);

  return "Profile published";
}

publishNostrProfile({
  name: "Dr. Bitcoin",
  about: "I am a doctor of bitcoin",
  picture: "https://drbitcoin.com/picture.png",
  nip05: "drbitcoin@drbitcoin.com",
  website: "https://drbitcoin.com",
  lud16: "drbitcoin@drbitcoin.com",
});
 