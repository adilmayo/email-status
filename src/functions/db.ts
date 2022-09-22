"use strict";

// Import dependency.
import { MongoClient } from "mongodb";


const mongoClusterName: string = "";
const mongoUser: string = "";
const mongoDbName: string = "";
const mongoPass: string = "";

// Connection string to the database
const uri: string = `mongodb+srv://${mongoUser}:${mongoPass}@${mongoClusterName}.xaaoc.mongodb.net/${mongoDbName}?retryWrites=true`;

// Validate that the database connection string has been configured.
if (!uri) {
  throw new Error(
    "The MONGODB_URI environment variable must be configured with the connection string " +
    "to the database."
  );
}

// Cached connection promise
let cachedPromise = null;


module.exports.connectToDatabase = async function connectToDatabase() {
  if (!cachedPromise) {

    cachedPromise = MongoClient.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  }


  const client = await cachedPromise;

  return client;
};
