# Destructuring, Spread and Rest

Destructuring pulls values out of arrays and objects into separate variables. Object destructuring matches by property name, as in const { title, order } = lesson. Array destructuring matches by position, as in const [first, second] = list. A name can be changed with a colon, written { title: heading }, and a default used when the value is undefined can be added with an equals sign, written { order = 0 }. Nested patterns reach into nested structures, such as { author: { name } }.

Destructuring is common in function parameters. A function declared as function create({ title, content, order = 0 }) takes a single options object, which is easier to read at the call site than a long list of positional arguments and makes optional values simple to skip.

The three dots have two roles depending on where they appear. In a function parameter list they are the rest syntax, and they gather the remaining arguments into a real array. In a call, an array literal or an object literal they are the spread syntax, and they expand an iterable or an object in place.

Spread is the idiomatic way to copy or merge. { ...defaults, ...overrides } creates a new object in which later properties win, and [...a, ...b] concatenates two arrays. Both copies are shallow, so nested objects stay shared with the original. Spread also converts any iterable, such as a Set, into an array with [...mySet].

Default parameter values apply only when an argument is undefined. Passing null or an empty string does not trigger the default, which surprises many developers.

Optional chaining, written user?.profile?.email, stops and returns undefined when a link in the chain is null or undefined instead of throwing. The nullish coalescing operator ?? supplies a fallback only for null or undefined, unlike || which also replaces 0 and empty strings.
