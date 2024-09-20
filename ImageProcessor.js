import EventEmitter from "events";
import axios from "axios";
import crypto from "crypto";
import { fileTypeFromBuffer } from "file-type";
import OpenAI from "openai";
import winston from "winston";

const logger = winston.createLogger({
    level: "info",
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: "error.log", level: "error" }),
        new winston.transports.File({ filename: "combined.log" }),
    ],
});

logger.add(
    new winston.transports.Console({
        format: winston.format.simple(),
    }),
);

class ImageProcessor extends EventEmitter {
    constructor() {
        super();
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.cache = {};
        this.model = process.env.OPENAI_MODEL || "gpt-4o-2024-08-06";
    }

    async processImage(imageData, prompt) {
        const hash = crypto.createHash("sha256");
        hash.update(`${imageData}s_${prompt}`);
        const cacheKey = hash.digest("hex");
        this.emit("receipt", cacheKey);

        if (this.cache[cacheKey]) {
            this.emit("cacheHit", cacheKey, this.cache[cacheKey]);
            return;
        }

        let imgBuffer;
        if (imageData.startsWith("http")) {
            const response = await axios.get(imageData, {
                responseType: "arraybuffer",
            });
            imgBuffer = Buffer.from(response.data, "binary");
        } else {
            imgBuffer = Buffer.from(imageData, "base64");
        }

        const imgType = await fileTypeFromBuffer(imgBuffer);
        const mimeType = imgType ? imgType.mime : "image/png";

        logger.info(
            `Processing image with MIME type ${mimeType} using OpenAI model: ${this.model}`,
        );

        const startTime = Date.now();

        try {
            const response = await this.openai.chat.completions.create({
                model: this.model,
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:${mimeType};base64,${imgBuffer.toString("base64")}`,
                                },
                            },
                        ],
                    },
                ],
            });

            const endTime = Date.now();
            const elapsedTime = (endTime - startTime) / 1000;

            const outputString = JSON.parse(
                response.choices[0].message.content,
            );
            const outputPayload = {
                result: outputString,
                elapsedTime,
                receiptId: cacheKey,
            };
            this.cache[cacheKey] = outputPayload;
            this.emit("cacheMiss", cacheKey, outputPayload);

            logger.info(
                `OpenAI output received. Model: ${this.model}. Elapsed time: ${elapsedTime.toFixed(2)} s`,
            );
        } catch (error) {
            logger.error(
                `Error processing image with OpenAI model ${this.model}: ${error.message}`,
            );
            throw error;
        }
    }
}

export default ImageProcessor;
