# HTTPS and TLS

HTTPS is HTTP carried inside a connection protected by Transport Layer Security, usually shortened to TLS. It gives three guarantees: confidentiality, because eavesdroppers cannot read the traffic, integrity, because tampering is detected, and authentication, because the client can verify it is talking to the real server.

Before any HTTP data flows, client and server perform a handshake. The client lists the protocol versions and cipher suites it supports. The server picks one and presents its certificate. The client checks that the certificate is valid, and the two sides then derive shared session keys using a key exchange. From that point both sides encrypt everything with fast symmetric encryption, since public key cryptography is too slow to use for bulk data.

A certificate binds a domain name to a public key and is signed by a certificate authority, an organisation that browsers and operating systems already trust. The client follows the chain of signatures from the server certificate up to a trusted root. Verification fails if the certificate has expired, was issued for a different domain, or is signed by an unknown authority, and browsers then show a warning page.

Free automated authorities such as Let's Encrypt issue short-lived certificates that are renewed automatically, which removed most of the cost of running HTTPS. Many hosting platforms terminate TLS at a load balancer, so the application itself receives plain HTTP from behind it and must trust the forwarded protocol header to know the original request was secure.

Older versions of the protocol, SSL and early TLS releases, are broken or deprecated and should be disabled. Current deployments use TLS 1.2 or 1.3, and version 1.3 shortens the handshake to one round trip.
