const node_metrics = require("../lib/metrics");
const assert = require("assert");

describe("pause test", () => {
  before(() =>
    // Start up the pause detector
    node_metrics.log_metrics("source", 10000)
  );


  return it("test2", (done) => {
    assert.equal(node_metrics._last_period_pause_ms, 0);

    return process.nextTick(() => {
      // Do a bunch of stuff to monopolize the event loop
      let total = 0;
      for (let i = 0; i < 100000000; i++) {
        total += i;
      }

      // Confirm that the last_period_pause_ms was increased
      return setTimeout(() => {
        assert(node_metrics._last_period_pause_ms > 1000);
        return done();
      }
        , 100);
    });
  });
});
