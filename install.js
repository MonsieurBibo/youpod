const fs = require("fs")
const path = require("path")
const db = require(__dirname + "/models/index.js")

console.log("Création des fichiers de base")

if (!fs.existsSync(path.join(__dirname, "/config.json"))) {
    fs.writeFileSync(path.join(__dirname, ".env"), `
PORT=5674                       # Le port de votre serveur
MAX_DURING=1                    # Le nombre de vidéos qui seront rendus en même temps
MAX_DURIN_PREVIEW=1             # Le nombre de preview pour les réseaux sociaux qui seront rendus en même temps
KEEPING_TIME=12                 # La durée au bout de laquelle les vidéos seront supprimés (en heure)
HOST=http://localhost:5674      # L'adresse à laquelle on pourra accèder à votre site
GMAIL_ADDR=someone@example.com  # L'adresse email de votre bot
GMAIL_PWD=123456                # Le mot de passe du compte Gmail de votre bot
EXPORT_FOLDER=./video           # Le dossier où seront sauvegardés les vidéos
GEN_PWD=                        # Le mot de passe pour accèder au site (vide pour désactiver)
API_PWD=123456                  # Le mot de passe d'accès à l'API
ADMIN_PWD=123456                # Le mot de passe du dashboard d'administration
COOKIE_SECRET=IDK               # Le mot de passe secret pour les cookies`)
}

db.sequelize.sync().then(() => {
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