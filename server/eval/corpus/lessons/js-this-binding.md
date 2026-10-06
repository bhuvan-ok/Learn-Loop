# How this Works

The value of this in a regular function is decided by how the function is called, not by where it is written. Called as a method, as in user.greet(), this is the object before the dot. Called as a bare function, this is undefined in strict mode and the global object in sloppy mode. Called with new, this is the freshly created object.

A frequent bug is passing a method as a callback. Writing setTimeout(user.greet, 100) hands over the function without its object, so inside greet the value of this is no longer user. The usual fixes are to wrap the call in an arrow function or to bind the method.

The methods call, apply and bind let you set this explicitly. Both call and apply invoke the function immediately; call takes arguments one by one and apply takes them as an array. Bind does not call the function at all. It returns a new function with this permanently fixed, and a bound function cannot be rebound later.

Arrow functions do not have their own this. They capture this lexically from the surrounding scope at the moment they are created, which makes them ideal for callbacks inside methods. For the same reason an arrow function cannot be used as a constructor, and call, apply and bind cannot change its this.

In a class, methods are defined on the prototype and lose their this when detached from the instance. A common remedy is to define the method as a class field that holds an arrow function, so each instance gets its own correctly bound copy.
