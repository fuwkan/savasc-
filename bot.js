const Discord = require('discord.js');
const client = new Discord.Client();;
const YouTube = require('simple-youtube-api');
const yt = require('ytdl-core');
const ayarlar = require('./ayarlar.json');
const chalk = require('chalk');
const fs = require('fs');
const moment = require('moment');
require('./util/eventLoader')(client);

const youtube = new YouTube(ayarlar.api);
var prefix = ayarlar.prefix;

const log = message => {
  console.log(`[${moment().format('YYYY-MM-DD HH:mm:ss')}] ${message}`);
};

/////////////////////////////////////////
let queue = {};

const commands = {
	'play': (msg) => {
		if (queue[msg.guild.id] === undefined) return msg.channel.sendMessage(`${ayarlar.prefix}add <url> ile birkaç müzik ekle`);
		if (!msg.guild.voiceConnection) return commands.join(msg).then(() => commands.play(msg));
		if (queue[msg.guild.id].playing) return msg.channel.sendMessage('Zaten Çalınan var');
		let dispatcher;
		queue[msg.guild.id].playing = true;

		console.log(queue);
		(function play(song) {
			console.log(song);
			if (song === undefined) return msg.channel.sendMessage('Sıra boş').then(() => {
				queue[msg.guild.id].playing = false;
				msg.member.voiceChannel.leave();
			});
			msg.channel.sendMessage(`Çalınan: **${song.title}** talep eden: **${song.requester}**`);
			dispatcher = msg.guild.voiceConnection.playStream(yt(song.url, { audioonly: true }), { passes : ayarlar.passes });
			let collector = msg.channel.createCollector(m => m);
			collector.on('message', m => {
				if (m.content.startsWith(ayarlar.prefix + 'pause')) {
					msg.channel.sendMessage('**durduruldu**').then(() => {dispatcher.pause();});
				} else if (m.content.startsWith(ayarlar.prefix + 'resume')){
					msg.channel.sendMessage('**devam ediyor**').then(() => {dispatcher.resume();});
				} else if (m.content.startsWith(ayarlar.prefix + 'skip')){
					msg.channel.sendMessage('**geçildi**').then(() => {dispatcher.end();});
				} else if (m.content.startsWith('volume+')){
					if (Math.round(dispatcher.volume*50) >= 100) return msg.channel.sendMessage(`Şiddet: ${Math.round(dispatcher.volume*50)}%`);
					dispatcher.setVolume(Math.min((dispatcher.volume*50 + (2*(m.content.split('+').length-1)))/50,2));
					msg.channel.sendMessage(`Şiddet: ${Math.round(dispatcher.volume*50)}%`);
				} else if (m.content.startsWith('volume-')){
					if (Math.round(dispatcher.volume*50) <= 0) return msg.channel.sendMessage(`Şiddet: ${Math.round(dispatcher.volume*50)}%`);
					dispatcher.setVolume(Math.max((dispatcher.volume*50 - (2*(m.content.split('-').length-1)))/50,0));
					msg.channel.sendMessage(`Şiddet: ${Math.round(dispatcher.volume*50)}%`);
				} else if (m.content.startsWith(ayarlar.prefix + 'time')){
					msg.channel.sendMessage(`Süre: ${Math.floor(dispatcher.time / 60000)}:${Math.floor((dispatcher.time % 60000)/1000) <10 ? '0'+Math.floor((dispatcher.time % 60000)/1000) : Math.floor((dispatcher.time % 60000)/1000)}`);
				}
			});
			dispatcher.on('end', () => {
				collector.stop();
				play(queue[msg.guild.id].songs.shift());
			});
			dispatcher.on('error', (err) => {
				return msg.channel.sendMessage('Hata: ' + err).then(() => {
					collector.stop();
					play(queue[msg.guild.id].songs.shift());
				});
			});
		})(queue[msg.guild.id].songs.shift());
	},
	'join': (msg) => {
		return new Promise((resolve, reject) => {
			const voiceChannel = msg.member.voiceChannel;
			if (!voiceChannel || voiceChannel.type !== 'voice') return msg.reply('Bir kanala katıl.');
			voiceChannel.join().then(connection => resolve(connection)).catch(err => reject(err));
		});
	},
	'leave': (msg) => {
					const voiceChannel = msg.member.voiceChannel;

			voiceChannel.leave()
		
	},
	'add': async (msg) => {
		const args = msg.content.split(' ');
		const searchString = args.slice(1).join(' ');
		const url2 = args[1].replace(/<.+>/g, '1');
		
		try {
			var video = await youtube.getVideo(url2)
		} catch (error) {
			try {
				var videos = await youtube.searchVideos(searchString, 1)
				var video = await youtube.getVideoByID(videos[0].id)
			} catch (err) {
				console.log(err)
				message.channel.send('Bir hata oluştu: ' + err)
			};
		};
		
		var url = `https://www.youtube.com/watch?v=${video.id}`
		
		if (url == '' || url === undefined) return msg.channel.sendMessage(`Bir YouTube linki eklemek için ${ayarlar.prefix}add <url> yazınız`);
		yt.getInfo(url, (err, info) => {
			if(err) return msg.channel.sendMessage('Geçersiz YouTube Bağlantısı: ' + err);
			if (!queue.hasOwnProperty(msg.guild.id)) queue[msg.guild.id] = {}, queue[msg.guild.id].playing = false, queue[msg.guild.id].songs = [];
			queue[msg.guild.id].songs.push({url: url, title: info.title, requester: msg.author.username});
			msg.channel.sendMessage(`sıraya **${info.title}** eklendi`);
		});
	},
	'queue': (msg) => {
		if (queue[msg.guild.id] === undefined) return msg.channel.sendMessage(`Sıraya ilk önce bazı şarkıları ekle : ${ayarlar.prefix}add`);
		let tosend = [];
		queue[msg.guild.id].songs.forEach((song, i) => { tosend.push(`${i+1}. ${song.title} - Talep eden: ${song.requester}`);});
		msg.channel.sendMessage(`__**${msg.guild.name}'s Müzik Kuyruğu:**__ Şu anda **${tosend.length}** şarkı sırada ${(tosend.length > 15 ? '*[Sadece 15 tanesi gösteriliyor]*' : '')}\n\`\`\`${tosend.slice(0,15).join('\n')}\`\`\``);
	}
};

