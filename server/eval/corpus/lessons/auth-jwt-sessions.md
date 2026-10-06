# Authentication: Sessions and JWTs

## Session-based authentication

After a user logs in, the server creates a session record and sends the browser a random session ID in a cookie. On each request the server looks that ID up in its session store, which might be memory, a database or Redis. Because the state lives on the server, a session can be revoked instantly by deleting the record. The cost is that every server instance needs access to the shared session store.

## JSON Web Tokens

A JWT is a signed token made of three Base64URL parts: a header, a payload of claims such as the user ID and expiry time, and a signature. The server verifies the signature with its secret key and trusts the claims without looking anything up, so no session store is needed. The payload is encoded, not encrypted, so anyone holding the token can read it and secrets must never be put inside.

## Trade-offs

The main weakness of a JWT is revocation. A stateless token stays valid until it expires, so logging a user out or banning them immediately requires extra machinery such as a denylist, which brings back server-side state. Short expiry times limit the damage of a stolen token.

## Access and refresh tokens

A common design issues a short-lived access token, valid for around fifteen minutes, together with a long-lived refresh token. When the access token expires the client exchanges the refresh token for a new one. The refresh token can be stored server-side so it can be revoked.

## Where to store tokens in a browser

Tokens kept in localStorage can be stolen by any injected script through cross-site scripting. A cookie marked HttpOnly cannot be read by JavaScript, and the Secure flag restricts it to HTTPS. The SameSite attribute limits when the cookie is sent on cross-site requests, which reduces cross-site request forgery risk.

## Passwords

Passwords must be stored as salted hashes produced by a slow algorithm such as bcrypt, never as plain text or a fast hash like SHA-256.
