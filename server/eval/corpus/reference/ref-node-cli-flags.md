# Node.js Command-Line Flags

Flags passed to the node executable change how the runtime starts. Flags before the script name configure Node.js; arguments after it go to the program.

## Debugging and diagnostics

- `--inspect`: Starts the inspector so a debugger such as Chrome DevTools can attach to the running process.
- `--inspect-brk`: Starts the inspector and pauses on the first line of the script until a debugger attaches.
- `--trace-warnings`: Prints a stack trace for every process warning, showing where it was emitted.
- `--trace-deprecation`: Prints a stack trace whenever a deprecated API is used.
- `--no-warnings`: Silences all process warnings, including deprecation notices.
- `--enable-source-maps`: Applies source maps so stack traces point at the original source files.
- `--stack-trace-limit`: Sets how many stack frames are captured in an error's stack trace.
- `--abort-on-uncaught-exception`: Aborts the process and writes a core file instead of exiting when an exception is uncaught.
- `--heapsnapshot-signal`: Writes a heap snapshot to disk when the process receives the named signal.
- `--cpu-prof`: Writes a CPU profile to disk when the process exits.
- `--heap-prof`: Writes a heap allocation profile to disk when the process exits.
- `--report-on-fatalerror`: Generates a diagnostic report when the process dies from a fatal error.

## Runtime behaviour

- `--max-old-space-size`: Sets the maximum size of the old generation of the V8 heap, in megabytes.
- `--max-http-header-size`: Sets the maximum size of HTTP headers in bytes for the built-in HTTP parser.
- `--unhandled-rejections`: Chooses how unhandled promise rejections are treated, such as strict, warn or none.
- `--title`: Sets the process title shown in tools like ps and top.
- `--disable-proto`: Disables the legacy proto property on objects, or removes it entirely.
- `--max-semi-space-size`: Sets the maximum size of a V8 semi-space, used for short-lived objects, in megabytes.
- `--openssl-legacy-provider`: Enables the legacy OpenSSL provider so older algorithms remain available.

## Running code

- `--watch`: Restarts the process automatically whenever an imported file changes.
- `--env-file`: Loads environment variables from the given dotenv-style file before running the script.
- `--test`: Runs the built-in test runner over the discovered test files.
- `--require`: Preloads a module before the main script runs, equivalent to a leading require call.
- `--import`: Preloads an ES module before the main script runs.
- `--eval`: Evaluates the following string as JavaScript instead of running a file.
- `--print`: Evaluates the following string and prints the result to standard output.
- `--check`: Checks the syntax of a script without executing it.
- `--input-type`: Declares whether code given on standard input or with eval is CommonJS or an ES module.
- `--conditions`: Adds custom conditions used when resolving package exports.