client.on('ready', () => {
	console.log('ready!');
});

client.on('message', msg => {
	if (!msg.content.startsWith(ayarlar.prefix)) return;
	if (commands.hasOwnProperty(msg.content.toLowerCase().slice(ayarlar.prefix.length).split(' ')[0])) commands[msg.content.toLowerCase().slice(ayarlar.prefix.length).split(' ')[0]](msg);
});
/////////////////////////////////////////

client.commands = new Discord.Collection();
client.aliases = new Discord.Collection();
fs.readdir('./komutlar/', (err, files) => {
  if (err) console.error(err);
  log(`${files.length} komut yüklenecek.`);
  files.forEach(f => {
    let props = require(`./komutlar/${f}`);
    log(`Yüklenen komut: ${props.help.name}.`);
    client.commands.set(props.help.name, props);
    props.conf.aliases.forEach(alias => {
      client.aliases.set(alias, props.help.name);
    });
  });
});

client.reload = command => {
  return new Promise((resolve, reject) => {
    try {
      delete require.cache[require.resolve(`./komutlar/${command}`)];
      let cmd = require(`./komutlar/${command}`);
      client.commands.delete(command);
      client.aliases.forEach((cmd, alias) => {
        if (cmd === command) client.aliases.delete(alias);
      });
      client.commands.set(command, cmd);
      cmd.conf.aliases.forEach(alias => {
        client.aliases.set(alias, cmd.help.name);
      });
      resolve();
    } catch (e){
      reject(e);
    }
  });
};

client.load = command => {
  return new Promise((resolve, reject) => {
    try {
      let cmd = require(`./komutlar/${command}`);
      client.commands.set(command, cmd);
      cmd.conf.aliases.forEach(alias => {
        client.aliases.set(alias, cmd.help.name);
      });
      resolve();
    } catch (e){
      reject(e);
    }
  });
};

