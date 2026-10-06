# CORS and the Same-Origin Policy

Browsers enforce the same-origin policy: a script loaded from one origin may not read responses from a different origin. An origin is the combination of scheme, host and port, so https://app.example.com and https://api.example.com are different origins, and so are http and https versions of the same host.

Cross-Origin Resource Sharing, or CORS, is the mechanism that lets a server opt in to being read by other origins. The server answers with headers such as Access-Control-Allow-Origin, which names the origin allowed to read the response. CORS is enforced by the browser only. It does not protect the server from requests made by curl, Postman or another server.

Simple requests, such as a GET or a form-style POST, are sent immediately and the browser then checks the response headers. Any request that uses methods like PUT or DELETE, custom headers, or a JSON content type is first preceded by a preflight. The preflight is an automatic OPTIONS request in which the browser asks whether the real request is permitted. The server must answer with Access-Control-Allow-Methods and Access-Control-Allow-Headers listing what is allowed, and the browser caches that answer for the time given in Access-Control-Max-Age.

By default cross-origin requests do not carry cookies. To send them, the client must set credentials to include and the server must reply with Access-Control-Allow-Credentials set to true. When credentials are involved the server cannot use the wildcard * for Access-Control-Allow-Origin and must name the exact origin.

A frequent mistake is to fix a CORS error by allowing every origin in production. The better approach is to keep an explicit allow-list of trusted origins, which is what the cors middleware's origin option is for.
