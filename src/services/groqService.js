/**
 * Copyright (c) 2023-2025 Cortex Realm | Made by Friday
 * Join Support Server: https://discord.gg/EWr3GgP6fe
 */

import { Groq } from 'groq-sdk';
import { GROQ_CONFIG } from '../config.js';

// Initialize Groq client
const groq = new Groq({
  apiKey: GROQ_CONFIG.apiKey,
});

// Delay helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Task queue to handle rate limits
class TaskQueue {
  constructor(concurrency = 2, delay = 300) {
    this.queue = [];
    this.running = 0;
    this.concurrency = concurrency;
    this.delay = delay;
  }

  async add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.run();
    });
  }

  async run() {
    if (this.running >= this.concurrency || this.queue.length === 0) return;

    const { task, resolve, reject } = this.queue.shift();
    this.running++;

    try {
      const result = await task();
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      this.running--;
      setTimeout(() => this.run(), this.delay);
    }
  }
}

const requestQueue = new TaskQueue(2, 300);

/**
 * Generate AI response (streaming if needed)
 */
export async function generateChatCompletion(messages, options = {}, onToken) {
  return requestQueue.add(async () => {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        if (options.stream) {
          // STREAMING MODE
          let fullResponse = '';
          const stream = await groq.chat.completions.create({
            model: options.model || GROQ_CONFIG.model,
            messages,
            temperature: options.temperature ?? GROQ_CONFIG.temperature,
            max_tokens: options.maxTokens ?? GROQ_CONFIG.maxTokens,
            stream: true
          });

          for await (const chunk of stream) {
            const token = chunk?.choices?.[0]?.delta?.content || '';
            if (token) {
              fullResponse += token;
              if (onToken) onToken(token);
            }
          }

          return fullResponse.trim();
        } else {
          // NON-STREAMING MODE
          const response = await groq.chat.completions.create({
            model: options.model || GROQ_CONFIG.model,
            messages,
            temperature: options.temperature ?? GROQ_CONFIG.temperature,
            max_tokens: options.maxTokens ?? GROQ_CONFIG.maxTokens,
          });

          return response?.choices?.[0]?.message?.content?.trim() || '';
        }
      } catch (error) {
        attempt++;
        console.error(`Groq API error (attempt ${attempt}):`, error.message || error);
        if (attempt < maxRetries) {
          await sleep(1000 * Math.pow(2, attempt - 1));
        } else {
          throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
        }
      }
    }
  });
}

// Async generator for streaming
export async function* generateChatCompletionStream(messages, options = {}) {
  let buffer = '';
  await generateChatCompletion(messages, { ...options, stream: true }, token => {
    buffer += token;
  });
  yield buffer;
}

export default {
  generateChatCompletion,
  generateChatCompletionStream
};
