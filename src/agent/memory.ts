import fs from 'fs';
import path from 'path';

export type Memory = {
  goals: {
    lifeGoal: string;
    currentObjectives: string[];
    completedObjectives: string[];
  };
  context: Record<string, any>;
  history: {
    timestamp: string;
    action: string;
    result: string;
  }[];
  lastRun: string | null;
};

export class MemoryManager {
  private memoryPath: string;
  private memory: Memory;

  constructor(memoryPath: string = path.join(process.cwd(), 'agent-memory.json')) {
    this.memoryPath = memoryPath;
    this.memory = this.loadMemory();
  }

  private loadMemory(): Memory {
    try {
      if (fs.existsSync(this.memoryPath)) {
        const data = fs.readFileSync(this.memoryPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading memory:', error);
    }

    // Return default memory structure if none exists
    return {
      goals: {
        lifeGoal: '',
        currentObjectives: [],
        completedObjectives: [],
      },
      context: {},
      history: [],
      lastRun: null,
    };
  }

  public saveMemory(): void {
    try {
      fs.writeFileSync(this.memoryPath, JSON.stringify(this.memory, null, 2));
    } catch (error) {
      console.error('Error saving memory:', error);
    }
  }

  public setLifeGoal(goal: string): void {
    this.memory.goals.lifeGoal = goal;
    this.saveMemory();
  }

  public addObjective(objective: string): void {
    if (!this.memory.goals.currentObjectives.includes(objective)) {
      this.memory.goals.currentObjectives.push(objective);
      this.saveMemory();
    }
  }

  public completeObjective(objective: string): void {
    const index = this.memory.goals.currentObjectives.indexOf(objective);
    if (index !== -1) {
      this.memory.goals.currentObjectives.splice(index, 1);
      this.memory.goals.completedObjectives.push(objective);
      this.saveMemory();
    }
  }

  public setContext(key: string, value: any): void {
    this.memory.context[key] = value;
    this.saveMemory();
  }

  public getContext(key: string): any {
    return this.memory.context[key];
  }

  public addHistoryEntry(action: string, result: string): void {
    this.memory.history.push({
      timestamp: new Date().toISOString(),
      action,
      result,
    });
    this.saveMemory();
  }

  public updateLastRun(): void {
    this.memory.lastRun = new Date().toISOString();
    this.saveMemory();
  }

  public getMemory(): Memory {
    return this.memory;
  }

  public getHistorySummary(limit: number = 10): string {
    const recentHistory = this.memory.history.slice(-limit);
    if (recentHistory.length === 0) return "No history available.";
    
    return recentHistory.map(entry => 
      `${new Date(entry.timestamp).toLocaleString()}: ${entry.action} - ${entry.result}`
    ).join("\n");
  }
} 