client.unload = command => {
  return new Promise((resolve, reject) => {
    try {
      delete require.cache[require.resolve(`./komutlar/${command}`)];
      let cmd = require(`./komutlar/${command}`);
      client.commands.delete(command);
      client.aliases.forEach((cmd, alias) => {
        if (cmd === command) client.aliases.delete(alias);
      });
      resolve();
    } catch (e){
      reject(e);
    }
  });
};

client.on('message', msg => {
  if (msg.content.toLowerCase() === 'sa') {
    msg.reply('Aleyküm Selam Knk Hoşgeldin');
  }
  
      if (msg.content.toLowerCase() === '+ping') {
      msg.reply('ping/ms **' + client.ping + '**');
}
    if (msg.content.toLowerCase() === 'sa') {
    msg.reply('as');
  }

  if (msg.content.toLowerCase() === prefix + 'türkbayrak') {
    msg.channel.sendMessage('🇹🇷');
  }
    if (msg.content.toLowerCase() === prefix + 'azerbaycanbayrak') {
    msg.channel.sendMessage('🇦🇿');
  }
    if (msg.content.toLowerCase() === prefix + 'ingilizbayrak') {
    msg.channel.sendMessage('🇺🇸');
  }
      if (msg.content.toLowerCase() === prefix + 'brezilyabayrak') {
    msg.channel.sendMessage('🇧🇷');
  }
        if (msg.content.toLowerCase() === prefix + 'kahve') {
    msg.reply('Bir Kahve İçti ');
  }
   if (msg.content.toLowerCase() === prefix + 'kahve') {
    msg.channel.sendMessage('https://giphy.com/gifs/totorial-3o6fIVzH8l5cXm6ZYQ');
  }
      if (msg.content.toLowerCase() === prefix + 'dersprogram') {
    msg.reply('Not= Bu Ders Programı 7/C Sınıfına Aittir.');
  }
    if (msg.content.toLowerCase() === prefix + 'dersprogram') {
    msg.channel.sendMessage('http://www.resimag.com/p1/9901ef5f73.png');
  }

  if (msg.content.toLowerCase() === prefix + 'spawmozeladmin') {
    msg.channel.sendMessage('...');
	msg.channel.sendMessage('...');
	    msg.channel.sendMessage('...');
		    msg.channel.sendMessage('...');
			    msg.channel.sendMessage('...');
				    msg.channel.sendMessage('...');
					    msg.channel.sendMessage('...');
						    msg.channel.sendMessage('...');
							    msg.channel.sendMessage('...');
								    msg.channel.sendMessage('...');
									    msg.channel.sendMessage('...');
										    msg.channel.sendMessage('...');
											    msg.channel.sendMessage('...');
												    msg.channel.sendMessage('...');
													    msg.channel.sendMessage('...');
														    msg.channel.sendMessage('...');
															    msg.channel.sendMessage('...');
																    msg.channel.sendMessage('...');
																	    msg.channel.sendMessage('...');
																		    msg.channel.sendMessage('...');
																			    msg.channel.sendMessage('...');
																				    msg.channel.sendMessage('...');
																					    msg.channel.sendMessage('...');
																						    msg.channel.sendMessage('...');
																							    msg.channel.sendMessage('...');
																								    msg.channel.sendMessage('...');
																									}
																																															
    if (msg.content.toLowerCase() === prefix + 'izmirmarşı') {
	msg.channel.sendMessage('-------------------------------------');
    msg.channel.sendMessage('İzmirin dağlarında çiçekler açar. ');
	msg.channel.sendMessage('Altın güneş orda sırmalar saçar. ');
	    msg.channel.sendMessage('Bozulmuş düşmanlar yel gibi kaçar. ');
		    msg.channel.sendMessage('Yaşa Mustafa Kemal Paşa,yaşa ');
			    msg.channel.sendMessage('Adın yazılacak mücevher taşa. ');
				    msg.channel.sendMessage('-------------------------------------');
					    msg.channel.sendMessage('İzmir dağlarına bomba koydular ');
						    msg.channel.sendMessage('Türkün sancağını öne koydular ');
							    msg.channel.sendMessage('Şanlı zaferlerle düşmanı boğdular. ');
								    msg.channel.sendMessage('Kader böyle imiş ey garip ana ');
									    msg.channel.sendMessage('Kanım feda olsun güzel vatana. ');
										    msg.channel.sendMessage('-------------------------------------');
											    msg.channel.sendMessage('İzmirin dağlarında oturdum kaldım ');
												    msg.channel.sendMessage('Şehit olanları deftere yazdim. ');
													    msg.channel.sendMessage('Öksüz yavruları bağrıma bastım ');
														    msg.channel.sendMessage('Kader böyle imiş ey garip ana ');
															    msg.channel.sendMessage('Kanim feda olsun güzel vatana ');
																    msg.channel.sendMessage('-------------------------------------');
																	    msg.channel.sendMessage('Türk oğluyum ben ölmek isterim. ');
																		    msg.channel.sendMessage('Toprak diken olsa yatağım yerim ');
																			    msg.channel.sendMessage('Allahından utansın dönenler geri ');
																				    msg.channel.sendMessage('Yaşa Mustafa Kemal Paşa,yaşa ');
																					    msg.channel.sendMessage('Adın yazılacak mücevher taşa.');
																						    msg.channel.sendMessage('-------------------------------------');						
																							}


	if (msg.content.toLowerCase() === prefix + 'istiklalmarşı') {
	msg.channel.sendMessage('-------------------------------------');
    msg.channel.sendMessage('Korkma, sönmez bu şafaklarda yüzen al sancak;');
	msg.channel.sendMessage('Sönmeden yurdumun üstünde tüten en son ocak.');
	    msg.channel.sendMessage('O benim milletimin yıldızıdır, parlayacak;');
		    msg.channel.sendMessage('O benimdir, o benim milletimindir ancak.');
				    msg.channel.sendMessage('-------------------------------------');
					    msg.channel.sendMessage('Çatma, kurban olayım, çehrene ey nazlı hilal!');
						    msg.channel.sendMessage('Kahraman ırkıma bir gül... Ne bu şiddet, bu celal?');
							    msg.channel.sendMessage('Sana olmaz dökülen kanlarımız sonra helal;');
								    msg.channel.sendMessage('Hakkıdır, Hakka tapan, milletimin istiklal.');
										    msg.channel.sendMessage('-------------------------------------');
                           }
  
          if (msg.content.toLowerCase() === prefix + 'gif')  {
  	if (Math.floor((Math.random() * 13) + 1) === 1) {
   		msg.channel.sendMessage('https://media.giphy.com/media/1TSUKOv4k56aIryKAP/giphy.gif');
   	}else if (Math.floor((Math.random() * 13) + 1) === 2) {
   		msg.channel.sendMessage('https://media.giphy.com/media/ASzK5wWjMtc6A/giphy.gif');
   	}else if (Math.floor((Math.random() * 13) + 1) === 3) {
   		msg.channel.sendMessage('https://media.giphy.com/media/E9oadOOmD27jG/giphy.gif');
   	}else if (Math.floor((Math.random() * 13) + 1) === 4) {
   		msg.channel.sendMessage('https://media.giphy.com/media/O1GhSbro4z4Dm/giphy.gif');
   	}else if (Math.floor((Math.random() * 13) + 1) === 5) {
   		msg.channel.sendMessage('https://media.giphy.com/media/ASzK5wWjMtc6A/giphy.gif');
   	}else if (Math.floor((Math.random() * 13) + 1) === 6) {
   		msg.channel.sendMessage('https://media.giphy.com/media/E9oadOOmD27jG/giphy.gif');
   	}else if (Math.floor((Math.random() * 13) + 1) === 7) {
   		msg.channel.sendMessage('https://media.giphy.com/media/O1GhSbro4z4Dm/giphy.gif');
   	}else if (Math.floor((Math.random() * 13) + 1) === 8) {
   		msg.channel.sendMessage('https://media.giphy.com/media/ND6xkVPaj8tHO/giphy.gif');
   	}else if (Math.floor((Math.random() * 13) + 1) === 9) {
   		msg.channel.sendMessage('https://media.giphy.com/media/w60oAqglSRa1icDwO1/giphy.gif');
   	}else if (Math.floor((Math.random() * 13) + 1) === 10) {
   		msg.channel.sendMessage('https://media.giphy.com/media/WFEGOIIrj6SY0/giphy.gif');
   }else if (Math.floor((Math.random() * 13) + 1) === 11) {
   		msg.channel.sendMessage('https://media.giphy.com/media/ND6xkVPaj8tHO/giphy.gif');
	}else if (Math.floor((Math.random() * 13) + 1) === 12) {
   		msg.channel.sendMessage('https://media.giphy.com/media/ND6xkVPaj8tHO/giphy.gif');
	}else if (Math.floor((Math.random() * 13) + 1) === 13) {
   		msg.channel.sendMessage('https://media.giphy.com/media/ND6xkVPaj8tHO/giphy.gif');
   }
  }
  
  
          if (msg.content.toLowerCase() === prefix + 'pokemon') {
  	if (Math.floor((Math.random() * 13) + 1) === 1) {
   		msg.channel.sendMessage('http://www.hareketligifler.net/data/media/1446/pokemon-hareketli-resim-0100.gif');
   	}else if (Math.floor((Math.random() * 13) + 1) === 2) {
   		msg.channel.sendMessage('http://www.hareketligifler.net/data/media/1446/pokemon-hareketli-resim-0095.gif');
   	}else if (Math.floor((Math.random() * 13) + 1) === 3) {
   		msg.channel.sendMessage('http://www.hareketligifler.net/data/media/1446/pokemon-hareketli-resim-0007.gif');
   	}else if (Math.floor((Math.random() * 13) + 1) === 4) {
   		msg.channel.sendMessage('http://www.hareketligifler.net/data/media/1446/pokemon-hareketli-resim-0102.gif');
   	}else if (Math.floor((Math.random() * 13) + 1) === 5) {
   		msg.channel.sendMessage('http://www.hareketligifler.net/data/media/1446/pokemon-hareketli-resim-0092.gif');
   	}else if (Math.floor((Math.random() * 13) + 1) === 6) {
   		msg.channel.sendMessage('http://www.hareketligifler.net/data/media/1446/pokemon-hareketli-resim-0081.gif');
   	}else if (Math.floor((Math.random() * 13) + 1) === 7) {
   		msg.reply('http://www.hareketligifler.net/data/media/1446/pokemon-hareketli-resim-0082.gif');
   	}else if (Math.floor((Math.random() * 13) + 1) === 8) {
   		msg.channel.sendMessage('http://www.hareketligifler.net/data/media/1446/pokemon-hareketli-resim-0073.gif');
   	}else if (Math.floor((Math.random() * 13) + 1) === 9) {
   		msg.reply('http://www.hareketligifler.net/data/media/1446/pokemon-hareketli-resim-0039.gif');
   	}else if (Math.floor((Math.random() * 13) + 1) === 10) {
   		msg.channel.sendMessage('http://www.hareketligifler.net/data/media/1446/pokemon-hareketli-resim-0017.gif');
   }else if (Math.floor((Math.random() * 13) + 1) === 11) {
   		msg.channel.sendMessage('http://www.hareketligifler.net/data/media/1446/pokemon-hareketli-resim-0040.gif');
	}else if (Math.floor((Math.random() * 13) + 1) === 12) {
   		msg.channel.sendMessage('http://www.hareketligifler.net/data/media/1446/pokemon-hareketli-resim-0021.gif');
	}else if (Math.floor((Math.random() * 13) + 1) === 13) {
   		msg.channel.sendMessage('http://www.hareketligifler.net/data/media/1446/pokemon-hareketli-resim-0009.gif');
   }
  }
  
  
            
          if (msg.content.toLowerCase() === prefix + 'zarat') {
  	if (Math.floor((Math.random() * 13) + 1) === 1) {
   		msg.channel.sendMessage('🎲1');
   	}else if (Math.floor((Math.random() * 13) + 1) === 2) {
   		msg.channel.sendMessage('🎲2');
   	}else if (Math.floor((Math.random() * 13) + 1) === 3) {
   		msg.channel.sendMessage('🎲3');
   	}else if (Math.floor((Math.random() * 13) + 1) === 4) {
   		msg.channel.sendMessage('🎲4');
   	}else if (Math.floor((Math.random() * 13) + 1) === 5) {
   		msg.channel.sendMessage('🎲5');
   	}else if (Math.floor((Math.random() * 13) + 1) === 6) {
   		msg.channel.sendMessage('🎲6');
   	}else if (Math.floor((Math.random() * 13) + 1) === 7) {
   		msg.channel.sendMessage('🎲6');
   	}else if (Math.floor((Math.random() * 13) + 1) === 8) {
   		msg.channel.sendMessage('🎲5');
   	}else if (Math.floor((Math.random() * 13) + 1) === 9) {
   		msg.channel.sendMessage('🎲-4');
   	}else if (Math.floor((Math.random() * 13) + 1) === 10) {
   		msg.channel.sendMessage('🎲3');
   }else if (Math.floor((Math.random() * 13) + 1) === 11) {
   		msg.channel.sendMessage('🎲2');
	}else if (Math.floor((Math.random() * 13) + 1) === 12) {
   		msg.channel.sendMessage('🎲1');
	}else if (Math.floor((Math.random() * 13) + 1) === 13) {
   		msg.channel.sendMessage('🎲1');
   }
  }
	
	
            if (msg.content.toLowerCase() === prefix + 'instagram') {
    msg.channel.sendMessage(' Furkan İnstagram = https://www.instagram.com/xentree.furkan/?hl=tr&fbclid=IwAR1nZCUQEDX9Br5_1kvjO5tQqYEFrqpLc1IUheBdQD_3-lojeYH9bZqv7a8');
  }

            if (msg.content.toLowerCase() === prefix + 'dolar') {
    msg.channel.sendMessage(' http://bigpara.hurriyet.com.tr/doviz/dolar/ ');
  }
  
              if (msg.content.toLowerCase() === prefix + 'çizgi') {
    msg.channel.sendMessage('-------------------------------------');
  }
});

