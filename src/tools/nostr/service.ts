import { SimplePool } from "nostr-tools/pool";
import type { Event } from "nostr-tools";

export class NostrService {
    private static instance: NostrService;
    private pool: SimplePool;
    private relayUrls: string[];
    
    private constructor() {
      const relays = process.env.RELAYS || 'wss://relay.damus.io,wss://relay.snort.social';
      this.relayUrls = relays.split(',');
      this.pool = new SimplePool();
      console.log(`🌊 Connected to relays: ${this.relayUrls.join(', ')}`);
      
      // Handle process exit
      process.on('SIGINT', () => {
        this.cleanup();
        // Don't call process.exit here as the agent will handle that
      });
    }
    
    public static getInstance(): NostrService {
      if (!NostrService.instance) {
        NostrService.instance = new NostrService();
      }
      return NostrService.instance;
    }
    
    public getPool(): SimplePool {
      return this.pool;
    }
    
    public getRelayUrls(): string[] {
      return this.relayUrls;
    }
    
    public async getEvent(filter: any): Promise<Event | null> {
      try {
        return await this.pool.get(this.relayUrls, filter);
      } catch (error) {
        console.error('Error fetching event:', error);
        return null;
      }
    }
    
    public subscribe(filter: any, handlers: any): { close: () => void } {
      return this.pool.subscribe(this.relayUrls, filter, handlers);
    }
    
    public async publishEvent(event: any): Promise<string[]> {
      try {
        const pubs = this.pool.publish(this.relayUrls, event);
        return await Promise.allSettled(pubs) as any;
      } catch (error: any) {
        console.error('Error publishing event:', error.message);
        throw error;
      }
    }
    
    public cleanup(): void {
      console.log('👋 Closing nostr connections to relays...');
      this.pool.close(this.relayUrls);
      console.log('✅ Nostr connections closed successfully.');
    }
  }