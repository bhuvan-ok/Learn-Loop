# DOM Events

When a user clicks, types or scrolls, the browser creates an event object and delivers it to the element involved. Code reacts by registering a listener with addEventListener, giving the event type and a function. The listener receives the event, whose target property is the element that triggered it and whose currentTarget is the element the listener is attached to.

Events travel in three phases. In the capturing phase the event moves down from the window to the target element. At the target it fires the listeners there. In the bubbling phase it travels back up through each ancestor. Listeners run during the bubbling phase by default, and passing true or the capture option as the third argument to addEventListener makes a listener run during capturing instead. A call to stopPropagation halts the event from reaching further elements.

Event delegation uses bubbling to handle many children with one listener. Instead of attaching a click handler to every item in a long list, attach one to the list and check event.target to see which item was clicked. This uses less memory and automatically covers items that are added later.

The method preventDefault cancels the browser's built-in behaviour for an event, such as following a link or submitting a form, without stopping the event from propagating. The two calls are independent and are often confused.

Listeners can be removed with removeEventListener, which needs the same function reference that was added, so an inline anonymous function cannot be removed. The once option removes a listener automatically after it has run a single time.

Passive listeners, enabled with the passive option, promise never to call preventDefault, which lets the browser keep scrolling smooth on touch and wheel events.
