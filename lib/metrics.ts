import {
  performance,
  EventLoopUtilization,
  monitorEventLoopDelay,
  EventLoopDelayMonitor,
} from "perf_hooks";
import * as http from "http";
import * as kv from "kayvee";

type jsonData = { [key: string]: any };
type metricLogger = (title: string, value: number, data?: jsonData) => void;

function logger(source): metricLogger {
  const log = new kv.logger(source);
  const env = process.env._DEPLOY_ENV;

  return (title: string, value: number, data?: jsonData) => {
    log.infoD(title, {
      value,
      env,
      type: "gauge",
      via: "node-process-metrics",
      ...data,
    });
  };
}

// log_memory_usage logs HeapUsed, HeapTotal, and RSS in the kayvee format
function log_memory_usage(log: metricLogger, frequency_ms: number) {
  setInterval(() => {
    const { heapTotal, heapUsed, rss } = process.memoryUsage();
    log("heap-used", heapUsed);
    log("heap-total", heapTotal);
    log("rss", rss);
  }, frequency_ms);
}

// log_metrics logs node process metrics at the specified frequency. It also logs every time the
// node event loop stops processing all the events for more than a second.
module.exports.log_metrics = (
  source: string,
  frequency_ms: number = 30_000
) => {
  const log = logger(source);

  log_memory_usage(log, frequency_ms);
  log_event_loop_metrics(log, frequency_ms);
  log_event_loop_lag(log, frequency_ms);
};

function log_event_loop_metrics(log: metricLogger, frequency_ms: number) {
  let utl: EventLoopUtilization;
  setInterval(() => {
    const { idle, active, utilization } = performance.eventLoopUtilization(utl);
    log("event-loop-utilization", utilization, {
      idle,
      active,
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

    const data: jsonData = {};
    histogram.percentiles.forEach((v, k) => {
      data[k.toString()] = v;
    });

    log("event-loop-lag", histogram.mean, data);

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
