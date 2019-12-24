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

require('dotenv').config()

var app = express()

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
  res.send(mustache.render(template, render_object))
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
  res.send(mustache.render(template, render_object))
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

    keys.forEach((k) => {
      bdd.Option.update({value: req.body[k]}, {
        where: {
          key: k
        }
      }).then(() => {
        res.redirect("/admin")
      })
    })
  } else {
    res.status(403)
  }
})

app.get("/admin/queue", (req, res) => {
  if (req.session.loggin_admin != undefined) {
    bdd.Video.findAll({where: {status: "waiting"}, order: [["priority", "DESC"], ["id", "ASC"]]}).then((videos) => {
      returnObj = {queue: []}

      for (i = 0; i < videos.length; i++) {
        o = {
          title: videos[i].epTitle,
          email: videos[i].email,
          rss: videos[i].rss,
          priority: videos[i].priority,
          id: videos[i].id
        }

        returnObj.queue.push(o)
      }

      res.header("Access-Control-Allow-Origin", process.env.HOST);
      res.header("Access-Control-Allow-Methods", "GET");
      res.header("Access-Control-Allow-Headers", req.header('access-control-request-headers'));
      res.status(200).json(returnObj)
    })
  } else {
    res.status(403)
  }
})

app.get("/admin", (req, res) => {
  if (req.session.loggin_admin != undefined) {
    template = fs.readFileSync(path.join(__dirname, "/web/admin.mustache"), "utf8")

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
                getOption("MAX_DURING_PREVIEW", (MAX_DURING_PREVIEW) => {
                  getOption("KEEPING_TIME", (KEEPING_TIME) => {
                    getOption("GMAIL_ADDR", (GMAIL_ADDR) => {
                      getOption("GMAIL_PWD", (GMAIL_PWD) => {
                        getOption("GEN_PWD", (GEN_PWD) => {
                          getOption("API_PWD", (API_PWD) => {
                            var render_object = {
                              nb_gen_video: nb_gen_video,
                              nb_save_video: nb_save_video,
                              nb_waiting_video: nb_waiting_video,
                              nb_rss_feed: nb_rss_feed,
                              size_export_folder: size_export_folder,
                              MAX_DURING: MAX_DURING,
                              MAX_DURING_PREVIEW: MAX_DURING_PREVIEW,
                              KEEPING_TIME: KEEPING_TIME,
                              GMAIL_ADDR: GMAIL_ADDR,
                              GMAIL_PWD: GMAIL_PWD,
                              GEN_PWD: GEN_PWD,
                              API_PWD: API_PWD
                            }
                          
                            res.setHeader("content-type", "text/html");
                            res.send(mustache.render(template, render_object))
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

app.get("/preview", csrfProtection, (req, res) => {
  getOption("GEN_PWD", (GEN_PWD) => { 
    getOption("KEEPING_TIME", (KEEPING_TIME) => {
      if (GEN_PWD == "") {
        bdd.Preview.count({
          where: {
            [Op.or]: [{status: "waiting"}, {status: "during"}]
          }
        }).then((nb) => {
          template = fs.readFileSync(path.join(__dirname, "/web/preview.mustache"), "utf8")
    
          var render_object = {
            "waiting_list": nb,
            "keeping_time": KEEPING_TIME,
            "csrfToken": req.csrfToken
          }
        
          res.setHeader("content-type", "text/html");
          res.send(mustache.render(template, render_object))
        })
    
      } else {
        if (req.session.logged != undefined) {
          bdd.Preview.count({
            where: {
              [Op.or]: [{status: "waiting"}, {status: "during"}]
            }
          }).then((nb) => {
            template = fs.readFileSync(path.join(__dirname, "/web/preview.mustache"), "utf8")
      
            var render_object = {
              "waiting_list": nb,
              "keeping_time": KEEPING_TIME,
              "csrfToken": req.csrfToken
            }
          
            res.setHeader("content-type", "text/html");
            res.send(mustache.render(template, render_object))
          })
        } else {
          res.redirect("/login?return=preview")
        }
      }
    })
  })

})

app.get("/custom", csrfProtection, (req, res) => {
  getOption("GEN_PWD", (GEN_PWD) => {
    getOption("KEEPING_TIME", (KEEPING_TIME) => {
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
            "csrfToken": req.csrfToken
          }
        
          res.setHeader("content-type", "text/html");
          res.send(mustache.render(template, render_object))
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
              "csrfToken": req.csrfToken
            }
          
            res.setHeader("content-type", "text/html");
            res.send(mustache.render(template, render_object))
          })
        } else {
          res.redirect("/login?return=custom")
        }
      }
    })
  })
})

app.get("/", csrfProtection, (req, res) => {
  getOption("GEN_PWD", (GEN_PWD) => {
    getOption("KEEPING_TIME", (KEEPING_TIME) => {
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
            "csrfToken": req.csrfToken
          }
        
          res.setHeader("content-type", "text/html");
          res.send(mustache.render(template, render_object))
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
              "csrfToken": req.csrfToken
            }
          
            res.setHeader("content-type", "text/html");
            res.send(mustache.render(template, render_object))
          })
        } else {
          res.redirect("/login")
        }
      }
    })
   })
})

app.get("/download/preview/:id", (req, res) => {
  if (req.query.token != undefined) {
    bdd.Preview.findByPk(req.params.id).then((preview) => {
      if (req.query.token != preview.access_token) {
        res.status(403).send("Vous n'avez pas accès à cette preview")
      } else {
        if (preview.status == 'finished') {
          res.download(path.join(pathEvalute(process.env.EXPORT_FOLDER), `preview_${vpreviewideo.id}.mp4`), `youpod_preview_${preview.end_timestamp}.mp4`)
        } else if (preview.status == 'deleted') {
          res.status(404).send("Cette vidéo à été supprimée du site!")
        } else if (preview.status == 'during') {
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
            if (req.body.selectEp == undefined) {
              getLastGuid(req.body.rss, (guid)=> {
                checkIfExistVideo(req, res, guid, () => {
                  bdd.Video.create({
                    email: req.body.email,
                    rss: req.body.rss,
                    guid: guid,
                    template: req.body.template,
                    access_token: randtoken.generate(32),
                    font:req.body["font-choice"]
                  }).then((video) => {
                    initNewGeneration();
                    res.sendFile(path.join(__dirname, "/web/done.html"))
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
                  font:req.body["font-choice"]
                }).then((video) => {
                  initNewGeneration();
                  res.sendFile(path.join(__dirname, "/web/done.html"))
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
                      font:req.body["font-choice"]
                    }).then((video) => {
                      initNewGeneration();
                      res.sendFile(path.join(__dirname, "/web/done.html"))
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
                    font:req.body["font-choice"]
                  }).then((video) => {
                    initNewGeneration();
                    res.sendFile(path.join(__dirname, "/web/done.html"))
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

function getLastGuid(feed_url, __callback) {
  parser.parseURL(feed_url, (err, feed) => {
    __callback(feed.items[0].guid)
    
  })
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
            font: req.body["font-choice"]
          }).then((video) => {
            initNewGeneration();
            res.sendFile(path.join(__dirname, "/web/done.html"))  
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
              font: req.body["font-choice"]
            }).then((video) => {
              initNewGeneration();
              res.sendFile(path.join(__dirname, "/web/done.html"))  
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

app.post("/addvideopreview", csrfProtection, (req, res) => {
  getOption("GEN_PWD", (GEN_PWD) => { 
    if (GEN_PWD == "") {
      if (req.body.email != undefined && req.body.imgURL != undefined && req.body.epTitle != undefined && req.body.podTitle != undefined && req.body.audioURL != undefined && req.body.timestart != undefined) {
        if (req.body.color == undefined) {
          color = "blanc"
        } else {
          color = req.body.color
        }
  
        checkIfExistPreview(req, res, color, () => {
          bdd.Preview.create({
            email: req.body.email,
            access_token: randtoken.generate(32),
            epTitle: req.body.epTitle,
            podTitle: req.body.podTitle,
            imgLink: req.body.imgURL,
            audioLink: req.body.audioURL,
            startTime: req.body.timestart,
            color: color
          }).then((preview) => {
            initNewGeneration();
            res.sendFile(path.join(__dirname, "/web/done.html"))
          })
        })
      } else {
        res.status(400).send("Votre requète n'est pas complète...")
      }
    } else {
      if (req.session.logged != undefined) {
        if (req.body.email != undefined && req.body.imgURL != undefined && req.body.epTitle != undefined && req.body.podTitle != undefined && req.body.audioURL != undefined && req.body.timestart != undefined) {
          if (req.body.color == undefined) {
            color = "blanc"
          } else {
            color = req.body.color
          }
          
          checkIfExistPreview(req, res, color, () => {
            bdd.Preview.create({
              email: req.body.email,
              access_token: randtoken.generate(32),
              epTitle: req.body.epTitle,
              podTitle: req.body.podTitle,
              imgLink: req.body.imgURL,
              audioLink: req.body.audioURL,
              startTime: req.body.timestart,
              color: color
            }).then((preview) => {
              initNewGeneration();
              res.sendFile(path.join(__dirname, "/web/done.html"))
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

function checkIfExistPreview(req, res, color, cb) {
  bdd.Preview.findOne({where: {email: req.body.email, epTitle: req.body.epTitle, epImg: req.body.epImg, audioURL: req.body.audioURL, startTime: req.body.timestart, color: color, status: {[Op.or] : ["waiting", "during", "finished"]}}}).then((video) => {
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

  bdd.Preview.findAll({where: {status: "during"}}).then((previews) => {
    previews.forEach((p) => {
      generateImgPreview(p.id);
    })
  })

  initNewGeneration();
}

function flush() {
  bdd.Video.findAll({where: {status: "finished"}}).then((videos) => {
    if (videos.length >=1) {
      for (i = 0; i < videos.length; i++) {
        time = Date.now() - videos[i].end_timestamp
        time = time / (1000 * 60 * 60);
    
        getOption("KEEPING_TIME", (KEEPING_TIME) => {
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
        })
      }
    }
  })

  bdd.Preview.findAll({where: {status: "finished"}}).then((previews) => {
    if (previews.length >=1) {
      for (i = 0; i < previews.length; i++) {
        time = Date.now() - previews[i].end_timestamp
        time = time / (1000 * 60 * 60);
    
        if (time > process.env.KEEPING_TIME) {
          try {
            fs.unlinkSync(path.join(pathEvalute(process.env.EXPORT_FOLDER), `preview_${previews[i].id}.mp4`))
          } catch (err) {
            console.log(`Fichier preview_${previews[i].id}.mp4 déjà supprimé`)
          }

          previews[i].status = "deleted"
          previews[i].save()
          console.log("Flush preview " + previews[i].id)
    
        }
      }
    } 
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

  bdd.Preview.count({where: {status: "during"}}).then((nb) => {
    getOption("MAX_DURING_PREVIEW", ((MAX_DURING_PREVIEW) => {
      if (nb < MAX_DURING_PREVIEW) {
        bdd.Preview.findOne({where: {status: "waiting"}, order: [["priority", "DESC"], ["id", "ASC"]]}).then((preview) => {
          if (preview != null) {
            preview.status = "during"
            preview.save().then((preview) => {
              generateImgPreview(preview.id);
            })
          }
        })
      }
    }))
  })
}

function generateImgPreview(id) {
  console.log("Preview " + id + " Démarage de la création");

  bdd.Preview.findByPk(id).then((preview) => {
    var template = fs.readFileSync(path.join(__dirname, "/template/preview.mustache"), "utf8");

    var renderObj = {
      "imageURL": preview.imgLink,
      "epTitle": preview.epTitle,
      "podTitle": preview.podTitle
    }

    string = mustache.render(template, renderObj);

    console.log("Preview " + id + " Génération de l'image");
    
    (async () => {
      const browser = await puppeteer.launch({
        defaultViewport: {
          width: 1000,
          height: 1000
        },
        headless: true,
        args: ['--no-sandbox']
      });
      const page = await browser.newPage();
      await page.setContent(string);
      await page.screenshot({path: path.join(__dirname, "/tmp/", `preview_${id}.png`), omitBackground: true});
    
      await browser.close();
      console.log("Preview " + id + " Image générée!")

      downloadAudioPreview(id, preview.audioLink, preview.startTime, preview.color)
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

function downloadAudioPreview(id, audio_url, time, color) {
  console.log("Preview " + id + " Démarage du téléchargement")
  download(audio_url).then(data => {
    fs.writeFileSync(path.join(__dirname, `/tmp/preview_${id}.mp3`), data);
    console.log("Preview " + id + " Fichier téléchargé!");
    generateVideoPreview(id, time, color);
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

function generateVideoPreview(id, time, color) {
  console.log("Preview" + id + " Démarage de la génération de la vidéo")

  s = parseInt(time.split(":")[0] * 60) + parseInt(time.split(":")[1])

  var child = spawn("ffmpeg", ["-y", "-i", `./tmp/preview_${id}.png`, "-i", `./assets/${color}.mov`, "-filter_complex", 'overlay=0:0', "-ss", s, "-to", s + 20, "-i", `./tmp/preview_${id}.mp3`, "-shortest", "-acodec", "aac", `${process.env.EXPORT_FOLDER}/preview_${id}.mp4`]);

  child.stdout.on('data', function (data) {
    console.log("Preview " +id + ' stdout: ' + data);
  });

  child.stderr.on('data', function (data) {
    console.log("Preview " + id + ' stderr: ' + data);
  });

  child.on('close', function (code) {
    console.log("Preview " + id + " Vidéo générée!")
    bdd.Preview.update({ status: "finished", end_timestamp: Date.now() }, {
      where: {
        id: id
      }
    }).then(() => {
      fs.unlinkSync(path.join(__dirname, "/tmp/", `preview_${id}.png`))
      fs.unlinkSync(path.join(__dirname, "/tmp/", `preview_${id}.mp3`))
  
      sendMailPreview(id);
      initNewGeneration();
    });
  });
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

function sendMailPreview(id) {
  bdd.Preview.findByPk(id).then((preview) => {
    template = fs.readFileSync(path.join(__dirname, "/web/mail_custom.mustache"), "utf8")
    
    getOption("KEEPING_TIME", (KEEPING_TIME) => {
      renderObj = {
        "ep_title": preview.epTitle,
        "keeping_time": KEEPING_TIME,
        "video_link": process.env.HOST + "/download/preview/" + id + "?token=" + preview.access_token
      }
  
  
      const mailOptions = {
        from: 'youpod@balado.tools', // sender address
        to: preview.email, // list of receivers
        subject: `Vidéo générée sur Youpod!`, // Subject line
        html: mustache.render(template, renderObj)
      };

      getOption("GMAIL_ADDR", (GMAIL_ADDR)=> {
        getOption("GMAIL_PWD", (GMAIL_PWD) => {
          transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: GMAIL_ADDR,
                pass: GMAIL_PWD
              }
          });

          transporter.sendMail(mailOptions, function (err, info) {
            if(err) return console.log(err)
          });
      
          preview.email = "deleted"
          preview.save();
        })
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

      const mailOptions = {
        from: 'youpod@balado.tools', // sender address
        to: video.email, // list of receivers
        subject: `Vidéo générée sur Youpod : ${ep_title}`, // Subject line
        html: mustache.render(template, renderObj)
      };

      getOption("GMAIL_ADDR", (GMAIL_ADDR)=> {
        getOption("GMAIL_PWD", (GMAIL_PWD) => {
          transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: GMAIL_ADDR,
                pass: GMAIL_PWD
              }
          });

          transporter.sendMail(mailOptions, function (err, info) {
            if(err) return console.log(err)
          });
      
          video.email = "deleted"
          video.save()
        })
      })
      

    })
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