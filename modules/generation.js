const bdd = require("../models/index.js")
const utils = require("./utils")
const videoModule = require("./video")

module.exports = {
	restart_generation: () => {
		console.log("Reprise de générations...")
		bdd.Video.findAll({where: {status: "during"}}).then((videos) => {
			videos.forEach((v) => {
				videoModule.start_generation(v.id)
			})
		})
	  
		bdd.Social.findAll({where: {status: "during"}}).then((socials) => {
			socials.forEach((p) => {
				if (p.rss != "__custom__") {
					generateImgSocial(p.rss, p.guid, p.id);
				}
			})
		})	  
	},
	flush: () => {
		utils.get_option("KEEPING_TIME", (KEEPING_TIME) => {
			bdd.Video.findAll({where: {status: "finished"}}).then((videos) => {
				if (videos.length >=1) {
					for (i = 0; i < videos.length; i++) {
						time = Date.now() - videos[i].end_timestamp
						time = time / (1000 * 60 * 60);
						
						if (time > KEEPING_TIME) {
							try {
								fs.unlinkSync(path.join(m.utils.path_evalute(process.env.EXPORT_FOLDER), `output_${videos[i].id}.mp4`))
							} catch (err) {
								console.log(`Fichier output_${videos[i].id}.mp4 déjà supprimé`)
							}
							videos[i].status = "deleted"
							videos[i].save()
							console.log("Flush video " + videos[i].id)
						}
					}
				}
			})
		
			bdd.Social.findAll({where: {status: "finished"}}).then((socials) => {
				if (socials.length >=1) {
					for (i = 0; i < socials.length; i++) {
						time = Date.now() - socials[i].end_timestamp
						time = time / (1000 * 60 * 60);
					
						if (time > KEEPING_TIME) {
							try {
								fs.unlinkSync(path.join(m.utils.path_evalute(process.env.EXPORT_FOLDER), `social_${socials[i].id}.mp4`))
							} catch (err) {
								console.log(`Fichier social_${socials[i].id}.mp4 déjà supprimé`)
							}
				
							socials[i].status = "deleted"
							socials[i].save()
							console.log("Flush social " + socials[i].id)
						}
					}
				} 
			})
		})
	},
	init_new_generation: () => {
		bdd.Video.count({where: {status: "during"}}).then((nb) => {
			utils.get_option("MAX_DURING", ((MAX_DURING) => {
				if (nb < MAX_DURING) {
					bdd.Video.findOne({where: {status: "waiting"}, order: [["priority", "DESC"], ["id", "ASC"]]}).then((video) => {
						if(video != null) {
							video.status = 'during'
							video.save().then((video) => {
								videoModule.start_generation(video.id)
							})
						}
					})
				}
			}))
		})
	  
		bdd.Social.count({where: {status: "during"}}).then((nb) => {
			utils.get_option("MAX_DURING_SOCIAL", ((MAX_DURING_SOCIAL) => {
				if (nb < MAX_DURING_SOCIAL) {
					bdd.Social.findOne({where: {status: "waiting"}, order: [["priority", "DESC"], ["id", "ASC"]]}).then((social) => {
						if (social != null) {
							social.status = "during"
							social.save().then((social) => {
								if (social.rss != "__custom__") {
									generateImgSocial(social.rss, social.guid, social.id);
								} else {
									generateImgSocialCustom(social.id)
								}
							})
						}
					})
				}
			}))
		})
	}
}