client.elevation = message => {
  if(!message.guild) {
	return; }
  let permlvl = 0;
  if (message.member.hasPermission("BAN_MEMBERS")) permlvl = 2;
  if (message.member.hasPermission("ADMINISTRATOR")) permlvl = 3;
  if (message.author.id === ayarlar.sahip) permlvl = 4;
  return permlvl;
};

var regToken = /[\w\d]{24}\.[\w\d]{6}\.[\w\d-_]{27}/g;
// client.on('debug', e => {
//   console.log(chalk.bgBlue.green(e.replace(regToken, 'that was redacted')));
// });

client.on('message', msg => {
  if (msg.content.toLowerCase() === 'amk') {
   msg.delete(30)
    msg.channel.sendMessage('📌Küfür Engellendi');
  }
});

client.on('message', msg => {
  if (msg.content.toLowerCase() === 'sik') {
   msg.delete(30)
    msg.channel.sendMessage('📌Küfür Engellendi');
  }
});

client.on('message', msg => {
  if (msg.content.toLowerCase() === 'am') {
   msg.delete(30)
    msg.channel.sendMessage('📌Küfür Engellendi');
  }
});

client.on('message', msg => {
  if (msg.content.toLowerCase() === 'yarrak') {
   msg.delete(30)
    msg.channel.sendMessage('📌Küfür Engellendi');
  }
});

