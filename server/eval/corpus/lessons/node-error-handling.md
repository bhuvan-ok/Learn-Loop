# Error Handling in Node.js

## Operational errors versus programmer errors

Operational errors are problems that can legitimately happen in a correct program: a database that is unreachable, invalid user input, a request that times out or a file that does not exist. They should be handled, logged and reported to the caller. Programmer errors are bugs, such as reading a property of undefined or passing the wrong argument type. They cannot be handled meaningfully at runtime and the usual response is to fix the code.

## Errors are objects

Throw instances of Error, or of a subclass, rather than strings, because an Error captures a stack trace. A custom class such as ApiError can add a status code and a flag marking it as operational, so a central handler can decide what to send to the client.

## Asynchronous errors

A try and catch block only catches errors thrown synchronously inside it, plus rejections from awaited promises. It cannot catch an error thrown later inside a plain callback. Callback style APIs pass the error as the first argument, which must be checked before using the result. Promise chains need a catch, and async functions need try and catch around await.

## Process-level handlers

The unhandledRejection event fires when a promise rejects with no handler attached, and uncaughtException fires when an exception reaches the top of the stack. Since Node.js 15 an unhandled rejection terminates the process by default. These handlers are a last resort for logging, and after an uncaught exception the process is in an unknown state, so the right move is to log the error, finish what you can and exit, letting a supervisor such as PM2 or Kubernetes restart it.

## Graceful shutdown

On SIGTERM a server should stop accepting new connections, let in-flight requests finish, close database connections and then exit. Doing so prevents requests being cut off during a deployment.

## Do not leak internals

Stack traces and database error messages must not be sent to clients in production. Log the detail on the server and return a short generic message together with a correlation ID that support staff can look up.
