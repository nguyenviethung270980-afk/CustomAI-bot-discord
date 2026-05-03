/**
 * Copyright (c) 2023-2025 Cortex Realm | Made by Friday
 * Join Support Server: https://discord.gg/EWr3GgP6fe
 */

import { Events, ActivityType } from 'discord.js';

export const name = Events.ClientReady;
export const once = true;

export function execute(client) {
  console.log(`Ready! Logged in as ${client.user.tag}`);
  client.user.setActivity('AI Assistant | /help', { type: ActivityType.Playing });
  
  // Log server count
  console.log(`Bot is active in ${client.guilds.cache.size} servers`);
} 