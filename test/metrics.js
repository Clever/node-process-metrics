import node_metrics from "../lib/metrics";
import assert from 'assert';

describe('pause test', function() {

  before(() =>
    // Start up the pause detector
    node_metrics.log_metrics('source', 10000)
  );


  return it('test2', function(done) {
    assert.equal(node_metrics._last_period_pause_ms, 0);

    return process.nextTick(function() {
      // Do a bunch of stuff to monopolize the event loop
      let total = 0;
      let iterable = __range__(1, 2000000000, true);
      for (let i = 0; i < iterable.length; i++) {
        let num = iterable[i];
        total += num;
      }

      // Confirm that the last_period_pause_ms was increased
      return setTimeout(function() {
        assert(node_metrics._last_period_pause_ms > 1000);
        return done();
      }
      , 100);
    });
  });
});


function __range__(left, right, inclusive) {
  let range = [];
  let ascending = left < right;
  let end = !inclusive ? right : ascending ? right + 1 : right - 1;
  for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
    range.push(i);
  }
  return range;
}