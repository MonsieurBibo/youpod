const fs = require('fs');
const path = require("path");
const mustache = require("mustache");
const Parser = require("rss-parser");
const download = require('download');
const { spawn } = require('child_process');
const express = require('express')
const bodyParser = require('body-parser');
const randtoken = require('rand-token');
const nodemailer = require("nodemailer");
const puppeteer = require('puppeteer');
const session = require('express-session');
const csurf = require('csurf')
const getMP3Duration = require('get-mp3-duration')
const bdd = require(__dirname + "/models/index.js")
const getSize = require('get-folder-size');
const Op = bdd.Sequelize.Op;
const package = require("./package.json")

require('dotenv').config()

const yt = require("./youtube.js")

var app = express()

partials = {
  footer: fs.readFileSync(path.join(__dirname, "/web/partials/footer.mustache"), "utf8")
}

app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
})); 
//Configuration du cookie de session
app.use(session({
  secret: process.env.COOKIE_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}))

var csrfProtection = csurf()

//Reprise des générations en cas d'erreur
flush();
setInterval(flush, 1000 * 60 * 15);
restartGeneration();
 
var parser = new Parser();

app.get("/yt/login", (req, res) => {
	yt.getGoogleUrl((url) => {
		res.redirect(url)
	})
})

app.get("/yt/redirect", (req, res) => {
  req.session.google_code = req.query.code
  req.session.save((err) => {
    res.redirect("/")
  })
})

app.get("/static/:file", (req, res) => {
  res.sendFile(path.join(__dirname, "/web/static/", req.params.file))
})

app.get("/template/:name", (req, res) => {
  template = fs.readFileSync(path.join(__dirname, "/template/" + req.params.name + ".mustache"), "utf8")

  var renderObj = {
    "imageURL": "https://glebeskefe.lepodcast.fr/cover",
    "epTitle": "Ceci est un super titre d'épisode!",
    "podTitle": "Super Podcast",
    "podSub": "Parfois dans la vie on a des coups de haut et des coups de bas..."
  }

  res.setHeader("content-type", "text/html");
  res.send(mustache.render(template, renderObj))
})

app.get("/login", csrfProtection, (req, res) => {
  template = fs.readFileSync(path.join(__dirname, "/web/login.mustache"), "utf8")

  var render_object = {
    "msg": req.session.message,
    "csrfToken": req.csrfToken,
    "cb": req.query.return
  }

  res.setHeader("content-type", "text/html");
  res.send(mustache.render(template, render_object, partials))
})

app.post("/admin/authenticate", csrfProtection, (req, res) => {
  if (req.body.password != undefined) {
    if (req.body.password != process.env.ADMIN_PWD) {
      req.session.message = "Mot de passe incorrect";

      req.session.save(function(err) {
        res.redirect("/admin/login")
      })
    } else {
      req.session.loggin_admin = true;
      req.session.message = undefined;

      req.session.save(function(err) {
        res.redirect("/admin")
      })
    }
  } else {
    res.redirect("/admin/login")
  }
})

app.get("/admin/login", csrfProtection, (req, res) => {
  template = fs.readFileSync(path.join(__dirname, "/web/login_admin.mustache"), "utf8")

  var render_object = {
    "msg": req.session.message,
    "csrfToken": req.csrfToken,
  }

  res.setHeader("content-type", "text/html");
  res.send(mustache.render(template, render_object, partials))
})

app.post("/admin/action", (req, res) => {
  if (req.session.loggin_admin != undefined) {
    if (req.body.action == "flush_video") {
      bdd.Video.findAll({where: {status: "finished"}}).then((videos) => {
        videos.forEach((v) => {
          try {
            fs.unlinkSync(path.join(pathEvalute(process.env.EXPORT_FOLDER), `output_${v.id}.mp4`))
          } catch (err) {
            console.log(`Fichier output_${v.id}.mp4 déjà supprimé`)
          }
          v.status = "deleted"
          v.save()
          console.log("Flush video " + v.id)
        })
  
        res.status(200).send("Vidéos supprimées!")
      })
    } else if (req.body.action == "flush_list") {
      bdd.Video.update({ status: "canceled", email: "canceled" }, {
        where: {
          status: "waiting"
        }
      }).then(() => {
        res.status(200).send("Liste d'attente effacée!")
      })
    }
  } else {
    res.status(403)
  }
})

app.post("/admin/prio/social/:id", (req, res) => {
	if (req.session.loggin_admin != undefined) {
	  bdd.Social.update({priority: req.body.priority}, {
		where: {
		  id: req.params.id
		}
	  }).then(() => {
		res.redirect("/admin")
	  })
	} else {
	  res.status(403)
	}
  
  })

app.post("/admin/prio/:id", (req, res) => {
  if (req.session.loggin_admin != undefined) {
    bdd.Video.update({priority: req.body.priority}, {
      where: {
        id: req.params.id
      }
    }).then(() => {
      res.redirect("/admin")
    })
  } else {
    res.status(403)
  }

})

app.post("/admin/option", (req, res) => {
  if (req.session.loggin_admin != undefined) {
    keys = Object.keys(req.body)

    bdd.Option.update({value: req.body.ENABLE_YOUTUBE != undefined ? true : false}, {
      where: {
        key: "ENABLE_YOUTUBE"
      }
    })
    
    keys.forEach((k) => {
      if (k != "ENABLE_YOUTUBE") {
        bdd.Option.update({value: req.body[k]}, {
          where: {
            key: k
          }
        })
      }
    })

    res.redirect("/admin")
  } else {
    res.redirect("/admin/login")
  }
})

app.get("/admin/queue", (req, res) => {
  if (req.session.loggin_admin != undefined) {
    bdd.Video.findAll({where: {[Op.or]: [{status: "during"}, {status: "waiting"}]}, order: [["priority", "DESC"], ["id", "ASC"]]}).then((videos) => {
      returnObj = {queue: [], during: [], queue_social: [], during_social: []}

      for (i = 0; i < videos.length; i++) {
        o = {
          title: videos[i].epTitle,
          email: videos[i].email,
          rss: videos[i].rss,
          priority: videos[i].priority,
          id: videos[i].id
        }

        if (videos[i].status == "during") {
          returnObj.during.push(o)
        } else {
          returnObj.queue.push(o)
        }
	  }

	  bdd.Social.findAll({where: {[Op.or]: [{status: "during"}, {status: "waiting"}]}, order: [["priority", "DESC"], ["id", "ASC"]]}).then((socials) => { 
		for (i = 0; i < socials.length; i++) {
			o = {
			  title: socials[i].epTitle,
			  email: socials[i].email,
			  rss: socials[i].rss,
			  priority: socials[i].priority,
			  id: socials[i].id
			}
	
			if (socials[i].status == "during") {
			  returnObj.during_social.push(o)
			} else {
			  returnObj.queue_social.push(o)
			}
		}

		res.header("Access-Control-Allow-Origin", process.env.HOST);
		res.header("Access-Control-Allow-Methods", "GET");
		res.header("Access-Control-Allow-Headers", req.header('access-control-request-headers'));
		res.status(200).json(returnObj)
	  })
    })
  } else {
    res.status(403)
  }
})

