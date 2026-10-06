# Atomicity and Transactions in MongoDB

Writes to a single document in MongoDB are always atomic, even when the update touches several fields or nested arrays inside that document. Either every change in the update is applied or none is, and no other client can ever observe a half-applied update. Because of this guarantee, careful schema design that keeps related data in one document often removes the need for transactions entirely.

Atomic update operators make read-modify-write safe on the server. Using $inc to add to a counter, $push to append to an array or $addToSet to add a unique element runs as one indivisible step. A pattern that reads the document, changes it in application code and writes it back has a race condition, because two clients can read the same old value and one update then overwrites the other.

Conditional updates build on this idea. A call such as findOneAndUpdate with a filter on the current state, for example { status: 'pending' }, applies only if the document still matches. This gives a compare-and-set that prevents two workers from claiming the same job.

When one logical operation must change several documents or collections, for example moving money between two accounts, a multi-document transaction provides all-or-nothing behaviour. In Mongoose this uses a session, and either every write inside withTransaction commits or all of them are rolled back. Transactions require a replica set or a sharded cluster, so they do not work on a standalone local mongod unless it is started as a single-node replica set. MongoDB Atlas clusters are replica sets already.

Transactions have costs. They hold locks, add latency, and are limited by default to 60 seconds of run time. They should be short and used only when atomicity across documents is truly required, rather than as a default for every write.

An idempotent operation, such as an upsert keyed by a unique field, is another way to stay safe when a request may be retried after a network failure.
