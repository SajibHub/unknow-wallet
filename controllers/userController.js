import { response } from "express";
import User from "../models/userModel.js";

export const createAccount = async (req, res) => {
    try {
        const { id } = req.body;
        
        if(!id) {
            return res.status(400).json({
                message: "ID is required."
            });
        }

        const findUser = await User.findOne({ id })
        if (findUser) {
            return res.status(200).json({
                message: " account already exists."
            })
        }
        const createUser = await User.create({
            id
        })

        if (!createUser) {
            return res.status(400).json({
                message: "Failed to create account. Please try again."
            })
        }

        return res.status(201).json({
            message: " account successfully created."
        })
    } catch (error) {
        return res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
}

export const Referral = async (req, res) => {
    try {
        const { userId, referralUserId } = req.body;

        if (!userId || !referralUserId) {
            return res.status(400).json({
                message: "All Fields are required",
            });
        }

        if (referralUserId == "") {
            return res.status(400).json({
                message: "Referral ID cannot be empty",
            });
        }

        if (userId == referralUserId) {
            return res.status(400).json({
                message: "You can't refer to yourself",
            });
        }

        const findReferral = await User.findOne({ userId }).select("_id id")

        if (!findReferral) {
            return res.status(404).json({
                message: "Referral user not found."
            })
        }

        const findReferralUser = await User.findOne({ referralUserId }).select("_id id")

        if (findReferralUser) {
            return res.status(400).json({
                message: "This user has already been referred."
            })
        }

        const referral = await Referral.create({
            userId,
            referralUserId
        })

        if (!referral) {
            return res.status(400).json({
                message: "Failed to process referral. Please try again."
            })
        }

        await User.findOneAndUpdate({ id: userId },
            { $inc: { balance: 100 } },
            { new: true }
        )

        await User.findOneAndUpdate({ id: referralUserId },
            { $inc: { balance: 50 } },
            { new: true }
        )

        return res.status(201).json({
            message: "Referral successfully.",
        })

    } catch (error) {
        return res.status(500).json({
            message: "An error occurred while processing your request.",
        })
    }
}