# JWT Claims and Algorithms Reference

## Registered claims

- `iss`: The issuer claim, identifying the principal that created and signed the token.
- `sub`: The subject claim, identifying the principal the token is about, usually a user ID.
- `aud`: The audience claim, naming the recipients the token is intended for.
- `exp`: The expiration time claim, after which the token must no longer be accepted.
- `nbf`: The not-before claim, giving the time before which the token must not be accepted.
- `iat`: The issued-at claim, recording when the token was created.
- `jti`: The JWT ID claim, a unique identifier that lets a token be tracked or revoked individually.

## Header parameters

- `alg`: The header parameter naming the signing algorithm used for the token.
- `typ`: The header parameter declaring the media type of the token, normally JWT.
- `kid`: The key ID header parameter, indicating which key was used so a verifier can select the right one.
- `jku`: The header parameter pointing to a URL that hosts the set of public keys for verification.
- `x5c`: The header parameter carrying the certificate chain used to verify the signature.

## Signing algorithms

- `HS256`: HMAC with SHA-256, a symmetric algorithm where the same secret signs and verifies.
- `HS512`: HMAC with SHA-512, the symmetric algorithm with a longer digest than HS256.
- `RS256`: RSA signature with SHA-256, an asymmetric algorithm verified with the public key.
- `RS512`: RSA signature with SHA-512, the asymmetric RSA variant with the longer digest.
- `ES256`: ECDSA signature using the P-256 curve and SHA-256, giving smaller signatures than RSA.
- `ES384`: ECDSA signature using the P-384 curve and SHA-384.
- `PS256`: RSA-PSS signature with SHA-256, a probabilistic padding variant of RSA signing.
- `EdDSA`: Edwards-curve digital signature algorithm, such as Ed25519, supported by modern libraries.
- `none`: The unsecured algorithm value meaning no signature, which verifiers must reject unless explicitly configured.
