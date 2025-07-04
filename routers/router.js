import express from "express";
import { Balance, changePin, createAccount, findPinNumber, ReferralUser } from "../controllers/userController.js";

const router = express.Router();

router.post("/create/account", createAccount)
router.post("/referral", ReferralUser)
router.get("/check/balance/:id", Balance)
router.get("/check/pin/:id", findPinNumber)
router.put("/pin/change/", changePin)

export default router;