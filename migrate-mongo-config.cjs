// migrate-mongo-config.cjs — T-018 C5. CommonJS (repo package.json is "type": "module";
// migrate-mongo's CLI loads this file directly with require(), so it must stay .cjs).
// MONGODB_URL / MONGODB_DB come from .env (see .env.example) — never hard-coded here.
require("dotenv/config");

const url = process.env.MONGODB_URL || "mongodb://localhost:27017";
const databaseName = process.env.MONGODB_DB || "lkb";

module.exports = {
  mongodb: {
    url,
    databaseName,
    options: {
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
    },
  },
  migrationsDir: "migrations",
  changelogCollectionName: "migrations_changelog",
  migrationFileExtension: ".js",
  useFileHash: false,
  moduleSystem: "commonjs",
};
