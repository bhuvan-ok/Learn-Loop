# Types and Equality in JavaScript

JavaScript has seven primitive types: string, number, boolean, undefined, null, bigint and symbol. Everything else is an object, including arrays and functions. Primitives are immutable and are compared by value, whereas objects are compared by reference, so two separate objects with identical contents are not equal.

The typeof operator reports a type as a string, with a few famous quirks. It returns "object" for null, which is a long-standing mistake in the language, and "function" for functions. Arrays also report "object", so Array.isArray is the reliable test for them.

The triple equals operator compares without conversion, so 1 === "1" is false. The double equals operator first coerces its operands to a common type, which produces surprising results such as 0 == "" being true and null == undefined being true while null == 0 is false. Most style guides require triple equals everywhere and allow double equals only to check for null or undefined together.

Values are also converted when a boolean is needed. The falsy values are false, 0, -0, 0n, the empty string, null, undefined and NaN. Everything else is truthy, including the string "0", empty arrays and empty objects.

NaN stands for not a number and is the only value that is not equal to itself, so x === NaN is always false. Number.isNaN tests for it correctly, while the older global isNaN coerces its argument first and can give misleading answers. Floating point arithmetic follows the binary standard, so 0.1 + 0.2 does not equal 0.3 exactly, and money should be stored in integer cents.

Object.is behaves like triple equals except that it treats NaN as equal to itself and distinguishes 0 from -0.
