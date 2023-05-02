import {
  performance,
  EventLoopUtilization,
  monitorEventLoopDelay,
  EventLoopDelayMonitor,
} from "perf_hooks";
import * as http from "http";
import * as kv from "kayvee";

type jsonData = { [key: string]: any };
type metricLogger = (title: string, data?: jsonData) => void;

function logger(source): metricLogger {
  const log = new kv.logger(source);
  const env = process.env._DEPLOY_ENV;

  return (title: string, data?: jsonData) => {
    log.infoD(title, {
      env,
      via: "node-process-metrics",
      ...data,
    });
  };
}

// log_metrics logs node process metrics at the specified frequency. It also logs every time the
// node event loop stops processing all the events for more than a second.
module.exports.log_metrics = (
  source: string,
  frequency_ms: number = 30_000
) => {
  const log = logger(source);

  log_memory_usage(log, frequency_ms);
  log_event_loop_utilization(log, frequency_ms);
  log_event_loop_lag(log, frequency_ms);
};

// log_memory_usage logs HeapUsed, HeapTotal, and RSS in the kayvee format
function log_memory_usage(log: metricLogger, frequency_ms: number) {
  setInterval(() => {
    const { heapTotal, heapUsed, rss } = process.memoryUsage();
    log("node-heap", {
      "heap-used": heapUsed,
      "heap-total": heapTotal,
      rss
    });
  }, frequency_ms);
}

function log_event_loop_utilization(log: metricLogger, frequency_ms: number) {
  let last: EventLoopUtilization;
  setInterval(() => {
    last = performance.eventLoopUtilization(last);
    const { idle, active, utilization } = last;
    log("event-loop-utilization", {
      "elu-utilization": utilization,
      "elu-idle": idle,
      "elu-active": active,
    });
  }, frequency_ms);
}

function log_event_loop_lag(log: metricLogger, frequency_ms: number) {
  let histogram: EventLoopDelayMonitor = monitorEventLoopDelay({
    resolution: 100,
  });
  histogram.enable();

  setInterval(() => {
    histogram.disable();

    log("event-loop-lag", {
      "el-lag-p99": histogram.percentile(99),
      "el-lag-p90": histogram.percentile(90),
      "el-lag-p50": histogram.percentile(50),
      "el-lag-mean": histogram.mean,
      "el-lag-max": histogram.max,
    });

    // The histogram disables itself every time the data is read from
    // so we must re-initialize it after every read.
    histogram = monitorEventLoopDelay({ resolution: 100 });
    histogram.enable();
  }, frequency_ms);
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
