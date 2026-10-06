# Express Middleware

## What middleware is

Middleware is a function that receives the request, the response and a next callback. It can read or change the request and response, end the request by sending a reply, or pass control onward by calling next(). An Express application is essentially an ordered pipeline of middleware functions followed by a route handler.

```js
function logger(req, res, next) {
  console.log(req.method, req.url);
  next();
}
app.use(logger);
```

## Order matters

Middleware runs in the order it is registered. A body parser such as express.json() must be registered before any route that reads req.body, otherwise the body is undefined. Authentication middleware must come before the routes it protects. A middleware that neither sends a response nor calls next() leaves the request hanging until the client times out.

## Route-level middleware

Middleware can be attached to a single route as extra arguments before the handler, for example router.post('/', protect, validate, createCourse). This is how a route gets its own authentication and validation without affecting other routes.

## Error-handling middleware

Error handlers are recognised by having four parameters: err, req, res and next. Express skips normal middleware and jumps to the next error handler whenever next is called with an argument, or when a synchronous handler throws. Error handlers must be registered after all routes. A typical final handler converts errors into a JSON response with a suitable status code and hides internal details in production.

## Async handlers

Express 4 does not catch rejected promises from async handlers. A thrown error inside an async function leaves the request hanging unless it is caught and passed to next(err). A small wrapper such as asyncHandler that attaches a catch to the returned promise avoids repeating try and catch in every route.

## Third-party middleware

Common packages include cors for cross-origin headers, helmet for security headers, morgan for request logging and compression for gzip responses.
