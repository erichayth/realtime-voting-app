#!/usr/bin/env node

const API_URL = 'https://vote.aicloudrun.com/api/vote';

// Weighted distribution of tools (higher weight = more likely to be selected)
const toolWeights = {
  "Claude Code": 25,
  "Cursor": 30,
  "Replit": 15,
  "Windsurf": 8,
  "OpenAI Codex": 10,
  "Roo Code": 3,
  "Google Jules": 2,
  "AWS Kiro": 5,
  "Loveable": 2,
  "Other": 7,
  "None": 5
};

// Convert weights to cumulative distribution
function createCumulativeDistribution(weights) {
  const tools = Object.keys(weights);
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  let cumulative = 0;
  const distribution = [];
  
  for (const tool of tools) {
    cumulative += weights[tool] / totalWeight;
    distribution.push({ tool, threshold: cumulative });
  }
  
  return distribution;
}

// Select tools based on weighted random selection
function selectTools() {
  const distribution = createCumulativeDistribution(toolWeights);
  const selections = [];
  
  // Randomly decide how many tools to select (1-3 tools per vote, with "None" always being solo)
  const numSelections = Math.random() < 0.1 ? 0 : Math.floor(Math.random() * 3) + 1;
  
  if (numSelections === 0 || Math.random() < 0.05) {
    // 5% chance to select "None" only
    return ["None"];
  }
  
  // Select tools based on distribution
  const selectedIndices = new Set();
  while (selections.length < numSelections) {
    const rand = Math.random();
    const selected = distribution.find(d => rand <= d.threshold);
    
    if (selected && selected.tool !== "None" && !selectedIndices.has(selected.tool)) {
      selections.push(selected.tool);
      selectedIndices.add(selected.tool);
    }
  }
  
  return selections;
}

// Generate a unique session ID
function generateSessionId() {
  return 'sim-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Submit a single vote
async function submitVote(sessionId, selections) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId,
        selections
      })
    });
    
    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Error submitting vote:', error.message);
    return false;
  }
}

// Main simulation function
async function simulateVotes(count = 100, delayMs = 100) {
  console.log(`🚀 Starting vote simulation for ${count} votes...`);
  console.log(`⏱️  Delay between votes: ${delayMs}ms`);
  console.log('');
  
  let successful = 0;
  let failed = 0;
  const voteDistribution = {};
  
  for (let i = 0; i < count; i++) {
    const sessionId = generateSessionId();
    const selections = selectTools();
    
    // Track distribution for reporting
    selections.forEach(tool => {
      voteDistribution[tool] = (voteDistribution[tool] || 0) + 1;
    });
    
    const success = await submitVote(sessionId, selections);
    
    if (success) {
      successful++;
      process.stdout.write(`✓`);
    } else {
      failed++;
      process.stdout.write(`✗`);
    }
    
    // Add line break every 50 votes for readability
    if ((i + 1) % 50 === 0) {
      console.log(` [${i + 1}/${count}]`);
    }
    
    // Add delay between votes to simulate realistic voting pattern
    if (i < count - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  // Final statistics
  console.log('\n');
  console.log('📊 Simulation Complete!');
  console.log('=======================');
  console.log(`✅ Successful votes: ${successful}`);
  console.log(`❌ Failed votes: ${failed}`);
  console.log(`📈 Success rate: ${((successful / count) * 100).toFixed(1)}%`);
  console.log(`⏱️  Total time: ${((count * delayMs) / 1000).toFixed(1)} seconds`);
  console.log('');
  console.log('📊 Vote Distribution:');
  console.log('--------------------');
  
  // Sort and display distribution
  const sortedTools = Object.entries(voteDistribution)
    .sort((a, b) => b[1] - a[1]);
  
  sortedTools.forEach(([tool, votes]) => {
    const percentage = ((votes / successful) * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(votes / 2));
    console.log(`${tool.padEnd(15)} ${votes.toString().padStart(3)} votes (${percentage.padStart(5)}%) ${bar}`);
  });
}

// Parse command line arguments
const args = process.argv.slice(2);
let voteCount = 100;
let delay = 100;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--count' || args[i] === '-c') {
    voteCount = parseInt(args[i + 1]) || 100;
  }
  if (args[i] === '--delay' || args[i] === '-d') {
    delay = parseInt(args[i + 1]) || 100;
  }
  if (args[i] === '--help' || args[i] === '-h') {
    console.log('Vote Simulation Script');
    console.log('=====================');
    console.log('');
    console.log('Usage: node simulate-votes.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  -c, --count <n>   Number of votes to simulate (default: 100)');
    console.log('  -d, --delay <ms>  Delay between votes in milliseconds (default: 100)');
    console.log('  -h, --help        Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node simulate-votes.js                    # Simulate 100 votes with 100ms delay');
    console.log('  node simulate-votes.js -c 50              # Simulate 50 votes');
    console.log('  node simulate-votes.js -c 200 -d 50       # Simulate 200 votes with 50ms delay');
    console.log('  node simulate-votes.js --count 500 --delay 20  # Fast simulation of 500 votes');
    process.exit(0);
  }
}

// Run the simulation
simulateVotes(voteCount, delay).catch(console.error);
