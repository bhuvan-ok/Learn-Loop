# REST API Design Basics

## Resources and URLs

REST models an API around resources, which are nouns identified by URLs such as /courses/42/lessons. The action is expressed by the HTTP method instead of being encoded in the path, so prefer DELETE /courses/42 over /deleteCourse?id=42. Collections use plural nouns and nested paths show ownership.

## Methods and what they mean

GET reads a resource and must have no side effects. POST creates a new resource under a collection, or triggers a process that does not fit another method. PUT replaces a resource completely with the representation in the request body. PATCH applies a partial update and changes only the fields that were sent. DELETE removes a resource.

## Safe and idempotent methods

A method is safe if it does not change server state, which applies to GET and HEAD. A method is idempotent if repeating the identical request leaves the server in the same state as sending it once. GET, PUT and DELETE are idempotent, while POST is not, so retrying a failed POST may create a duplicate. PATCH is not guaranteed to be idempotent, because an operation such as incrementing a counter changes the result every time it is applied.

## Statelessness

Every request must carry all the information the server needs to process it, because the server keeps no client session between requests. Statelessness lets any server instance handle any request, which is what makes horizontal scaling straightforward.

## Pagination and filtering

Large collections should be paginated and should accept filtering through query parameters such as ?status=published&limit=20. Returning the total count and a link to the next page lets clients iterate without guessing.
