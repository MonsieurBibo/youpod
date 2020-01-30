const bdd = require("../../models/index.js")
const package = require("../../package.json")
const getSize = require('get-folder-size');
const fs = require('fs');
const path = require("path");
const mustache = require("mustache");
const utils = require("../utils")
const Op = bdd.Sequelize.Op;

module.exports = {
    check_logged: (req, res, next) => {
        if (req.session.loggin_admin != undefined) {
            next()
        } else {
            res.redirect("/admin/login")
        }
    },
    authenticate: (req, res, next) => {
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
        
    },
    login: (req, res, next) => {
        template = fs.readFileSync(path.join(__dirname, "../../web/login_admin.mustache"), "utf8")

        var render_object = {
          "msg": req.session.message,
          "csrfToken": req.csrfToken,
        }
      
        res.setHeader("content-type", "text/html");
        res.send(mustache.render(template, render_object, partials))
    },
    action: (req, res, next) => {
        if (req.body.action == "flush_video") {
            bdd.Video.findAll({where: {status: "finished"}}).then((videos) => {
                videos.forEach((v) => {
                    try {
                        fs.unlinkSync(path.join(utils.path_evalute(process.env.EXPORT_FOLDER), `output_${v.id}.mp4`))
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
    },
    prio: {
        social: (req, res, next) => {
            bdd.Social.update({priority: req.body.priority}, {
                where: {
                    id: req.params.id
                }
            }).then(() => {
                res.redirect("/admin")
            })
        },
        video: (req, res, next) => {
            bdd.Video.update({priority: req.body.priority}, {
                where: {
                    id: req.params.id
                }
            }).then(() => {
                res.redirect("/admin")
            })
        }
    },
    option: (req, res, next) => {
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
    },
    queue: (req, res, next) => {
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
    },
    index: (req, res, next) => {
        template = fs.readFileSync(path.join(__dirname, "../../web/admin.mustache"), "utf8")

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
            
                    getSize(utils.path_evalute(path.join("../", process.env.EXPORT_FOLDER)), (err, size) => {
                        if (err) { throw err; }
                    
                        size_export_folder = (size / 1024 / 1024).toFixed(2) + ' MB';
                        
                        bdd.Option.findAll().then(options => {
                            var render_object = {                                
                                nb_gen_social: nb_gen_social,
                                nb_gen_video: nb_gen_video,
                                nb_save_video: nb_save_video,
                                nb_waiting_video: nb_waiting_video,
                                nb_rss_feed: nb_rss_feed,
                                size_export_folder: size_export_folder,
                                youpod_version: package.version
                            }

                            options.forEach((o) => {
                                render_object[o.key] = o.value;
                            })

                            render_object.IS_GMAIL = render_object.MAIL_SERVICE == "gmail" ?  MAIL_SERVICE : undefined,
                            render_object.ENABLE_YOUTUBE = render_object.ENABLE_YOUTUBE == false ? undefined : render_object.ENABLE_YOUTUBE,
                            
                            res.setHeader("content-type", "text/html");
                            res.send(mustache.render(template, render_object, partials))
                        })
                    });
                })
                })
                })
            })
        })
    }
}