app.get("/admin", (req, res) => {
  if (req.session.loggin_admin != undefined) {
    template = fs.readFileSync(path.join(__dirname, "/web/admin.mustache"), "utf8")

	bdd.Social.count({where: {
		[Op.or]: [{status: "finished"}, {status: "deleted"}]
	}}).then((nb_gen_social) => {
		bdd.Video.count({where: {
			[Op.or]: [{status: "finished"}, {status: "deleted"}]
		  }}).then((nb_gen_video) => {
			bdd.Video.count({where: {
			  status: "finished"
			}}).then((nb_save_video) => {
			  bdd.Video.count({where: {
				[Op.or]: [{status: "waiting"}, {status: "during"}]
			  }}).then((nb_waiting_video) => {
				bdd.sequelize.query(`SELECT DISTINCT rss FROM Videos`, { raw: true }).then(function(rows){
				  nb_rss_feed = rows[0].length
		
				  getSize(pathEvalute(process.env.EXPORT_FOLDER), (err, size) => {
					if (err) { throw err; }
				   
					size_export_folder = (size / 1024 / 1024).toFixed(2) + ' MB';
		
					getOption("MAX_DURING", (MAX_DURING) => {
					  getOption("MAX_DURING_SOCIAL", (MAX_DURING_SOCIAL) => {
						getOption("KEEPING_TIME", (KEEPING_TIME) => {
						  getOption("GMAIL_ADDR", (GMAIL_ADDR) => {
							getOption("GMAIL_PWD", (GMAIL_PWD) => {
							  getOption("GEN_PWD", (GEN_PWD) => {
								getOption("API_PWD", (API_PWD) => {
								  getOption("GOOGLE_FONT_KEY", (GOOGLE_FONT_KEY) => {
									  getOption("GOOGLE_ID", (GOOGLE_ID) => {
										  getOption("GOOGLE_SECRET", (GOOGLE_SECRET) => {
											  getOption("ENABLE_YOUTUBE", (ENABLE_YOUTUBE) => {
												  getOption("MAIL_SERVICE", (MAIL_SERVICE) => {
													getOption("SMTP_HOST", (SMTP_HOST) => {
													  getOption("SMTP_PORT", (SMTP_PORT) => {
														getOption("SMTP_USERNAME", (SMTP_USERNAME) => {
														  getOption("SMTP_PASSWORD", (SMTP_PASSWORD) => {
															getOption("SMTP_DOMAIN", (SMTP_DOMAIN) => {
															  var render_object = {
																  nb_gen_social: nb_gen_social,
																nb_gen_video: nb_gen_video,
																nb_save_video: nb_save_video,
																nb_waiting_video: nb_waiting_video,
																nb_rss_feed: nb_rss_feed,
																size_export_folder: size_export_folder,
																MAX_DURING: MAX_DURING,
																MAX_DURING_SOCIAL: MAX_DURING_SOCIAL,
																KEEPING_TIME: KEEPING_TIME,
																GMAIL_ADDR: GMAIL_ADDR,
																GMAIL_PWD: GMAIL_PWD,
																GEN_PWD: GEN_PWD,
																API_PWD: API_PWD,
																GOOGLE_FONT_KEY: GOOGLE_FONT_KEY,
																GOOGLE_ID: GOOGLE_ID,
																GOOGLE_SECRET: GOOGLE_SECRET,
																IS_GMAIL: MAIL_SERVICE == "gmail" ?  MAIL_SERVICE : undefined,
																SMTP_HOST: SMTP_HOST,
																SMTP_DOMAIN: SMTP_DOMAIN,
																SMTP_PORT: SMTP_PORT,
																SMTP_USERNAME: SMTP_USERNAME,
																SMTP_PASSWORD: SMTP_PASSWORD,
																ENABLE_YOUTUBE: ENABLE_YOUTUBE == false ? undefined : ENABLE_YOUTUBE,
																youpod_version: package.version
															  }
															
															  res.setHeader("content-type", "text/html");
															  res.send(mustache.render(template, render_object, partials))
															})
														  })
														})
													  })
													})
												  })
												})
										  })
									  })
								  })
								})
							  })
							})
						  })
						})
					  })
					})
				  });
			  })
			  })
			})
		  })
	})
  } else {
    res.redirect("/admin/login")
  }
})

app.post("/authenticate", csrfProtection, (req, res) => {
  if (req.body.password != undefined) {
    getOption("GEN_PWD", (GEN_PWD) => {
      if (req.body.password != GEN_PWD) {
        req.session.message = "Mot de passe incorrect";
  
        req.session.save(function(err) {
          res.redirect("/login?return=" + req.body.return)
        })
      } else {
        req.session.logged = true;
        req.session.message = undefined;
  
        req.session.save(function(err) {
          if (req.body.return != "") {
            res.redirect("/" + req.body.return)
          } else {
            res.redirect("/")
          }
        })
      }
    })
  } else {
    res.redirect("/login")
  }
})

