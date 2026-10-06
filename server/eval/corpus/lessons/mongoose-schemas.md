# Mongoose Schemas and Validation

Mongoose adds structure to MongoDB by describing each collection with a schema. A schema lists the fields, their types and their rules, and a model compiled from it provides methods to create, query and update documents. MongoDB itself does not require documents to share a shape, so the schema is where the application enforces one.

Common field types are String, Number, Date, Boolean, ObjectId, arrays and nested objects. Each field can carry options such as required, default, unique, min, max, enum, trim and lowercase. The required option rejects a document that omits the field, and enum limits a string to a fixed set of values.

Validation runs when a document is saved. A failure produces a ValidationError listing each field that broke a rule, which an API normally turns into a 400 response. Custom validators are plain functions on the field, and the message can be supplied alongside them. Validators do not run on update queries such as findByIdAndUpdate unless the runValidators option is switched on.

The timestamps option adds createdAt and updatedAt fields and keeps them current automatically. Virtuals are computed properties that are not stored, such as a fullName built from first and last name. Schema methods and statics attach reusable behaviour to documents and to the model.

A pre save hook runs before a document is stored and is the usual place to hash a password. Hooks must call next or return a promise, and an error thrown inside one aborts the save.

The unique option is not a validator. It asks MongoDB to build a unique index, so a duplicate insert fails with an error code of 11000 that must be translated into a friendly message.
