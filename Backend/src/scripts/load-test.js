const targetUrl = process.env.LOAD_TEST_TARGET_URL || 'http://localhost:5000/uploads/test-load.txt';
const concurrency = parseInt(process.env.LOAD_TEST_CONCURRENCY || '200', 10);

async function runSingleRequest() {
  const start = Date.now();
  try {
    const res = await fetch(targetUrl);
    const duration = Date.now() - start;
    const isSuccess = res.status === 200 || res.status === 429;
    return { success: isSuccess, duration, isRateLimited: res.status === 429 };
  } catch (err) {
    const duration = Date.now() - start;
    return { success: false, duration, error: err.message };
  }
}

async function runLoadTest() {
  console.log(`⚡ Starting throughput load test against: ${targetUrl}`);
  console.log(`Concurrency: ${concurrency} parallel requests`);

  const start = Date.now();
  const promises = Array.from({ length: concurrency }).map(() => runSingleRequest());
  const results = await Promise.all(promises);
  const totalDuration = Date.now() - start;

  let successes = 0;
  let rateLimited = 0;
  let failures = 0;
  let sumLatency = 0;

  results.forEach(res => {
    if (res.success) {
      successes++;
      if (res.isRateLimited) {
        rateLimited++;
      }
    } else {
      failures++;
    }
    sumLatency += res.duration;
  });

  const avgLatency = (sumLatency / results.length).toFixed(2);
  const throughput = ((results.length / totalDuration) * 1000).toFixed(2);

  console.log('\n📊 LOAD TEST SUMMARY');
  console.log('---------------------------');
  console.log(`Total Requests Sent : ${results.length}`);
  console.log(`Processed (200 OK)  : ${successes - rateLimited}`);
  console.log(`Rate Limited (429)  : ${rateLimited}`);
  console.log(`Failed (Server Error): ${failures}`);
  console.log(`Average Latency     : ${avgLatency} ms`);
  console.log(`Total Elapsed Time  : ${totalDuration} ms`);
  console.log(`Estimated Throughput: ${throughput} req/sec`);
  console.log('---------------------------');

  if (failures > 0) {
    console.error('⚠️ WARNING: Load test encountered server or connection errors.');
    process.exit(1);
  }

  console.log('✅ LOAD TEST SUCCESSFUL: All parallel requests responded successfully!');
  process.exit(0);
}

runLoadTest();
