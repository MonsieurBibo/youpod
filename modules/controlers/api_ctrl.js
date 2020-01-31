const utils = require("../utils")
const bdd = require("../../models/index.js")
const generation = require("../generation")

module.exports = {
    get_video: (req, res, next) => {
        utils.get_option("API_PWD", (API_PWD) => { 
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
                    
                            utils.get_option("KEEPING_TIME", (KEEPING_TIME) => {
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
    },
    add_video: (req, res, next) => {
        utils.get_option("API_PWD", (API_PWD) => {
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
                                generation.init_new_generation();
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
    },
    feed: (req, res, next) => {
        utils.check_if_rss(req.query.url, (is_feed) => {
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
    }
}