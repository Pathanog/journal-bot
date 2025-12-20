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
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const startServer = require("./server");
const { getGuild, setGuild } = require("./utils/settings");
const config = require("./config.json");

startServer();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

/* 🔹 AUTO REGISTER SLASH COMMANDS (INSTANT, RENDER FREE SAFE) */
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("journal")
      .setDescription("Journal management")
      .addSubcommand(sc =>
        sc.setName("adduser")
          .setDescription("Add user to private journal")
          .addUserOption(o =>
            o.setName("user").setDescription("User").setRequired(true)
          )
      )
      .addSubcommand(sc =>
        sc.setName("removeuser")
          .setDescription("Remove user from private journal")
          .addUserOption(o =>
            o.setName("user").setDescription("User").setRequired(true)
          )
      )
  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  for (const guild of client.guilds.cache.values()) {
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, guild.id),
      { body: commands }
    );
  }

  console.log("Slash commands registered");
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
});

/* PREFIX COMMANDS */
client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith(",")) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();
  if (cmd !== "journal") return;

  if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild))
    return message.reply("❌ Admin only");

  if (args[0] === "setpublic") {
    const forum = message.mentions.channels.first();
    if (!forum || forum.type !== ChannelType.GuildForum)
      return message.reply("❌ Mention a forum channel");

    setGuild(message.guild.id, "publicForum", forum.id);
    return message.reply(`✅ Public journal forum set to ${forum}`);
  }

  if (args[0] === "setprivate") {
    const forum = message.mentions.channels.first();
    if (!forum || forum.type !== ChannelType.GuildForum)
      return message.reply("❌ Mention a forum channel");

    setGuild(message.guild.id, "privateForum", forum.id);
    return message.reply(`✅ Private journal forum set to ${forum}`);
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

    message.channel.send({
      content: "📝 **Create a Journal**",
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
      .setTitle("New Journal");

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
          .setLabel("Journal Content")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
  }

  /* MODAL SUBMIT */
  if (interaction.isModalSubmit()) {
    const guildData = getGuild(interaction.guild.id);

    const forumId = interaction.customId === "journal_private"
      ? guildData.privateForum
      : guildData.publicForum;

    if (!forumId)
      return interaction.reply({ content: "❌ Forum not set", ephemeral: true });

    const forum = await interaction.guild.channels.fetch(forumId);

    const thread = await forum.threads.create({
      name: interaction.fields.getTextInputValue("title"),
      topic: `OWNER:${interaction.user.id}`,
      message: {
        content: `📝 Journal by ${interaction.user}\n\n${interaction.fields.getTextInputValue("content")}`
      }
    });

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
      return interaction.reply({ content: "❌ Use inside a journal", ephemeral: true });

    if (!thread.topic || !thread.topic.startsWith("OWNER:"))
      return interaction.reply({ content: "❌ Owner not found", ephemeral: true });

    const ownerId = thread.topic.split("OWNER:")[1];
    if (ownerId !== interaction.user.id)
      return interaction.reply({ content: "❌ Only owner allowed", ephemeral: true });

    const target = interaction.options.getUser("user");

    if (interaction.options.getSubcommand() === "adduser") {
      await thread.members.add(target.id);
      return interaction.reply({ content: `✅ Added ${target}`, ephemeral: true });
    }

    if (interaction.options.getSubcommand() === "removeuser") {
      await thread.members.remove(target.id);
      return interaction.reply({ content: `✅ Removed ${target}`, ephemeral: true });
    }
  }
});

client.login(process.env.TOKEN);
