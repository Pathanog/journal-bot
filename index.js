const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionsBitField
} = require("discord.js");

const startServer = require("./server");
const { getGuild, setGuild } = require("./utils/settings");

startServer();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

/* PREFIX COMMANDS */
client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith(",")) return;

  const args = message.content.slice(1).split(/ +/);
  const cmd = args.shift()?.toLowerCase();

  if (cmd === "journal" && args[0] === "setform") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild))
      return message.reply("❌ Need Manage Server permission.");

    const channel = message.mentions.channels.first();
    if (!channel || channel.type !== ChannelType.GuildForum)
      return message.reply("❌ Mention a forum channel.");

    setGuild(message.guild.id, "forum", channel.id);
    return message.reply(`✅ Journal forum set to ${channel}`);
  }

  if (cmd === "journal" && args[0] === "panel") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild))
      return message.reply("❌ Need Manage Server permission.");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("journal_public")
        .setLabel("🟢 Public Journal")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("journal_private")
        .setLabel("🔒 Private Journal")
        .setStyle(ButtonStyle.Secondary)
    );

    message.channel.send({
      content: "📝 **Create a Journal**",
      components: [row]
    });
  }
});

/* INTERACTIONS */
client.on("interactionCreate", async interaction => {
  if (interaction.isButton()) {
    const modal = new ModalBuilder()
      .setCustomId(interaction.customId)
      .setTitle("Create Journal");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("title")
          .setLabel("Journal Title")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("content")
          .setLabel("Journal Entry")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit()) {
    const forumId = getGuild(interaction.guild.id).forum;
    if (!forumId)
      return interaction.reply({ content: "Forum not set.", ephemeral: true });

    const forum = await interaction.guild.channels.fetch(forumId);
    const title = interaction.fields.getTextInputValue("title");
    const content = interaction.fields.getTextInputValue("content");

    const thread = await forum.threads.create({
      name: title,
      message: {
        content: `**Journal by ${interaction.user}**\n\n${content}`
      }
    });

    if (interaction.customId.includes("private")) {
      await thread.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        ViewChannel: false
      });
      await thread.permissionOverwrites.edit(interaction.user.id, {
        ViewChannel: true,
        SendMessages: true
      });
    }

    interaction.reply({ content: `✅ Journal created: ${thread}`, ephemeral: true });
  }
});

client.login(process.env.TOKEN);
