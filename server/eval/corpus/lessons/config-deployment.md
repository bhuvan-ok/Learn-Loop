# Configuration and Deployment

The twelve-factor approach says an application should read its configuration from the environment rather than from files committed alongside the code. Database URLs, API keys and feature flags differ between development, staging and production, so they are supplied as environment variables. In Node.js they are read from process.env, and a package such as dotenv loads a local .env file during development. The .env file itself must be listed in .gitignore, and a committed .env.example documents which variables are expected.

Fail fast on missing configuration. Validating required variables at startup and exiting with a clear message is far better than discovering a missing JWT secret when the first user tries to log in.

A health check endpoint, conventionally GET /health, returns 200 when the service can do its job. Load balancers and orchestrators call it to decide whether to route traffic to an instance. A liveness check only says the process is running, while a readiness check also confirms that dependencies such as the database are reachable, so an instance that cannot serve requests is taken out of rotation without being killed.

Docker packages an application and its dependencies into an image, which is a read-only template. A container is a running instance of an image. A Dockerfile lists the steps to build the image, and copying package.json and installing dependencies before copying the source lets Docker reuse its cached layer when only the code changed. A .dockerignore file keeps node_modules and secrets out of the build context.

Run Node.js in production with NODE_ENV set to production, which makes Express and many libraries skip development-only work. Use a process manager or an orchestrator to restart the process if it crashes, and send logs to standard output so the platform can collect them.

Zero-downtime deployment is achieved with rolling updates, where new instances start and pass the readiness check before old instances are stopped. Database migrations should be backward compatible so that old and new code can run against the same schema during the rollout.
