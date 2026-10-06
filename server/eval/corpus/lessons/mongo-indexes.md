# MongoDB Indexes

## Why indexes matter

Without an index, MongoDB answers a query by scanning every document in the collection, which is called a collection scan. An index is a sorted structure over one or more fields, stored as a B-tree, that lets the database jump straight to the matching documents. Indexes speed up reads but slow down writes slightly and use memory and disk, because every insert and update must also maintain them.

## Single-field and compound indexes

A single-field index covers one field. A compound index covers several fields in a defined order, for example createIndex({ course: 1, order: 1 }). Field order is critical because the index can only be used for queries on a leftmost prefix of its fields. An index on { course: 1, order: 1 } supports queries on course alone and on course plus order, but not on order alone.

```js
db.lessons.createIndex({ course: 1, order: 1 });
db.lessons.find({ course: id }).sort({ order: 1 });
```

## The ESR rule

When designing a compound index, order the fields as Equality, then Sort, then Range. Fields tested with equality come first, fields used for sorting come next so the index can return documents already in order, and range conditions such as $gt or $in come last. Putting the range field before the sort field forces MongoDB to sort in memory.

## Unique, TTL and partial indexes

A unique index rejects duplicate values, which is how an email address or a student and course pair can be made unique. A TTL index automatically deletes documents a set number of seconds after a date field, which suits sessions and temporary tokens. A partial index only includes documents that match a filter, which keeps it small.

## Covered queries

If an index contains every field a query needs, including the fields returned in the projection, MongoDB can answer from the index alone without reading any documents, which is the fastest possible plan.

## Verifying with explain

The explain method shows the query plan. A stage of COLLSCAN means a full scan, while IXSCAN means an index was used. Comparing totalDocsExamined with nReturned shows how selective the index is.
