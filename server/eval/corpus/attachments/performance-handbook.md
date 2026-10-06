# Backend Performance Handbook

This handbook collects practical techniques for keeping a database-backed API fast as traffic grows. Each section focuses on one common bottleneck and the standard remedy.

## 1. Pagination

Returning an entire collection in one response is slow and wasteful, so list endpoints must be paginated. The simplest approach is offset pagination, which uses skip and limit. It is easy to build and allows jumping to any page, but its cost grows with the offset because the database must walk past every skipped document before returning results. Asking for page 5000 of a large collection can take seconds.

Cursor pagination, also called keyset pagination, avoids that cost. The client sends the sort key of the last item it received, and the server returns the next items with a condition such as _id greater than the cursor. With an index on the sort key every page costs about the same, no matter how deep the client has scrolled. Cursor pagination also stays stable when new items are inserted while the user is paging, whereas offset pagination can show duplicates or skip items. Its drawback is that clients cannot jump straight to an arbitrary page number.

## 2. Connection pooling

Opening a new database connection for every request is expensive because each one involves a network handshake, authentication and often TLS negotiation. A connection pool keeps a set of open connections and lends them to requests. The MongoDB Node.js driver maintains a pool automatically and its maxPoolSize option defaults to 100 connections. Operations wait in a queue when all connections are busy.

A pool that is too small makes requests queue up and raises latency, while a pool that is too large can overwhelm the database server, which has its own connection limit. Create one client when the application starts and reuse it everywhere. Creating a new client inside each request handler is a classic mistake that exhausts connections quickly.

## 3. Caching with Redis

When the same expensive query is run repeatedly, store the result in an in-memory cache such as Redis. The standard pattern is cache-aside. The application first looks in Redis, and on a miss it queries the database, writes the result to Redis and returns it. Every cached entry should be given a time to live with the EXPIRE command, for example 300 seconds, so stale data eventually disappears by itself.

The hard part of caching is invalidation. When the underlying data changes, the cached copy must be deleted or updated, otherwise users see old values. A cache stampede happens when a popular key expires and many requests miss at once, all hitting the database together. Staggering expiry times with a small random jitter and allowing only one request to rebuild the entry both reduce the risk.

Redis is also commonly used to store web sessions and to hold rate limit counters shared between several server instances.

## 4. Reading query plans

Slow queries should be diagnosed rather than guessed at. In MongoDB, calling explain with the executionStats verbosity returns what the query planner chose and how much work it did. The key figures are totalKeysExamined, totalDocsExamined and nReturned. A healthy indexed query examines roughly as many keys as it returns documents. If totalDocsExamined is far larger than nReturned, the query is reading many documents to throw most of them away and probably needs a better index.

The winning plan shows the stages used. An IXSCAN followed by a FETCH reads the index and then loads each matching document, while a COLLSCAN stage means the whole collection was scanned. A SORT stage in the plan means the sort was done in memory instead of using index order, which is slow and limited to 100 megabytes by default. The slow query log and the database profiler help find which queries to examine first.

## 5. The N+1 query problem

The N+1 problem occurs when code runs one query to fetch a list of N items and then runs another query for each item to fetch related data. Listing 50 courses and then querying the tutor of each course separately makes 51 round trips instead of two. Each trip adds network latency, so the page gets slower as the list grows.

The fix is to fetch related data in bulk. In Mongoose, populate batches the lookups into a single extra query using an $in condition on the collected IDs. An aggregation with $lookup can join on the server in one round trip. Denormalising a small field such as the tutor's name into the course document removes the second query completely.

## 6. Replication and read scaling

A MongoDB replica set keeps copies of the data on several servers. One member is the primary and accepts all writes, and the others are secondaries that replicate the primary's changes. If the primary fails, the remaining members hold an election and promote a secondary, which needs a majority of voting members to agree. A set of three members tolerates the loss of one.

Reads can be spread across secondaries by setting a read preference such as secondaryPreferred, which raises read capacity. The cost is replication lag: a secondary may be a little behind, so a read just after a write can return the old value. Reads that must see the latest data should go to the primary. Replication provides availability and read scaling, but it does not increase write capacity, because every write must still be applied on the primary.
