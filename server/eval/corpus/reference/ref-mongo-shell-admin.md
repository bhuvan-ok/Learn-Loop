# MongoDB Shell and Admin Commands

## Collection methods

- `insertOne`: Inserts a single document into a collection and returns the generated identifier.
- `insertMany`: Inserts an array of documents into a collection in one operation.
- `updateOne`: Updates the first document that matches a filter.
- `updateMany`: Updates every document that matches a filter.
- `replaceOne`: Replaces the first matching document with an entirely new document.
- `deleteOne`: Deletes the first document that matches a filter.
- `deleteMany`: Deletes every document that matches a filter.
- `bulkWrite`: Runs a list of insert, update and delete operations in a single batch.
- `estimatedDocumentCount`: Returns an approximate document count quickly from collection metadata.
- `distinct`: Returns the unique values of a field across the documents that match a filter.
- `renameCollection`: Changes the name of an existing collection.
- `dropIndex`: Removes a single index from a collection.
- `getIndexes`: Lists all indexes defined on a collection.
- `drop`: Removes a collection and all of its indexes.

## Database and server commands

- `db.serverStatus`: Returns a document of metrics about the running server, such as connections and memory.
- `db.currentOp`: Lists the database operations currently in progress.
- `db.killOp`: Terminates a running operation by its operation id.
- `db.runCommand`: Runs a database command given as a document.
- `db.adminCommand`: Runs a command against the admin database.
- `db.stats`: Returns storage statistics for the current database.
- `db.dropDatabase`: Deletes the current database and all its collections.
- `db.getCollectionNames`: Lists the names of the collections in the current database.
- `db.createUser`: Creates a user with the given roles on the current database.
- `db.grantRolesToUser`: Adds roles to an existing user.
- `db.setProfilingLevel`: Sets how many operations the database profiler records.
- `db.fsyncLock`: Flushes writes to disk and blocks further writes, to allow a safe file copy.
- `rs.status`: Reports the health and state of each member of the replica set.
- `rs.initiate`: Initialises a replica set using the given configuration.
- `rs.stepDown`: Asks the primary to step down so another member can be elected.
- `rs.conf`: Returns the current replica set configuration document.
