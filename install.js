const fs = require("fs")
const path = require("path")
const db = require(__dirname + "/models/index.js")

console.log("Création des fichiers de base")

if (!fs.existsSync(path.join(__dirname, "/config.json"))) {
    fs.writeFileSync(path.join(__dirname, ".env"), `
PORT=5674
MAX_DURING=1
MAX_DURIN_PREVIEW=1
KEEPING_TIME=12
HOST=http://localhost:5674
GMAIL_ADDR=someone@example.com
GMAIL_PWD=123456
EXPORT_FOLDER=./video
GEN_PWD=
API_PWD=123456
ADMIN_PWD=123456
COOKIE_SECRET=IDK`)
}

db.sequelize.sync().then(()=> {
    console.log("Création des tables réussies!")
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