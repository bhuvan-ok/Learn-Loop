# MongoDB Query Operators

The find method accepts a filter document that describes which documents to return. A plain field and value pair means equality, so { status: 'published' } matches published documents. Comparison operators extend this: $gt, $gte, $lt and $lte compare values, $ne matches anything different, and $in matches any value from a list while $nin excludes a list.

Conditions are combined with logical operators. A filter with several fields is an implicit AND. The $or operator takes an array of alternative filters, $and makes the combination explicit, $nor matches documents that fail every condition, and $not inverts a single operator.

The $exists operator tests whether a field is present, and $type tests its BSON type. For text, $regex matches a pattern, and a case-insensitive search is possible with the i option, although a regular expression that does not start with a fixed prefix cannot use an index efficiently.

Arrays have their own operators. Matching a value against an array field succeeds if any element equals it. The $all operator requires every listed value to be present, $size matches an exact array length and $elemMatch requires a single element to satisfy several conditions at once, which a plain filter on the field cannot express.

A projection, passed as the second argument, chooses which fields to return. A value of 1 includes a field and 0 excludes it, and the two styles cannot be mixed except for the _id field. Returning only needed fields reduces the amount of data sent over the network.

Cursors support sort, limit and chained modifiers, and the countDocuments method counts matches using the same filter syntax.
