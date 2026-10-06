# Less Common HTTP Request Headers

## Conditional and range requests

- `If-Match`: Makes a request conditional on the resource's current ETag matching one of the listed values.
- `If-Unmodified-Since`: Makes a request succeed only if the resource has not changed since the given date.
- `If-Range`: Asks for a partial range only if the validator still matches, otherwise the whole resource is sent.
- `Range`: Asks the server for only part of a resource, given as byte offsets.
- `Expect`: Lists server behaviours the client requires, most often 100-continue before sending a large body.

## Proxy and client information

- `X-Forwarded-For`: Lists the client IP address and any proxies the request passed through.
- `X-Forwarded-Proto`: Records whether the original client request used http or https before a proxy.
- `X-Forwarded-Host`: Records the original Host header value a client used before a proxy rewrote it.
- `Forwarded`: The standardised header that carries proxy information such as the client address, protocol and host.
- `Via`: Shows the intermediate proxies and gateways a message has passed through.
- `X-Requested-With`: A de facto marker, usually set to XMLHttpRequest, identifying requests made by script.
- `Max-Forwards`: Limits how many proxies may forward a TRACE or OPTIONS request.
- `DNT`: The legacy Do Not Track preference sent by some browsers.

## Fetch metadata and misc

- `Origin`: Gives the scheme, host and port that initiated a cross-origin or POST request.
- `Referer`: Gives the address of the page that linked to the requested resource.
- `Sec-Fetch-Site`: Tells the server whether the request came from the same origin, same site or a different site.
- `Sec-Fetch-Mode`: Tells the server the request mode, such as cors, navigate or no-cors.
- `Sec-Fetch-Dest`: Tells the server what the response will be used for, such as document, image or script.
- `Sec-Fetch-User`: Indicates that a navigation request was triggered by a user activation.
- `Upgrade-Insecure-Requests`: Signals that the client prefers an encrypted and authenticated response.
- `Save-Data`: Indicates that the client would like to use less data, for example on a metered connection.
- `Priority`: Lets a client hint at how important a response is relative to other requests.
- `TE`: Lists the transfer encodings the client is willing to accept, such as trailers.
