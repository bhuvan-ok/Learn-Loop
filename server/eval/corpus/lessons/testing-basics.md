# Testing Basics

## Kinds of tests

A unit test checks one small piece of code, such as a function, in isolation and runs in milliseconds. An integration test checks that several pieces work together, for example an HTTP route talking to a real test database. An end-to-end test drives the whole application through its user interface in a real browser.

## The test pyramid

The test pyramid advises writing many fast unit tests, fewer integration tests and only a handful of end-to-end tests. Tests higher in the pyramid cover more behaviour but are slower, more brittle and harder to debug when they fail.

## Structure of a good test

Follow the Arrange, Act, Assert pattern. Arrange sets up the data and dependencies, Act runs the single behaviour under test, and Assert checks the result. A test should check one behaviour and have a name that describes it, so a failure explains itself.

## Mocks, stubs and spies

A stub returns canned answers in place of a real dependency. A mock additionally verifies how it was called. A spy wraps a real function and records its calls. Use them to isolate code from slow or unreliable collaborators such as an email service or a paid AI API. Over-mocking is a trap, because a test that replaces everything only proves that the mocks work.

## Determinism

Tests must give the same result every run. Flaky tests usually come from shared state between tests, real clocks, random values or network calls. Fix the clock, seed random generators, and give each test its own data.

## What coverage tells you

Code coverage reports which lines ran during the tests. High coverage does not prove the assertions are meaningful, but low coverage in critical code is a clear warning.

## Node's built-in runner

Node.js ships with a test runner. Tests are written with node:test and run with node --test, and assertions come from node:assert, so no extra framework is required.
