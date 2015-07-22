node_metrics = require "../lib/metrics"
assert       = require 'assert'

describe 'pause test', ->

  before ->
    # Start up the pause detector
    node_metrics.log_metrics 'source', 10000


  it 'test2', (done) ->
    assert.equal node_metrics._last_period_pause_ms, 0

    process.nextTick ->
      # Do a bunch of stuff to monopolize the event loop
      total = 0
      for num in [1..1000000000]
        total += num

      # Confirm that the last_period_pause_ms was increased
      setTimeout ->
        assert node_metrics._last_period_pause_ms > 1000
        done()
      , 100

