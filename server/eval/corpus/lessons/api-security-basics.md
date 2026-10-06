# API Security Basics

Rate limiting restricts how many requests a client can make in a time window and protects an API from brute-force logins, scraping and accidental overload. A common algorithm is the fixed window counter, which allows, say, 100 requests per 15 minutes per key and answers 429 Too Many Requests after that. Sliding windows and token buckets smooth out the bursts that a fixed window permits at its boundaries. The key is usually the IP address, but for authenticated endpoints it is better to key by user ID, because many users can share one office or campus IP address. Login and password reset routes deserve a much stricter limit than ordinary reads.

Validate every input on the server, even if the browser form already checks it. Validation libraries such as express-validator or Zod check type, length and format and reject anything unexpected with a 400 response. Allow-lists are safer than deny-lists, and unknown fields should be stripped rather than saved.

NoSQL injection is the MongoDB equivalent of SQL injection. If a login route passes req.body.email straight into a query, an attacker can send an object such as {"$ne": ""} instead of a string, and the query then matches every user. Defences are to validate that fields are strings, to strip keys beginning with $ or containing dots using a middleware such as express-mongo-sanitize, and to never build queries from raw request objects.

The helmet middleware sets a group of protective HTTP response headers in one call. These include Content-Security-Policy to limit where scripts can load from, X-Content-Type-Options to stop MIME sniffing and Strict-Transport-Security to force HTTPS.

Secrets such as database passwords and signing keys belong in environment variables or a secrets manager and never in source control. A secret committed to a repository should be treated as leaked and rotated, even if the commit is later deleted.

Cross-site scripting is prevented by escaping output and by a strict Content-Security-Policy, and cross-site request forgery by SameSite cookies or anti-forgery tokens. Always serve an API over HTTPS so credentials are never sent in clear text.
