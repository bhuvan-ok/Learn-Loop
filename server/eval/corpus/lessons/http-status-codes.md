# HTTP Status Codes

Status codes tell the client what happened to its request, and they are grouped by their first digit. Codes beginning with 2 mean success, 3 means redirection, 4 means the client made a mistake, and 5 means the server failed.

Common success codes are 200 OK for a successful read or update, 201 Created for a POST that created a resource (ideally with a Location header pointing to it), and 204 No Content for a success that has nothing to send back, such as a DELETE.

Redirection codes include 301 Moved Permanently, 302 Found for a temporary redirect, and 304 Not Modified, which tells the client that its cached copy is still valid.

Client error codes are the ones APIs get wrong most often:
- 400 Bad Request means the request was malformed or failed validation.
- 401 Unauthorized means the client is not authenticated, because credentials are missing or invalid. Despite its name it is about identity.
- 403 Forbidden means the client is authenticated but is not allowed to perform the action.
- 404 Not Found means the resource does not exist, and is sometimes returned deliberately instead of 403 so that a private resource's existence is not revealed.
- 409 Conflict means the request clashes with the current state, for example creating a user with an email that already exists.
- 422 Unprocessable Entity means the request is well formed but semantically invalid.
- 429 Too Many Requests means the client has been rate limited, and a Retry-After header can say when to try again.

Server error codes are 500 Internal Server Error for an unexpected failure, 502 Bad Gateway when an upstream server returned an invalid response, 503 Service Unavailable when the server is overloaded or down for maintenance, and 504 Gateway Timeout when an upstream server did not answer in time.
