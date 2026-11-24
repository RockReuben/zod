#!/usr/bin/env node
/** Simulate activity events for testing the FX system */

import { program } from 'commander';
import { randomUUID } from 'crypto';

interface SimEvent {
  session_id: string;
  source_app: string;
  agent_name: string;
  type: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_output: Record<string, unknown>;
  timestamp: number;
}

const SCENARIOS: Record<string, SimEvent[]> = {
  'all-kinds': [
    // Write event
    {
      session_id: 'sim-all-kinds',
      source_app: 'test-app',
      agent_name: 'writer-agent',
      type: 'PostToolUse',
      tool_name: 'Write',
      tool_input: { file_path: 'apps/server/new_module.py', diagram: 'docs/diagrams/system-overview.md', node: 'server' },
      tool_output: { success: true },
      timestamp: 0,
    },
    // Read event
    {
      session_id: 'sim-all-kinds',
      source_app: 'test-app',
      agent_name: 'reader-agent',
      type: 'PreToolUse',
      tool_name: 'Read',
      tool_input: { file_path: 'apps/client/src/App.tsx', diagram: 'docs/diagrams/system-overview.md', node: 'client' },
      tool_output: {},
      timestamp: 1000,
    },
    // Search event
    {
      session_id: 'sim-all-kinds',
      source_app: 'test-app',
      agent_name: 'searcher-agent',
      type: 'PostToolUse',
      tool_name: 'Grep',
      tool_input: { pattern: 'TODO', path: 'apps', diagram: 'docs/diagrams/system-overview.md', node: 'hooks' },
      tool_output: { matches: ['TODO: fix this'] },
      timestamp: 2000,
    },
    // Error event
    {
      session_id: 'sim-all-kinds',
      source_app: 'test-app',
      agent_name: 'error-agent',
      type: 'PostToolUse',
      tool_name: 'Write',
      tool_input: { file_path: 'apps/server/bad.py', diagram: 'docs/diagrams/system-overview.md', node: 'server' },
      tool_output: { error: 'Permission denied', is_error: true },
      timestamp: 3000,
    },
  ],
  'burst': [],
  'long-hop': [],
  'two-agents': [],
  'error-in-burst': [],
};

// Generate burst scenario (40 events in 2s across 3 nodes)
for (let i = 0; i < 40; i++) {
  const nodes = ['server', 'client', 'hooks'];
  const node = nodes[i % nodes.length];
  const agents = ['agent-a', 'agent-b', 'agent-c'];
  const agent = agents[i % agents.length];
  const tools = ['Write', 'Edit', 'MultiEdit'];
  const tool = tools[i % tools.length];

  SCENARIOS.burst.push({
    session_id: 'sim-burst',
    source_app: 'test-app',
    agent_name: agent,
    type: 'PostToolUse',
    tool_name: tool,
    tool_input: { file_path: `apps/${node}/file${i}.py`, diagram: 'docs/diagrams/system-overview.md', node },
    tool_output: { success: true },
    timestamp: i * 50, // 50ms apart = 20 eps
  });
}

// Generate long-hop scenario (alternating far-apart nodes)
for (let i = 0; i < 10; i++) {
  const nodes = i % 2 === 0 ? 'server' : 'planning';
  SCENARIOS['long-hop'].push({
    session_id: 'sim-long-hop',
    source_app: 'test-app',
    agent_name: 'jumper-agent',
    type: 'PostToolUse',
    tool_name: 'Write',
    tool_input: { file_path: `apps/${nodes}/file${i}.py`, diagram: 'docs/diagrams/system-overview.md', node: nodes },
    tool_output: { success: true },
    timestamp: i * 1500,
  });
}

// Generate two-agents scenario (interleaved trails)
for (let i = 0; i < 12; i++) {
  const agents = i % 2 === 0 ? 'agent-alpha' : 'agent-beta';
  const nodes = i % 4 < 2 ? 'server' : 'client';
  SCENARIOS['two-agents'].push({
    session_id: 'sim-two-agents',
    source_app: 'test-app',
    agent_name: agents,
    type: 'PostToolUse',
    tool_name: 'Write',
    tool_input: { file_path: `apps/${nodes}/file${i}.py`, diagram: 'docs/diagrams/system-overview.md', node: nodes },
    tool_output: { success: true },
    timestamp: i * 800,
  });
}

// Generate error-in-burst scenario
for (let i = 0; i < 20; i++) {
  const isError = i === 10; // Error in the middle
  SCENARIOS['error-in-burst'].push({
    session_id: 'sim-error-burst',
    source_app: 'test-app',
    agent_name: 'bursty-agent',
    type: 'PostToolUse',
    tool_name: 'Write',
    tool_input: { file_path: `apps/server/file${i}.py`, diagram: 'docs/diagrams/system-overview.md', node: 'server' },
    tool_output: isError ? { error: 'Rate limit', rate_limited: true } : { success: true },
    timestamp: i * 100,
  });
}

program
  .name('simulate-activity')
  .description('Post simulated events to the Zod Control Center event server')
  .option('-s, --scenario <name>', 'Scenario to run', 'all-kinds')
  .option('-u, --url <url>', 'Server URL', 'http://127.0.0.1:8081')
  .option('-t, --token <token>', 'Auth token (or ZOD_TOKEN env)')
  .option('-d, --delay <ms>', 'Delay between events (ms)', '0')
  .option('--loop', 'Loop the scenario indefinitely')
  .parse(process.argv);

const options = program.opts();
const scenario = SCENARIOS[options.scenario];

if (!scenario) {
  console.error(`Unknown scenario: ${options.scenario}`);
  console.error(`Available: ${Object.keys(SCENARIOS).join(', ')}`);
  process.exit(1);
}

const token = options.token || process.env.ZOD_TOKEN || 'zod-control-center-token';
const baseUrl = options.url.replace(/\/$/, '');
const delay = parseInt(options.delay, 10);

async function postEvent(event: SimEvent): Promise<void> {
  const payload = {
    ...event,
    uuid: randomUUID(),
    timestamp: Date.now() / 1000 + event.timestamp,
  };

  try {
    const response = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Failed to post event: ${response.status} ${text}`);
    } else {
      const _result = await response.json();
      console.log(`Posted: ${event.tool_name} -> ${event.tool_input.node} (${event.agent_name})`);
    }
  } catch (e) {
    console.error(`Error posting event: ${e}`);
  }
}

async function runScenario(): Promise<void> {
  console.log(`Running scenario: ${options.scenario} (${scenario.length} events)`);

  for (let i = 0; i < scenario.length; i++) {
    const event = { ...scenario[i], timestamp: scenario[i].timestamp + Date.now() / 1000 };
    await postEvent(event);

    if (i < scenario.length - 1) {
      const nextDelay = delay > 0 ? delay : (scenario[i + 1].timestamp - scenario[i].timestamp);
      if (nextDelay > 0) {
        await new Promise(r => setTimeout(r, nextDelay));
      }
    }
  }

  console.log('Scenario complete');
}

async function main(): Promise<void> {
  if (options.loop) {
    console.log('Running in loop mode (Ctrl+C to stop)');
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await runScenario();
      await new Promise(r => setTimeout(r, 5000)); // 5s between loops
    }
  } else {
    await runScenario();
  }
}

main().catch(console.error);