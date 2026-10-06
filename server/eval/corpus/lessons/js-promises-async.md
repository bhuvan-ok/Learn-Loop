# Promises and async/await

## Promise states

A Promise represents a value that will be available later. It starts out pending and then settles exactly once, either fulfilled with a value or rejected with a reason. Once settled it never changes state again. Handlers attached with then run asynchronously as microtasks, even if the promise was already settled.

## Chaining

Each call to then returns a new promise, which allows steps to be chained. Returning a plain value from a handler fulfils the next promise with that value, and returning another promise makes the chain wait for it. A single catch at the end of a chain handles a rejection from any earlier step.

## async and await

An async function always returns a promise. The await keyword pauses the function until the awaited promise settles and then resumes with its value, or throws its rejection reason so that try and catch work as they do for synchronous code. Pausing a function with await does not block the thread, because the rest of the program keeps running.

## Running work in parallel

Awaiting independent operations one after another makes them run in sequence. To run them at the same time, start all of them first and await them together with Promise.all. Promise.all rejects as soon as any input promise rejects. Promise.allSettled instead waits for every promise and reports each outcome, and Promise.race settles with whichever promise finishes first.

## Common mistakes

Forgetting to return a promise inside a then handler breaks the chain because the next step does not wait. Forgetting await on an async call leaves you holding a pending promise instead of its value. An unhandled rejection in modern Node.js terminates the process by default.
