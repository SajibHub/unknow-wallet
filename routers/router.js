import express from "express";
import { createAccount, Referral } from "../controllers/userController.js";

const router = express.Router();

router.post("/create/account", createAccount)
router.post("/referral", Referral)

export default router;