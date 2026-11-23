/** Color palette for agent highlights - accessible colors */
export const AGENT_COLOR_PALETTE = [
  '#1a73e8', // blue
  '#2e7d32', // green
  '#7b1fa2', // purple
  '#f57c00', // orange
  '#c62828', // red
  '#00838f', // teal
  '#5d4037', // brown
  '#455a64', // blue-grey
] as const;

/** Map to cache agent name -> color assignment */
const agentColorCache = new Map<string, string>();

/**
 * Get a consistent color for an agent name using deterministic hashing.
 * Same agent name always returns the same color.
 */
export function getAgentColor(agentName: string): string {
  if (!agentColorCache.has(agentName)) {
    // Deterministic hash of agent name
    let hash = 0;
    for (let i = 0; i < agentName.length; i++) {
      hash = ((hash << 5) - hash) + agentName.charCodeAt(i);
      hash |= 0; // Convert to 32-bit integer
    }
    const colorIndex = Math.abs(hash) % AGENT_COLOR_PALETTE.length;
    agentColorCache.set(agentName, AGENT_COLOR_PALETTE[colorIndex]);
  }
  return agentColorCache.get(agentName)!;
}

/** Clear the agent color cache (useful for testing) */
export function clearAgentColorCache(): void {
  agentColorCache.clear();
}