const fs = require("fs")
const path = require("path")
const sq = require('sqlite3');

console.log("Création des fichiers de base")

if (!fs.existsSync(path.join(__dirname, "/config.json"))) {
    fs.writeFileSync(path.join(__dirname, "/config.json"), `{
        "port": 5674,
        "max_during": 1,
        "max_during_preview": 1,
        "keeping_time": 12,
        "host": "http://localhost:5674",
        "mail": "youpod@example.com",
        "password": "your_password",
        "export_folder": "./video/",
        "gen_pwd": "",
        "api_pwd": "123456",
        "cookie_secret": "IDK"
    }`)
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