app.post("/social/add", csrfProtection, (req, res) => {
  getOption("GEN_PWD", (GEN_PWD) => { 
	checkIfRss(req.body.rss, (isRss) => {
		if(isRss) {
			if (req.body.email != undefined && req.body.timestart != undefined && req.body.timestart.match(/[0-9][0-9]:[0-9][0-9]:[0-9][0-9]/).length != 1 && req.body.duration != undefined) {
				if (GEN_PWD == "") {
					getLastGuid(req.body.rss, req.body.selectEp, (guid)=> {
						checkIfExistSocial(req, res, guid, () => {
							bdd.Social.create({
								rss: req.body.rss,
								email: req.body.email,
								access_token: randtoken.generate(32),
								startTime: req.body.timestart,
								duration: req.body.duration,
								guid: guid
							}).then((social) => {
								initNewGeneration();
								res.sendFile(path.join(__dirname, "/web/done.html"))
							})
						})
					})
				} else {
					if (req.session.logged != undefined) {
						getLastGuid(req.body.rss, req.body.selectEp, (guid)=> {
							checkIfExistSocial(req, res, guid, () => {
								bdd.Social.create({
									rss: req.body.rss,
									email: req.body.email,
									access_token: randtoken.generate(32),
									startTime: req.body.timestart,
									duration: req.body.duration,
									guid: guid
								}).then((social) => {
									initNewGeneration();
									res.sendFile(path.join(__dirname, "/web/done.html"))
								})
							})
						})
					} else {
						res.redirect("/login")
					}
				}
			} else {
				res.status(400).send("Votre requète n'est pas complète...")
			}

		} else {
			template = fs.readFileSync(path.join(__dirname, "/web/error.mustache"), "utf8")
		
			var render_object = {
			"err_message": "L'URL que vous avez entré " + req.body.rss + " n'est pas un flux RSS valide!"
			}
		
			res.setHeader("content-type", "text/html");
			res.send(mustache.render(template, render_object))
		}
	}) 
  })
})

app.post("/social/custom/add", csrfProtection, (req, res) => {
	getOption("GEN_PWD", (GEN_PWD) => { 
		if (req.body.email != undefined && req.body.imgURL != undefined && req.body.epTitle != undefined && req.body.podTitle != undefined && req.body.audioURL != undefined && req.body.timestart != undefined && req.body.timestart.match(/[0-9][0-9]:[0-9][0-9]:[0-9][0-9]/).length != 1 && req.body.duration != undefined) {

			if (GEN_PWD == "") {
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
						initNewGeneration();
						res.sendFile(path.join(__dirname, "/web/done.html"))
					})
				})
			} else {
				if (req.session.logged != undefined) {
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
							initNewGeneration();
							res.sendFile(path.join(__dirname, "/web/done.html"))
						})
					})
				} else {
					res.redirect("/login")
				}
			}
		} else {
			res.status(400).send("Votre requète n'est pas complète...")
		}
	})
  })

app.get("/social/custom", csrfProtection, (req, res) => {
	getOption("GEN_PWD", (GEN_PWD) => { 
	  getOption("KEEPING_TIME", (KEEPING_TIME) => {
		if (GEN_PWD == "") {
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
	  
		} else {
		  if (req.session.logged != undefined) {
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
		  } else {
			res.redirect("/login?return=social/custom")
		  }
		}
	  })
	})
  })

app.get("/social", csrfProtection, (req, res) => {
  getOption("GEN_PWD", (GEN_PWD) => { 
    getOption("KEEPING_TIME", (KEEPING_TIME) => {
      if (GEN_PWD == "") {
        bdd.Social.count({
          where: {
            [Op.or]: [{status: "waiting"}, {status: "during"}]
          }
        }).then((nb) => {
          template = fs.readFileSync(path.join(__dirname, "/web/social.mustache"), "utf8")
    
          var render_object = {
            "waiting_list": nb,
            "keeping_time": KEEPING_TIME,
            "csrfToken": req.csrfToken
          }
        
          res.setHeader("content-type", "text/html");
          res.send(mustache.render(template, render_object, partials))
        })
    
      } else {
        if (req.session.logged != undefined) {
          bdd.Social.count({
            where: {
              [Op.or]: [{status: "waiting"}, {status: "during"}]
            }
          }).then((nb) => {
            template = fs.readFileSync(path.join(__dirname, "/web/social.mustache"), "utf8")
      
            var render_object = {
              "waiting_list": nb,
              "keeping_time": KEEPING_TIME,
              "csrfToken": req.csrfToken
            }
          
            res.setHeader("content-type", "text/html");
            res.send(mustache.render(template, render_object, partials))
          })
        } else {
          res.redirect("/login?return=social")
        }
      }
    })
  })
})

app.get("/custom", csrfProtection, (req, res) => {
  getOption("GEN_PWD", (GEN_PWD) => {
    getOption("KEEPING_TIME", (KEEPING_TIME) => {
      getOption("GOOGLE_FONT_KEY", (GOOGLE_FONT_KEY) => {
        getOption("ENABLE_YOUTUBE", (ENABLE_YOUTUBE) => {
          if (GEN_PWD == "") {
            bdd.Video.count({
              where: {
                [Op.or]: [{status: "waiting"}, {status: "during"}]
              }
            }).then((nb) => {
              template = fs.readFileSync(path.join(__dirname, "/web/custom.mustache"), "utf8")
        
              var render_object = {
                "waiting_list": nb,
                "keeping_time": KEEPING_TIME,
                "csrfToken": req.csrfToken,
                "ENABLE_YOUTUBE": ENABLE_YOUTUBE == false ? undefined : ENABLE_YOUTUBE,
                "yt_logged": req.session.google_code != undefined ? true : false,
                "GOOGLE_FONT_KEY": GOOGLE_FONT_KEY
              }
            
              res.setHeader("content-type", "text/html");
              res.send(mustache.render(template, render_object, partials))
            })
          } else {
            if (req.session.logged != undefined) {
              bdd.Video.count({
                where: {
                  [Op.or]: [{status: "waiting"}, {status: "during"}]
                }
              }).then((nb) => {
                template = fs.readFileSync(path.join(__dirname, "/web/custom.mustache"), "utf8")
          
                var render_object = {
                  "waiting_list": nb,
                  "keeping_time": KEEPING_TIME,
                  "need_pass": GEN_PWD!="",
                  "csrfToken": req.csrfToken,
                  "ENABLE_YOUTUBE": ENABLE_YOUTUBE == false ? undefined : ENABLE_YOUTUBE,
                  "yt_logged": req.session.google_code != undefined ? true : false,
                  "GOOGLE_FONT_KEY": GOOGLE_FONT_KEY
                }
              
                res.setHeader("content-type", "text/html");
                res.send(mustache.render(template, render_object, partials))
              })
            } else {
              res.redirect("/login?return=custom")
            }
          }
        })
      })
    })
  })
})

