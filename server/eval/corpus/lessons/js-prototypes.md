# Prototypes and Inheritance

JavaScript objects inherit through prototypes rather than classes. Every object has an internal link to another object called its prototype. When you read a property, the engine looks on the object itself first, then on its prototype, then on the prototype's prototype, and so on until it reaches null. This sequence of links is the prototype chain.

Assigning a property always writes to the object itself and never to the prototype, so an object can shadow an inherited property without changing it for other objects. The hasOwnProperty method tells you whether a property lives on the object itself or is inherited.

Functions called with new use their prototype property as the prototype of the objects they create. Methods placed on that shared prototype exist only once in memory, whereas methods created inside the constructor are duplicated for every instance.

The class keyword introduced in ES2015 is syntax sugar over this same mechanism. A class declaration creates a constructor function and puts its methods on the prototype. The extends keyword links the prototype of the child class to the prototype of the parent class, and super calls the parent constructor or its methods.

Object.create(proto) creates a new object whose prototype is proto, which is the most direct way to set up inheritance without constructors. Object.getPrototypeOf reads an object's prototype and is preferred over the older __proto__ accessor. Changing the prototype of an existing object with Object.setPrototypeOf is slow and discouraged.
