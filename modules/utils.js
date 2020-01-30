const path = require("path");
const bdd = require("../models/index.js")
const Parser = require("rss-parser");

var parser = new Parser();

module.exports = {
    path_evalute: (arg_path) => {
        if (path.isAbsolute(arg_path)) {
            return arg_path
        } else {
            return path.join(__dirname, arg_path)
        }
	},
	get_option: (option, cb) => {
		bdd.Option.findByPk(option).then((option) => {
		  cb(option.value)
		})
	},
	check_if_mp3: (url, redirectError, param, cb) => {
		getFinalURL(url, (true_url) => {
			fetch(true_url)
			.then((data) => {
				contentType = data.headers.get("content-type")
			
				if (contentType && contentType == "audio/mpeg") {
					cb()
				} else {
					redirectError(param)
				}
			})
				.catch(err => {
			})
		})
	},
	get_last_guid: (feed_url, guid, __callback) => {
		if (guid != undefined) {
			__callback(guid)
		} else {
			parser.parseURL(feed_url, (err, feed) => {
				__callback(feed.items[0].guid)
				
			})
		}
	},
	check_if_rss: (feed_url, __callback) => {
		parser.parseURL(feed_url, (err, feed) => {
			__callback(feed != undefined);
		})
	},
	send_error_page: (o) => {
		template = fs.readFileSync(path.join(__dirname, "/web/error.mustache"), "utf8")
	  
		var render_object = {
			"err_message": "L'audio que vous avez entré n'est pas un MP3"
		}
	  
		o.request.setHeader("content-type", "text/html");
		o.request.send(mustache.render(template, render_object))
	}
}

  
function getFinalURL(url, cb) {
	fetch(url)
	.then((data) => {
	  if (data.redirected) {
		getFinalURL(data.url, cb)
	  } else {
		cb(data.url)
	  }
	})
}