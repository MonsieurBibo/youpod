module.exports = {
    login: (req, res, next) => {
        template = fs.readFileSync(path.join(__dirname, "/web/login.mustache"), "utf8")

        var render_object = {
          "msg": req.session.message,
          "csrfToken": req.csrfToken,
          "cb": req.query.return
        }
      
        res.setHeader("content-type", "text/html");
        res.send(mustache.render(template, render_object, partials))
    }
}