# Profiling Node.js Applications

Optimising without measuring usually targets the wrong thing. Profiling records where a program spends its time and memory so effort goes to the real bottleneck.

A CPU profile samples the call stack many times per second and counts how often each function appears. Starting Node.js with the --inspect flag lets Chrome DevTools attach and record a profile, and the built-in --prof flag writes a log that the node --prof-process command summarises. The result is often drawn as a flame graph, where the width of each bar is the share of time spent in that function and its callees, so wide bars near the top are the hot spots. Tools such as clinic and 0x produce flame graphs from a running process with little setup.

Memory problems show up as a heap that keeps growing. A heap snapshot lists every live object and what retains it, and comparing two snapshots taken some time apart shows which kinds of object accumulate. Calling process.memoryUsage reports the resident set size and the heap totals, and a steady upward trend under constant load suggests a leak.

Load testing complements profiling. A tool such as autocannon or k6 sends many concurrent requests and reports throughput and latency percentiles, which reveals how the application behaves under pressure rather than for a single request. Run the test against a production-like environment, since a laptop with a local database says little about real traffic.

Change one thing at a time and re-measure, so that the effect of each optimisation is known. Keep profiling output from before and after a change, since a fix that makes a benchmark faster but hurts memory use may be a poor trade.

Micro-benchmarks of tiny functions are easily distorted by compiler optimisations and rarely predict the speed of a whole application.
