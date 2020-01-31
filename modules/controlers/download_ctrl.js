const bdd = require("../../models/index.js")
const path = require("path");
const utils = require("../utils")

module.exports = {
    video: (req, res, next) => {
        if (req.query.token != undefined) {
            bdd.Video.findByPk(req.params.id).then((video) => {
                if (req.query.token != video.access_token) {
                    res.status(403).send("Vous n'avez pas accès à cette vidéo")
                } else {
                    if (video.status == 'finished') {
                        res.download(path.join(utils.path_evalute(process.env.EXPORT_FOLDER), `output_${video.id}.mp4`), `youpod_${video.end_timestamp}.mp4`)
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
    },
    social: (req, res, next) => {
        if (req.query.token != undefined) {
            bdd.Social.findByPk(req.params.id).then((social) => {
                if (req.query.token != social.access_token) {
                    res.status(403).send("Vous n'avez pas accès à cette vidéo pour réseaux sociaux")
                } else {
                    if (social.status == 'finished') {
                        res.download(path.join(utils.path_evalute(process.env.EXPORT_FOLDER), `social_${social.id}.mp4`), `youpod_social_${social.end_timestamp}.mp4`)
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
    }
}