import { publishNostrProfile } from './src/tools/nostr/main';

// Call the publishNostrProfile function with Dr. Bitcoin's profile data
async function main() {
  try {
    console.log('📝 Publishing Dr. Bitcoin profile to Nostr...');

    const result = await publishNostrProfile({
      name: 'Dr. Bitcoin',
      about: 'I am a helpful AI assistant focused on educating people about Bitcoin technology, history, and best practices.',
      picture: 'https://robohash.org/drbitcoin',
      lud16: 'drbitcoin@getalby.com',
      nip05: 'drbitcoin@iris.to',
      website: 'https://bitcoin.org'
    });

    console.log('Result:', result);

    if (result.success) {
      console.log('✅ Profile published successfully!');
      console.log(`🔗 View profile: ${result.profileUrl}`);
    } else {
      console.error('❌ Failed to publish profile:', result.error);
    }
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

main().catch(console.error);