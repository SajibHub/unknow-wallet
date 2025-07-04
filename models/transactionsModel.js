import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    transactionType: {
        type: String,
        enum: ["send_money", "referral_bonus", "withdrawal", "deposit"],
        required: true
    },
}, { timestamps: true, versionKey: false });

const Transaction = mongoose.model("Transaction", TransactionSchema);
export default Transaction;