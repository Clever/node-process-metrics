const _ = require('underscore');
const kayvee = require('kayvee');

let env = process.env.NODE_ENV || 'staging';

// log_memory_usage logs HeapUsed, HeapTotal, and RSS in the kayvee format
let log_memory_usage = function(source) {
    let mem = process.memoryUsage();
    let type = "gauge";
    console.error(kayvee.formatLog(source, kayvee.INFO, 'HeapUsed', {type, env, value: mem.heapUsed}));
    console.error(kayvee.formatLog(source, kayvee.INFO, 'HeapTotal', {type, env, value: mem.heapTotal}));
    return console.error(kayvee.formatLog(source, kayvee.INFO, 'RSS', {type, env, value: mem.rss}));
  };

// Exposing last period ms to make testing easier. It means a global variable, which isn't ideal, but I
// think it makes the code cleaner in this case, and since this module is small it's not a big concern
module.exports._last_period_pause_ms = 0;

// pause_detector is useful for determining if node isn't processing the event loop. There are
// two common explanations for these pauses:
// 1. The event loop is monopolized by one long request
// 2. Node is garbage collecting
// This works by sleeping for the specified time and then checking how long it's been since the pause
// detector was last scheduled. If it is much longer than sleep_time (pause_threshold_ms) then we
// can infer that something was monopolizing the event loop.
let start_pause_detector = function(source, sleep_time_ms, pause_threshold_ms) {
  let last_time_ms = Date.now();

  // This function gets called every pause_threshold_ms
  let pause_fn = function() {
    let current_time_ms = Date.now();
    // pause_ms represents the "extra" time the server slept
    let pause_ms = current_time_ms - last_time_ms - sleep_time_ms;

    // If the pause is long enough log it immediately so we can potentially associate it with an api request
    if (pause_ms > pause_threshold_ms) {
      console.error(kayvee.formatLog(source, kayvee.INFO, 'Pause Detected', {
        pause_duration: pause_ms,
        env
      }
      )
      );
    }

    // Update the variables for the next call
    module.exports._last_period_pause_ms += pause_ms;
    return last_time_ms = current_time_ms;
  };

  return setInterval(pause_fn, sleep_time_ms);
};

let log_pauses = function(source) {
  console.error(kayvee.formatLog(source, kayvee.INFO, 'PauseMetric', {
    type: "gauge",
    value: module.exports._last_period_pause_ms,
    env
  }
  )
  );
  return module.exports._last_period_pause_ms = 0;
};


// log_metrics logs node process metrics at the specified frequency. It also logs every time the
// node event loop stops processing all the events for more than a second.
module.exports.log_metrics = (source, frequency_ms, pause_threshold_ms = 1000) => {
  setInterval(_.partial(log_memory_usage, source), frequency_ms);
  start_pause_detector(source, 100, pause_threshold_ms);
  return setInterval(_.partial(log_pauses, source), frequency_ms);
}

