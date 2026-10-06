# Additional HTTP Status Codes

## Informational and success

- `100 Continue`: The initial part of the request was received and the client should continue sending the body.
- `101 Switching Protocols`: The server agrees to the protocol change the client asked for.
- `102 Processing`: The server has accepted the request but has not finished it yet, used by WebDAV.
- `103 Early Hints`: Lets the server send preload hints before the final response is ready.
- `202 Accepted`: The request was accepted for processing but the work has not completed yet.
- `203 Non-Authoritative Information`: The response came from a transforming proxy rather than the origin server.
- `205 Reset Content`: The server finished the request and asks the client to reset the document view.
- `206 Partial Content`: The server is delivering only the byte range the client requested.
- `207 Multi-Status`: The body carries separate status codes for several independent operations, used by WebDAV.

## Redirection

- `300 Multiple Choices`: The request has more than one possible response and the client should choose.
- `303 See Other`: The client should fetch the result from another address using a GET request.
- `307 Temporary Redirect`: The resource is temporarily elsewhere and the client must repeat the request with the same method.
- `308 Permanent Redirect`: The resource has moved permanently and the client must repeat the request with the same method.

## Client errors

- `405 Method Not Allowed`: The method is known but not supported by the target resource.
- `406 Not Acceptable`: The server cannot produce a response matching the client's Accept headers.
- `407 Proxy Authentication Required`: The client must authenticate with the proxy first.
- `408 Request Timeout`: The server gave up waiting for the client to finish sending the request.
- `410 Gone`: The resource used to exist but has been removed permanently, with no forwarding address.
- `411 Length Required`: The server refuses the request without a defined Content-Length header.
- `412 Precondition Failed`: A condition in the request headers evaluated to false on the server.
- `413 Content Too Large`: The request body is larger than the server is willing to process.
- `414 URI Too Long`: The requested address is longer than the server will interpret.
- `415 Unsupported Media Type`: The server does not support the format of the request body.
- `416 Range Not Satisfiable`: The requested byte range lies outside the size of the resource.
- `417 Expectation Failed`: The server cannot meet the requirement given in the Expect header.
- `418 I'm a teapot`: A joke status from an April Fools specification, indicating the server refuses to brew coffee.
- `423 Locked`: The resource being accessed is locked, used by WebDAV.
- `426 Upgrade Required`: The server refuses the request until the client switches to a different protocol.
- `428 Precondition Required`: The server requires the request to be conditional to prevent lost updates.
- `431 Request Header Fields Too Large`: The headers, individually or together, are too large for the server.
- `451 Unavailable For Legal Reasons`: The resource is blocked because of a legal demand.

## Server errors

- `501 Not Implemented`: The server does not support the functionality needed to fulfil the request.
- `505 HTTP Version Not Supported`: The server does not support the HTTP version used in the request.
- `507 Insufficient Storage`: The server cannot store the representation needed to complete the request.
- `508 Loop Detected`: The server detected an infinite loop while processing the request.
- `511 Network Authentication Required`: The client must authenticate to gain network access, as at a captive portal.
