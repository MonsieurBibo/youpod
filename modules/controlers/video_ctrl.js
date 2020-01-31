const utils = require("../utils")
const bdd = require("../../models/index.js")
const fs = require('fs');
const path = require("path");
const mustache = require("mustache");
const Op = bdd.Sequelize.Op;
const generation = require("../generation")
const videoModule = require("../video")
const randtoken = require('rand-token');

module.exports = {
    index: (req, res, next) => {
        m.utils.get_option("KEEPING_TIME", (KEEPING_TIME) => {
            m.utils.get_option("GOOGLE_FONT_KEY", (GOOGLE_FONT_KEY) => {
                m.utils.get_option("ENABLE_YOUTUBE", (ENABLE_YOUTUBE) => {
                    bdd.Video.count({
                        where: {
                        [Op.or]: [{status: "waiting"}, {status: "during"}]
                        }
                    }).then((nb) => {
                        template = fs.readFileSync(path.join(__dirname, "../../web/index.mustache"), "utf8")
                    
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
                })
            })
        })
    },
    custom: (req, res, next) => {
        utils.get_option("KEEPING_TIME", (KEEPING_TIME) => {
            utils.get_option("GOOGLE_FONT_KEY", (GOOGLE_FONT_KEY) => {
                utils.get_option("ENABLE_YOUTUBE", (ENABLE_YOUTUBE) => {
                    bdd.Video.count({
                        where: {
                        [Op.or]: [{status: "waiting"}, {status: "during"}]
                        }
                    }).then((nb) => {
                        template = fs.readFileSync(path.join(__dirname, "../../web/custom.mustache"), "utf8")
                
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
                })
            })
        })
    },
    add: (req, res, next) => {
        if (req.body.email != undefined && req.body.rss != undefined) {
            utils.check_if_rss(req.body.rss, (is_rss) => {
                if (is_rss) {
                    utils.get_last_guid(req.body.rss, req.body.selectEp, (guid)=> {
                        videoModule.check_if_exist(req, res, guid, () => {
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
                                generation.init_new_generation();
                                res.sendFile(path.join(__dirname, "../../web/done.html"))
                                })
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
        if (req.body.email != undefined && req.body.imgURL != undefined && req.body.epTitle != undefined && req.body.podTitle != undefined && req.body.podSub != undefined && req.body.audioURL != undefined) {
            utils.check_if_mp3(req.body.audioURL, sendErrorPage, { request: res}, ()=> {
                videoModule.check_if_exist_custom(req, res, () => {
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
                        generation.init_new_generation();
                        res.sendFile(path.join(__dirname, "../../web/done.html"))
                        })
                    })
                })
            })
        } else {
            res.status(400).send("Votre requète n'est pas complète...")
        }
    }
}