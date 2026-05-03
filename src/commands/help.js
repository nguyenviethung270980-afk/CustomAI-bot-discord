/**
 * Copyright (c) 2023-2025 Cortex Realm | Made by Friday
 * Join Support Server: https://discord.gg/EWr3GgP6fe
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Display information about bot commands and features');

export async function execute(interaction) {
  const helpEmbed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('Cortex Realm AI Assistant')
    .setDescription('Here are the available commands and features:')
    .addFields(
      { 
        name: '💬 AI Chat Commands', 
        value: '`/chat [message]` - Chat with the AI assistant\n`/clear` - Clear your conversation history'
      },
      { 
        name: '🔧 User Settings', 
        value: '`/settings` - Configure your AI preferences' 
      },
      { 
        name: '📋 Channel Management', 
        value: '`/setup-channel` - Set up a channel for AI auto-responses\n`/remove-channel` - Remove AI from a channel\n`/list-channels` - List all AI channels in this server' 
      },
      { 
        name: '❓ Help & Info', 
        value: '`/help` - Display this help information' 
      },
      {
        name: '📝 Using AI Channels',
        value: 'Once a channel is set up with `/setup-channel`, the AI will automatically respond to messages based on your configured probability. Auto-responses work alongside manual `/chat` commands.'
      },
      {
        name: 'ℹ️ About',
        value: 'This bot uses the custom model for fast and free AI responses.\n\nJoin our support server: [discord.gg/V4XQmaY4wR](https://discord.gg/V4XQmaY4wR)'
      }
    )
    .setFooter({ 
      text: 'Custom bot | Made by 1234hunh',
      iconURL: interaction.client.user.displayAvatarURL()
    })
    .setTimestamp();

  await interaction.reply({
    embeds: [helpEmbed],
    ephemeral: false,
  });
} 