import TelegramBot from "node-telegram-bot-api";
import axios from "axios"
import dotenv from "dotenv"

dotenv.config()

const { BOT_TOKEN, API } = process.env;
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const userPinStep = {};
const userChangePinStep = {};

const telegramClient = () => {
    bot.setMyCommands([
        { command: "balance", description: "Get your balance" },
        { command: "send_money", description: "Send Money" },
        { command: "pin_setting", description: "Pin Setting" },
        { command: "referral", description: "Get your referral code" },
    ]);

    bot.onText(/\/start/, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id
        const referralCode = match.input.split(" ")[1];

        if (referralCode) {
            if (referralCode == userId) {
                bot.sendMessage(chatId, "You cannot refer yourself.");
                return;
            }
        }

        try {
            const response = await axios.post(`${API}/api/v1/create/account`,
                {
                    id: userId.toString()
                },
                {
                    headers: {
                        "Content-Type": "application/json"
                    }
                })

            if (response.status == 200) {
                bot.sendMessage(chatId, `👋 Welcome back! Your account already exists.`);
            }
            if (response.status == 201) {
                bot.sendMessage(chatId, `👋 Welcome! Your account has been created successfully.`);
                if (referralCode) {
                    try {
                        const response = await axios.post(`${API}/api/v1/referral`, { userId, referralUserId: referralCode },
                            {
                                headers: {
                                    "Content-Type": "application/json"
                                }
                            }
                        )
                        if (response.status == 201) {
                            bot.sendMessage(chatId, `Referral successful! You have been referred by ${referralCode}.`);
                            bot.sendMessage(referralCode, `🎉 You have successfully referred a user! User ID: ${userId}`);
                        }
                    } catch (error) {
                        bot.sendMessage(chatId, error.response?.data?.message);
                    }
                }
            }
        } catch (error) {
            console.log(error)
            bot.sendMessage(chatId, error.response?.data?.message)
        }
    });

    // message 
    bot.on("message", async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const text = msg.text;
        
        if (text.startsWith("/") && text !== "/pin_setting") {
            if (userPinStep[chatId]) {
                delete userPinStep[chatId];
            }
        }

        if (text == "/referral") {
            const referralLink = `https://t.me/unknow_wallet_bot?start=${userId}`;
            bot.sendMessage(chatId, `🔗 Here is your referral link:\n${referralLink}`);
            return;
        }

        if (text == "/balance") {
            try {
                const response = await axios.get(`${API}/api/v1/check/balance/${userId}`, {
                    headers: {
                        "Content-Type": "application/json"
                    }
                });
                if (response.status == 200) {
                    return bot.sendMessage(chatId, `💰 *Your balance is:* ${response.data.balance} *BDT*`, { parse_mode: "Markdown" });
                }
            } catch (error) {
                return bot.sendMessage(chatId, error.response?.data?.message);
            }

        }

        if (text === "/pin_setting") {
            const statusMsg = await bot.sendMessage(chatId, "⏳ Please wait, checking your pin status...");
            try {
                const { data, status } = await axios.get(`${API}/api/v1/check/pin/${userId}`);
                if (status === 200) {
                    if (data.pin === "new") {
                        await bot.editMessageText("🔐 You don't have a pin yet.", {
                            chat_id: chatId,
                            message_id: statusMsg.message_id,
                        });

                        await bot.sendMessage(chatId, "Would you like to set a new PIN? Reply with 'Y' or 'N'.");
                        userPinStep[chatId] = "awaiting_pin_confirmation";
                        return;
                    }

                    if (data.pin == "old") {
                        await bot.editMessageText("🔐 Your pin is already set.", {
                            chat_id: chatId,
                            message_id: statusMsg.message_id,
                        });
                        await bot.sendMessage(chatId, "Would you like to change your PIN? Reply with 'Y' or 'N'.");
                        userPinStep[chatId] = "awaiting_pin_change_confirmation";
                        return;
                    }
                }
            } catch (error) {
                const errMsg = error.response?.data?.message;
                return bot.editMessageText(errMsg, {
                    chat_id: chatId,
                    message_id: statusMsg.message_id,
                });
            }
            return;
        }
        // STEP 1A: Handle New PIN Setup - Y/N
        if (userPinStep[chatId] === "awaiting_pin_confirmation") {
            const choice = text.toUpperCase();
            if (choice === "Y") {
                await bot.sendMessage(chatId, "✅ Please enter your new 6-digit PIN:");
                userChangePinStep[chatId] = { step: 2, change: false }; // step 2 = waiting for new pin
                delete userPinStep[chatId];
            } else if (choice === "N") {
                await bot.sendMessage(chatId, "❌ PIN setup canceled.");
                delete userPinStep[chatId];
            } else {
                await bot.sendMessage(chatId, "⚠️ Please reply with 'Y' or 'N'.");
            }
            return;
        }

        // STEP 1B: Handle Change PIN - Y/N
        if (userPinStep[chatId] === "awaiting_pin_change_confirmation") {
            const choice = text.toUpperCase();
            if (choice === "Y") {
                await bot.sendMessage(chatId, "🔑 Please enter your OLD 6-digit PIN:");
                userChangePinStep[chatId] = { step: 1 };
                delete userPinStep[chatId];
            } else if (choice === "N") {
                await bot.sendMessage(chatId, "❌ PIN change canceled.");
                delete userPinStep[chatId];
            } else {
                await bot.sendMessage(chatId, "⚠️ Please reply with 'Y' or 'N'.");
            }
            return;
        }

        if (userPinStep[chatId] === "awaiting_new_pin") {
            if (/^\d{6}$/.test(text)) {
                const newPin = text;

                await bot.sendMessage(chatId, `🔐 Saving your new pin: ${newPin}...`);

                try {
                    const payload = {
                        id: chatId,
                        change: false,
                        newPin: newPin
                    };

                    const response = await axios.put(`${API}/api/v1/pin/change`, payload);

                    if (response.status === 200) {
                        await bot.sendMessage(chatId, "✅ Your new pin has been saved successfully.");
                    } else {
                        await bot.sendMessage(chatId, "⚠️ Something went wrong while saving your pin.");
                    }
                } catch (error) {
                    const errMsg = error.response?.data?.message || "❌ Failed to save your pin.";
                    await bot.sendMessage(chatId, errMsg);
                }

                delete userPinStep[chatId];
            } else {
                await bot.sendMessage(chatId, "❗ Please enter a valid 6-digit number.");
            }
            return;
        }

        if (userChangePinStep[chatId]?.step === 1) {
            if (/^\d{6}$/.test(text)) {
                userChangePinStep[chatId] = userChangePinStep[chatId];
                userChangePinStep[chatId].oldPin = text;
                userChangePinStep[chatId].step = 2;
                await bot.sendMessage(chatId, "✅ Now enter your NEW 6-digit PIN:");
            } else {
                await bot.sendMessage(chatId, "❗ Invalid. Please enter a 6-digit PIN.");
            }
            return;
        }

        if (userChangePinStep[chatId]?.step === 2) {
            if (/^\d{6}$/.test(text)) {
                const waiting = await bot.sendMessage(chatId, "🔐 Saving your new PIN...");
                try {
                    const { data, status } = await axios.put(`${API}/api/v1/pin/change`, {
                        id: chatId,
                        change: true,
                        oldPin: userChangePinStep[chatId].oldPin,
                        newPin: text,
                    });
                    if (status == 200) {
                        await bot.editMessageText(`✅ ${data.message}`, {
                            chat_id: chatId,
                            message_id: waiting.message_id
                        });
                    }
                } catch (err) {
                    const msg = err.response?.data?.message;
                    await bot.editMessageText(`❗ ${msg}`, {
                        chat_id: chatId,
                        message_id: waiting.message_id
                    });
                }
                delete userChangePinStep[chatId];
            } else {
                await bot.sendMessage(chatId, "❗ Invalid. Please enter a 6-digit PIN.");
            }
            return;
        }


    })
}

export default telegramClient;