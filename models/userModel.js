import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    balance: {
        type: Number,
        default: 0
    },
    pin: {
        type: String,
        default: null
    },
    status: {
        type: Boolean,
        default: true
    }
}, { timestamps: true, versionKey: false })

const User = mongoose.model("users", userSchema)

export default User;