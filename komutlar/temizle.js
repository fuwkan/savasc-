const Discord = require("discord.js");
const errors = require("../utils/errors.js");

module.exports.run = async (bot, message, args) => {

  if(!message.member.hasPermission("MANAGE_MESSAGES")) return errors.noPerms(message, "MANAGE_MESSAGES");
  if(!args[0]) return message.channel.send(":x: Dostum bir sayı belirtmelisin.");
  message.channel.bulkDelete(args[0]).then(() => {
    message.channel.send(`:white_check_mark: Başarı ile ${args[0]} adet mesaj silindi.`).then(msg => msg.delete(5000));
  });
}

module.exports.help = {
  name: "temizle"
}
