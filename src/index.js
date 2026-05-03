/**
 * Copyright (c) 2023-2025 Cortex Realm | Made by Friday
 * Join Support Server: https://discord.gg/EWr3GgP6fe
 */

import { Client, Collection, REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Groq from 'groq-sdk';
import dotenv from "dotenv";

import { BOT_CONFIG, CLIENT_OPTIONS, MONGODB_CONFIG } from './config.js';

dotenv.config();

// ────────────────────────────────────────────────
// ES module helpers
// ────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ────────────────────────────────────────────────
// Discord client
// ────────────────────────────────────────────────
const client = new Client(CLIENT_OPTIONS);
client.commands = new Collection();
client.buttons = new Collection();

// ────────────────────────────────────────────────
// Multi-Groq API (load balance / failover)
// ────────────────────────────────────────────────
const groqKeys = process.env.GROQ_API_KEY
  ? process.env.GROQ_API_KEY.split(",").map(k => k.trim())
  : [];

if (!groqKeys.length) {
  console.error("❌ No Groq API keys found. Please add GROQ_API_KEY in your .env file");
  process.exit(1);
}

const groqClients = groqKeys.map((key) => new Groq({ apiKey: key }));

let groqIndex = 0;
function getGroqClient() {
  const client = groqClients[groqIndex];
  groqIndex = (groqIndex + 1) % groqClients.length;
  return client;
}

client.askGroq = async (options, retries = groqClients.length) => {
  for (let i = 0; i < retries; i++) {
    const groq = getGroqClient();
    try {
      return await groq.chat.completions.create({
        model: options.model || "llama-3.1-70b-versatile",
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 1024,
      });
    } catch (err) {
      console.warn(`⚠️ Groq API error (key ${i + 1}):`, err.message);
    }
  }
  throw new Error("All Groq API keys failed.");
};

// ────────────────────────────────────────────────
// Database
// ────────────────────────────────────────────────
async function connectToDatabase() {
  try {
    await mongoose.connect(MONGODB_CONFIG.uri);
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB:", error);
  }
}

// ────────────────────────────────────────────────
// Command / Button / Event loader
// ────────────────────────────────────────────────
async function loadCommands() {
  const commandsPath = path.join(__dirname, "commands");
  if (!fs.existsSync(commandsPath)) return [];

  const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"));
  const commandsData = [];

  for (const file of commandFiles) {
    try {
      const command = await import(`file://${path.join(commandsPath, file)}`);
      if ("data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
        commandsData.push(command.data.toJSON());
        console.log(`✅ Loaded command: ${command.data.name}`);
      }
    } catch (e) {
      console.error(`❌ Error loading command ${file}:`, e);
    }
  }
  return commandsData;
}

async function loadButtons() {
  const buttonsPath = path.join(__dirname, "buttons");
  if (!fs.existsSync(buttonsPath)) return;

  const buttonFiles = fs.readdirSync(buttonsPath).filter((f) => f.endsWith(".js"));
  for (const file of buttonFiles) {
    try {
      const button = await import(`file://${path.join(buttonsPath, file)}`);
      if ("customId" in button && "execute" in button) {
        client.buttons.set(button.customId, button);
        console.log(`✅ Loaded button: ${button.customId}`);
      }
    } catch (e) {
      console.error(`❌ Error loading button ${file}:`, e);
    }
  }
}

async function loadEvents() {
  const eventsPath = path.join(__dirname, "events");
  if (!fs.existsSync(eventsPath)) return;

  const eventFiles = fs.readdirSync(eventsPath).filter((f) => f.endsWith(".js"));
  for (const file of eventFiles) {
    try {
      const event = await import(`file://${path.join(eventsPath, file)}`);
      if (!event.name) continue;
      if (event.once) client.once(event.name, (...args) => event.execute(...args, client));
      else client.on(event.name, (...args) => event.execute(...args, client));
      console.log(`✅ Loaded event: ${event.name}`);
    } catch (e) {
      console.error(`❌ Error loading event ${file}:`, e);
    }
  }
}

// ────────────────────────────────────────────────
// Command deployment
// ────────────────────────────────────────────────
async function deployCommands(commandsData) {
  if (!commandsData.length) return 0;
  const rest = new REST().setToken(BOT_CONFIG.token);
  const data = await rest.put(Routes.applicationCommands(BOT_CONFIG.clientId), { body: commandsData });
  console.log(`✅ Deployed ${data.length} slash commands.`);
  return data.length;
}

// ────────────────────────────────────────────────
// Initialization
// ────────────────────────────────────────────────
async function initializeBot() {
  console.log("🚀 Starting Cortex Realm Discord Bot...");

  await connectToDatabase();

  const commandsToRegister = await loadCommands();
  await deployCommands(commandsToRegister);
  await loadButtons();
  await loadEvents();

  await client.login(BOT_CONFIG.token);
  console.log("🤖 Cortex Realm Bot Online!");
}

// ────────────────────────────────────────────────
// Start
// ────────────────────────────────────────────────
initializeBot();
