# Node.js path, os and process Reference

## path module

- `path.join`: Joins path segments with the platform separator and normalises the result.
- `path.resolve`: Resolves a sequence of segments into an absolute path, working right to left until one is absolute.
- `path.basename`: Returns the last portion of a path, optionally with a given extension removed.
- `path.dirname`: Returns the directory portion of a path.
- `path.extname`: Returns the extension of a path including the leading dot.
- `path.parse`: Splits a path into an object with root, dir, base, ext and name.
- `path.format`: Builds a path string from an object with root, dir, base, ext and name.
- `path.normalize`: Collapses redundant separators and resolves dot and double-dot segments in a path.
- `path.relative`: Computes the relative path that leads from one absolute path to another.
- `path.isAbsolute`: Reports whether a path is absolute.
- `path.sep`: The platform-specific path segment separator, a backslash on Windows and a slash elsewhere.

## os module

- `os.cpus`: Returns an array describing each logical CPU core, including model and speed.
- `os.totalmem`: Returns the total amount of system memory in bytes.
- `os.freemem`: Returns the amount of free system memory in bytes.
- `os.homedir`: Returns the home directory of the current user.
- `os.tmpdir`: Returns the operating system's default directory for temporary files.
- `os.platform`: Returns a string identifying the operating system platform, such as linux or win32.
- `os.hostname`: Returns the host name of the operating system.
- `os.uptime`: Returns the system uptime in seconds.
- `os.loadavg`: Returns the 1, 5 and 15 minute load averages, which are always zero on Windows.
- `os.networkInterfaces`: Returns the network interfaces that have been assigned an address.
- `os.EOL`: The operating system's end-of-line marker, a carriage return and line feed on Windows.

## process object

- `process.argv`: An array holding the command-line arguments, starting with the node executable and the script path.
- `process.env`: An object containing the environment variables of the process.
- `process.exit`: Ends the process immediately with the given exit code.
- `process.exitCode`: Sets the code the process will exit with once it ends naturally.
- `process.cwd`: Returns the current working directory of the process.
- `process.chdir`: Changes the current working directory of the process.
- `process.hrtime`: Returns a high-resolution real time as a pair of seconds and nanoseconds.
- `process.memoryUsage`: Returns an object describing memory use, including rss, heapTotal and heapUsed.
- `process.uptime`: Returns the number of seconds the current process has been running.
- `process.pid`: The process identifier of the running process.
- `process.platform`: A string identifying the operating system platform the process runs on.
- `process.stdout`: A writable stream connected to standard output.
