# Layered Backend Architecture

As a backend grows, putting everything in route handlers becomes hard to test and change. A layered design splits responsibilities so each part has one reason to change.

The route layer maps URLs and methods to controller functions. A controller deals with HTTP: it reads parameters and the body, calls the service layer and turns the result or an error into a status code and JSON. It contains no business rules and no database queries.

The service layer holds the business logic. A function such as enrollStudent decides whether a student may enroll, applies pricing rules and coordinates several steps, without knowing anything about requests or responses. Because it takes plain arguments and returns plain values, it can be unit tested without starting a server.

The data access layer, sometimes called repositories, wraps the database. Services call functions such as findCourseById instead of using the database driver directly, so changing a query or even the database technology touches one place. In a small Mongoose application the models themselves often serve this role.

Dependencies should point inward: controllers know services, services know repositories, and nothing below knows what is above it. Passing dependencies in as parameters, called dependency injection, lets tests substitute fakes without special libraries.

Cross-cutting concerns such as authentication, validation, logging and error formatting belong in middleware so they apply uniformly. Validation of the request shape happens at the edge, before the controller runs, while rules about the domain are checked in the service.

Layers add indirection, so a tiny project does not need all of them. Introduce a layer when a file starts mixing concerns or becomes difficult to test.
