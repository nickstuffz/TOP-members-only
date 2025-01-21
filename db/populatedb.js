#! /usr/bin/env node

require("dotenv").config();

const { Client } = require("pg");

const SQL = `
DROP TABLE IF EXISTS users;

CREATE TABLE users (
   id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
   username VARCHAR ( 255 ) NOT NULL,
   password VARCHAR ( 255 ) NOT NULL
);

CREATE UNIQUE INDEX username_lower_idx ON users (LOWER(username));
`;

async function main() {
  console.log("seeding...");
  const client = new Client({
    connectionString: `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
  });
  await client.connect();
  await client.query(SQL);
  await client.end();
  console.log("done");
}

main();
