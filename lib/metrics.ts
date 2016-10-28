const _ = require("underscore");
const kayvee = require("kayvee");

const env = process.env.NODE_ENV || "staging";

// log_memory_usage logs HeapUsed, HeapTotal, and RSS in the kayvee format
function log_memory_usage(source) {
  const mem = process.memoryUsage();
  const type = "gauge";
  console.error(kayvee.formatLog(source, kayvee.INFO, "HeapUsed", { type, env, value: mem.heapUsed }));
  console.error(kayvee.formatLog(source, kayvee.INFO, "HeapTotal", { type, env, value: mem.heapTotal }));
  console.error(kayvee.formatLog(source, kayvee.INFO, "RSS", { type, env, value: mem.rss }));
};

let _last_period_pause_ms = 0;

// pause_detector is useful for determining if node isn't processing the event loop. There are
// two common explanations for these pauses:
// 1. The event loop is monopolized by one long request
// 2. Node is garbage collecting
// This works by sleeping for the specified time and then checking how long it's been since the pause
// detector was last scheduled. If it is much longer than sleep_time (pause_threshold_ms) then we
// can infer that something was monopolizing the event loop.
function start_pause_detector(source, sleep_time_ms, pause_threshold_ms) {
  let last_time_ms = Date.now();

  // This function gets called every pause_threshold_ms
  const pause_fn = function () {
    const current_time_ms = Date.now();
    // pause_ms represents the "extra" time the server slept
    const pause_ms = current_time_ms - last_time_ms - sleep_time_ms;

    // If the pause is long enough log it immediately so we can potentially associate it with an api request
    if (pause_ms > pause_threshold_ms) {
      console.error(kayvee.formatLog(source, kayvee.INFO, "Pause Detected", {
        pause_duration: pause_ms,
        env,
      }));
    }

    // Update the variables for the next call
    console.log("LAST PAUSE", pause_ms)
    _last_period_pause_ms += pause_ms;
    last_time_ms = current_time_ms;
  };

  setInterval(pause_fn, sleep_time_ms);
};

function log_pauses(source) {
  console.error(kayvee.formatLog(source, kayvee.INFO, "PauseMetric", {
    type: "gauge",
    value: _last_period_pause_ms,
    env,
  }));
  _last_period_pause_ms = 0;
};

// log_metrics logs node process metrics at the specified frequency. It also logs every time the
// node event loop stops processing all the events for more than a second.
module.exports.log_metrics = (source, frequency_ms, pause_threshold_ms = 1000) => {
  setInterval(_.partial(log_memory_usage, source), frequency_ms);
  console.log("PAUSE DET")
  start_pause_detector(source, 100, pause_threshold_ms);
  setInterval(_.partial(log_pauses, source), frequency_ms);
};

module.exports._get_last_period_pause_ms = () => _last_period_pause_ms;
