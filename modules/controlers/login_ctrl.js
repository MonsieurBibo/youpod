const fs = require('fs');
const path = require("path");
const mustache = require("mustache");
const utils = require("../utils")

module.exports = {
    login: (req, res, next) => {
        template = fs.readFileSync(path.join(__dirname, "../../web/login.mustache"), "utf8")

        var render_object = {
          "msg": req.session.message,
          "csrfToken": req.csrfToken,
          "cb": req.query.return
        }
      
        res.setHeader("content-type", "text/html");
        res.send(mustache.render(template, render_object, partials))
	},
	authenticate: (req, res, next) => {
		if (req.body.password != undefined) {
			utils.get_option("GEN_PWD", (GEN_PWD) => {
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
						res.redirect(req.body.return)
					} else {
						res.redirect("/")
					}
					})
				}
			})
		} else {
			res.redirect("/login")
		}
	},
	check_logged: (req, res, next) => {
		utils.get_option("GEN_PWD", (GEN_PWD) => {
			if (GEN_PWD == "") {
				next()
			} else {
				if (req.session.logged != undefined) {
					next()
				} else {
					res.redirect("/login?return=" + req.path)
				}
			}
		})
	}
}