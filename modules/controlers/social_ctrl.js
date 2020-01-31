const fs = require('fs');
const path = require("path");
const mustache = require("mustache");
const utils = require("../utils")
const bdd = require("../../models/index.js")
const Op = bdd.Sequelize.Op;
const generation = require("../generation")
const randtoken = require('rand-token');

module.exports = {
	index: (req, res, next) => {
		utils.get_option("KEEPING_TIME", (KEEPING_TIME) => {
			bdd.Social.count({
				where: {
				[Op.or]: [{status: "waiting"}, {status: "during"}]
				}
			}).then((nb) => {
				template = fs.readFileSync(path.join(__dirname, "../../web/social.mustache"), "utf8")
		
				var render_object = {
				"waiting_list": nb,
				"keeping_time": KEEPING_TIME,
				"csrfToken": req.csrfToken
				}
			
				res.setHeader("content-type", "text/html");
				res.send(mustache.render(template, render_object, partials))
			})
		})
	},
	custom: (req, res, next) => {
		m.utils.get_option("KEEPING_TIME", (KEEPING_TIME) => {
			bdd.Social.count({
				where: {
					[Op.or]: [{status: "waiting"}, {status: "during"}]
				}
			}).then((nb) => {
				template = fs.readFileSync(path.join(__dirname, "/web/social_custom.mustache"), "utf8")
		
				var render_object = {
					"waiting_list": nb,
					"keeping_time": KEEPING_TIME,
					"csrfToken": req.csrfToken
				}
			
				res.setHeader("content-type", "text/html");
				res.send(mustache.render(template, render_object, partials))
			})
		})
	},
	add: (req, res, next) => {
		if (req.body.email != undefined && req.body.timestart != undefined && req.body.timestart.match(/[0-9][0-9]:[0-9][0-9]:[0-9][0-9]/).length == 1 && req.body.duration != undefined) {
			utils.check_if_rss(req.body.rss, (isRss) => {
				if(isRss) {
					utils.get_last_guid(req.body.rss, req.body.selectEp, (guid)=> {
						checkIfExistSocial(req, res, guid, () => {
							bdd.Social.create({
								rss: req.body.rss,
								email: req.body.email,
								access_token: randtoken.generate(32),
								startTime: req.body.timestart,
								duration: req.body.duration,
								guid: guid
							}).then((social) => {
								generation.init_new_generation();
								res.sendFile(path.join(__dirname, "../../web/done.html"))
							})
						})
					})
				} else {
					template = fs.readFileSync(path.join(__dirname, "../../web/error.mustache"), "utf8")
					
					var render_object = {
					"err_message": "L'URL que vous avez entré " + req.body.rss + " n'est pas un flux RSS valide!"
					}
					
					res.setHeader("content-type", "text/html");
					res.send(mustache.render(template, render_object))
				}
			}) 
		} else {
			res.status(400).send("Votre requète n'est pas complète...")
		}
	},
	add_custom: (req, res, next) => {
		if (req.body.email != undefined && req.body.imgURL != undefined && req.body.epTitle != undefined && req.body.podTitle != undefined && req.body.audioURL != undefined && req.body.timestart != undefined && req.body.timestart.match(/[0-9][0-9]:[0-9][0-9]:[0-9][0-9]/).length == 1 && req.body.duration != undefined) {
			utils.check_if_mp3(req.body.audioURL, utils.send_error_page, { request: res }, () => {
				checkIfExistSocialCustom(req, res, () => {
					bdd.Social.create({
						email: req.body.email,
						rss: "__custom__",
						access_token: randtoken.generate(32),
						epTitle: req.body.epTitle,
						imgLink: req.body.imgURL,
						podTitle: req.body.podTitle,
						audioLink: req.body.audioURL,
						startTime: req.body.timestart,
						duration: req.body.duration
					}).then((video) => {
						generation.init_new_generation()
						res.sendFile(path.join(__dirname, "/web/done.html"))
					})
				})
			})
		} else {
			res.status(400).send("Votre requète n'est pas complète...")
		}
	}
}

function checkIfExistSocial(req, res, guid, cb) {
	bdd.Social.findOne({where: {email: req.body.email, rss: req.body.rss, guid:guid, startTime: req.body.timestart, status: {[Op.or] : ["waiting", "during", "finished"]}}}).then((video) => {
		if (video == null) {
		  cb();
		} else {
		  template = fs.readFileSync(path.join(__dirname, "/web/error.mustache"), "utf8")
	
		  var render_object = {
			"err_message": "Cette préview est déjà dans la liste d'attente!"
		  }
		
		  res.setHeader("content-type", "text/html");
		  res.send(mustache.render(template, render_object))
		}
	  })
}

function checkIfExistSocialCustom(req, res, cb) {
  bdd.Social.findOne({where: {email: req.body.email, epTitle: req.body.epTitle, imgLink: req.body.imgURL, audioLink: req.body.audioURL, startTime: req.body.timestart, status: {[Op.or] : ["waiting", "during", "finished"]}}}).then((video) => {
    if (video == null) {
      cb();
    } else {
      template = fs.readFileSync(path.join(__dirname, "/web/error.mustache"), "utf8")

      var render_object = {
        "err_message": "Cette préview est déjà dans la liste d'attente!"
      }
    
      res.setHeader("content-type", "text/html");
      res.send(mustache.render(template, render_object))
    }
  })
}