client.on('message', msg => {
  if (msg.content.toLowerCase() === 'sik') {
   msg.delete(30)
    msg.channel.sendMessage('📌Küfür Engellendi');
  }
});


client.on('message', msg => {
  if (msg.content.toLowerCase() === 'pipi') {
   msg.delete(30)
    msg.channel.sendMessage('📌Küfür Engellendi');
  }
});

client.on('message', msg => {
  if (msg.content.toLowerCase() === 'sex') {
   msg.delete(30)
    msg.channel.sendMessage('📌Küfür Engellendi');
  }
});

client.on('message', msg => {
  if (msg.content.toLowerCase() === 'porno') {
   msg.delete(30)
    msg.channel.sendMessage('📌Küfür Engellendi');
  }
});

client.on('message', msg => {
  if (msg.content.toLowerCase() === 'sikik') {
   msg.delete(30)
    msg.channel.sendMessage('📌Küfür Engellendi');
  }
});

client.on('message', msg => {
  if (msg.content.toLowerCase() === 'orospu çocuğu') {
   msg.delete(30)
    msg.channel.sendMessage('📌Küfür Engellendi');
  }
});

client.on('message', msg => {
  if (msg.content.toLowerCase() === 'amınakoduğum') {
   msg.delete(30)
    msg.channel.sendMessage('📌Küfür Engellendi');
  }
});

