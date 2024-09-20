import dotenv from "dotenv";
import mqtt from "mqtt";
import winston from "winston";
import ImageProcessor from "./ImageProcessor.js";

dotenv.config();

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

const cache = {};
const imgProcessor = new ImageProcessor();
const responseTopic = process.env.OUTPUT_TOPIC || "receipts/seen";
const receiptTopic = process.env.RECEIPT_TOPIC || "receipts/vision";
const client = mqtt.connect(process.env.BROKER_ADDRESS);

client.on("connect", () => {
    client.publish(process.env.STATUS_TOPIC, JSON.stringify({ status: "up" }));
    client.subscribe(process.env.TOPIC, (err) => {
        if (err) {
            logger.error(`Subscription error: ${err}`);
        } else {
            logger.info(
                `Successfully subscribed to topic ${process.env.TOPIC}`,
            );
        }
    });
});

imgProcessor.on("receipt", (cacheKey) => {
    client.publish(receiptTopic, JSON.stringify({ receiptId: cacheKey }));
    logger.info(`Receipt published with ID ${cacheKey}`);
});

imgProcessor.on("cacheHit", (cacheKey, output) => {
    client.publish(responseTopic, JSON.stringify(output));
    logger.info(`Cache hit for ${cacheKey}.`);
});

imgProcessor.on("cacheMiss", (cacheKey, output) => {
    client.publish(responseTopic, JSON.stringify(output));
    logger.info(`Cache miss for ${cacheKey}. Data processed.`);
});

// Then, inside your message event handler
client.on("message", async (topic, message) => {
    if (topic === process.env.TOPIC) {
        const parsedMessage = JSON.parse(message.toString());
        const { imageData, prompt } = parsedMessage;

        await imgProcessor.processImage(imageData, prompt);
    }
});

// client.on('message', async (topic, message) => {
//   if (topic === process.env.TOPIC) {
//     logger.info('Message received');
//     try {
//       const parsedMessage = JSON.parse(message.toString());
//       const responseTopic = parsedMessage.topic ? parsedMessage.topic : process.env.OUTPUT_TOPIC;

//       const { imageData, prompt } = parsedMessage;
//       let imgBuffer;

//       // Generate a cache key based on imageData and prompt
//       // Generate a hash as cache key
//       const hash = crypto.createHash('sha256');
//       hash.update(`${imageData}_${prompt}`);
//       const cacheKey = hash.digest('hex');

//       const receiptTopic = process.env.RECEIPT_TOPIC || 'receipts/vision';

//       client.publish(receiptTopic, JSON.stringify({ receiptId: cacheKey }));
//       logger.info(`Receipt published with ID ${cacheKey}`);

//       // Check cache first
//       if (cache[cacheKey]) {
//         client.publish(responseTopic, JSON.stringify(cache[cacheKey]));
//         logger.info(`Cache hit for ${cacheKey}.`);
//         return;
//       }

//       if (imageData.startsWith('http')) {
//         logger.info(`Downloading image from URL: ${imageData}`);
//         const response = await axios.get(imageData, { responseType: 'arraybuffer' });
//         imgBuffer = Buffer.from(response.data, 'binary');
//       } else {
//         imgBuffer = Buffer.from(imageData, 'base64');
//       }

//       const imgType = await fileTypeFromBuffer(imgBuffer);
//       const mimeType = imgType ? imgType.mime : "image/png";

//       logger.info(`Running model ${process.env.MODEL} on image with MIME type ${mimeType}`);
//       const dataURI = `data:${mimeType};base64,${imgBuffer.toString('base64')}`;

//       const startTime = Date.now();  // Capture the start time

//       const output = await replicate.run(
//         process.env.MODEL,
//         { input: { image: dataURI, prompt } }
//       );

//       const endTime = Date.now();  // Capture the end time

//       // Calculate the elapsed time in milliseconds
//       const elapsedTime = (endTime - startTime) / 1000;

//       // Join the output array into a single string
//       const outputString = output.join('');

//       const outputPayload = { result: outputString, elapsedTime, receiptId: cacheKey };

//       cache[cacheKey] = outputPayload;

//       // Publish the output to another topic
//       client.publish(responseTopic, JSON.stringify(outputPayload));
//       logger.info(`Model output published to ${responseTopic}. Elapsed time: ${elapsedTime.toFixed(2)} s`);

//     } catch (error) {
//       logger.error(`Error occurred: ${error}`);
//     }
//   }
// });
