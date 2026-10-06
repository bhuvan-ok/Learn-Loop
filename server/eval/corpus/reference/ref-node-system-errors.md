# Node.js System Error Codes

Node.js reports operating system and network failures through error objects whose code property is a short upper-case name. Matching on the code is more reliable than matching on the message text.

## File system errors

- `ENOENT`: No such file or directory; a path in the operation does not exist.
- `EEXIST`: A file or directory already exists where the operation expected to create a new one.
- `EACCES`: Permission denied; the process lacks the access rights needed for the file or port.
- `EPERM`: Operation not permitted, typically a privileged action attempted without the required rights.
- `EISDIR`: An operation that expects a file was given a directory.
- `ENOTDIR`: A component of the given path that should be a directory is not one.
- `ENOTEMPTY`: A directory could not be removed because it still contains entries.
- `EMFILE`: Too many open files; the process reached its file descriptor limit.
- `EBUSY`: The resource is busy or locked and cannot be used right now.
- `EXDEV`: A rename was attempted across different file systems, which is not allowed.
- `ELOOP`: Too many levels of symbolic links were encountered while resolving a path.
- `ENOSPC`: No space left on the device to complete the write.
- `EROFS`: A write was attempted on a read-only file system.

## Network errors

- `ECONNREFUSED`: The connection was refused because nothing is listening on the target address and port.
- `ECONNRESET`: The peer abruptly closed the connection while data was still being exchanged.
- `ECONNABORTED`: The local software aborted the connection attempt.
- `EADDRINUSE`: The address and port a server tried to bind to is already taken by another process.
- `EADDRNOTAVAIL`: The requested local address is not available on this machine.
- `EPIPE`: A write was made to a connection or pipe whose reading end has already closed.
- `ETIMEDOUT`: The connection or operation did not complete within the time allowed.
- `ENOTFOUND`: A DNS lookup found no address for the requested host name.
- `EAI_AGAIN`: A DNS lookup failed temporarily; trying again later may succeed.
- `EHOSTUNREACH`: No route exists to the destination host.
- `ENETUNREACH`: The destination network cannot be reached from this machine.
- `ENOTCONN`: An operation required a connected socket but the socket is not connected.
