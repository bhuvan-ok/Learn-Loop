# Node.js ERR_ Error Codes

Errors thrown by Node.js itself carry a stable code beginning with ERR_. The codes below are grouped by the area of the runtime that raises them.

## Stream errors

- `ERR_STREAM_PREMATURE_CLOSE`: A stream or pipeline ended before it emitted its end or finish event.
- `ERR_STREAM_PUSH_AFTER_EOF`: Data was pushed onto a readable stream after it had already signalled the end of its input.
- `ERR_STREAM_WRITE_AFTER_END`: A write was attempted on a writable stream after end had been called.
- `ERR_STREAM_DESTROYED`: A method was called on a stream that had already been destroyed.
- `ERR_STREAM_NULL_VALUES`: A null value was passed to write, which is not allowed outside object mode.
- `ERR_STREAM_ALREADY_FINISHED`: A stream method was called on a stream that had already finished.
- `ERR_STREAM_CANNOT_PIPE`: Pipe was attempted on a stream that cannot be piped, such as a destroyed one.
- `ERR_METHOD_NOT_IMPLEMENTED`: A method that a custom stream subclass must implement was called but is missing.
- `ERR_MULTIPLE_CALLBACK`: A stream callback was invoked more than once.
- `ERR_STREAM_UNSHIFT_AFTER_END_EVENT`: Unshift was called on a readable stream after its end event had been emitted.

## Argument and value errors

- `ERR_INVALID_ARG_TYPE`: An argument of the wrong type was passed to a Node.js API.
- `ERR_INVALID_ARG_VALUE`: An argument has the right type but a value that is not acceptable.
- `ERR_MISSING_ARGS`: A required argument was not supplied to a Node.js API.
- `ERR_OUT_OF_RANGE`: A numeric argument fell outside the range the API accepts.
- `ERR_INVALID_RETURN_VALUE`: A callback or function returned a value of an unexpected type.
- `ERR_UNKNOWN_ENCODING`: An unsupported character encoding name was passed to an API.
- `ERR_BUFFER_OUT_OF_BOUNDS`: A buffer operation tried to read or write outside the buffer's bounds.
- `ERR_INVALID_URL`: A string that could not be parsed as a URL was given to the URL constructor.
- `ERR_INVALID_FILE_URL_HOST`: A file URL had a host that is not valid on this platform.

## Module and process errors

- `ERR_MODULE_NOT_FOUND`: An ES module import could not resolve to an existing file or package.
- `ERR_REQUIRE_ESM`: Require was used to load a file that is an ES module.
- `ERR_UNKNOWN_FILE_EXTENSION`: The ES module loader met a file extension it does not know how to load.
- `ERR_PACKAGE_PATH_NOT_EXPORTED`: A package import used a subpath that the package does not list in its exports map.
- `ERR_UNHANDLED_REJECTION`: A promise rejection had no handler and the unhandled-rejections mode treats that as fatal.
- `ERR_HTTP_HEADERS_SENT`: An attempt was made to set or send headers after the response headers were already sent.
- `ERR_SOCKET_CLOSED`: An operation was attempted on a socket that had already closed.
- `ERR_SERVER_NOT_RUNNING`: Close was called on a server that is not currently listening.
- `ERR_IPC_CHANNEL_CLOSED`: A message was sent to a child process over an inter-process channel that has closed.
