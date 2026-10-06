# Routing in Express

A route in Express pairs an HTTP method and a path pattern with a handler function. A call such as app.get('/courses', listCourses) runs listCourses for every GET request to /courses. The methods get, post, put, patch and delete correspond to the HTTP verbs, and app.all matches every method.

Path parameters capture parts of the URL. In the pattern /courses/:courseId/lessons/:lessonId, the values are available as req.params.courseId and req.params.lessonId. Parameters are always strings, so convert them to numbers or ObjectIds yourself before using them. Query strings such as ?category=web are parsed into req.query.

Routes are tested in the order they are declared, and the first match wins. A catch-all pattern such as /courses/:id declared before a more specific path like /courses/featured will swallow the specific request, so more specific routes belong first.

An express.Router groups related routes into a small modular application that is mounted under a prefix with app.use('/api/courses', courseRouter). Routers keep a large codebase organised by feature, and a router created with mergeParams: true can read the parameters of the path it was mounted under.

To respond, a handler calls res.json to send JSON, res.status to set the code, res.send for general bodies, res.redirect for redirects and res.sendFile for static files. Calling more than one of these for the same request raises an error saying headers were already sent.

A final route registered after all others, written as app.use with no path, acts as the not-found handler and returns a 404 response for any URL that nothing else matched.
