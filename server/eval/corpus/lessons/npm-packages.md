# npm and package.json

The package.json file describes a Node.js project: its name, version, scripts and dependencies. Running npm install reads it, downloads the listed packages into node_modules and records the exact versions chosen in package-lock.json. The lock file should be committed so that every machine and every deployment installs identical versions.

Dependencies are split into two groups. The dependencies field lists packages needed at runtime, such as express. The devDependencies field lists tools used only while developing, such as nodemon or a linter. Installing with the omit dev option, which is common in production builds, skips the second group and keeps the image smaller.

Versions follow semantic versioning, written major.minor.patch. A patch release fixes bugs, a minor release adds features without breaking anything, and a major release may break compatibility. The caret range ^4.17.1 accepts any compatible version below 5.0.0, while the tilde range ~4.17.1 accepts only patch updates. An exact version has no prefix.

The scripts field defines commands that run with npm run. Names like start and test have shortcuts and can be run as npm start and npm test. A script can call locally installed tools without a global install because npm adds node_modules/.bin to the path while it runs.

The npx command downloads and runs a package once without adding it to the project. The npm ci command installs strictly from the lock file and fails if it disagrees with package.json, which makes it the right choice for automated builds.

Running npm audit lists known vulnerabilities in the dependency tree, and npm outdated shows packages with newer versions available.
