# MongoDB Data Modeling

## Embedding versus referencing

MongoDB lets you either embed related data inside one document or store it in separate collections and reference it by ID. Embedding keeps data that is read together in a single document, so one query returns everything and no join is needed. Referencing keeps each entity in its own collection, which avoids duplication and lets the parts change independently.

## When to embed

Embed when the relationship is one-to-few, the child data is always read with its parent, and the child has no life of its own. A user's shipping addresses or the line items of an order are typical examples. Because a single document write is atomic, embedding also lets you update parent and children together without a transaction.

## When to reference

Reference when the relationship is one-to-many with a large or unbounded number of children, when the children are queried on their own, or when many parents share the same child. Comments on a popular post should be separate documents, since an embedded array could grow without limit.

## The document size limit

A single BSON document cannot exceed 16 megabytes. An embedded array that keeps growing, such as every event ever recorded for a device, will eventually hit this limit and also makes every update to the parent slower. This is the main reason unbounded arrays should be avoided.

## Denormalisation

Copying a small, rarely changing field into another document, such as storing the author's name next to each review, saves a lookup on every read. The price is that every copy must be updated when the original changes, so it suits data that is read far more often than it is written.

## Design for the queries

Unlike relational design, MongoDB schema design starts from the application's access patterns. List the queries the application runs most often and shape the documents so those queries touch as few documents as possible.
