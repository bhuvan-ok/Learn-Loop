# Modules in Node.js

Node.js supports two module systems. CommonJS is the original one and uses require to load a module and module.exports to expose values. ES modules are the standard used by browsers and use import and export statements.

A file is treated as an ES module when its extension is .mjs or when the nearest package.json sets the type field to module. Otherwise a .js file is CommonJS. The two differ in several ways. CommonJS loads modules synchronously and lets require appear anywhere, even inside a function, while import declarations are static and are analysed before any code runs, which allows tools to remove unused exports. ES modules have top-level await, whereas CommonJS does not.

CommonJS provides the variables __dirname and __filename for the current file. In an ES module they do not exist, and the location is read from import.meta.url instead.

Node caches every module after its first load. Requiring the same path a second time returns the same exports object, which makes modules behave like singletons and is why a database connection created in one module can be shared by the whole application. Circular dependencies are possible, but the module that is required first may see a partially filled exports object from the other.

Module resolution follows the path given. A bare name such as express is searched for in node_modules directories, walking up from the current folder, while a relative path such as ./utils/ApiError starts from the current file. Core modules like fs and path are always found first.

An ES module can import a CommonJS module, and the reverse needs a dynamic import, which returns a promise.
