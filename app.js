import dotenv from 'dotenv';
import Replicate from "replicate";
import axios from 'axios';
import mqtt from "mqtt";
import { fileTypeFromBuffer } from 'file-type';
import winston from 'winston';

dotenv.config();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

logger.add(new winston.transports.Console({
  format: winston.format.simple()
}));

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
const client = mqtt.connect(process.env.BROKER_ADDRESS);

client.on('connect', () => {
  client.publish(process.env.STATUS_TOPIC, JSON.stringify({ status: "up" }));
  client.subscribe(process.env.TOPIC, (err) => {
    if (err) {
      logger.error(`Subscription error: ${err}`);
    } else {
      logger.info(`Successfully subscribed to topic ${process.env.TOPIC}`);
      
    }
  });
});

client.on('message', async (topic, message) => {
  if (topic === process.env.TOPIC) {
    logger.info('Message received');
    try {
      const parsedMessage = JSON.parse(message.toString());
      const { imageData, prompt } = parsedMessage;
      let imgBuffer;

      if (imageData.startsWith('http')) {
        logger.info(`Downloading image from URL: ${imageData}`);
        const response = await axios.get(imageData, { responseType: 'arraybuffer' });
        imgBuffer = Buffer.from(response.data, 'binary');
      } else {
        imgBuffer = Buffer.from(imageData, 'base64');
      }

      const imgType = await fileTypeFromBuffer(imgBuffer);
      const mimeType = imgType ? imgType.mime : "image/png";

      logger.info(`Running model ${process.env.MODEL} on image with MIME type ${mimeType}`);
      const dataURI = `data:${mimeType};base64,${imgBuffer.toString('base64')}`;

      const startTime = Date.now();  // Capture the start time


      const output = await replicate.run(
        process.env.MODEL,
        { input: { image: dataURI, prompt } }
      );


      const endTime = Date.now();  // Capture the end time

      // Calculate the elapsed time in milliseconds
      const elapsedTime = (endTime - startTime) / 1000;

      // Join the output array into a single string
      const outputString = output.join('');

      // Publish the output to another topic
      client.publish(process.env.OUTPUT_TOPIC, JSON.stringify({ result: outputString }));

      logger.info(`Model output published. Elapsed time: ${elapsedTime.toFixed(2)} s`);


    } catch (error) {
      logger.error(`Error occurred: ${error}`);
    }
  }
});
