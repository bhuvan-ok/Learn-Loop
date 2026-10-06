# Streams in Node.js

A stream processes data piece by piece instead of loading all of it into memory at once. Reading a two gigabyte log file with fs.readFile would need two gigabytes of memory, while fs.createReadStream reads it in small chunks, 64 kilobytes at a time by default, so memory use stays flat regardless of file size.

There are four kinds of stream. A Readable is a source of data, such as a file read or an incoming HTTP request. A Writable is a destination, such as a file write or an HTTP response. A Duplex is both readable and writable, as a TCP socket is. A Transform is a duplex stream that modifies data as it passes through, as zlib.createGzip does when it compresses.

Streams can be connected with pipe, so that source.pipe(destination) moves data along automatically. The modern and safer alternative is stream.pipeline, which also propagates errors from any stage and cleans up every stream when one of them fails. With plain pipe an error in one stage does not destroy the others and can leak file descriptors.

Backpressure is the key idea in stream design. A fast producer can generate data faster than a slow consumer can handle it. When a writable's internal buffer fills up, write() returns false to signal that the producer should stop. The producer waits for the drain event before writing again. Using pipe or pipeline handles this pause and resume behaviour for you.

Streams are also event emitters. A readable emits a data event for each chunk and an end event when there is nothing left, and any stream emits an error event that must be handled or it will crash the process. Modern Node.js also lets you consume a readable with for await...of, which handles backpressure automatically.

Streaming is the reason an Express route can send a large file with res.pipe-style behaviour without buffering it, and it is also how Server-Sent Events keep a connection open to push tokens to a browser.
