# Working with Arrays

JavaScript arrays have a family of methods for transforming data without writing manual loops. The map method returns a new array in which every element has been replaced by the result of a function. The filter method returns a new array containing only the elements for which a function returns a truthy value. The reduce method folds an array down to a single value by repeatedly combining an accumulator with each element, and it accepts an initial value as its second argument. Omitting that initial value makes reduce use the first element instead, and it throws an error on an empty array.

The methods find and findIndex return the first matching element or its position, while some and every answer whether at least one or all elements pass a test. The includes method checks for a value, using strict equality.

Methods differ in whether they change the original array. The methods map, filter, slice and concat leave it untouched. The methods push, pop, shift, unshift, splice, sort and reverse modify it in place. Calling sort without a comparison function converts elements to strings, so [10, 9, 1].sort() gives [1, 10, 9]. A numeric sort needs a comparator such as (a, b) => a - b.

For looping, for...of walks the values of any iterable and works with break and continue. The forEach method cannot be stopped early and ignores the return value of async callbacks, so awaiting inside forEach does not pause the loop. The for...in loop walks property names, including inherited ones, and should not be used on arrays.

The spread operator makes a shallow copy of an array. Nested arrays and objects are still shared between the original and the copy.
