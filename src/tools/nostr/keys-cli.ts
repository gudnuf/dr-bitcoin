import { generateAndSaveKeyPair, getOrGenerateKeyPair, loadKeyPair, printKeyInfo } from "./key-manager";
import fs from "fs";
import path from "path";

const KEYS_DIR = path.join(process.cwd(), ".nostr-keys");
const KEY_FILE = path.join(KEYS_DIR, "dr-bitcoin-keys.json");

function printHelp() {
  console.log("\n📝 Dr. Bitcoin Nostr Key Manager");
  console.log("=============================");
  console.log("Commands:");
  console.log("  generate   - Generate new Nostr keys");
  console.log("  show       - Show current keys");
  console.log("  status     - Check if keys exist");
  console.log("  delete     - Delete current keys");
  console.log("  help       - Show this help\n");
}

function showStatus() {
  const keys = loadKeyPair();
  if (keys) {
    console.log("✅ Dr. Bitcoin has Nostr keys");
    console.log(`   Created: ${keys.createdAt}`);
    console.log(`   Keys stored at: ${KEY_FILE}`);
  } else {
    console.log("❌ No Nostr keys found");
    console.log(`   Expected at: ${KEY_FILE}`);
  }
}

function deleteKeys() {
  try {
    if (fs.existsSync(KEY_FILE)) {
      fs.unlinkSync(KEY_FILE);
      console.log("🗑️ Keys deleted successfully");
    } else {
      console.log("❌ No keys found to delete");
    }
  } catch (error) {
    console.error("Error deleting keys:", error);
  }
}

async function main() {
  const command = process.argv[2] || "help";

  switch (command) {
    case "generate":
      console.log("🔑 Generating new Nostr keys for Dr. Bitcoin...");
      const keys = generateAndSaveKeyPair();
      printKeyInfo(keys);
      break;

    case "show":
      const existingKeys = loadKeyPair();
      if (existingKeys) {
        printKeyInfo(existingKeys);
      } else {
        console.log("❌ No keys found. Use 'generate' to create new keys.");
      }
      break;

    case "status":
      showStatus();
      break;

    case "delete":
      deleteKeys();
      break;

    case "help":
    default:
      printHelp();
      break;
  }
}

// Run the CLI
main().catch(console.error);