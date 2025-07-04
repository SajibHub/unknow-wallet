import bcrypt from "bcrypt"

import User from "../models/userModel.js";
import Referral from "../models/referralModel.js";
import mongoose from "mongoose";
import Transaction from "../models/transactionsModel.js";


export const createAccount = async (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
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

export const ReferralUser = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
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

        const findReferral = await User.findOne({ id: userId }).select("_id id")

        if (!findReferral) {
            return res.status(404).json({
                message: "Referral user not found."
            })
        }

        const ReferralUser = await User.findOne({ id: referralUserId }).select("_id id");

        const findReferralUser = await Referral.findOne({ referralUserId }).select("_id id")
        if (findReferralUser) {
            return res.status(400).json({
                message: "This user has already been referred."
            })
        }

        const referral = await Referral.create([{
            userId,
            referralUserId
        }], { session });

        if (!referral) {
            return res.status(400).json({
                message: "Failed to process referral. Please try again."
            })
        }


        for (const id of [userId, referralUserId]) {
            await User.findOneAndUpdate({ id },
                { $inc: { balance: 50 } },
                { new: true, session }
            )
        }

        const findOwner = await User.findOne({ id: process.env.OWNER_TELEGRAM_ID }).select("_id id");

        if (!findOwner) {
            return res.status(404).json({
                message: "Owner not found."
            });
        }

        for (const id of [findReferral._id, ReferralUser._id]) {
            await Transaction.create([{
                sender: findOwner._id,
                receiver: id,
                amount: 50,
                transactionType: "referral_bonus"
            }], { session })
        }

        session.commitTransaction();
        return res.status(201).json({
            message: "Referral successfully.",
        })

    } catch (error) {
        console.log(error)
        session.abortTransaction();
        return res.status(500).json({
            message: "An error occurred while processing your request.",
        })
    } finally {
        session.endSession();
    }
}

export const Balance = async (req, res) => {
    try {
        const { id } = req.params;


        const findBalance = await User.findOne({ id }).select("balance");

        if (!findBalance) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        return res.status(200).json({
            balance: findBalance.balance
        });
    } catch (error) {
        return res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
}

export const findPinNumber = async (req, res) => {
    try {
        const { id } = req.params;

        const findPin = await User.findOne({ id }).select("pin");
        if (!findPin) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        if (!findPin.pin) {
            return res.status(200).json({
                pin: "new"
            });
        }

        return res.status(200).json({
            pin: "old"
        });
    } catch (error) {
        return res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
}

export const changePin = async (req, res) => {
    try {
        const { id, change, oldPin, newPin } = req.body;
        if (!id) {
            return res.status(400).json({
                message: "ID and change fields are required."
            });
        }

        if (newPin.length !== 6) {
            return res.status(400).json({
                message: "New PIN must be exactly 6 digits long."
            });
        }

        if (change == false) {
            if (!newPin) {
                return res.status(400).json({
                    message: "New PIN is required."
                });
            }
            const setNewPin = await User.findOneAndUpdate({ id },
                { pin: await bcrypt.hash(newPin, 10) },
                { new: true }
            );
            if (!setNewPin) {
                return res.status(400).json({
                    message: "Failed to set new PIN. Please try again."
                });
            }

            return res.status(200).json({
                message: "New PIN set successfully."
            });
        }

        if (!newPin || !oldPin) {
            return res.status(400).json({
                message: "Old PIN and New PIN are required."
            });
        }

        if (oldPin.length !== 6) {
            return res.status(400).json({
                message: "Old PIN must be exactly 6 digits long."
            });
        }

        const findUser = await User.findOne({ id }).select("_id id pin")
        if (!findUser) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        const pinCompare = await bcrypt.compare(oldPin, findUser.pin);
        if (!pinCompare) {
            return res.status(400).json({
                message: "Old PIN is incorrect."
            });
        }

        const changePin = await User.findByIdAndUpdate(findUser._id, {
            pin: await bcrypt.hash(newPin, 10)
        }, { new: true });

        if (!changePin) {
            return res.status(400).json({
                message: "Failed to change PIN. Please try again."
            });
        }

        return res.status(200).json({
            message: "PIN changed successfully."
        });

    } catch (error) {
        return res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    }
}

export const sendMoney = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { senderId, receiverId, amount, pin } = req.body;
        if (!senderId || !receiverId || !amount) {
            return res.status(400).json({
                message: "All fields are required."
            });
        }

        if (amount <= 0) {
            return res.status(400).json({
                message: "Amount must be greater than zero."
            });
        }

        if (senderId === receiverId) {
            return res.status(400).json({
                message: "You cannot send money to yourself."
            });
        }

        const findSender = await User.findOne({ id: senderId }).select("_id id balance pin");
        if (!findSender) {
            return res.status(404).json({
                message: "Sender not found."
            });
        }

        const findReceiver = await User.findOne({ id: receiverId }).select("_id id balance");
        if (!findReceiver) {
            return res.status(404).json({
                message: `No account found for user ID: ${receiverId}.`
            });
        }

        if (findSender.balance < amount) {
            return res.status(400).json({
                message: "Insufficient balance."
            });
        }

        const pinCompare = await bcrypt.compare(pin, findSender.pin);

        if (!pinCompare) {
            return res.status(400).json({
                message: "Incorrect PIN. Please try aging."
            });
        }

        const updatedSender = await User.findOneAndUpdate(
            { id: senderId },
            { $inc: { balance: -amount } },
            { new: true, session }
        );

        if (!updatedSender) {
            return res.status(400).json({
                message: "Failed to update sender's balance."
            });
        }

        const updatedReceiver = await User.findOneAndUpdate(
            { id: receiverId },
            { $inc: { balance: amount } },
            { new: true, session }
        );

        if (!updatedReceiver) {
            return res.status(400).json({
                message: "Failed to update receiver's balance."
            });
        }

        const transaction = await Transaction.create([{
            sender: updatedSender._id,
            receiver: updatedReceiver._id,
            amount,
            transactionType: "send_money"
        }], { session });

        if (!transaction) {
            return res.status(400).json({
                message: "Failed to create transaction record."
            });
        }

        session.commitTransaction()
        return res.status(201).json({
            message: "SendMoney successfully.",
        });

    } catch (error) {
        session.abortTransaction();
        return res.status(500).json({
            message: "An error occurred while processing your request.",
        });
    } finally {
        session.endSession();
    }
}

