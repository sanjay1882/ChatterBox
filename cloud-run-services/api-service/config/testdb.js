import connectDB, { disconnectDB } from "./db.js";

beforeAll(async () => {
    process.env.NODE_ENV = "test"; // Triggers in-memory MongoDB
    await connectDB();
});

afterAll(async () => {
    await disconnectDB(); // Cleans up in-memory instance
});