# The MongoDB Aggregation Pipeline

## Stages

An aggregation pipeline passes documents through an ordered list of stages, and each stage transforms the stream it receives. It is the tool for grouping, joining and reshaping data on the server instead of in application code.

```js
db.orders.aggregate([
  { $match: { status: 'paid' } },
  { $group: { _id: '$customerId', total: { $sum: '$amount' } } },
  { $sort: { total: -1 } },
  { $limit: 5 },
]);
```

## Core stages

The $match stage filters documents like a find query. The $group stage collects documents by a key and computes accumulators such as $sum, $avg, $min, $max and $push. The $project stage chooses or computes the fields to keep. The $sort stage orders documents, and $limit and $skip trim the result. The $unwind stage turns each element of an array field into its own document.

## Joining with $lookup

The $lookup stage performs a left outer join against another collection. It matches a local field to a foreign field and adds the matching documents as an array. Joins are slower than reading embedded data, so $lookup is best used for reporting rather than on a hot path, and the foreign field should be indexed.

## Put $match early

A $match at the start of the pipeline can use an index and shrinks the data every later stage must process. Placing a $match after a $group usually means the whole collection was grouped first. The query optimiser can sometimes reorder stages, but you should write them in an efficient order anyway.

## Memory limits

Blocking stages like $group and $sort in the pipeline are limited to 100 megabytes of RAM each by default. Passing allowDiskUse: true lets them spill to temporary files on disk for larger inputs.

## Counting

The $count stage returns the number of documents that reach it. A simple total over a whole collection is faster with countDocuments or estimatedDocumentCount than with a pipeline.