client.on('message', msg => {
  if (msg.content.toLowerCase() === 'amcık') {
   msg.delete(30)
    msg.channel.sendMessage('📌Küfür Engellendi');
  }
});

client.on('message', msg => {
  if (msg.content.toLowerCase() === 'taşşak') {
   msg.delete(30)
    msg.channel.sendMessage('📌Küfür Engellendi');
  }
});

client.on('message', msg => {
  if (msg.content.toLowerCase() === 'taşşaksız') {
   msg.delete(30)
    msg.channel.sendMessage('📌Küfür Engellendi');
  }
});

client.on('message', msg => {
  if (msg.content.toLowerCase() === 'yarraksız') {
   msg.delete(30)
    msg.channel.sendMessage('📌Küfür Engellendi');
  }
});

client.on('message', msg => {
  if (msg.content.toLowerCase() === 'oç') {
   msg.delete(30)
    msg.channel.sendMessage('📌Küfür Engellendi');
  }
});

client.on('message', msg => {
  if (msg.content.toLowerCase() === 'OC') {
   msg.delete(30)
    msg.channel.sendMessage('📌Küfür Engellendi');
  }
});

client.on('message', msg => {
  if (msg.content.toLowerCase() === 'göt') {
   msg.delete(30)
    msg.channel.sendMessage('📌Küfür Engellendi');
  }
});

