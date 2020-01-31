const path = require("path");
const bdd = require("../models/index.js")
const Parser = require("rss-parser");
const nodemailer = require("nodemailer");
const mustache = require("mustache");
const fetch = require('node-fetch');

var parser = new Parser();

module.exports = {
    path_evalute: (arg_path) => {
        if (path.isAbsolute(arg_path)) {
            return arg_path
        } else {
            return path.join(__dirname, arg_path)
        }
	},
	check_if_mp3: (url, redirectError, param, cb) => {
		getFinalURL(url, (true_url) => {
			fetch(true_url)
			.then((data) => {
				contentType = data.headers.get("content-type")
			
				if (contentType && contentType == "audio/mpeg") {
					cb()
				} else {
					redirectError(param)
				}
			})
				.catch(err => {
			})
		})
	},
	get_last_guid: (feed_url, guid, __callback) => {
		if (guid != undefined) {
			__callback(guid)
		} else {
			parser.parseURL(feed_url, (err, feed) => {
				__callback(feed.items[0].guid)
				
			})
		}
	},
	check_if_rss: (feed_url, __callback) => {
		parser.parseURL(feed_url, (err, feed) => {
			__callback(feed != undefined);
		})
	},
	send_error_page: (o) => {
		template = fs.readFileSync(path.join(__dirname, "/web/error.mustache"), "utf8")
	  
		var render_object = {
			"err_message": "L'audio que vous avez entré n'est pas un MP3"
		}
	  
		o.request.setHeader("content-type", "text/html");
		o.request.send(mustache.render(template, render_object))
	},
	send_error_mail: (o) => {
		template = fs.readFileSync(path.join(__dirname, "../web/mail_error.mustache"), "utf8")
	  
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
	  
		get_transporter((transporter) => {
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
	},
	get_option: get_option,
	get_transporter: get_transporter
}

function get_transporter (cb) {
	get_option("MAIL_SERVICE", (MAIL_SERVICE) => {
		if (MAIL_SERVICE == "gmail") {
			get_option("GMAIL_ADDR", (GMAIL_ADDR)=> {
				get_option("GMAIL_PWD", (GMAIL_PWD) => {
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
			get_option("SMTP_HOST", (SMTP_HOST) => {
				get_option("SMTP_PORT", (SMTP_PORT) => {
					get_option("SMTP_USERNAME", (SMTP_USERNAME) => {
						get_option("SMTP_PASSWORD", (SMTP_PASSWORD) => {
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

function get_option(option, cb) {
	bdd.Option.findByPk(option).then((option) => {
	  cb(option.value)
	})
}
  
function getFinalURL(url, cb) {
	fetch(url)
	.then((data) => {
	  if (data.redirected) {
		getFinalURL(data.url, cb)
	  } else {
		cb(data.url)
	  }
	})
}