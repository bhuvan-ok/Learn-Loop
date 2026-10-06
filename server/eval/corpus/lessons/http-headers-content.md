# HTTP Request and Response Headers

Headers are name and value pairs sent before the body of an HTTP message. They describe the message and negotiate how it should be handled, and their names are case-insensitive.

The Content-Type header says what format the body is in, for example application/json for JSON or multipart/form-data for file uploads. A server that receives JSON should check it before parsing, and a client that sends JSON must set it or the server may treat the body as plain text. The Content-Length header gives the body size in bytes, and a response with Transfer-Encoding set to chunked sends its body in pieces of unknown total length.

The Accept header tells the server which formats the client prefers, which is called content negotiation. The Accept-Language header does the same for human language, and Accept-Encoding lists the compression schemes the client can decode, such as gzip or br. The server replies with a matching Content-Encoding.

The Authorization header carries credentials. The common form is Authorization: Bearer followed by a token, and the older Basic scheme sends a Base64 encoded username and password, which offers no protection unless the connection is encrypted. The User-Agent header identifies the client software, and the Host header names the server being contacted, which lets one machine serve many sites.

For responses, the Location header gives the address of a newly created resource or a redirect target. The Set-Cookie header asks the browser to store a cookie and the Cookie header sends it back on later requests. Retry-After tells a client how long to wait before trying again.

Custom headers were once prefixed with X-, but that convention is deprecated and new headers should simply have clear names.
