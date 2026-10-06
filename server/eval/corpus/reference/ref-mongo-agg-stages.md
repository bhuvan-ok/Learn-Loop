# Additional MongoDB Aggregation Stages

## Reshaping documents

- `$addFields`: Adds new computed fields to each document while keeping all existing fields.
- `$set`: An alias of addFields that adds or overwrites fields on each document.
- `$unset`: Removes fields from each document as it passes through the pipeline.
- `$replaceRoot`: Replaces each input document with a specified embedded document.
- `$replaceWith`: An alias of replaceRoot that swaps each document for the given expression.
- `$redact`: Restricts document content based on information stored in the document itself.
- `$sortByCount`: Groups documents by an expression and returns the count of each group in descending order.
- `$sample`: Randomly selects the given number of documents from its input.

## Grouping and bucketing

- `$bucket`: Groups documents into buckets defined by explicit boundary values.
- `$bucketAuto`: Groups documents into a chosen number of buckets whose boundaries are determined automatically.
- `$setWindowFields`: Performs calculations over a window of related documents, such as running totals.
- `$densify`: Creates missing documents in a sequence of numeric or date values.
- `$fill`: Populates null and missing field values using a method such as linear interpolation.

## Joining and output

- `$graphLookup`: Recursively searches a collection to follow chains of related documents, such as an organisation chart.
- `$unionWith`: Combines the results of two collections into a single stream of documents.
- `$merge`: Writes the pipeline results into a collection, inserting, replacing or merging with existing documents.
- `$out`: Writes the pipeline results to a collection, replacing it, and must be the last stage.
- `$geoNear`: Returns documents ordered by distance from a point and adds the computed distance to each.

## Metadata

- `$collStats`: Returns statistics about a collection or view.
- `$indexStats`: Returns usage statistics for each index in a collection.
- `$currentOp`: Returns information about the operations currently running on the server.
- `$listSessions`: Lists the sessions that are active on the server.
- `$planCacheStats`: Returns plan cache information for a collection.
