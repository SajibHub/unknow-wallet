import TelegramBot from "node-telegram-bot-api";
import axios from "axios"
import dotenv from "dotenv"

dotenv.config()

const { BOT_TOKEN, API } = process.env;
const bot = new TelegramBot(BOT_TOKEN, { polling: true });


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

        if (text == "/referral") {
            const referralLink = `https://t.me/unknow_wallet_bot?start=${userId}`;
            bot.sendMessage(chatId, `🔗 Here is your referral link:\n${referralLink}`);
            return;
        }

    })
}

export default telegramClient;