export const transactionHistory = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                message: "User ID is required."
            });
        }

        const findUser = await User.findOne({ id: id.toString() }).select("_id id");

        if (!findUser) {
            return res.status(404).json({
                message: "User not found."
            });
        }
        const userIdStr = findUser._id.toString();

        const transactions = await Transaction.aggregate([
            {
                $match: {
                    $or: [
                        { sender: findUser._id },
                        { receiver: findUser._id }
                    ]
                }
            },
            { $limit: 50 },
            {
                $lookup: {
                    from: "users",
                    let: { receiverId: "$receiver" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$_id", "$$receiverId"] } } },
                        { $project: { _id: 1, id: 1 } }
                    ],
                    as: "receiver"
                }
            },
            {
                $lookup: {
                    from: "users",
                    let: { senderId: "$sender" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$_id", "$$senderId"] } } },
                        { $project: { _id: 1, id: 1 } }
                    ],
                    as: "sender"
                }
            },
            { $unwind: "$receiver" },
            { $unwind: "$sender" },
            { $sort: { createdAt: -1 } },
            {
                $project: {
                    _id: 1,
                    isSender: {
                        $eq: [userIdStr, { $toString: "$sender._id" }]
                    },
                    from: { $cond: [{ $eq: ["$transactionType", "referral_bonus"] }, "Unknow Wallet", '$sender.id'] },
                    to: "$receiver.id",
                    amount: 1,
                    transactionType: 1,
                    time: {
                        $dateToString: {
                            format: "%H:%M:%S %d-%m-%Y",
                            date: "$createdAt",
                            timezone: "Asia/Dhaka"
                        }
                    }
                }
            }
        ]);

        return res.status(200).json({ transactions });

    } catch (error) {
        console.error("Transaction history error:", error);
        return res.status(500).json({
            message: "An error occurred while processing your request.",
            error: error.message
        });
    }
};
