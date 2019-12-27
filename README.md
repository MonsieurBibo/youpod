# YouPod

Pour commencer à programmer YouPod, nous sommes partis d'un constat : 
Il est difficile pour un néophyte d'exporter simplement son podcast en vidéo. 

S'il est possible d'utiliser les logiciels de montages classiques, il faut reconnaître que le réaliser "à la main", c'est long... 
Il existe des utilitaires en ligne, ou des hébergeurs de podcasts qui le proposent directement dans leurs offres (comme [Ausha](https://www.ausha.co/), ou [Acast Open](https://open.acast.com/)) mais tous sont payants.

En réalité, ce n'est pas très compliqué : Il suffit de prendre l'audio, et une image non? 

On a quand même ajouté une petite boucle vidéo derrière pour que ça ressemble un peu plus à quelque chose.

[![Demo](https://img.youtube.com/vi/Lpa5UtjI9NE/0.jpg)](https://www.youtube.com/watch?v=Lpa5UtjI9NE)

Source : https://robotsettondeuses.lepodcast.fr/



[![Demo](https://img.youtube.com/vi/H5IUxtKbapI/0.jpg)](https://www.youtube.com/watch?v=H5IUxtKbapI)

Source : https://aspacemr.lepodcast.fr/

L'idée de réaliser cet outil vient de [ce tuto d'Alliés Numériques](https://alliesnumeriques.org/tutoriels/publier-votre-podcast-sur-youtube-la-methode-classe-avec-ffmpeg/).

## Installation

**/!\ Si vous  voulez uniquement générer des vidéos, sans vous prendre la tête avec les installations, Podshows m'a permis d'héberger une instance publique de Youpod sur [app.youpod.io](https://app.youpod.io)**

Pour avoir votre propre instance de Youpod c'est simple : Il vous faudra simplement [NodeJS](https://nodejs.org/en/) (en version LTS). 
Une fois NodeJS installé, téléchargez le code, et installez les modules. 

Il est nécéssaire aussi d'avoir FFMPEG 4.2.x minimum. Verifiez en tapant dans un terminal
```ffmpeg -version```
Si ce n'est pas le cas, téléchargez-le ici : https://www.ffmpeg.org/download.html

Voici les commandes pour faire ça :
```shell
git clone https://github.com/Bigaston/youpod
cd youpod
npm install --unsafe-perm=true --allow-root
```

(Sur Windows la commande cd ne marchera pas, rendez vous simplement dans le dossier téléchargé, cliquez sur la barre d'adresse, écrivez `cmd` et vous aurez un terminal dans le bon dossier pour lancer `npm install`.

Ensuite il est très important de se rendre dans le fichier `/youpod/.env` ainsi généré, qui contiendra les informations essentielles à l'installation de votre site web.

```.env
PORT=5674                       # Le port de votre serveur
HOST=http://localhost:5674      # L'adresse à laquelle on pourra accèder à votre site
EXPORT_FOLDER=./video           # Le dossier où seront sauvegardés les vidéos
ADMIN_PWD=123456                # Le mot de passe du dashboard d'administration
GOOGLE_ID=liqusdhnqoi           # Votre client ID de l'API Youtube
GOOGLE_SECRET=qosidhqnpsodih    # Le code secret de l'API Youtube
```

Maintenant il ne vous reste plus qu'à lancer votre serveur avec

```shell
npm start
```

Et vous pourrez y accéder directement via un navigateur à l'adresse que vous avez configurée (par défaut, http://localhost:5674).

Maintenant il faut vous rendre sur votre site web, sur `/admin` pour terminer la configuration. Entrez votre mot de passe administrateur et descendez sur le bas de la page. Pensez à compléter tous les champs de vos options (sauf ceux facultatifs).

Pour plus d'information à propos de comment configurer votre compte email, allez voir dans [cet article du Wiki](https://github.com/Bigaston/youpod/wiki/Configurer-son-compte-mail) !

## Remerciement

Merci beaucoup à [Phil_Goud](https://twitter.com/Phil_Goud) qui m'a beaucoup aidé sur ce projet grâce entre autre aux vagues qu'il a généré et à toute l'interface qu'il a faite (vu que la mienne était un peu... bof?)

Merci à [Pof](https://twitter.com/PofMagicfingers) pour avoir boosté aux hormones notre commandes FFMPEG.

Si vous souhaitez me soutenir financièrement dans ce projet, vous pouvez passer par mon [Patreon](https://patreon.com/Bigaston) ou mon [uTip](https://utip.io/Bigaston) !

En cas de problème ou de questions, passez directement par les [Issues](https://github.com/Bigaston/youpod/issues) ou par [mon Twitter](https://twitter.com/Bigaston) !

