const fs = require('fs');
const {google} = require('googleapis');
const readline = require("readline")
const Parser = require("rss-parser");
const bdd = require("../models/index.js")

var parser = new Parser();

module.exports.login = (req, res, next) => {
	var oauth2Client;
	getOption("GOOGLE_ID", (GOOGLE_ID)=> {
		getOption("GOOGLE_SECRET", (GOOGLE_SECRET) => {
			oauth2Client = new google.auth.OAuth2(
				GOOGLE_ID,
				GOOGLE_SECRET,
				process.env.HOST + "/yt/redirect"
			  );
	
			const scopes = [
				'https://www.googleapis.com/auth/youtube.upload'
			];
			  
			const google_url = oauth2Client.generateAuthUrl({
				// 'online' (default) or 'offline' (gets refresh_token)
				access_type: 'offline',
			  
				// If you only need one scope you can pass it as a string
				scope: scopes
			});
			
			res.redirect(google_url);
		})
	})
}

module.exports.redirect = (req, res, next) => {
	req.session.google_code = req.query.code
	req.session.save((err) => {
	  res.redirect("/")
	})
}


module.exports.upload = function(yt_code, video_path, video) {
	console.log(video.id + " Mise en ligne sur Youtube")
	
	getOption("GOOGLE_ID", (GOOGLE_ID)=> {
		getOption("GOOGLE_SECRET", (GOOGLE_SECRET) => {
			oauth2User = new google.auth.OAuth2(
				GOOGLE_ID,
				GOOGLE_SECRET,
				process.env.HOST + "/yt/redirect"
			);
		
			oauth2User.getToken(yt_code).then((token) => {
				oauth2User.setCredentials(token.tokens)
		
				const youtube = google.youtube({
					version: 'v3',
					auth: oauth2User
				});
		
				vTitle = ""
				vDesc = ""
		
				if (video.rss == "__custom__") {
					vTitle = video.epTitle
					vDesc = video.podSub + "\n\n" + video.epTitle + " épisode de " + video.podTitle
		
					uploadVid()
				} else {
					parser.parseURL(video.rss, (err, feed) => { 
					i = 0;
					while(feed.items[i].guid != video.guid && i < feed.items.length) {
						i++;
					}
		
					vTitle = feed.items[i].title
					vDesc = feed.items[i].contentSnippet
		
					uploadVid()
					})
				}
		
				function uploadVid() {
					const fileSize = fs.statSync(video_path).size;
					youtube.videos.insert(
					{
						part: 'id,snippet,status',
						notifySubscribers: false,
						requestBody: {
						snippet: {
							title: vTitle,
							description: vDesc + "\n\n🎥 Vidéo générée avec Youpod : http://youpod.io",
						},
						status: {
							privacyStatus: 'private',
						},
						},
						media: {
						body: fs.createReadStream(video_path),
						},
					},
					{
						// Use the `onUploadProgress` event from Axios to track the
						// number of bytes uploaded to this point.
						onUploadProgress: evt => {
						const progress = (evt.bytesRead / fileSize) * 100;
						readline.clearLine(process.stdout, 0);
						readline.cursorTo(process.stdout, 0, null);
						process.stdout.write(`${Math.round(progress)}% complete`);
						},
					}
					).then((res) => {
					console.log(video.id + " Mise en ligne terminée!")
					});
				}
			})
		})
	})
}

function getOption(option, cb) {
	bdd.Option.findByPk(option).then((option) => {
	  cb(option.value)
	})
}