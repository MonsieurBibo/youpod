# Changelog
## Version 1.2
### Version 1.2.3
#### Corrections
- Bug dans la recherche dans le flux quand l'épisode ne contenait pas d'enclosure
- Corrections fautes dans le mail
- Correction temps démarage extrait

### Version 1.2.2
#### Ajouts
- Clé de l'API google sur l'admin
- Lecteur pour définir le début de l'extrait à l'oreille
- Social Custom
- Option de police déplacée dans option avancée
- Social sur le dashboard admin
- Un des slider a été masqué

#### Corrections
- Changement sur le mail pour les social
- Bug lors de la lecture de l'extrait

### Version 1.2.1
#### Ajouts
- Preview pour les réseaux sociaux à partir du flux RSS

### Version 1.2.0
#### Ajouts
- Choix du service d'email entre SMTP et Gmail

## Version 1.1.0
#### Ajouts
- Changement au niveau de la gestion de la base de donnée vers Sequelize
- Ajout d'un panel d'administration
  - Configuration des options du site
  - Liste des vidéos en attentes et en traitement
  - Statistiques
- Page d'explication en cas de mauvais CSRF
- Sécurité anti spam (CSRF et vérification de certains paramètres de duplication)
- Footer définit grâce à un partial
- Ajout de l'upload directement sur Youtube
  - Activable/désactivable depuis l'admin
  - Configuration des clés d'accès dans le .env
  - Génération automatique du titre et de la description
  - Connection via le compte Google
  - Ajout d'une politique de confidentialité

#### Correction
- Définition du transporteur NodeMailer juste avant l'envoit du mail
- Clé d'API de Google Font Personalisable