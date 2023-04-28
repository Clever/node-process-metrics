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

function log_event_loop_lag(
  log: metricLogger,
  frequency_ms: number,
) {
  let histogram: EventLoopDelayMonitor = monitorEventLoopDelay({ resolution: 100 })
  histogram.enable()
  setInterval(() => {
    histogram.disable()

    const data: jsonData = {}
    histogram.percentiles.forEach((v, k) => {
      data[k.toString()] = v
    })

    log("event-loop-lag", "gauge", histogram.mean, data)

    histogram = monitorEventLoopDelay({ resolution: 100 })
    histogram.enable()
  }, frequency_ms)
}

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
