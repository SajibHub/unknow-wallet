import express from "express";
import rateLimit from "express-rate-limit";
import cors from "cors";
import helmet from "helmet";
import hpp from "hpp";
import dotenv from "dotenv";
import compression from "compression";
import mongoSanitize from 'express-mongo-sanitize';

import telegramClient from "./controllers/telegramClient.js";
import database from "./config/database.js";
import router from "./routers/router.js";


dotenv.config();
const PORT = process.env.PORT || 4000;
const app = express();

const limit = rateLimit({
    windowMs: parseInt(process.env.REQ_MS, 10),
    max: parseInt(process.env.REQ_LIMIT, 10),
    message: "Too many requests, please try again later.",
    statusCode: 429,
});

app.use(limit);

app.use(
    cors({
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"],
    })
);

app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    noSniff: true,
}))

app.use(
    helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
        },
    })
);

app.use(hpp());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    ['body', 'query', 'params'].forEach((key) => {
        if (req[key]) {
            const sanitized = mongoSanitize(req[key]);
            req[`sanitized${key.charAt(0).toUpperCase() + key.slice(1)}`] = sanitized;
        }
    });
    next();
});
app.use(compression());

app.use("/api/v1", router);

telegramClient()

app.listen(PORT, () => {
    database()
    console.log("Server is running on port", PORT);
});