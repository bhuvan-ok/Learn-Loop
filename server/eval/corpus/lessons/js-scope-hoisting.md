# Scope and Hoisting

## var, let and const

Variables declared with var are function scoped, meaning they are visible throughout the whole function that contains them, ignoring blocks such as if statements and loops. Variables declared with let and const are block scoped and only exist inside the nearest pair of curly braces. A const binding cannot be reassigned, but if it holds an object, the object's contents can still change.

## Hoisting

Before running code, the engine processes declarations, which makes them appear to move to the top of their scope. A var variable is hoisted and initialised to undefined, so reading it before its assignment gives undefined rather than an error. Function declarations are hoisted completely, so you can call them before the line where they are written.

## The temporal dead zone

Let and const declarations are also hoisted, but they are not initialised until execution reaches the declaration. The period between entering the scope and reaching that line is called the temporal dead zone, and reading the variable during it throws a ReferenceError. This makes a mistake that var would silently tolerate fail loudly instead.

## Function expressions are not hoisted like declarations

When a function is assigned to a variable, only the variable follows the variable's hoisting rules. With var, the name exists but holds undefined, so calling it early throws a TypeError. With let or const it throws a ReferenceError instead.

## Redeclaration

Declaring the same name twice with var in one scope is allowed and silently reuses the variable. Doing the same with let or const is a SyntaxError, which catches accidental name clashes.
