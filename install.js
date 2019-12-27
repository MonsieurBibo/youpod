const fs = require("fs")
const path = require("path")
const db = require(__dirname + "/models/index.js")

console.log("Création des fichiers de base")

if (!fs.existsSync(path.join(__dirname, "/.env"))) {
    fs.writeFileSync(path.join(__dirname, ".env"), `
PORT=5674
HOST=http://localhost:5674
EXPORT_FOLDER=./video
ADMIN_PWD=123456
COOKIE_SECRET=IDK`)
}

db.sequelize.sync().then(()=> {
    console.log("Création des tables réussies!")
    db.Option.findOrCreate({where: {key: 'MAX_DURING'}, defaults: {value: '1'}}).then(() => {
        db.Option.findOrCreate({where: {key: 'MAX_DURING_PREVIEW'}, defaults: {value: '1'}}).then(() => {
            db.Option.findOrCreate({where: {key: 'KEEPING_TIME'}, defaults: {value: '12'}}).then(() => {
                db.Option.findOrCreate({where: {key: 'GMAIL_ADDR'}, defaults: {value: 'michel@example.com'}}).then(() => {
                    db.Option.findOrCreate({where: {key: 'GMAIL_PWD'}, defaults: {value: '123456'}}).then(() => {
                        db.Option.findOrCreate({where: {key: 'GEN_PWD'}, defaults: {value: ''}}).then(() => {
                            db.Option.findOrCreate({where: {key: 'API_PWD'}, defaults: {value: '123456'}}).then(() => {
                                db.Option.findOrCreate({where: {key: 'GOOGLE_FONT_KEY'}, defaults: {value: ''}})
                            })
                        })
                    })
                })
            })
        })
    })
}).catch(error => {
    console.log("Erreur lors de la création des tables!")
})

if(!fs.existsSync(path.join(__dirname, "/video"))) {
    fs.mkdirSync(path.join(__dirname, "/video"))
}

if (!fs.existsSync(path.join(__dirname, "/tmp"))) {
    fs.mkdirSync(path.join(__dirname, "/tmp"))
}
console.log("L'instalation est terminée.")
console.log("Pensez aussi à éditer vos informations dans config.json")