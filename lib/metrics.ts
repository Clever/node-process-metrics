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

// log_metrics logs node process metrics at the specified frequency. The
// metrics logged are as follows:
//  - hepa memory used, total and rss
//  - event loop utilization calculated, idle, and active
//  - event loop lag p50, p90, p99, mean, and max values
module.exports.log_metrics = (
  source: string,
  frequency_ms: number = 30_000
) => {
  const log = logger(source);

  start_memory_usage_logging(log, frequency_ms);
  start_elu_logging(log, frequency_ms);
  start_event_loop_lag_logging(log, frequency_ms);
};

function start_memory_usage_logging(log: metricLogger, frequency_ms: number) {
  setInterval(() => {
    const { heapTotal, heapUsed, rss } = process.memoryUsage();
    log("node-heap", {
      "heap-used": heapUsed,
      "heap-total": heapTotal,
      rss,
    });
  }, frequency_ms);
}

function start_elu_logging(log: metricLogger, frequency_ms: number) {
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

function start_event_loop_lag_logging(log: metricLogger, frequency_ms: number) {
  const resolution = 100;
  let histogram: EventLoopDelayMonitor = monitorEventLoopDelay({ resolution });
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
    histogram = monitorEventLoopDelay({ resolution });
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
