import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

console.log("URI: ", process.env.MONGO_URI);
mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
})
    .then(() => {
        console.log("SUCCESSFULLY CONNECTED TO ATLAS");
        process.exit(0);
    })
    .catch(err => {
        console.error("FAILED", err.message);
        process.exit(1);
    });
