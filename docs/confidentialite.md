# Confidentialité

Le principe de base de Youpod est de stocker le moins d'informations sensibles afin de limiter les risques de fuites de données.

## Vos donnés

### Avant/durant la génération

Sont stockés :

- L'adresse de votre flux RSS
- Votre adresse email
- Le guid
- Les autres informations fournies durant le formulaire
- Si vous choisissez de publier sur Youtube, le code d'accès (pas le mot de passe) renvoyé par l'API de Google

### Après la génération

Sont supprimés :

- Votre adresse email
- Le code d'accès renvoyé par l'API de Google

Les flux RSS et les autres informations sont conservées à des fins d'analyses d'utilisation du service.

## Utilisation des donnés Google

En utilisant la connexion avec Youtube sur Youpod, votre vidéo sera automatiquement exportée sur Youtube à la fin de la génération. C'est la seule méthode qu'utilise Youpod pour le moment avec l'API de Google.

Au niveau de la sauvegarde des données, votre code d'accès (qui doit être à nouveau validé avant de pouvoir faire quoi que ce soit), est stocké dans notre base de donnée uniquement le temps de la génération de la vidéo, après quoi il est automatiquement supprimé.

## Informations

Youpod est développé par [Bigaston](https://twitter.com/Bigaston), avec l'aide de [Phil](https://twitter.com/phil_goud) et de [Pof](https://twitter.com/PofMagicfingers).

L'instance principale de Youpod, [app.youpod.io](https://app.youpod.io) est hébergée sur un serveur Kimsufi soutenu par le financement de [Podshows](https://podshows.fr/);