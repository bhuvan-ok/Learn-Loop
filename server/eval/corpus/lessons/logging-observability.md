# Logging and Observability

Observability is the ability to understand what a running system is doing from the data it emits. It rests on three kinds of signal: logs, metrics and traces.

Logs are timestamped records of events. Structured logging writes each entry as a JSON object with named fields such as level, message, userId and requestId instead of a free-form sentence, which lets log tools filter and aggregate by field. Log levels separate importance: error for failures that need attention, warn for suspicious but recoverable situations, info for normal milestones and debug for detail that is usually switched off. Never write passwords, tokens or full card numbers to logs.

Metrics are numbers sampled over time, such as requests per second, error rate, memory use and queue length. They are cheap to store and ideal for dashboards and alerts. Percentile latencies, such as the 95th and 99th, are more informative than averages because a few slow requests are hidden by a mean.

A trace follows one request as it passes through several services. Each step is a span with a start time and duration, and all spans share a trace identifier that is passed along in a request header. A trace shows exactly where time was spent when a call crosses many components.

Alerts should be based on symptoms users feel, such as a rising error rate or slow responses, rather than on every internal cause. An alert that fires constantly gets ignored, so each one should be actionable.

Request logging middleware such as morgan records the method, path, status and duration of every HTTP request, giving a quick overview of traffic and slow routes.
