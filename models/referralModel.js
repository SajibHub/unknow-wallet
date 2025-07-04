import mongoose from "mongoose";

const ReferralSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    referralUserId: {
        type: String,
        required: true,
        unique: true
    }
}, { timestamps: true, versionKey: false })

const Referral = mongoose.model("referrals", ReferralSchema);
export default Referral;