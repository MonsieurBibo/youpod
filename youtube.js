const fs = require('fs');
const {google} = require('googleapis');
const readline = require("readline")
const Parser = require("rss-parser");

var parser = new Parser();

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_ID,
    process.env.GOOGLE_SECRET,
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

module.exports.google_url = google_url;

module.exports.upload = function(yt_code, video_path, video) {
  console.log(video.id + " Mise en ligne sur Youtube")
  oauth2User = new google.auth.OAuth2(
      process.env.GOOGLE_ID,
      process.env.GOOGLE_SECRET,
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
}