# Closures in JavaScript

A closure is a function bundled together with a reference to the environment in which it was created. In practice this means an inner function can keep reading and updating the variables of an outer function even after the outer function has finished running. The variables are not copied; the inner function holds a live link to them.

Closures are the standard way to get private state in JavaScript. A factory function declares a local variable, then returns functions that use it. Code outside the factory cannot touch the variable directly and can only go through the returned functions. A counter built this way exposes increment and read operations while the count itself stays hidden.

Closures also power partial application and function factories. A function such as makeMultiplier(factor) returns a new function that remembers factor, so makeMultiplier(3) produces a function that always multiplies by three.

A classic pitfall appears when a closure is created inside a loop that uses var. Every callback created in the loop shares the same single loop variable, so by the time the callbacks run the variable already holds its final value. Declaring the loop variable with let fixes the problem because let creates a fresh binding for every iteration of the loop.

Closures keep their captured variables alive for as long as the closure itself is reachable. A long-lived closure that captures a large object can therefore prevent that object from being garbage collected, which is a common source of memory leaks in event handlers that are never removed.
