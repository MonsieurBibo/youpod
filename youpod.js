const fs = require('fs');
const path = require("path");
const mustache = require("mustache");
const Parser = require("rss-parser");
const download = require('download');
const { spawn } = require('child_process');
const express = require('express')
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
const session = require('express-session');
const csurf = require('csurf')
const bdd = require(__dirname + "/models/index.js")

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

// Routes API
app.post("/api/video", m.api_ctrl.add_video);
app.get("/api/video/:id", m.api_ctrl.get_video);
app.get("/api/feed", m.api_ctrl.feed)

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