import bcrypt from "bcrypt"

import User from "../models/userModel.js";
import Referral from "../models/referralModel.js";

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

        const findReferralUser = await Referral.findOne({ referralUserId }).select("_id id")
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
        console.log(error)
        return res.status(500).json({
            message: "An error occurred while processing your request.",
        })
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

        if(newPin.length !== 6) {
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

        if(oldPin.length !== 6) {
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

        if(!changePin) {
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