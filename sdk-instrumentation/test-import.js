/**
 * Quick test to verify package builds and exports correctly
 */

const pkg = require('./dist/index.js');

console.log('Testing @agent-lightning/instrumentation package...\n');

// Check exports
console.log('✓ Package imports successfully');
console.log('✓ Exports:', Object.keys(pkg));

// Check main exports exist
const required = ['instrument', 'LightningClient', 'createHooks', 'StepBuffer'];
const missing = required.filter(name => !pkg[name]);

if (missing.length > 0) {
  console.error('✗ Missing exports:', missing);
  process.exit(1);
}

console.log('✓ All required exports present:', required);

// Test instrument function
try {
  const result = pkg.instrument({
    collectorUrl: 'http://test.com',
    apiKey: 'test-key',
    agentId: 'test-agent'
  });

  console.log('✓ instrument() returns:', Object.keys(result));

  const requiredKeys = ['hooks', 'flush', 'getSessionId', 'getTrajectoryId', 'complete'];
  const missingKeys = requiredKeys.filter(k => !result[k]);

  if (missingKeys.length > 0) {
    console.error('✗ Missing keys in result:', missingKeys);
    process.exit(1);
  }

  console.log('✓ All required methods present');
  console.log('✓ Session ID:', result.getSessionId());
  console.log('✓ Hooks:', Object.keys(result.hooks));

  console.log('\n✅ All tests passed!');
} catch (error) {
  console.error('✗ Error testing instrument():', error.message);
  process.exit(1);
}
