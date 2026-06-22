const targetUrl = process.env.SMOKE_TEST_TARGET_URL || 'http://localhost:5000';

async function runSmokeTest() {
  console.log(`🚀 Starting deployment smoke test against: ${targetUrl}`);
  
  const endpoints = [
    { path: '/health', expectedStatus: 200, expectUP: true },
    { path: '/health/ready', expectedStatus: 200, expectStatusField: 'READY' },
    { path: '/health/live', expectedStatus: 200, expectStatusField: 'ALIVE' },
    { path: '/health/detailed', expectedStatus: 200 }
  ];

  let passed = true;

  for (const ep of endpoints) {
    const url = `${targetUrl}${ep.path}`;
    console.log(`Checking ${url}...`);
    try {
      const response = await fetch(url);
      if (response.status !== ep.expectedStatus) {
        console.error(`✗ FAIL: ${ep.path} returned status ${response.status} (expected ${ep.expectedStatus})`);
        passed = false;
        continue;
      }

      const body = await response.json();
      if (ep.expectUP && body.data?.status !== 'UP' && body.data?.status !== 'DEGRADED') {
        console.error(`✗ FAIL: ${ep.path} status field was ${body.data?.status} (expected UP or DEGRADED)`);
        passed = false;
        continue;
      }

      if (ep.expectStatusField && body.data?.status !== ep.expectStatusField) {
        console.error(`✗ FAIL: ${ep.path} status field was ${body.data?.status} (expected ${ep.expectStatusField})`);
        passed = false;
        continue;
      }

      console.log(`✓ PASS: ${ep.path} status is healthy.`);
    } catch (err) {
      console.error(`✗ FAIL: Could not reach endpoint ${ep.path}: ${err.message}`);
      passed = false;
    }
  }

  if (!passed) {
    console.error('❌ SMOKE TEST FAILED: Deployment health check returned errors.');
    process.exit(1);
  }

  console.log('✅ SMOKE TEST PASSED: All endpoint health status checks succeeded!');
  process.exit(0);
}

runSmokeTest();