client.on('message', msg => {
  if (msg.content.toLowerCase() === 'amıcık') {
   msg.delete(30)
    msg.channel.sendMessage('📌Küfür Engellendi');
  }
});

client.on('message', msg => {
  if (msg.content.toLowerCase() === 'ne diyon amk') {
   msg.delete(30)
    msg.channel.sendMessage('📌Küfür Engellendi');
  }
});

client.on('message', msg => {
  if (msg.content.toLowerCase() === 'göt') {
   msg.delete(30)
    msg.channel.sendMessage('📌Küfür Engellendi');
  }
});

client.on('message', msg => {
  if (msg.content.toLowerCase() === 'götcük') {
   msg.delete(30)
    msg.channel.sendMessage('📌Küfür Engellendi');
  }
});

client.on('message', msg => {
  if (msg.content.toLowerCase() === 'hanife') {
   msg.delete(30)
    msg.channel.sendMessage('📌Küfür Engellendi');
  }
});

client.on('message', msg => {
  if (msg.content.toLowerCase() === 'zehra') {
   msg.delete(30)
    msg.channel.sendMessage('📌Küfür Engellendi');
  }
});

client.on('message', msg => {
  if (msg.content.toLowerCase() === 'ananı sikerim') {
   msg.delete(30)
    msg.channel.sendMessage('📌Küfür Engellendi');
  }
});

client.on('message', msg => {
  if (msg.content.toLowerCase() === 'ananısikerim') {
   msg.delete(30)
    msg.channel.sendMessage('📌Küfür Engellendi');
  }
});

client.on('message', msg => {
  if (msg.content.toLowerCase() === 'sikimi kemir') {
   msg.delete(30)
    msg.channel.sendMessage('📌Küfür Engellendi');
  }
});

client.on('message', msg => {
  if (msg.content.toLowerCase() === prefix + 'botdavet') {
    if (msg.channel.type !== 'dm') {
      const ozelmesajkontrol = new Discord.RichEmbed()
    .setColor(0x00AE86)
    .setTimestamp()
    .setAuthor(msg.author.username, msg.author.avatarURL)
    .addField(msg.author.username, 'Özel mesajlarını kontrol et. :postbox:');
    msg.channel.sendEmbed(ozelmesajkontrol) }
      msg.author.sendMessage("Bot Davet Link: https://discordapp.com/oauth2/authorize?client_id=510761813563015168&scope=bot&permissions=2146958847").then(message => console.log(`[${moment().format('YYYY-MM-DD HH:mm:ss')}] Gönderilen mesaj: ${message.content}`)).catch(console.error);
  }
});

