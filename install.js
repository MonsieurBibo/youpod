const fs = require("fs")
const path = require("path")
const sq = require('sqlite3');

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

if (!fs.existsSync(path.join(__dirname, "/base.db"))) {
    sq.verbose();
    var db = new sq.Database(__dirname + "/base.db");
    db.run(`CREATE TABLE "video" (
        "id"	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "email"	TEXT NOT NULL,
        "rss"	TEXT NOT NULL,
        "guid"	TEXT,
        "template"	TEXT,
        "access_token"	TEXT NOT NULL,
        "end_timestamp"	TEXT,
        "status"	TEXT NOT NULL DEFAULT 'waiting' CHECK(status in ("waiting","during","finished","deleted","error")),
        "font"	TEXT,
        "epTitle"	TEXT,
        "epImg"	TEXT,
        "podTitle"	TEXT,
        "podSub"	TEXT,
        "audioURL"	TEXT
    )`)

    db.run(`CREATE TABLE "preview" (
        "id"	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "email"	TEXT NOT NULL,
        "epTitle"	TEXT NOT NULL,
        "podTitle"	TEXT NOT NULL,
        "imgLink"	TEXT NOT NULL,
        "audioLink"	TEXT NOT NULL,
        "color"	TEXT CHECK(color in ('noir','gris','blanc','bleu','vert','jaune','orange','rouge','violet')),
        "startTime"	TEXT,
        "end_timestamp"	INTEGER,
        "access_token"	TEXT,
        "status"	TEXT DEFAULT "waiting" CHECK(status in ("waiting","during","finished","deleted","error"))
    )`)
}

if(!fs.existsSync(path.join(__dirname, "/video"))) {
    fs.mkdirSync(path.join(__dirname, "/video"))
}

if (!fs.existsSync(path.join(__dirname, "/tmp"))) {
    fs.mkdirSync(path.join(__dirname, "/tmp"))
}
console.log("L'instalation est terminée.")
console.log("Pensez aussi à éditer vos informations dans config.json")