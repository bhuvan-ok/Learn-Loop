# HTTP Caching

## Why browsers cache

Caching lets a client reuse a stored response instead of downloading it again. This cuts latency, saves bandwidth and reduces load on the origin server. HTTP controls it through response headers.

## Cache-Control

The Cache-Control header carries the caching rules. The directive max-age=3600 says a response stays fresh for 3600 seconds, during which the browser reuses it without contacting the server. The directive no-store forbids storing the response at all and is meant for sensitive data. The directive no-cache is often misunderstood: it allows storing the response but requires revalidating it with the server before every reuse. The directives public and private control whether shared caches such as a CDN may store the response or only the user's own browser may.

## Validation with ETag

When a response goes stale, the client can ask whether it changed instead of downloading it again. The server sends an ETag header, which is an identifier for that version of the content. The client later sends it back in an If-None-Match request header. If the content is unchanged the server replies with 304 Not Modified and an empty body, and the client keeps using its stored copy. The Last-Modified and If-Modified-Since pair works the same way using timestamps.

## Cache busting

Long max-age values are only safe for files whose URL changes when the content changes. Build tools therefore put a content hash in file names such as app.3f9c1a.js, so the file can be cached for a year and a new release is picked up automatically.

## Vary

The Vary header tells caches that a response depends on certain request headers, such as Accept-Encoding, so they do not serve a compressed version to a client that cannot read it.
