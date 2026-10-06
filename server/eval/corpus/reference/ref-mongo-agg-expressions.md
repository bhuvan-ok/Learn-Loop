# MongoDB Aggregation Expression Operators

## String and date

- `$concat`: Joins several strings into one.
- `$toUpper`: Converts a string to upper case.
- `$toLower`: Converts a string to lower case.
- `$trim`: Removes whitespace or chosen characters from both ends of a string.
- `$split`: Splits a string into an array of substrings around a delimiter.
- `$substrCP`: Returns part of a string measured in Unicode code points.
- `$indexOfBytes`: Returns the byte position of the first occurrence of a substring, or minus one.
- `$regexMatch`: Tests whether a string matches a regular expression and returns true or false.
- `$dateToString`: Converts a date into a formatted string.
- `$dateFromString`: Converts a date string into a date object.
- `$dateAdd`: Adds a number of time units to a date.
- `$dateDiff`: Returns the difference between two dates in a chosen unit.
- `$dateTrunc`: Truncates a date down to the start of a chosen unit such as the hour or the month.

## Conditional and array

- `$cond`: Evaluates a condition and returns one of two expressions, like a ternary operator.
- `$ifNull`: Returns a replacement value when an expression evaluates to null or is missing.
- `$switch`: Evaluates a list of case expressions and returns the result of the first that matches.
- `$arrayElemAt`: Returns the element at a given index of an array.
- `$filter`: Returns a subset of an array containing only elements that satisfy a condition.
- `$map`: Applies an expression to every element of an array and returns the results.
- `$reduce`: Combines the elements of an array into a single value using an expression.
- `$concatArrays`: Joins several arrays into one.
- `$arrayToObject`: Converts an array of key and value pairs into a document.
- `$objectToArray`: Converts a document into an array of key and value pairs.
- `$zip`: Merges arrays by combining the elements at each position into new arrays.
- `$isArray`: Returns true when its argument is an array.

## Arithmetic and accumulators

- `$round`: Rounds a number to a given number of decimal places.
- `$ceil`: Returns the smallest integer greater than or equal to a number.
- `$floor`: Returns the largest integer less than or equal to a number.
- `$abs`: Returns the absolute value of a number.
- `$pow`: Raises a number to the given exponent.
- `$sqrt`: Calculates the square root of a number.
- `$multiply`: Multiplies numbers together.
- `$divide`: Divides one number by another.
- `$subtract`: Subtracts one number or date from another.
- `$first`: Returns the first value in a group of documents.
- `$last`: Returns the last value in a group of documents.
- `$stdDevPop`: Calculates the population standard deviation of numeric values.
- `$stdDevSamp`: Calculates the sample standard deviation of numeric values.
- `$addToSet`: Collects the unique values of a field in a group into an array.
