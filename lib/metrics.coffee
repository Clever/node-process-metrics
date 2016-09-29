_ = require 'underscore'
kayvee = require 'kayvee'
memwatch = require 'memwatch-next'

env = process.env.NODE_ENV or 'staging'

# log_memory_usage logs HeapUsed, HeapTotal, and RSS in the kayvee format
log_memory_usage = (source) ->
    mem = process.memoryUsage()
    type = "gauge"
    console.error kayvee.formatLog source, kayvee.INFO, 'HeapUsed', {type, env, value: mem.heapUsed}
    console.error kayvee.formatLog source, kayvee.INFO, 'HeapTotal', {type, env, value: mem.heapTotal}
    console.error kayvee.formatLog source, kayvee.INFO, 'RSS', {type, env, value: mem.rss}

# Exposing last period ms to make testing easier. It means a global variable, which isn't ideal, but I
# think it makes the code cleaner in this case, and since this module is small it's not a big concern
module.exports._last_period_pause_ms = 0

# pause_detector is useful for determining if node isn't processing the event loop. There are
# two common explanations for these pauses:
# 1. The event loop is monopolized by one long request
# 2. Node is garbage collecting
# This works by sleeping for the specified time and then checking how long it's been since the pause
# detector was last scheduled. If it is much longer than sleep_time (pause_threshold_ms) then we
# can infer that something was monopolizing the event loop.
start_pause_detector = (source, sleep_time_ms, pause_threshold_ms) ->
  last_time_ms = Date.now()

  # This function gets called every pause_threshold_ms
  pause_fn = ->
    current_time_ms = Date.now()
    # pause_ms represents the "extra" time the server slept
    pause_ms = current_time_ms - last_time_ms - sleep_time_ms

    # If the pause is long enough log it immediately so we can potentially associate it with an api request
    if pause_ms > pause_threshold_ms
      console.error kayvee.formatLog source, kayvee.INFO, 'Pause Detected',
        pause_duration: pause_ms
        env: env

    # Update the variables for the next call
    module.exports._last_period_pause_ms += pause_ms
    last_time_ms = current_time_ms

  setInterval pause_fn, sleep_time_ms

log_pauses = (source) ->
  console.error kayvee.formatLog source, kayvee.INFO, 'PauseMetric',
    type: "gauge"
    value: module.exports._last_period_pause_ms
    env: env
  module.exports._last_period_pause_ms = 0


# log_metrics logs node process metrics at the specified frequency. It also logs every time the
# node event loop stops processing all the events for more than a second.
module.exports.log_metrics = (source, frequency_ms, pause_threshold_ms = 1000) ->
  setInterval _.partial(log_memory_usage, source), frequency_ms
  start_pause_detector source, 100, pause_threshold_ms
  setInterval _.partial(log_pauses, source), frequency_ms

  memwatch.on 'stats', (stats) ->
    kayvee_logger.counterD 'gc-stats', 1, stats

  memwatch.on 'leak', (info) ->
    kayvee_logger.counterD 'gc-leak', 1, info
