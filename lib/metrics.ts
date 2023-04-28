import { performance } from "perf_hooks";
import * as http from "http";
import * as kv from "kayvee";

type jsonData = { [key: string]: any }
type metricLogger = (title: string, type: string, value: number, data?: jsonData) => void

function logger(source): metricLogger {
  const log = new kv.logger(source);
  const env = process.env._DEPLOY_ENV

  return (title: string, type: string, value: number, data?: jsonData) => {
    log.infoD(title, { type, value, env, via: "node-process-metrics", ...data });
  };
}

// log_memory_usage logs HeapUsed, HeapTotal, and RSS in the kayvee format
function log_memory_usage(log) {
  const mem = process.memoryUsage();
  log("HeapUsed", "gauge", mem.heapUsed);
  log("HeapTotal", "gauge", mem.heapTotal);
  log("RSS", "gauge", mem.rss);
}

// pause_detector is useful for determining if node isn't processing the event loop. There are
// two common explanations for these pauses:
// 1. The event loop is monopolized by one long request
// 2. Node is garbage collecting
// This works by sleeping for `sleep_time_ms` and then checking how long it's been since the pause
// detector was last scheduled. If the difference between actual pause and `sleep_time_ms` is larger
// than `pause_threshold_ms`, then we can infer that something was monopolizing the event loop.
function start_pause_detector(log, sleep_time_ms, pause_threshold_ms) {
  let last_time_ms = Date.now();

  // This function gets called every pause_threshold_ms
  const pause_fn = function () {
    const current_time_ms = Date.now();
    // pause_ms represents the "extra" time the server slept
    const pause_ms = current_time_ms - last_time_ms - sleep_time_ms;

    // If the pause is long enough, log it immediately so we can associate it with an api request
    if (pause_ms > pause_threshold_ms) {
      log("Pause Detected", "counter", pause_ms);
    }

    // Update the variables for the next call
    _last_period_pause_ms += pause_ms;
    last_time_ms = current_time_ms;
  };

  setInterval(pause_fn, sleep_time_ms);
}

function log_pauses(log) {
  log("PauseMetric", "gauge", _last_period_pause_ms);
  _last_period_pause_ms = 0;
}

// log_metrics logs node process metrics at the specified frequency. It also logs every time the
// node event loop stops processing all the events for more than a second.
module.exports.log_metrics = (
  source,
  frequency_ms,
  pause_threshold_ms = 1000
) => {
  const log = logger(source);

  setInterval(() => log_memory_usage(log), frequency_ms);
  start_pause_detector(log, 100, pause_threshold_ms);
  setInterval(() => log_pauses(log), frequency_ms);
};

module.exports._get_last_period_pause_ms = () => _last_period_pause_ms;

module.exports.log_event_loop_metrics = (
  source: string,
  frequency_ms: number = 30000
) => {
  const logger = new kv.logger(source);
  setInterval(() => {
    const { idle, active, utilization } = performance.eventLoopUtilization();
    logger.infoD("event-loop-utilization", {
      idle,
      active,
      utilization,
    });
  }, frequency_ms);
};

module.exports.log_active_connections = (
  source: string,
  server: http.Server,
  frequency_ms: number = 30000
) => {
  const logger = new kv.logger(source);
  setInterval(() => {
    server.getConnections((err, count) => {
      if (!err) {
        logger.infoD("active-connections", {
          count,
        });
      } else {
        logger.errorD("error-getting-active-connections", {
          error: err,
        });
      }
    });
  }, frequency_ms);
};
