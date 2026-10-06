# API Versioning and Documentation

Public APIs change, and clients that cannot update immediately must keep working. Versioning lets a provider release incompatible changes without breaking existing integrations. A change is breaking if it removes or renames a field, changes a type, or alters the meaning of a response. Adding an optional field or a new endpoint is usually safe.

There are three common places to put the version. A URL prefix such as /api/v2/courses is the simplest and the easiest to see in logs and browsers. A custom request header or a version parameter in the Accept media type keeps URLs clean but is harder to test casually. Query parameters such as ?version=2 are rarely recommended. Whatever the choice, it should be consistent across the whole API.

Retiring an old version needs a deprecation policy. Announce the end date well ahead, return a Deprecation or Sunset header on responses from the old version, and track which clients still call it before switching it off.

Good documentation is part of the product. The OpenAPI specification describes endpoints, parameters, request bodies and responses in a machine-readable YAML or JSON file. Tools can render it as interactive documentation, generate client libraries in several languages and validate requests against it. Keeping the specification in the repository next to the code, and checking it in continuous integration, stops it drifting out of date.

Every endpoint should document its authentication requirement, its error responses and an example request and response. Consistent error bodies, containing a code, a message and optionally a field name, let client developers handle problems without reading the server source.

A changelog that lists additions, deprecations and removals per release is the quickest way for integrators to see what affects them.
