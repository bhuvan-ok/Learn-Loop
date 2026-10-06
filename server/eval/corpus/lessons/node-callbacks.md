# Callbacks in Node.js

Before newer asynchronous syntax existed, Node.js APIs reported results through callbacks, which are functions passed in to be called when an operation finishes. Reading a file looked like fs.readFile(path, callback), and the callback ran later with the outcome.

Node established a convention called the error-first callback. The first parameter is reserved for an error, and it is null or undefined on success. The remaining parameters carry the results. Code must test the first parameter before touching the others, otherwise a failure is silently ignored and the result is used while it is still undefined. A callback must also be called exactly once, and never both synchronously and asynchronously, because inconsistent timing makes programs hard to reason about.

Nesting callbacks to run steps one after another produces deeply indented code, nicknamed callback hell. The usual remedies are to give each callback a name and move it to the top level, to split the work into small functions, or to switch to a different abstraction altogether. Control flow libraries such as async once filled this gap with helpers for running tasks in series, in parallel or over a collection.

The util.promisify function converts an error-first callback function into one that returns a value you can await, and the built-in fs.promises module offers the file functions in that form already. Converting at the edges lets older APIs sit comfortably next to newer code.

Callbacks are still the right tool for events that happen repeatedly, such as a handler for every incoming request, because the same function is invoked each time rather than once.

An exception thrown inside an asynchronous callback cannot be caught by a try and catch block that surrounds the call that started the operation.
