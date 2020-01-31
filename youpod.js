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
const Op = bdd.Sequelize.Op;
const fetch = require('node-fetch');

require('dotenv').config()

const m = require("./modules")

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

app.use("/static", express.static('./web/static'));

var csrfProtection = csurf()

//Reprise des générations en cas d'erreur
m.generation.flush();
setInterval(m.generation.flush, 1000 * 60 * 15);
m.generation.restart_generation();
m.generation.init_new_generation();
 
var parser = new Parser();

// Routes Youtube
app.get("/yt/login", m.yt.login)
app.get("/yt/redirect", m.yt.redirect)

// Routes Connection
app.get("/login", csrfProtection, m.login_ctrl.login)
app.post("/authenticate", csrfProtection, m.login_ctrl.authenticate)

// Routes Admin
app.post("/admin/authenticate", csrfProtection, m.admin_ctrl.authenticate);
app.get("/admin/login", csrfProtection, m.admin_ctrl.login);
app.post("/admin/action", m.admin_ctrl.check_logged, m.admin_ctrl.action);
app.post("/admin/prio/social/:id", m.admin_ctrl.check_logged, m.admin_ctrl.prio.social);
app.post("/admin/prio/:id", m.admin_ctrl.check_logged, m.admin_ctrl.prio.video);
app.post("/admin/option", m.admin_ctrl.check_logged, m.admin_ctrl.option);
app.get("/admin/queue", m.admin_ctrl.check_logged, m.admin_ctrl.queue);
app.get("/admin", m.admin_ctrl.check_logged, m.admin_ctrl.index);

// Routes Social
app.post("/social/add", csrfProtection, m.login_ctrl.check_logged, m.social_ctrl.add)
app.post("/social/custom/add", csrfProtection, m.login_ctrl.check_logged, m.social_ctrl.add_custom);
app.get("/social/custom", csrfProtection, m.login_ctrl.check_logged, m.social_ctrl.custom);
app.get("/social", csrfProtection, m.login_ctrl.check_logged, m.social_ctrl.index);

// Routes Vidéo
app.post("/addvideo", csrfProtection, m.login_ctrl.check_logged, m.video_ctrl.add)
app.post("/addvideocustom", csrfProtection, m.login_ctrl.check_logged, m.video_ctrl.add_custom)
app.get("/custom", csrfProtection, m.login_ctrl.check_logged, m.video_ctrl.custom);
app.get("/", csrfProtection, m.login_ctrl.check_logged, m.video_ctrl.index);

// Routes Download
app.get("/download/social/:id", m.download_ctrl.social)
app.get("/download/:id", m.download_ctrl.video)

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

app.post("/api/video", (req, res) => {
  m.utils.get_option("API_PWD", (API_PWD) => {
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
  m.utils.get_option("API_PWD", (API_PWD) => { 
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
    
              m.utils.get_option("KEEPING_TIME", (KEEPING_TIME) => {
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
      img = feed.itunes.image ? feed.itunes.image : feed.image.url
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

function sendErrorMail(o) {
  template = fs.readFileSync(path.join(__dirname, "/web/mail_error.mustache"), "utf8")

  renderObj = {
    file_url : o.url,
    host_url: process.env.HOST
  }

  const mailOptions = {
    from: 'YouPod@youpod.io', // sender address
    to: o.content.email, // list of receivers
    subject: `Erreur lors de la génération!`, // Subject line
    html: mustache.render(template, renderObj)
  };

  getTransporter((transporter) => {
    transporter.sendMail(mailOptions, function (err, info) {
      if(err) return console.log(err)
    });

    if (o.content.constructor.name == "Video") {
      fs.unlinkSync(path.join(__dirname, "/tmp/", `overlay_${o.content.id}.png`))
    } else {
      fs.unlinkSync(path.join(__dirname, "/tmp/", `social_${o.content.id}.png`))
    }

    o.content.status = "error"
    o.content.email = "deleted"
    o.content.save();
  }) 
}

function downloadAudioSocial(id, audio_url) {
  console.log("Social " + id + " Démarage du téléchargement")
  bdd.Social.findByPk(id).then(social => {
    checkIfMP3(audio_url, sendErrorMail, {url: audio_url, content: social}, () => {
      download(audio_url).then(data => {
        fs.writeFileSync(path.join(__dirname, `/tmp/social_${id}.mp3`), data);
        console.log("Social " + id + " Fichier téléchargé!");
        generateVideoSocial(id);
      });
    })
  })
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
  bdd.Video.findByPk(id).then(video => {
    checkIfMP3(audio_url, sendErrorMail, {url: audio_url, content: video}, () => {
      download(audio_url).then(data => {
        fs.writeFileSync(path.join(__dirname, `/tmp/audio_${id}.mp3`), data);
        console.log(id + " Fichier téléchargé!");
        generateVideo(id, ep_title);
      });
    })  
  })
}

function generateVideoSocial(id) {
  console.log("Social" + id + " Démarage de la génération de la vidéo")

  bdd.Social.findByPk(id).then((social) => {
	splited = social.startTime.split(":")

	s = splited[0] * 3600 + splited[1] * 60 + parseInt(splited[2])

	var child = spawn("ffmpeg", ["-y", "-stream_loop", -1, "-i", `./tmp/social_${id}.png`, "-filter_complex", 'overlay', "-vcodec", "libvpx-vp9", "-stream_loop", -1, "-i", `./assets/bars.webm`, "-ss", s, "-i", `./tmp/social_${id}.mp3`, "-t", social.duration, "-map", "2:a", "-acodec", "aac", "-b:a", "192k", "-ac", "2", `${process.env.EXPORT_FOLDER}/social_${id}.mp4`]);
  
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
    var child = spawn("ffmpeg", ["-y", "-stream_loop", -1, "-i", `./tmp/loop_${id}.mp4`, "-i", `./tmp/audio_${id}.mp3`, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-shortest", "-map", "0:v", "-map", "1:a", `${process.env.EXPORT_FOLDER}/output_${id}.mp4`]);

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
    
    m.utils.get_option("KEEPING_TIME", (KEEPING_TIME) => {
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
    m.utils.get_option("KEEPING_TIME", (KEEPING_TIME) => { 
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

      m.utils.get_option("SMTP_DOMAIN", (SMTP_DOMAIN) => {
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
            yt.upload(video.googleToken, path.join(m.utils.path_evalute(process.env.EXPORT_FOLDER), `output_${video.id}.mp4`), video)
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
  m.utils.get_option("MAIL_SERVICE", (MAIL_SERVICE) => {
    if (MAIL_SERVICE == "gmail") {
      m.utils.get_option("GMAIL_ADDR", (GMAIL_ADDR)=> {
        m.utils.get_option("GMAIL_PWD", (GMAIL_PWD) => {
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
      m.utils.get_option("SMTP_HOST", (SMTP_HOST) => {
        m.utils.get_option("SMTP_PORT", (SMTP_PORT) => {
          m.utils.get_option("SMTP_USERNAME", (SMTP_USERNAME) => {
            m.utils.get_option("SMTP_PASSWORD", (SMTP_PASSWORD) => {
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