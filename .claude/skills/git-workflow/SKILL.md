---
name: git-workflow
description: Règles Git du dépôt papillon-pronote pour Claude (commit avec l'identité Cyprien63, `git add .`, messages de commit en français, commits pertinents groupés). À suivre dès qu'un commit ou un push est demandé ou envisagé.
---

# Workflow Git — papillon-pronote

Ce skill encode la façon de committer et pousser sur le dépôt **papillon-pronote**.

## Identité Git

L'auteur des commits est toujours **Cyprien63**, avec une adresse **réellement
rattachée au compte GitHub** `cyprien63` (id 157894664) :

```
git config user.name  "Cyprien63"
git config user.email "p.cyprien6312@gmail.com"
```

C'est l'adresse déclarée sur le compte, et elle est déjà publique dans
`pages/mentions-legales.html`. Elle est aussi utilisée par les commits
existants sur `main`.

**L'email doit être nommé en clair, jamais décrit.** Une formule comme
« l'adresse liée au compte » invite à en inventer une : `cyprien@…` n'est
rattachée à aucun compte, et GitHub affiche alors les commits comme	pushés par
quelqu'un d'autre — ici un compte `cyprien` qui n'est pas toi.

Pour vérifier qu'une adresse est bien rattachée au bon compte avant de
committer :

```bash
curl -s "https://api.github.com/search/commits?q=author-email:<adresse>" \
  -H "Accept: application/vnd.github+json" | grep -oE '"login": *"[^"]*"' | head -1
```

Si l'adresse renvoie `cyprien63`, elle convient. Si elle renvoie un autre
login, ou **rien du tout** — c'est le cas d'une adresse inventée — les commits
ne seront pas attribués au compte. L'absence de sortie est le symptôme le plus
fréquent, parce qu'elle ne ressemble pas à une erreur.

Si l'identité globale de la machine n'est pas celle-ci, la forcer *par dépôt*
avec les deux commandes ci-dessus avant de committer.

## Commit

- Toujours **`git add .`** avant de committer (on indexe tout le répertoire).
- Vérifier l'état avant : `git status` et `git diff` pour relire ce qui va être indexé
  (ne jamais indexer de secrets ou de fichiers involontaires).
- Les messages de commit sont **en français**, concis et décrivent l'action faite
  (ex. « Restyle façon Papillon de la page Compte PRONOTE », « Bouton QR : ne colle
  plus au bord bas, aligné en bas à droite »). Style indicatif / impératif court.

## Rythme des commits

- **Autorisé à committer plusieurs fois sans demander la permission** : faire des
  commits **pertinents**, un par changement logique (une fonctionnalité, un fix,
  une refonte cohérente).
- **Ne PAS committer « à chaque modif »** : ne pas créer un commit par micro-étape
  ou par fichier modifié dans le vide ; regrouper les petites modifications liées
  dans le même commit thématique.
- Quand un commit touche plusieurs zones sans lien entre elles, les séparer en
  plusieurs commits (un par sujet).
- S'il y a plusieurs commits en attente, le travail peut être commité en plusieurs
  commits thématiques avant tout push.

## Push

- **Toujours demander l'autorisation avant de pousser** (`git push`), quel que soit
  le nombre de commits en attente.
- Ne jamais pousser sans que l'utilisateur ne l'ait demandé.
- Si l'utilisateur donne le feu vert, pousser la branche courante vers son remote
  (`git push origin <branche>`) et le lui confirmer.

## Règles d'or

1. Commit : `git add .` + message **en français**.
2. Identité : **Cyprien63**.
3. Plusieurs commits **thématiques** autorisés sans permission.
4. **Push uniquement sur demande explicite** de l'utilisateur.