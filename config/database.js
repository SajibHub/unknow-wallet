import mongoose from "mongoose";

const database = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("Database connection established");
  } catch (error) {
    console.log("Database connection failed");
  }
};

export default database;