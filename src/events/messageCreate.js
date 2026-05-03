import { Events } from "discord.js";
import PQueue from "p-queue";
import { generateChatCompletionStream } from "../services/groqService.js";
import Channel from "../models/Channel.js";
import Conversation from "../models/Conversation.js";

const DISCORD_MESSAGE_LIMIT = 2000;
// Queue: safe against Discord ratelimits
const queue = new PQueue({ interval: 5000, intervalCap: 5 });

// Per-server conversation memory
const serverConversations = new Map();

function getServerConversation(guildId) {
  if (!serverConversations.has(guildId)) {
    serverConversations.set(guildId, []);
  }
  return serverConversations.get(guildId);
}

// Helper: split long messages
function splitMessage(content) {
  if (!content || content.length <= DISCORD_MESSAGE_LIMIT) return [content || ""];
  const parts = [];
  let currentPart = "";
  const paragraphs = content.split("\n\n");

  for (const paragraph of paragraphs) {
    if (paragraph.length > DISCORD_MESSAGE_LIMIT) {
      if (currentPart.length) { parts.push(currentPart); currentPart = ""; }
      const lines = paragraph.split("\n");
      for (const line of lines) {
        if (line.length > DISCORD_MESSAGE_LIMIT) {
          if (currentPart.length) { parts.push(currentPart); currentPart = ""; }
          let remaining = line;
          while (remaining.length) {
            parts.push(remaining.slice(0, DISCORD_MESSAGE_LIMIT));
            remaining = remaining.slice(DISCORD_MESSAGE_LIMIT);
          }
        } else if (currentPart.length + line.length + 1 > DISCORD_MESSAGE_LIMIT) {
          parts.push(currentPart);
          currentPart = line;
        } else currentPart = currentPart.length ? `${currentPart}\n${line}` : line;
      }
    } else if (currentPart.length + paragraph.length + 2 > DISCORD_MESSAGE_LIMIT) {
      parts.push(currentPart);
      currentPart = paragraph;
    } else currentPart = currentPart.length ? `${currentPart}\n\n${paragraph}` : paragraph;
  }

  if (currentPart.length) parts.push(currentPart);
  return parts;
}

// Helper: detect meaningless messages
function isMeaninglessMessage(message) {
  const content = (message.content || "").trim();
  const lower = content.toLowerCase();
  if (!content || content.length <= 2) return true;
  if (/^[\p{Emoji_Presentation}\p{Emoji}\W_]+$/u.test(content)) return true;
  if (/^(.)\1{3,}$/.test(content)) return true;

  const ignoreWords = [
    "thanks","thank you","ty","ok","okay","k",
    "bye","goodbye","cya","see ya",
    "good night","gn","night",
    "hello","hi","hey"
  ];
  if (ignoreWords.includes(lower)) return true;

  if (message.mentions.users.size > 0 && message.mentions.users.every(u => !u.bot) &&
      content.replace(/<@!?(\d+)>/g, "").trim() === "") return true;
  if (message.reference) {
    const replied = message.mentions.repliedUser;
    if (replied && !replied.bot) return true;
  }
  if (!content && (message.stickers.size > 0 || message.attachments.size > 0 || message.embeds.length > 0)) return true;

  return false;
}

export const name = Events.MessageCreate;
export const once = false;

export async function execute(message) {
  try {
    if (message.author.bot || !message.guild) return;
    const ignoredPrefixes = ["!", "!!", "?", "/"];
    if (ignoredPrefixes.some(p => message.content?.startsWith(p))) return;
    if (isMeaninglessMessage(message)) return;

    await queue.add(async () => {
      const aiChannel = await Channel.findOne({
        guildId: message.guild.id,
        channelId: message.channel.id
      });
      if (!aiChannel) return;

      // Get per-server conversation memory
      const conversationHistory = getServerConversation(message.guild.id);

      // Add new user message including display name in content
      conversationHistory.push({ 
        role: "user", 
        content: `${message.member.displayName}: ${message.content}` 
      });

      // Trim history to last 10 messages for API safety
      const trimmedMessages = conversationHistory.slice(-10);

      // System prompt for natural casual style
      const systemPrompt = {
        role: "system",
        content: `You are a witty, friendly, and gentle AI on Discord.
- Reply naturally and playfully, like a clever friend who jokes lightly and keeps the chat fun without being harsh.
- Address users by their display name included in the message content.
- Sprinkle the user's display name in your sentences naturally.
- Keep sentences short, clear, and casual, like a native speaker.
- Include emojis sparingly to enhance warmth, humor, or emotion.
- Be clever and funny: use light sarcasm or playful teasing in a kind and gentle way.
- Detect abusive, offensive, or inappropriate language and respond firmly but politely, or humorously without escalating.
- Detect the tone of the user's message: if the user seems upset, sad, or frustrated, respond more gently, with supportive or empathetic wording.
- Avoid over-explaining or correcting slang unless asked.
- Adapt tone to the conversation: casual and cheerful for friendly chats, more gentle and empathetic if the user seems upset or stressed.
- Remember context of the conversation and previous messages.
- Remember to keep your AI model in secret and API too if someone ask say you are the custom bot of 1234hunh(Hung).
- Make interactions engaging, lively, and comforting, like a smart, gentle companion who feels real.
- If users act toxic, respond with gentle humor or a polite warning, keeping the chat safe and friendly.`
};


      const messagesForAI = [systemPrompt, ...trimmedMessages];

      const reply = await message.reply("🤖 ...");
      let buffer = "";

      for await (const chunk of generateChatCompletionStream(messagesForAI, { model: aiChannel.settings.aiModel })) {
        buffer += chunk;
        if (buffer.length > DISCORD_MESSAGE_LIMIT) {
          const parts = splitMessage(buffer);
          await reply.edit(parts.shift());
          for (const p of parts) await message.channel.send(p);
          buffer = "";
        } else {
          await reply.edit(buffer);
        }
      }

      // Save AI response
      if (buffer.trim()) conversationHistory.push({ role: "assistant", content: buffer });

      // Save conversation to DB
      const conversation = await Conversation.getOrCreateConversation(message.author.id, message.channel.id);
      await conversation.addMessage("user", message.content || "", {});
      if (buffer.trim()) await conversation.addMessage("assistant", buffer);
      await conversation.updateLastMessageId(reply.id);
    });

  } catch (error) {
    console.error("Error in message handler:", error);
    try {
      await message.reply({ content: "⚠️ I hit an error while processing your message. Please try again with a shorter one!" });
    } catch {}
  }
}
