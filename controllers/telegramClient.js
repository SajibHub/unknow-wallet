import TelegramBot from "node-telegram-bot-api";
import axios from "axios"
import dotenv from "dotenv"

dotenv.config()

const { BOT_TOKEN, API } = process.env;
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const userPinStep = {};
const userChangePinStep = {};
const sendMoney = {}
const userCache = new Map();


const telegramClient = () => {
    bot.setMyCommands([
        { command: "id", description: "Get your Telegram ID" },
        { command: "balance", description: "Get your balance" },
        { command: "send_money", description: "Send Money" },
        { command: "withdraw", description: "Withdraw Money" },
        { command: "transaction", description: "Transaction History" },
        { command: "pin_setting", description: "Pin Setting" },
        { command: "forget_pin", description: "Forget your pin" },
        { command: "referral", description: "Get your referral code" },
        { command: "help", description: "Get help and support" }
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
                            bot.sendMessage(chatId, `Referral successful! You have been referred by ${referralCode}. You received 50 BDT bonus!`);
                            bot.sendMessage(referralCode, `🎉 You have successfully referred a user! User ID: ${userId}. You received 100 BDT bonus!`);
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

        if (text.startsWith("/") && text !== "/send_money") {
            if (sendMoney[chatId]) {
                delete sendMoney[chatId];
            }
        }
        //telegram user Id
        if (text == "/id") {
            return bot.sendMessage(chatId, `🆔 *Your Telegram ID:*\n\`\`\`\n${userId}\n\`\`\``, {
                parse_mode: "Markdown"
            });
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

        // new pin set
        if (userPinStep[chatId] === "awaiting_new_pin") {
            if (/^\d{6}$/.test(text)) {
            userPinStep[chatId] = {
                step: "confirm_new_pin",
                newPin: text
            };
            await bot.sendMessage(chatId, "🔁 Please re-enter your new 6-digit PIN to confirm:");
            } else {
            await bot.sendMessage(chatId, "❗ Please enter a valid 6-digit number.");
            }
            return;
        }

        if (
            typeof userPinStep[chatId] === "object" &&
            userPinStep[chatId].step === "confirm_new_pin"
        ) {
            if (text === userPinStep[chatId].newPin) {
            await bot.sendMessage(chatId, `🔐 Saving your new pin...`);
            try {
                const payload = {
                id: chatId,
                change: false,
                newPin: text
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
            await bot.sendMessage(chatId, "❌ PINs do not match. Please start again with /pin_setting.");
            delete userPinStep[chatId];
            }
            return;
        }
        // pin change step 1
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

        // pin change step 2
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

        //send money 
        if (text == "/send_money") {
            const pinStatus = await axios.get(`${API}/api/v1/check/pin/${chatId}`);
            if (pinStatus.data.pin === "new") {
                return bot.sendMessage(chatId, "❌ You don't have a PIN set. Please set a PIN first using /pin_setting.");
            }
            if (pinStatus.data.pin === "old") {
                sendMoney[chatId] = { step: 1 };
                return bot.sendMessage(chatId,
                    "👤 Who are you sending money to?\n\n" +
                    "📩 Please enter the *recipient's Telegram ID* to continue.",
                    { parse_mode: "Markdown" }
                );
            }
        }

        if (sendMoney[chatId]?.step === 1) {
            const recipientId = text;
            if (!/^\d+$/.test(recipientId)) {
                return bot.sendMessage(chatId, "❌ *Invalid Telegram ID.*\n\nPlease enter a valid Telegram ID to proceed.", {
                    parse_mode: "Markdown"
                });
            }
            if (chatId == recipientId) {
                return bot.sendMessage(chatId, "⚠️ *You cannot send money to yourself.*\n\nPlease enter a different Telegram ID.", {
                    parse_mode: "Markdown"
                });
            }
            sendMoney[chatId].recipientId = recipientId;
            sendMoney[chatId].step = 2;
            return bot.sendMessage(chatId, "💰 Please enter the *amount* you want to send (in BDT):", {
                parse_mode: "Markdown"
            });
        }

        if (sendMoney[chatId]?.step === 2) {
            const amount = parseFloat(text);
            if (
                isNaN(amount) ||
                amount <= 0 ||
                !Number.isInteger(amount)
            ) {
                return bot.sendMessage(chatId, "❌ *Invalid Amount*\n\nPlease enter a valid amount in whole BDT (like 10, 50, 100).\nDecimals such as 5.5 or 10.75 are not allowed.", {
                    parse_mode: "Markdown"
                });
            }

            sendMoney[chatId].amount = amount;
            sendMoney[chatId].step = 3;
            return bot.sendMessage(chatId,
                `🔔 *Transaction Preview:*\n\n` +
                `• Amount: *৳${amount}*\n` +
                `• Recipient ID: *${sendMoney[chatId].recipientId}*\n\n` +
                `🔐 _Please type your PIN to confirm the transaction._`,
                { parse_mode: "Markdown" }
            );
        }

        if (sendMoney[chatId]?.step === 3) {
            await bot.deleteMessage(chatId, msg.message_id);
            await bot.sendMessage(chatId, "*⏳ Please wait...*\n\nVerifying your PIN and completing the transaction.", {
                parse_mode: "Markdown"
            });
            try {
                const { data, status } = await axios.post(`${API}/api/v1/send-money`, {
                    senderId: chatId,
                    receiverId: sendMoney[chatId]?.recipientId,
                    amount: parseFloat(sendMoney[chatId]?.amount),
                    pin: text
                }, { headers: { "Content-Type": "application/json" } })

                if (status == 201) {

                    await bot.sendMessage(chatId, `✅ *৳${parseFloat(sendMoney[chatId]?.amount)}* has been successfully sent to *${sendMoney[chatId].recipientId}*.\n\n🧾 _Transaction: Send Money_`, {
                        parse_mode: "Markdown"
                    });
                    await bot.sendMessage(sendMoney[chatId]?.recipientId, `🎉 *You have received ৳${parseFloat(sendMoney[chatId]?.amount)}!* \n\n📨 From: *${chatId}*\n🧾 _Transaction: Send Money_`, {
                        parse_mode: "Markdown"
                    });
                    delete sendMoney[chatId];
                }
            } catch (error) {
                console.log(error)
                delete sendMoney[chatId]
                return bot.sendMessage(chatId, `❌ *Transaction failed!*\n\nError: ${error.response?.data?.message}`, {
                    parse_mode: "Markdown"
                });

            }
        }

        //transaction history 
        const formatTransactions = (transactions, page = 1, pageSize = 10) => {
            const totalPages = Math.ceil(transactions.length / pageSize);
            const sliced = transactions.slice((page - 1) * pageSize, page * pageSize);

            const header = `📄 *Transaction History*\n_Page ${page} of ${totalPages}_\n\n`;

            const body = sliced.map(tx => {
                const from = tx.from.startsWith('@')
                    ? `[${tx.from}](https://t.me/${tx.from.replace('@', '')})`
                    : `\`${tx.from}\``;

                const to = tx.to.startsWith('@')
                    ? `[${tx.to}](https://t.me/${tx.to.replace('@', '')})`
                    : `\`${tx.to}\``;

                const typeEmoji = tx.transactionType.includes("referral") ? "🎁" :
                    tx.isSender ? "📤" : "📥";

                const typeLabel = tx.transactionType.includes("referral")
                    ? tx.transactionType.replace(/_/g, ' ').toUpperCase()
                    : (tx.isSender ? "Send Money" : "Receive Money").toUpperCase();

                const signedAmount = (tx.transactionType.includes("referral") ? "+" : (tx.isSender ? "-" : "+")) + tx.amount.toLocaleString();

                return (
                    `━━━━━━━━━━━━━━\n` +
                    `🆔 *TX ID:* \`${tx._id}\`\n` +
                    `💰 *Amount:* *${signedAmount}* BDT\n` +
                    `${typeEmoji} *Type:* ${typeLabel}\n` +
                    `👤 *From:* ${from}\n` +
                    `👥 *To:* ${to}\n` +
                    `🕒 *Time:* \`${tx.time}\`\n`
                );
            }).join('\n');


            return { text: header + body, totalPages };
        };

        const generateKeyboard = (page, totalPages) => {
            const prev = { text: "⬅️ Prev", callback_data: `history_page_${page - 1}` };
            const next = { text: "➡️ Next", callback_data: `history_page_${page + 1}` };
            const current = { text: `Page ${page}/${totalPages}`, callback_data: "noop" };

            return [
                [
                    ...(page > 1 ? [prev] : []),
                    current,
                    ...(page < totalPages ? [next] : [])
                ]
            ];
        };

        if (text == "/transaction") {
            await bot.sendMessage(chatId, "⏳ *Please wait...*\n\nWe are fetching your transaction history.", {
                parse_mode: "Markdown"
            });

            try {
                // Step 2: Axios API call
                const { data } = await axios.get(`${API}/api/v1/transaction/${chatId}`);
                const transactions = data.transactions || [];

                if (transactions.length === 0) {
                    return bot.sendMessage(chatId, "❌ *No transactions found.*", {
                        parse_mode: "Markdown"
                    });
                }

                // Step 3: Send paginated first page
                const page = 1;
                const { text, totalPages } = formatTransactions(transactions, page);

                // Optional: Cache per user if needed
                userCache.set(chatId, transactions);

                await bot.sendMessage(chatId, text, {
                    parse_mode: "Markdown",
                    reply_markup: {
                        inline_keyboard: generateKeyboard(page, totalPages)
                    }
                });

            } catch (err) {
                console.log(err)
                return bot.sendMessage(chatId, "❌ *Failed to load transaction history.*", {
                    parse_mode: "Markdown"
                });
            }

        }

        bot.on('callback_query', async ({ data, message }) => {
            if (!data.startsWith('history_page_')) return;

            const chatId = message.chat.id;
            const messageId = message.message_id;
            const page = parseInt(data.replace('history_page_', ''), 10);

            const transactions = userCache.get(chatId);
            if (!transactions) return;

            const { text, totalPages } = formatTransactions(transactions, page);

            await bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: generateKeyboard(page, totalPages)
                }
            });
        });

        // withdraw money

        if (text === "/withdraw") {
            return bot.sendMessage(chatId, "🚧 *Withdraw Feature Coming Soon!*\n\nWe're currently working on this feature. Please check back later for updates. Thank you for your patience!", {
                parse_mode: "Markdown"
            });
        }

        // forget pin
        if (text === "/forget_pin") {
            return bot.sendMessage(chatId, "🛠️ *Coming Soon*\nThis feature isn't available yet.", {
                parse_mode: "Markdown"
            });
        }

        // help 
        if (text === "/help") {
            return bot.sendMessage(chatId,
                "🆘 *Bot Help & Commands Guide*\n\n" +
                "Here’s what I can do for you:\n\n" +
                "🔹 `/id` — Get your Telegram user ID.\n" +
                "💰 `/balance` — Check your current balance.\n" +
                "💸 `/send_money` — Transfer money to another user.\n" +
                "🏧 `/withdraw` — Withdraw funds from your balance. *(Coming Soon)*\n" +
                "📄 `/transaction` — View your recent transaction history.\n" +
                "🔐 `/forget_pin` — Reset your PIN using a verification code.\n" +
                "🎁 `/referral` — Get your referral code and earn rewards.\n" +
                "📞 `/help` — You're here! Get help and support info.\n\n" +
                "If you face any issue, just message here or use /referral to invite friends and earn.",
                { parse_mode: "Markdown" }
            );
        }

    })
}

export default telegramClient;