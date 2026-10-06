# Node.js fs Module Reference

The fs module offers callback, synchronous and promise-based versions of each operation. The names below are the base callback forms.

## Reading and writing

- `fs.readFile`: Reads the entire contents of a file into memory and returns them to a callback.
- `fs.writeFile`: Replaces the contents of a file with the given data, creating the file if needed.
- `fs.appendFile`: Adds data to the end of a file, creating the file if it does not exist.
- `fs.createReadStream`: Opens a file as a readable stream that delivers its contents in chunks.
- `fs.createWriteStream`: Opens a file as a writable stream that accepts data in chunks.
- `fs.copyFile`: Copies a file to a new location, optionally refusing to overwrite an existing target.
- `fs.truncate`: Shortens or extends a file to an exact length in bytes.
- `fs.open`: Opens a file and returns a numeric file descriptor for low-level operations.
- `fs.read`: Reads bytes from an open file descriptor into a supplied buffer at a given position.
- `fs.fsync`: Forces the data of an open file descriptor to be flushed to the storage device.

## Directories and metadata

- `fs.mkdir`: Creates a directory, and with the recursive option also creates any missing parents.
- `fs.readdir`: Lists the names of the entries inside a directory.
- `fs.rmdir`: Removes an empty directory.
- `fs.rm`: Removes files or directories, and with the recursive option deletes whole trees.
- `fs.mkdtemp`: Creates a uniquely named temporary directory from a prefix and returns its path.
- `fs.stat`: Returns size, type and timestamps for a path, following symbolic links.
- `fs.lstat`: Returns the same information as stat but describes a symbolic link itself instead of its target.
- `fs.access`: Tests whether the current process may read, write or execute a path.
- `fs.rename`: Moves or renames a file or directory within the same file system.
- `fs.unlink`: Deletes a file or symbolic link.
- `fs.realpath`: Resolves a path to its canonical absolute form, following symbolic links.
- `fs.symlink`: Creates a symbolic link pointing at a target path.
- `fs.chmod`: Changes the permission bits of a file.
- `fs.utimes`: Sets the access and modification timestamps of a file.
- `fs.watch`: Watches a file or directory and reports change events as they happen.
- `fs.opendir`: Opens a directory for asynchronous iteration of its entries.