app.get("/", csrfProtection, (req, res) => {
  getOption("GEN_PWD", (GEN_PWD) => {
    getOption("KEEPING_TIME", (KEEPING_TIME) => {
      getOption("GOOGLE_FONT_KEY", (GOOGLE_FONT_KEY) => {
        getOption("ENABLE_YOUTUBE", (ENABLE_YOUTUBE) => {
          if (GEN_PWD == "") {
            bdd.Video.count({
              where: {
                [Op.or]: [{status: "waiting"}, {status: "during"}]
              }
            }).then((nb) => {
              template = fs.readFileSync(path.join(__dirname, "/web/index.mustache"), "utf8")
          
              var render_object = {
                "waiting_list": nb,
                "keeping_time": KEEPING_TIME,
                "need_pass": GEN_PWD!="",
                "csrfToken": req.csrfToken,
                "ENABLE_YOUTUBE": ENABLE_YOUTUBE == false ? undefined : ENABLE_YOUTUBE,
                "yt_logged": req.session.google_code != undefined ? true : false,
                "GOOGLE_FONT_KEY": GOOGLE_FONT_KEY
              }
            
              res.setHeader("content-type", "text/html");
              res.send(mustache.render(template, render_object, partials))
            })
          } else {
            if (req.session.logged != undefined) {
              bdd.Video.count({
                where: {
                  [Op.or]: [{status: "waiting"}, {status: "during"}]
                }
              }).then((nb) => {
                template = fs.readFileSync(path.join(__dirname, "/web/index.mustache"), "utf8")
            
                var render_object = {
                  "waiting_list": nb,
                  "keeping_time": KEEPING_TIME,
                  "need_pass": GEN_PWD!="",
                  "csrfToken": req.csrfToken,
                  "ENABLE_YOUTUBE": ENABLE_YOUTUBE == false ? undefined : ENABLE_YOUTUBE,
                  "yt_logged": req.session.google_code != undefined ? true : false,
                  "GOOGLE_FONT_KEY": GOOGLE_FONT_KEY
                }
              
                res.setHeader("content-type", "text/html");
                res.send(mustache.render(template, render_object, partials))
              })
            } else {
              res.redirect("/login")
            }
          }
        })
      })
    })
   })
})

app.get("/download/social/:id", (req, res) => {
  if (req.query.token != undefined) {
    bdd.Social.findByPk(req.params.id).then((social) => {
      if (req.query.token != social.access_token) {
        res.status(403).send("Vous n'avez pas accès à cette vidéo pour réseaux sociaux")
      } else {
        if (social.status == 'finished') {
          res.download(path.join(pathEvalute(process.env.EXPORT_FOLDER), `social_${social.id}.mp4`), `youpod_social_${social.end_timestamp}.mp4`)
        } else if (social.status == 'deleted') {
          res.status(404).send("Cette vidéo à été supprimée du site!")
        } else if (social.status == 'during') {
          res.status(404).send("Cette vidéo est encore en cours de traitement, revenez plus tard!")
        } else {
          res.status(404).send("Cette vidéo est encore dans la file d'attente.")
        }
      }
    }).catch((err) => {
      res.status(404).send("Cette vidéo n'est pas disponible...")
    })
  } else {
    res.status(404).send("Vous n'avez pas mis de token d'accès à une vidéo")
  }

})

app.get("/download/:id", (req, res) => {
  if (req.query.token != undefined) {
    bdd.Video.findByPk(req.params.id).then((video) => {
      if (req.query.token != video.access_token) {
        res.status(403).send("Vous n'avez pas accès à cette vidéo")
      } else {
        if (video.status == 'finished') {
          res.download(path.join(pathEvalute(process.env.EXPORT_FOLDER), `output_${video.id}.mp4`), `youpod_${video.end_timestamp}.mp4`)
        } else if (video.status == 'deleted') {
          res.status(404).send("Cette vidéo à été supprimée du site!")
        } else if (video.status == 'during') {
          res.status(404).send("Cette vidéo est encore en cours de traitement, revenez plus tard!")
        } else {
          res.status(404).send("Cette vidéo est encore dans la file d'attente.")
        }
      }
    }).catch((err) => {
      res.status(404).send("Cette vidéo n'est pas disponible...")
    })
  } else {
    res.status(404).send("Vous n'avez pas mis de token d'accès à une vidéo")
  }

})

