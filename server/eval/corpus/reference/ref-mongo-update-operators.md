# MongoDB Update Operators

Update operators modify fields in place instead of replacing the whole document.

## Field operators

- `$set`: Replaces the value of a field with the given value, creating the field if it is missing.
- `$unset`: Removes the named fields from a document.
- `$mul`: Multiplies the value of a field by a number.
- `$min`: Updates a field only if the given value is less than the current value.
- `$max`: Updates a field only if the given value is greater than the current value.
- `$rename`: Renames a field to a new name.
- `$currentDate`: Sets a field to the current date, either as a Date or as a timestamp.
- `$setOnInsert`: Sets fields only when an upsert ends up inserting a new document.
- `$bit`: Performs a bitwise AND, OR or XOR update of an integer field.

## Array operators

- `$pop`: Removes the first or last element of an array.
- `$pull`: Removes every array element that matches a given condition.
- `$pullAll`: Removes all array elements that equal any value in a list.
- `$each`: A modifier that lets push or addToSet add several elements in one operation.
- `$position`: A modifier that tells push where in the array to insert the new elements.
- `$slice`: A modifier that trims an array to a fixed size after a push.
- `$sort`: A modifier that orders the elements of an array after a push.
- `$`: The positional operator, which updates the first array element that matched the query condition.
- `$[]`: The all-positional operator, which updates every element of an array.
- `$[identifier]`: The filtered positional operator, which updates only elements matching an array filter.