client.on('message', msg => {
  if (msg.content.toLowerCase() === prefix + '----deneme----kod') {
    if (msg.channel.type !== 'dm') {
      const ozelmesajkontrol = new Discord.RichEmbed()
    .setColor(0x00AE86)
    .setTimestamp()
    .setAuthor(msg.author.username, msg.author.avatarURL)
    .addField(msg.author.username, 'Özel mesajlarını kontrol et. :postbox:');
    msg.channel.sendEmbed(ozelmesajkontrol) }
      msg.author.sendMessage("Yardım İçin Sunucu Kurucusu İle Konuşabilirsiniz.").then(message => console.log(`[${moment().format('YYYY-MM-DD HH:mm:ss')}] Gönderilen mesaj: ${message.content}`)).catch(console.error);
	  msg.author.sendMessage("-------------------------------------------------").then(message => console.log(`[${moment().format('YYYY-MM-DD HH:mm:ss')}] Gönderilen mesaj: ${message.content}`)).catch(console.error);
  }
});

client.on('message', msg => {
  if (msg.content.toLowerCase() === prefix + 'sunucudavet') {
    if (msg.channel.type !== 'dm') {
      const ozelmesajkontrol = new Discord.RichEmbed()
    .setColor(0x00AE86)
    .setTimestamp()
    .setAuthor(msg.author.username, msg.author.avatarURL)
    .addField(msg.author.username, 'Özel mesajlarını kontrol et. :postbox:');
    msg.channel.sendEmbed(ozelmesajkontrol) }
      msg.author.sendMessage("Sunucu Davet Link: https://discord.gg/yGdswDQ").then(message => console.log(`[${moment().format('YYYY-MM-DD HH:mm:ss')}] Gönderilen mesaj: ${message.content}`)).catch(console.error);
  }
});
  
client.on('warn', e => {
  console.log(chalk.bgYellow(e.replace(regToken, 'that was redacted')));
});

client.on('error', e => {
  console.log(chalk.bgRed(e.replace(regToken, 'that was redacted')));
});

////////////////////////

client.on("guildMemberAdd", member => {
	
	var channel = member.guild.channels.find("name", "giriş-çıkış");
	if (!channel) return;
	
	var role = member.guild.roles.find("name", "vatandaş");
	if (!role) return;
	
	member.addRole(role); 
	
	channel.send(member + " artık " + role + " rolü ile aramızda");
	
	member.send("Aramıza hoş geldin! Artık @vatandaş rolüne sahipsin!")
	
});

////////////////////////

// SUNUCUYA GİRİŞ
client.on('guildMemberAdd', member => {
  let Sunucu = member.guild;
  let GirişRolü = guild.roles.find('name', 'vatandaş');
  member.addRole(Vatandaş);

  const GirişKanalı = member.guild.channels.find('name', 'giriş-çıkış');
  if (!GirişKanalı) return;
  const GirişMesaj = new Discord.RichEmbed()
  .setColor('GREEN')
  .setAuthor(member.user.username, member.user.avatarURL)
  .setThumbnail(member.user.avatarURL)
  .setTitle('📥 | Sunucuya katıldı')
  .setTimestamp()
  GirişKanalı.sendEmbed(GirişMesaj);
});

// SUNUCUDAN ÇIKIŞ
client.on('guildMemberRemove', member => {
  const ÇıkışKanalı = member.guild.channels.find('name', 'giriş-çıkış');
  if (!ÇıkışKanalı) return;
  const ÇıkışMesaj = new Discord.RichEmbed()
  .setColor('RED')
  .setAuthor(member.user.username, member.user.avatarURL)
  .setThumbnail(member.user.avatarURL)
  .setTitle('📤 | Sunucudan Ayrıldı')
  .setTimestamp()
  ÇıkışKanalı.sendEmbed(ÇıkışMesaj); 
});

client.login(process.env.BOT_TOKEN);
