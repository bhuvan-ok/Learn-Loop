# Additional MongoDB Query Operators

## Evaluation and schema

- `$expr`: Allows aggregation expressions inside a query, so fields of one document can be compared with each other.
- `$jsonSchema`: Matches documents that satisfy a JSON Schema, also used for collection validation.
- `$mod`: Matches documents where a field divided by a divisor leaves a given remainder.
- `$text`: Performs a text search against a collection's text index.
- `$where`: Matches documents using a JavaScript expression evaluated on the server, which is slow and rarely advisable.
- `$comment`: Attaches a comment to a query so it can be identified in logs and profiler output.

## Geospatial

- `$geoWithin`: Matches documents whose location lies entirely inside a given shape.
- `$geoIntersects`: Matches documents whose geometry intersects a given GeoJSON object.
- `$near`: Returns documents ordered from nearest to farthest from a point, using a geospatial index.
- `$nearSphere`: Like near, but calculates distance on a sphere for geographic coordinates.
- `$box`: Defines a rectangle for a geoWithin query using legacy coordinate pairs.
- `$center`: Defines a circle on a flat plane for a geoWithin query.
- `$centerSphere`: Defines a circle on a sphere, with the radius in radians, for a geoWithin query.
- `$maxDistance`: Limits a near query to documents within a given distance of the point.

## Bitwise

- `$bitsAllSet`: Matches numbers where every bit position in the given mask is set to one.
- `$bitsAnySet`: Matches numbers where at least one bit position in the mask is set to one.
- `$bitsAllClear`: Matches numbers where every bit position in the mask is zero.
- `$bitsAnyClear`: Matches numbers where at least one bit position in the mask is zero.
