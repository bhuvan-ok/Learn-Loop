# The Event Loop

## Why JavaScript can wait without blocking

JavaScript runs your code on a single thread, so only one function executes at any moment. Slow work such as timers, network requests and file reads is handed to the runtime (the browser or Node.js), which performs it outside the main thread and later schedules a callback to report the result.

## Call stack and task queues

The call stack holds the functions currently executing. When the stack is empty, the event loop looks for the next piece of queued work. There are two main queues. The macrotask queue holds callbacks from setTimeout, setInterval and I/O events. The microtask queue holds Promise reactions, queueMicrotask callbacks and, in Node.js, process.nextTick callbacks.

## Microtasks run first

After each macrotask finishes, the event loop drains the entire microtask queue before it takes the next macrotask. This is why a Promise then callback always runs before a setTimeout callback, even when the timeout delay is zero milliseconds. A microtask that keeps scheduling more microtasks can starve the macrotask queue and freeze rendering.

## Blocking the loop

Long synchronous work, such as a huge loop or a heavy JSON parse, keeps the call stack busy and delays every queued callback, including user clicks. Heavy computation should be split into chunks, moved to a Web Worker in the browser, or moved to a worker thread in Node.js.

## setTimeout is a minimum, not a guarantee

The delay passed to setTimeout is the earliest time the callback may run. If the call stack is still busy when the timer expires, the callback simply waits its turn in the macrotask queue.
