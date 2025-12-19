const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionsBitField
} = require("discord.js");

const { getGuild, setGuild } = require("./utils/settings");
const startServer = require("./server");

startServer();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

/* PREFIX COMMANDS */
client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith(",")) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();

  if (cmd !== "journal") return;

  if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild))
    return message.reply("❌ Admin only.");

  if (args[0] === "setform") {
    const forum = message.mentions.channels.first();
    if (!forum || forum.type !== ChannelType.GuildForum)
      return message.reply("❌ Mention a forum channel.");

    setGuild(message.guild.id, "forum", forum.id);
    return message.reply(`✅ Journal forum set to ${forum}`);
  }

  if (args[0] === "panel") {
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

    return message.channel.send({
      content: "📝 **Create a Journal Entry**",
      components: [row]
    });
  }
});

/* INTERACTIONS */
client.on("interactionCreate", async interaction => {

  /* BUTTON → MODAL */
  if (interaction.isButton()) {
    if (!interaction.customId.startsWith("journal_")) return;

    const modal = new ModalBuilder()
      .setCustomId(interaction.customId)
      .setTitle("New Journal Entry");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("title")
          .setLabel("Title")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("content")
          .setLabel("Journal Content")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
  }

  /* MODAL SUBMIT */
  if (interaction.isModalSubmit()) {
    const forumId = getGuild(interaction.guild.id).forum;
    if (!forumId)
      return interaction.reply({ content: "❌ Forum not set.", ephemeral: true });

    const forum = await interaction.guild.channels.fetch(forumId);

    const title = interaction.fields.getTextInputValue("title");
    const content = interaction.fields.getTextInputValue("content");

    const thread = await forum.threads.create({
      name: `📝 ${title}`,
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

    return interaction.reply({
      content: `✅ Journal created: ${thread}`,
      ephemeral: true
    });
  }

  /* SLASH COMMANDS */
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName !== "journal") return;

    const thread = interaction.channel;
    if (!thread.isThread())
      return interaction.reply({ content: "❌ Use inside a journal.", ephemeral: true });

    const starter = await thread.fetchStarterMessage();
    if (starter.author.id !== interaction.user.id)
      return interaction.reply({ content: "❌ Only owner allowed.", ephemeral: true });

    const target = interaction.options.getUser("user");

    if (interaction.options.getSubcommand() === "adduser") {
      await thread.permissionOverwrites.edit(target.id, {
        ViewChannel: true,
        SendMessages: true
      });
      return interaction.reply({ content: `✅ Added ${target}`, ephemeral: true });
    }

    if (interaction.options.getSubcommand() === "removeuser") {
      await thread.permissionOverwrites.delete(target.id);
      return interaction.reply({ content: `✅ Removed ${target}`, ephemeral: true });
    }
  }
});

client.login(process.env.TOKEN);
