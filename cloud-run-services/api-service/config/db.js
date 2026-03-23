import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod = null;

const connectDB = async () => {
    try {
        let uri;

        if (process.env.NODE_ENV === "test") {
            // Use in-memory MongoDB for testing (no network needed)
            mongod = await MongoMemoryServer.create();
            uri = mongod.getUri();
            console.log("Test environment: Using In-Memory MongoDB...");
        } else {
            uri = process.env.MONGO_URI || "mongodb://localhost:27017/chatterbox";
            console.log("Attempting to connect to MongoDB...");
        }

        const conn = await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`);

        mongoose.connection.on("error", (err) => {
            console.error("MongoDB Connection Error after initial connection:", err);
        });

        mongoose.connection.on("disconnected", () => {
            console.warn("MongoDB disconnected. Mongoose will try to automatically reconnect.");
        });

        return conn;
    } catch (err) {
        console.error(`MongoDB Initial Connection Error: ${err.message}`);
        throw err;
    }
};

// Call this in your test teardown (afterAll)
export const disconnectDB = async () => {
    await mongoose.disconnect();
    if (mongod) {
        await mongod.stop();
        mongod = null;
    }
};

export default connectDB;