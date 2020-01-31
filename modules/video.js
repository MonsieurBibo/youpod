const bdd = require("../../models/index.js")
const Op = bdd.Sequelize.Op;
const fs = require('fs');
const path = require("path");
const utils = require("./utils")
const getMP3Duration = require('get-mp3-duration')
const generation = require("./generation")
const mustache = require("mustache");

function generate_image(string, video, audio, title) {
    console.log(video.id + " Génération de l'image");
    
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
        await page.screenshot({path: path.join(__dirname, "../tmp/", `overlay_${video.id}.png`), omitBackground: true});
        
        await browser.close();
        console.log(video.id + " Image générée!")

        downloadAudio(video, audio, title)
    })();
}


function downloadAudio(video, audio_url, ep_title) {
    console.log(video.id + " Démarage du téléchargement")
    utils.check_if_mp3(audio_url, utils.send_error_mail, {url: audio_url, content: video}, () => {
        download(audio_url).then(data => {
            fs.writeFileSync(path.join(__dirname, `/tmp/audio_${video.id}.mp3`), data);
            console.log(video.id + " Fichier téléchargé!");
            generateVideo(video, ep_title);
        });
    })  
}

function generateVideo(video, ep_title) {
    console.log(video.id + " Démarage de la génération de la vidéo")
  
    duration = Math.trunc(getMP3Duration(fs.readFileSync(path.join(__dirname, "../tmp/", `audio_${video.id}.mp3`)))/1000) + 1
  
    var ol = spawn("ffmpeg", ["-y", "-loop", 1, "-i", `../tmp/overlay_${id}.png`, "-filter_complex", "overlay", "-vcodec", "libvpx-vp9", "-i", "../assets/loop.webm", "-t", 20, "-r", 60, "-ss", 0.1, `../tmp/loop_${video.id}.mp4`])
    
    ol.stdout.on('data', function (data) {
        console.log(video.id + ' stdout: ' + data);
    });
  
    ol.stderr.on('data', function (data) {
        console.log(video.id + ' stderr: ' + data);
    });
  
    ol.on('close', function (code) {
        var child = spawn("ffmpeg", ["-y", "-stream_loop", -1, "-i", `../tmp/loop_${video.id}.mp4`, "-i", `../tmp/audio_${video.id}.mp3`, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-shortest", "-map", "0:v", "-map", "1:a", `${process.env.EXPORT_FOLDER}/output_${video.id}.mp4`]);
    
        child.stdout.on('data', function (data) {
            console.log(video.id + ' stdout: ' + data);
        });
        
        child.stderr.on('data', function (data) {
            console.log(video.id + ' stderr: ' + data);
        });
        
        child.on('close', function (code) {
            console.log(video.id + " Vidéo générée!")
            video.status = "finished"
            video.end_timestamp = Date.now()
            video.save().then(() => {
                fs.unlinkSync(path.join(__dirname, "../tmp/", `overlay_${video.id}.png`))
                fs.unlinkSync(path.join(__dirname, "../tmp/", `audio_${video.id}.mp3`))
                fs.unlinkSync(path.join(__dirname, "../tmp/", `loop_${video.id}.mp4`))
            
                sendMail(video, ep_title);
                generation.init_new_generation()
            })
        });
    });
}

function sendMail(video, ep_title) {
    utils.get_option("KEEPING_TIME", (KEEPING_TIME) => { 
        if (video.rss != "__custom__") {
            template = fs.readFileSync(path.join(__dirname, "../web/mail.mustache"), "utf8")
            renderObj = {
                "rss_link": video.rss,
                "keeping_time": KEEPING_TIME,
                "epTitle": ep_title,
                "video_link": process.env.HOST + "/download/" + id + "?token=" + video.access_token,
                "website_url": process.env.HOST
            }
        } else {
            template = fs.readFileSync(path.join(__dirname, "../web/mail_custom.mustache"), "utf8")
            renderObj = {
                "ep_title": video.epTitle,
                "keeping_time": KEEPING_TIME,
                "video_link": process.env.HOST + "/download/" + id + "?token=" + video.access_token,
                "website_url": process.env.HOST
            }
        }

        utils.get_option("SMTP_DOMAIN", (SMTP_DOMAIN) => {
            const mailOptions = {
                from: 'YouPod@' + SMTP_DOMAIN, // sender address
                to: video.email, // list of receivers
                subject: `Vidéo générée sur Youpod : ${ep_title}`, // Subject line
                html: mustache.render(template, renderObj)
            };
        
            utils.get_transporter((transporter) => {
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
}

module.exports = {
    check_if_exist: (req, res, cb) => {
        bdd.Video.findOne({where: {email: req.body.email, rss: req.body.rss, guid: guid, status: {[Op.or] : ["waiting", "during", "finished"]}}}).then((video) => {
            if (video == null) {
                cb();
            } else {
                template = fs.readFileSync(path.join(__dirname, "../web/error.mustache"), "utf8")
            
                var render_object = {
                    "err_message": "Cette vidéo est déjà dans la liste d'attente!"
                }
                
                res.setHeader("content-type", "text/html");
                res.send(mustache.render(template, render_object))
            }
        })
    },
    check_if_exist_custom: (req, res, cb) => {
        bdd.Video.findOne({where: {email: req.body.email, epTitle: req.body.epTitle, epImg: req.body.imgURL, audioURL: req.body.audioURL, status: {[Op.or] : ["waiting", "during", "finished"]}}}).then((video) => {
            if (video == null) {
                cb();
            } else {
                template = fs.readFileSync(path.join(__dirname, "../web/error.mustache"), "utf8")
            
                var render_object = {
                    "err_message": "Cette vidéo est déjà dans la liste d'attente!"
                }
                
                res.setHeader("content-type", "text/html");
                res.send(mustache.render(template, render_object))
            }
        })
    },
    start_generation: (id) => {
        console.log(id + " Démarage de la création");
        bdd.Video.findByPk(id).then((video) => {
            if (video.template != null && video.template != "") {
              template = video.template
            } else {
              template = fs.readFileSync(path.join(__dirname, "/template/default.mustache"), "utf8");
            }

            if (video.feed != "__custom__") {
                // Si la vidéos est à base d'un flux RSS
                parser.parseURL(video.feed, (err, lFeed) => {
                    console.log(id + " Récupération du flux")
                    feed = lFeed

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
                  
                    generate_image(string, video, feed.items[i].enclosure, feed.items[i].title);
                })
            } else {
                // Si la vidéos est personalisée
                var renderObj = {
                    "imageURL": video.epImg,
                    "epTitle": video.epTitle,
                    "podTitle": video.podTitle,
                    "podSub": video.podSub,
                    "font": video.font,
                    "font_url": video.font.replace(/ /g, "+")
                }
              
                string = mustache.render(template, renderObj);
              
                generate_image(string, video, video.audioURL, video.epTitle);
            }

        })
    }
}