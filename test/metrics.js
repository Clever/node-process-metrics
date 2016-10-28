const nodeMetrics = require("../lib/metrics");
const assert = require("assert");

describe("pause test", () => {
  // Start up the pause detector
  before(() => nodeMetrics.log_metrics("source", 10000));

  it("test2", (done) => {
    assert.equal(nodeMetrics._last_period_pause_ms, 0);

    process.nextTick(() => {
      // Do a bunch of stuff to monopolize the event loop
      let total = 0;
      for (let i = 0; i < 100000000; i++) {
        total += i;
      }

      // Confirm that the last_period_pause_ms was increased
      setTimeout(() => {
        assert(nodeMetrics._last_period_pause_ms > 1000);
        done();
      }, 100);
    });
  });
});