app.post("/addvideo", csrfProtection, (req, res) => {
  getOption("GEN_PWD", (GEN_PWD) => {
    if (GEN_PWD == "") {
      if (req.body.email != undefined && req.body.rss != undefined) {
        checkIfRss(req.body.rss, (is_rss) => {
          if (is_rss) {
			getLastGuid(req.body.rss, req.body.selectEp, (guid)=> {
				checkIfExistVideo(req, res, guid, () => {
					bdd.Video.create({
					email: req.body.email,
					rss: req.body.rss,
					guid: guid,
					template: req.body.template,
					access_token: randtoken.generate(32),
					font:req.body["font-choice"],
					googleToken: req.body.publishYT != undefined && req.session.google_code != undefined ? req.session.google_code : undefined
					}).then((video) => {
						req.session.google_code = undefined
						req.session.save((err) => {
						initNewGeneration();
						res.sendFile(path.join(__dirname, "/web/done.html"))
						})
					})
				})
			})
          } else {
            template = fs.readFileSync(path.join(__dirname, "/web/error.mustache"), "utf8")
      
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
    } else {
      if (req.session.logged != undefined) {
        if (req.body.email != undefined && req.body.rss != undefined) {
          checkIfRss(req.body.rss, (is_rss) => {
            if (is_rss) {
              if (req.body.selectEp == undefined) {
                getLastGuid(req.body.rss, (guid)=> {
                  checkIfExistVideo(req, res, guid, () => {
                    bdd.Video.create({
                      email: req.body.email,
                      rss: req.body.rss,
                      guid: guid,
                      template: req.body.template,
                      access_token: randtoken.generate(32),
                      font:req.body["font-choice"],
                      googleToken: req.body.publishYT != undefined && req.session.google_code != undefined ? req.session.google_code : undefined
                    }).then((video) => {
                      req.session.google_code = undefined
                      req.session.save((err) => {
                        initNewGeneration();
                        res.sendFile(path.join(__dirname, "/web/done.html"))
                      })
                    })
                  })
                })
              } else {
                checkIfExistVideo(req, res, req.body.selectEp, () => {
                  bdd.Video.create({
                    email: req.body.email,
                    rss: req.body.rss,
                    guid: req.body.selectEp,
                    template: req.body.template,
                    access_token: randtoken.generate(32),
                    font:req.body["font-choice"],
                    googleToken: req.body.publishYT != undefined && req.session.google_code != undefined ? req.session.google_code : undefined
                  }).then((video) => {
                    req.session.google_code = undefined
                    req.session.save((err) => {
                      initNewGeneration();
                      res.sendFile(path.join(__dirname, "/web/done.html"))
                    })
                  })
                })
              }
            } else {
              template = fs.readFileSync(path.join(__dirname, "/web/error.mustache"), "utf8")
      
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
      } else {
        res.redirect("/login")
      }
    }
  })

})

function checkIfExistVideo(req, res, guid, cb) {
  bdd.Video.findOne({where: {email: req.body.email, rss: req.body.rss, guid: guid, status: {[Op.or] : ["waiting", "during", "finished"]}}}).then((video) => {
    if (video == null) {
      cb();
    } else {
      template = fs.readFileSync(path.join(__dirname, "/web/error.mustache"), "utf8")

      var render_object = {
        "err_message": "Cette vidéo est déjà dans la liste d'attente!"
      }
    
      res.setHeader("content-type", "text/html");
      res.send(mustache.render(template, render_object))
    }
  })
}

function getLastGuid(feed_url, guid, __callback) {
	if (guid != undefined) {
		__callback(guid)
	} else {
		parser.parseURL(feed_url, (err, feed) => {
			__callback(feed.items[0].guid)
			
		  })
	}
}

function checkIfRss(feed_url, __callback) {
  parser.parseURL(feed_url, (err, feed) => {
    __callback(feed != undefined);
  })
}

app.post("/addvideocustom", csrfProtection, (req, res) => {
  getOption("GEN_PWD", (GEN_PWD) => { 
    if (GEN_PWD == "") {
      if (req.body.email != undefined && req.body.imgURL != undefined && req.body.epTitle != undefined && req.body.podTitle != undefined && req.body.podSub != undefined && req.body.audioURL != undefined) {
        checkIfExistCustom(req, res, () => {
          console.log(req.body.imgURL)
          bdd.Video.create({
            email: req.body.email,
            rss: "__custom__",
            template: req.body.template,
            access_token: randtoken.generate(32),
            epTitle: req.body.epTitle,
            epImg: req.body.imgURL,
            podTitle: req.body.podTitle,
            podSub: req.body.podSub,
            audioURL: req.body.audioURL,
            font: req.body["font-choice"],
            googleToken: req.body.publishYT != undefined && req.session.google_code != undefined ? req.session.google_code : undefined
          }).then((video) => {
            req.session.google_code = undefined
            req.session.save((err) => {
              initNewGeneration();
              res.sendFile(path.join(__dirname, "/web/done.html"))
            })
          })
        })
      } else {
        res.status(400).send("Votre requète n'est pas complète...")
      }
    } else {
      if (req.session.logged != undefined) {
        if (req.body.email != undefined && req.body.imgURL != undefined && req.body.epTitle != undefined && req.body.podTitle != undefined && req.body.podSub != undefined && req.body.audioURL != undefined) {  
          checkIfExistCustom(req, res, () => {
            bdd.Video.create({
              email: req.body.email,
              rss: "__custom__",
              template: req.body.template,
              access_token: randtoken.generate(32),
              epTitle: req.body.epTitle,
              epImg: req.body.imgURL,
              podTitle: req.body.podTitle,
              podSub: req.body.podSub,
              audioURL: req.body.audioURL,
              font: req.body["font-choice"],
              googleToken: req.body.publishYT != undefined && req.session.google_code != undefined ? req.session.google_code : undefined
            }).then((video) => {
              req.session.google_code = undefined
              req.session.save((err) => {
                initNewGeneration();
                res.sendFile(path.join(__dirname, "/web/done.html"))
              })
            })
          })
        } else {
          res.status(400).send("Votre requète n'est pas complète...")
        }
      } else {
        res.redirect("/login")
      }
    }
  })
})

function checkIfExistCustom(req, res, cb) {
  bdd.Video.findOne({where: {email: req.body.email, epTitle: req.body.epTitle, epImg: req.body.imgURL, audioURL: req.body.audioURL, status: {[Op.or] : ["waiting", "during", "finished"]}}}).then((video) => {
    if (video == null) {
      cb();
    } else {
      template = fs.readFileSync(path.join(__dirname, "/web/error.mustache"), "utf8")

      var render_object = {
        "err_message": "Cette vidéo est déjà dans la liste d'attente!"
      }
    
      res.setHeader("content-type", "text/html");
      res.send(mustache.render(template, render_object))
    }
  })
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

app.post("/api/video", (req, res) => {
  getOption("API_PWD", (API_PWD) => {
    if (req.query.pwd != undefined && req.query.pwd == API_PWD) {
      if (req.body.email != undefined && req.body.imgURL != undefined && req.body.epTitle != undefined && req.body.podTitle != undefined && req.body.podSub != undefined && req.body.audioURL != undefined) {
        if (req.body.font == undefined) {
          font = "Montserrat"
        } else {
          font = req.body.font
        }

        bdd.Video.findOne({where: {email: req.body.email, epTitle: req.body.epTitle, epImg: req.body.imgURL, audioURL: req.body.audioURL, status: {[Op.or] : ["waiting", "during", "finished"]}}}).then((video) => {
          if (video == null) {
            bdd.Video.create({
              email: req.body.email,
              rss: "__custom__",
              template: req.body.template,
              access_token: randtoken.generate(32),
              epTitle: req.body.epTitle,
              epImg: req.body.imgURL,
              podTitle: req.body.podTitle,
              podSub: req.body.podSub,
              audioURL: req.body.audioURL,
              font: font
            }).then((video) => {
              initNewGeneration();
              res.status(200).json({id: video.id, token: video.access_token});
            }).catch((err) => {
              console.error(err);
              res.status(500);
            })
          } else {
            res.status(403).send("Vidéo déjà dans la file d'attente")
          }
        })
      } else {
        res.status(400).send("Votre requète n'est pas complète...")
      }
    } else {
      res.status(401).send("Vous n'avez pas le bon mot de passe d'API")
    }
  })
})

app.get("/api/video/:id", (req, res) => {
  getOption("API_PWD", (API_PWD) => { 
    if (req.query.pwd != undefined && req.query.pwd == API_PWD) {
      if (req.query.token != undefined) {
        bdd.Video.findByPk(req.params.id).then((video) => {
          if (video != null) {
            if (req.query.token == video.access_token) {
              returnObj = {
                id: video.id, 
                status: video.status, 
                download_url: process.env.HOST + "/download/" + video.id + "?token=" + video.access_token
              }
    
              getOption("KEEPING_TIME", (KEEPING_TIME) => {
                if (video.status == "finished") {
                  returnObj.delete_timestamp = parseInt(video.end_timestamp) + (KEEPING_TIME * 60 * 60 * 1000) 
                }
              })
  
              res.status(200).json(returnObj);
            } else {
              res.status(401).send("Le token n'est pas juste")
            }
          } else {
            res.status(404).send("Il n'y a pas de vidéo " + req.params.id)
          }
  
        })
      } else {
        res.status(401).send("Vous devez préciser un token d'accès pour la vidéo")
      }
    } else {
      res.status(401).send("Vous n'avez pas le bon mot de passe d'API")
    }  
  })
})

app.get("/api/feed", (req, res) => {
  checkIfRss(req.query.url, (is_feed) => {
    if (is_feed) {
      parser.parseURL(req.query.url, (err, feed) => {
        resObj = {
          data: [],
          message: "Flux " + req.query.url + " trouvé"
        }
    
        feed.items.forEach((i) => {
          o = {
            title: i.title,
            guid: i.guid.replace("<![CDATA[", "").replace("]]>", "")
		  }
		  
		  o.audio = i.enclosure == undefined ? undefined : i.enclosure.url
    
          resObj.data.push(o)
        })
    
        res.header("Access-Control-Allow-Origin", process.env.HOST);
        res.header("Access-Control-Allow-Methods", "GET");
        res.header("Access-Control-Allow-Headers", req.header('access-control-request-headers'));
        res.status(200).json(resObj);
      })
    } else {
      resObj = {
        data: [],
        message: "Le flux n'est pas un flux RSS valide"
      }
      res.header("Access-Control-Allow-Origin", process.env.HOST);
      res.header("Access-Control-Allow-Methods", "GET");
      res.header("Access-Control-Allow-Headers", req.header('access-control-request-headers'));
      res.status(400).json(resObj);
    }

  })
})

// FONCTION DE GENERATIONS
function restartGeneration() {
  console.log("Reprise de générations...")
  bdd.Video.findAll({where: {status: "during"}}).then((videos) => {
    videos.forEach((v) => {
      if (v.rss != "__custom__") {
        generateFeed(v.rss, v.guid, v.template, v.id, v.font)
      } else {
        generateImgCustom(v.id);
      }
    })
  })

  bdd.Social.findAll({where: {status: "during"}}).then((socials) => {
    socials.forEach((p) => {
		if (p.rss != "__custom__") {
			generateImgSocial(p.rss, p.guid, p.id);
		}
    })
  })

  initNewGeneration();
}

function flush() {
  getOption("KEEPING_TIME", (KEEPING_TIME) => {
    bdd.Video.findAll({where: {status: "finished"}}).then((videos) => {
      if (videos.length >=1) {
        for (i = 0; i < videos.length; i++) {
          time = Date.now() - videos[i].end_timestamp
          time = time / (1000 * 60 * 60);
          
          if (time > KEEPING_TIME) {
            try {
              fs.unlinkSync(path.join(pathEvalute(process.env.EXPORT_FOLDER), `output_${videos[i].id}.mp4`))
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
              fs.unlinkSync(path.join(pathEvalute(process.env.EXPORT_FOLDER), `social_${socials[i].id}.mp4`))
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
  
}

function initNewGeneration() {
  bdd.Video.count({where: {status: "during"}}).then((nb) => {
    getOption("MAX_DURING", ((MAX_DURING) => {
      if (nb < MAX_DURING) {
        bdd.Video.findOne({where: {status: "waiting"}, order: [["priority", "DESC"], ["id", "ASC"]]}).then((video) => {
          if(video != null) {
            video.status = 'during'
            video.save().then((video) => {
              if (video.rss != "__custom__") {
                generateFeed(video.rss, video.guid, video.template, video.id, video.font)
              } else {
                generateImgCustom(video.id);
              }
            })
          }
        })
      }
    }))
  })

  bdd.Social.count({where: {status: "during"}}).then((nb) => {
    getOption("MAX_DURING_SOCIAL", ((MAX_DURING_SOCIAL) => {
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

function generateImgSocial(feed_url, guid, id) {
	console.log("Social " + id + " Démarage de la création")
	parser.parseURL(feed_url, (err, lFeed) => {
		console.log("Social " + id + " Récupération du flux")
		feed = lFeed

		var template = fs.readFileSync(path.join(__dirname, "/template/social.mustache"), "utf8");
	
		i = 0;
		while(feed.items[i].guid != guid && i < feed.items.length) {
			i++;
		}
	
		if (i == feed.items.length) {
			bdd.Social.update({ status: "error", email: "error" }, {
			where: {
				id: id
			}
			})
			return;
		}
	
		if(feed.items[i].itunes.image == undefined) {
			img = feed.image.link
		} else {
			img = feed.items[i].itunes.image
		}
	
		var renderObj = {
			"imageURL": img,
			"epTitle": feed.items[i].title,
			"podTitle": feed.title
		}
	
		string = mustache.render(template, renderObj);
	
		console.log("Social " + id + " Génération de l'image");
		
		(async () => {
			const browser = await puppeteer.launch({
			defaultViewport: {
				width: 1080,
				height: 1080
			},
			headless: true,
			args: ['--no-sandbox']
			});
			const page = await browser.newPage();
			await page.setContent(string);
			await page.screenshot({path: path.join(__dirname, "/tmp/", `social_${id}.png`), omitBackground: true});
		
			await browser.close();
			console.log("Social " + id + " Image générée!")
			downloadAudioSocial(id, feed.items[i].enclosure.url)
		})();
	})
  }

function generateImgSocialCustom(id) {
  console.log("Social " + id + " Démarage de la création");

  bdd.Social.findByPk(id).then((social) => {
    var template = fs.readFileSync(path.join(__dirname, "/template/social.mustache"), "utf8");

    var renderObj = {
      "imageURL": social.imgLink,
      "epTitle": social.epTitle,
      "podTitle": social.podTitle
    }

    string = mustache.render(template, renderObj);

    console.log("Social " + id + " Génération de l'image");
    
    (async () => {
      const browser = await puppeteer.launch({
        defaultViewport: {
          width: 1080,
          height: 1080
        },
        headless: true,
        args: ['--no-sandbox']
      });
      const page = await browser.newPage();
      await page.setContent(string);
      await page.screenshot({path: path.join(__dirname, "/tmp/", `social_${id}.png`), omitBackground: true});
    
      await browser.close();
      console.log("Social " + id + " Image générée!")

      downloadAudioSocial(id, social.audioLink)
    })();
  })
}

function generateImgCustom(id) {
  console.log(id + " Démarage de la création");

  bdd.Video.findByPk(id).then((video) => {
    if (video.template != null && video.template != "") {
      template = video.template
    } else {
      var template = fs.readFileSync(path.join(__dirname, "/template/default.mustache"), "utf8");
    }

    var renderObj = {
      "imageURL": video.epImg,
      "epTitle": video.epTitle,
      "podTitle": video.podTitle,
      "podSub": video.podSub,
      "font": video.font,
      "font_url": video.font.replace(/ /g, "+")
    }

    string = mustache.render(template, renderObj);

    console.log(id + " Génération de l'image");
    
    (async () => {
      const browser = await puppeteer.launch({
        defaultViewport: {
          width: 1920,
          height: 1080
        },
        headless: true,
        args: ['--no-sandbox']
      });
      const page = await browser.newPage();
      await page.setContent(string);
      await page.screenshot({path: path.join(__dirname, "/tmp/", `overlay_${id}.png`), omitBackground: true});
    
      await browser.close();
      console.log(id + " Image générée!")

      downloadAudioCustom(id, video.audioURL, video.epTitle)
    })();
  })
}

function generateFeed(feed_url, guid, temp, id, font) {
  console.log(id + " Démarage de la création")
  parser.parseURL(feed_url, (err, lFeed) => {
    console.log(id + " Récupération du flux")
    feed = lFeed

    if (temp != "") {
      template = temp
    } else {
      var template = fs.readFileSync(path.join(__dirname, "/template/default.mustache"), "utf8");
    }

    i = 0;
    while(feed.items[i].guid != guid && i < feed.items.length) {
      i++;
    }

    if (i == feed.items.length) {
      bdd.Video.update({ status: "error", email: "error" }, {
        where: {
          id: id
        }
      })
      return;
    }

    if(feed.items[i].itunes.image == undefined) {
      img = feed.image.link
    } else {
      img = feed.items[i].itunes.image
    }

    var renderObj = {
      "imageURL": img,
      "epTitle": feed.items[i].title,
      "podTitle": feed.title,
      "podSub": feed.itunes.subtitle,
      "font_url": font.replace(/ /g, "+"),
      "font": font
    }

    string = mustache.render(template, renderObj);

    console.log(id + " Génération de l'image");
    
    (async () => {
      const browser = await puppeteer.launch({
        defaultViewport: {
          width: 1920,
          height: 1080
        },
        headless: true,
        args: ['--no-sandbox']
      });
      const page = await browser.newPage();
      await page.setContent(string);
      await page.screenshot({path: path.join(__dirname, "/tmp/", `overlay_${id}.png`), omitBackground: true});
    
      await browser.close();
      console.log(id + " Image générée!")
      downloadAudio(id, feed.items[i].enclosure.url, feed.items[i].title)
    })();
  })
}

function downloadAudioSocial(id, audio_url) {
  console.log("Social " + id + " Démarage du téléchargement")
  download(audio_url).then(data => {
    fs.writeFileSync(path.join(__dirname, `/tmp/social_${id}.mp3`), data);
    console.log("Social " + id + " Fichier téléchargé!");
    generateVideoSocial(id);
  });
}

function downloadAudioCustom(id, audio_url, ep_title) {
  console.log(id + " Démarage du téléchargement")
  download(audio_url).then(data => {
    fs.writeFileSync(path.join(__dirname, `/tmp/audio_${id}.mp3`), data);
    console.log(id + " Fichier téléchargé!");
    generateVideo(id, ep_title);
  });
}

function downloadAudio(id, audio_url, ep_title) {
  console.log(id + " Démarage du téléchargement")
  download(audio_url).then(data => {
    fs.writeFileSync(path.join(__dirname, `/tmp/audio_${id}.mp3`), data);
    console.log(id + " Fichier téléchargé!");
    generateVideo(id, ep_title);
  });
}

function generateVideoSocial(id) {
  console.log("Social" + id + " Démarage de la génération de la vidéo")

  bdd.Social.findByPk(id).then((social) => {
	splited = social.startTime.split(":")

	s = splited[0] * 3600 + splited[1] * 60 + parseInt(splited[2])

	var child = spawn("ffmpeg", ["-y", "-stream_loop", -1, "-i", `./tmp/social_${id}.png`, "-filter_complex", 'overlay', "-vcodec", "libvpx-vp9", "-stream_loop", -1, "-i", `./assets/bars.webm`, "-ss", s, "-i", `./tmp/social_${id}.mp3`, "-t", social.duration, "-map", "2:a", "-acodec", "aac", `${process.env.EXPORT_FOLDER}/social_${id}.mp4`]);
  
	child.stdout.on('data', function (data) {
	  console.log("Social " +id + ' stdout: ' + data);
	});
  
	child.stderr.on('data', function (data) {
	  console.log("Social " + id + ' stderr: ' + data);
	});
  
	child.on('close', function (code) {
	  console.log("Social " + id + " Vidéo générée!")
	  bdd.Social.update({ status: "finished", end_timestamp: Date.now() }, {
		where: {
		  id: id
		}
	  }).then(() => {
		fs.unlinkSync(path.join(__dirname, "/tmp/", `social_${id}.png`))
		fs.unlinkSync(path.join(__dirname, "/tmp/", `social_${id}.mp3`))
	
		sendMailSocial(id);
		initNewGeneration();
	  });
	});
  })
}

function generateVideo(id, ep_title) {
  console.log(id + " Démarage de la génération de la vidéo")

  duration = Math.trunc(getMP3Duration(fs.readFileSync(path.join(__dirname, "tmp/", `audio_${id}.mp3`)))/1000) + 1

  var ol = spawn("ffmpeg", ["-y", "-loop", 1, "-i", `./tmp/overlay_${id}.png`, "-filter_complex", "overlay", "-vcodec", "libvpx-vp9", "-i", "./assets/loop.webm", "-t", 20, "-r", 60, "-ss", 0.1, `./tmp/loop_${id}.mp4`])
  
  ol.stdout.on('data', function (data) {
    console.log(id + ' stdout: ' + data);
  });

  ol.stderr.on('data', function (data) {
    console.log(id + ' stderr: ' + data);
  });

  ol.on('close', function (code) {
    var child = spawn("ffmpeg", ["-y", "-stream_loop", -1, "-i", `./tmp/loop_${id}.mp4`, "-i", `./tmp/audio_${id}.mp3`, "-c:v", "copy", "-c:a", "aac", "-shortest", "-map", "0:v", "-map", "1:a", `${process.env.EXPORT_FOLDER}/output_${id}.mp4`]);

    child.stdout.on('data', function (data) {
      console.log(id + ' stdout: ' + data);
    });
  
    child.stderr.on('data', function (data) {
      console.log(id + ' stderr: ' + data);
    });
  
    child.on('close', function (code) {
      console.log(id + " Vidéo générée!")
      bdd.Video.update({ status: "finished", end_timestamp: Date.now() }, {
        where: {
          id: id
        }
      }).then(() => { 
        fs.unlinkSync(path.join(__dirname, "/tmp/", `overlay_${id}.png`))
        fs.unlinkSync(path.join(__dirname, "/tmp/", `audio_${id}.mp3`))
        fs.unlinkSync(path.join(__dirname, "/tmp/", `loop_${id}.mp4`))
    
        sendMail(id, ep_title);
        initNewGeneration();
      })
    });
  });
}

function sendMailSocial(id) {
  bdd.Social.findByPk(id).then((social) => {
	  if (social.rss != "__custom__") {
		template = fs.readFileSync(path.join(__dirname, "/web/mail_social.mustache"), "utf8")
	  } else {
		template = fs.readFileSync(path.join(__dirname, "/web/mail_social_custom.mustache"), "utf8")
	  }
    
    getOption("KEEPING_TIME", (KEEPING_TIME) => {
		if (social.rss != "__custom__") {
			renderObj = {
				"feed_url": social.rss,
				"keeping_time": KEEPING_TIME,
				"video_link": process.env.HOST + "/download/social/" + id + "?token=" + social.access_token
			}
		} else {
			renderObj = {
				"ep_title": social.epTitle,
				"keeping_time": KEEPING_TIME,
				"video_link": process.env.HOST + "/download/social/" + id + "?token=" + social.access_token
			}
		}

  
  
      const mailOptions = {
        from: 'YouPod@youpod.io', // sender address
        to: social.email, // list of receivers
        subject: `Extrait généré sur Youpod!`, // Subject line
        html: mustache.render(template, renderObj)
      };

      getTransporter((transporter) => {
        transporter.sendMail(mailOptions, function (err, info) {
          if(err) return console.log(err)
        });
    
        social.email = "deleted"
        social.save();
      })
    })
  })
}

function sendMail(id, ep_title) {
  bdd.Video.findByPk(id).then((video) => {
    getOption("KEEPING_TIME", (KEEPING_TIME) => { 
      if (video.rss != "__custom__") {
        template = fs.readFileSync(path.join(__dirname, "/web/mail.mustache"), "utf8")
        renderObj = {
          "rss_link": video.rss,
          "keeping_time": KEEPING_TIME,
          "epTitle": ep_title,
          "video_link": process.env.HOST + "/download/" + id + "?token=" + video.access_token,
          "website_url": process.env.HOST
        }
      } else {
        template = fs.readFileSync(path.join(__dirname, "/web/mail_custom.mustache"), "utf8")
        renderObj = {
          "ep_title": video.epTitle,
          "keeping_time": KEEPING_TIME,
          "video_link": process.env.HOST + "/download/" + id + "?token=" + video.access_token,
          "website_url": process.env.HOST
        }
      }

      getOption("SMTP_DOMAIN", (SMTP_DOMAIN) => {
        const mailOptions = {
          from: 'YouPod@' + SMTP_DOMAIN, // sender address
          to: video.email, // list of receivers
          subject: `Vidéo générée sur Youpod : ${ep_title}`, // Subject line
          html: mustache.render(template, renderObj)
        };
  
        getTransporter((transporter) => {
          transporter.sendMail(mailOptions, function (err, info) {
            if(err) return console.log(err)
          });
          
          if (video.googleToken != undefined) {
            yt.upload(video.googleToken, path.join(pathEvalute(process.env.EXPORT_FOLDER), `output_${video.id}.mp4`), video)
            video.googleToken = "deleted"
          }
    
          video.email = "deleted"
          video.save()
        })
      })
    })
  })
}

function getTransporter(cb) {
  getOption("MAIL_SERVICE", (MAIL_SERVICE) => {
    if (MAIL_SERVICE == "gmail") {
      getOption("GMAIL_ADDR", (GMAIL_ADDR)=> {
        getOption("GMAIL_PWD", (GMAIL_PWD) => {
          transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: GMAIL_ADDR,
                pass: GMAIL_PWD
              }
          });

          cb(transporter)
        })
      })
    } else {
      getOption("SMTP_HOST", (SMTP_HOST) => {
        getOption("SMTP_PORT", (SMTP_PORT) => {
          getOption("SMTP_USERNAME", (SMTP_USERNAME) => {
            getOption("SMTP_PASSWORD", (SMTP_PASSWORD) => {
              transporter = nodemailer.createTransport({
                host: SMTP_HOST,
                port: SMTP_PORT,
                secure: false, // upgrade later with STARTTLS
                auth: {
                  user: SMTP_USERNAME,
                  pass: SMTP_PASSWORD
                }
              });

              cb(transporter)
            })
          })
        })
      })
    }
  })
}

function pathEvalute(arg_path) {
	if (path.isAbsolute(arg_path)) {
		return arg_path
	} else {
		return path.join(__dirname, arg_path)
	}
}

function getOption(option, cb) {
  bdd.Option.findByPk(option).then((option) => {
    cb(option.value)
  })
}

// error handler
app.use(function (err, req, res, next) {
  if (err.code !== 'EBADCSRFTOKEN') return next(err)

  // handle CSRF token errors here
  template = fs.readFileSync(path.join(__dirname, "/web/error.mustache"), "utf8")
      
  var render_object = {
    "err_message": "Vous avec un mauvais CSRF token, merci de recharger la page avant de soummetre à nouveau ce formulaire!"
  }

  res.setHeader("content-type", "text/html");
  res.send(mustache.render(template, render_object))
})

//Ouverture du serveur Web sur le port définit dans les variables d'environnement
app.listen(process.env.PORT, () => console.log(`Serveur lancé sur le port ${process.env.PORT}`))