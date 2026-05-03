/**
 * Copyright (c) 2023-2025 Cortex Realm | Made by Friday
 * Join Support Server: https://discord.gg/EWr3GgP6fe
 */

import dotenv from 'dotenv';
import { GatewayIntentBits, Partials } from 'discord.js';

// Load environment variables
dotenv.config();

// Bot configuration
export const BOT_CONFIG = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  groqKeys: process.env.GROQ_API_KEY
    ? process.env.GROQ_API_KEY.split(',').map((k) => k.trim())
    : [], // expects GROQ_API_KEY in .env (comma separated)
};

// Groq defaults (model + options)
export const GROQ_CONFIG = {
  model: 'llama3-70b-8192',
  temperature: 0.7,
  maxTokens: 500,
};

// MongoDB configuration
export const MONGODB_CONFIG = {
  uri: process.env.MONGODB_URI,
};

// Discord.js client configuration
export const CLIENT_OPTIONS = {
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User,
  ],
};
