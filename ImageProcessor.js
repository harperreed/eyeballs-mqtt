import EventEmitter from 'events';
import axios from 'axios';
import crypto from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import Replicate from "replicate";
import winston from 'winston';

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

class ImageProcessor extends EventEmitter {
  constructor() {
    super();
    this.replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
    this.cache = {};
  }

  async processImage(imageData, prompt) {
    const hash = crypto.createHash('sha256');
    hash.update(`${imageData}_${prompt}`);
    const cacheKey = hash.digest('hex');

    this.emit('receipt', cacheKey);

    if (this.cache[cacheKey]) {
      this.emit('cacheHit', cacheKey, this.cache[cacheKey]);
      return;
    }

    let imgBuffer;

    if (imageData.startsWith('http')) {
      const response = await axios.get(imageData, { responseType: 'arraybuffer' });
      imgBuffer = Buffer.from(response.data, 'binary');
    } else {
      imgBuffer = Buffer.from(imageData, 'base64');
    }

    const imgType = await fileTypeFromBuffer(imgBuffer);
    const mimeType = imgType ? imgType.mime : "image/png";

    const dataURI = `data:${mimeType};base64,${imgBuffer.toString('base64')}`;

    logger.info(`Running model ${process.env.MODEL} on image with MIME type ${mimeType}`);

    const startTime = Date.now();  // Capture the start time

    const output = await this.replicate.run(
      process.env.MODEL,
      { input: { image: dataURI, prompt } }
    );

    const endTime = Date.now();  // Capture the end time

    // Calculate the elapsed time in milliseconds
    const elapsedTime = (endTime - startTime) / 1000;

    // Join the output array into a single string
    const outputString = output.join('');

    const outputPayload = { result: outputString, elapsedTime, receiptId: cacheKey };

    this.cache[cacheKey] = outputPayload;
    this.emit('cacheMiss', cacheKey, outputPayload);
    logger.info(`Model output emitted. Elapsed time: ${elapsedTime.toFixed(2)} s`);
  }
}

export default ImageProcessor;
