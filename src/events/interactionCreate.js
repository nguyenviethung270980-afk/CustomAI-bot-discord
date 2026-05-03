import { Events } from 'discord.js';
import User from '../models/User.js';

export const name = Events.InteractionCreate;
export const once = false;

// Handle model selection
async function handleModelSelection(interaction) {
  try {
    await interaction.deferUpdate();
    
    const userId = interaction.user.id;
    const selectedModel = interaction.values[0];
    
    // Update user settings in the database
    const user = await User.findOne({ userId });
    if (user) {
      await user.updateSettings({ aiModel: selectedModel });
      
      await interaction.followUp({
        content: `Model updated to ${selectedModel}`,
        ephemeral: true,
      });
    }
  } catch (error) {
    console.error('Error handling model selection:', error);
    await interaction.followUp({
      content: 'Failed to update model settings.',
      ephemeral: true,
    });
  }
}

// Handle temperature selection
async function handleTemperatureSelection(interaction) {
  try {
    await interaction.deferUpdate();
    
    const userId = interaction.user.id;
    const selectedTemperature = parseFloat(interaction.values[0]);
    
    // Update user settings in the database
    const user = await User.findOne({ userId });
    if (user) {
      await user.updateSettings({ temperature: selectedTemperature });
      
      await interaction.followUp({
        content: `Temperature updated to ${selectedTemperature}`,
        ephemeral: true,
      });
    }
  } catch (error) {
    console.error('Error handling temperature selection:', error);
    await interaction.followUp({
      content: 'Failed to update temperature settings.',
      ephemeral: true,
    });
  }
}

export async function execute(interaction) {
  // Handle slash commands
  if (interaction.isChatInputCommand()) {
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing ${interaction.commandName}`);
      console.error(error);
      
      const response = {
        content: 'There was an error while executing this command!',
        ephemeral: true
      };
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(response);
      } else {
        await interaction.reply(response);
      }
    }
  }
  
  // Handle buttons
  else if (interaction.isButton()) {
    // Get the base customId without parameters
    const [customId] = interaction.customId.split(':');
    const button = interaction.client.buttons.get(customId);
    
    if (!button) {
      console.error(`No button handling for ${customId} was found.`);
      return;
    }
    
    try {
      await button.execute(interaction);
    } catch (error) {
      console.error(`Error executing button ${customId}`);
      console.error(error);
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'There was an error while executing this button!', ephemeral: true });
      } else {
        await interaction.reply({ content: 'There was an error while executing this button!', ephemeral: true });
      }
    }
  }
  
  // Handle select menus
  else if (interaction.isStringSelectMenu()) {
    // Handle select menu interactions based on customId
    const customId = interaction.customId;
    
    if (customId === 'select_model') {
      handleModelSelection(interaction);
    } else if (customId === 'select_temperature') {
      handleTemperatureSelection(interaction);
    }
  }
} 