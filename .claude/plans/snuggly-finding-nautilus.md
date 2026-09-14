# Plan : Corriger le rendu PRONOTE pour qu'il ressemble à Papillon

Contexte : L'utilisateur signale que le texte est trop foncé, qu'il n'y a pas assez de couleur, et que l'interface ne ressemble pas à l'application mobile Papillon (`papillon.bzh`).

Approche : Réécrire `content/pronote/pronote.css` avec des variables de design claires (vert `#29947A`, texte `#17302A`, fond `#F2F3F5`) et appliquer un style "mobile-like" (cartes blanches arrondies, ombres douces, texte aéré).

Fichiers : `content/pronote/pronote.css` (principal), `content/pronote/pronote.js` (non modifié — il injecte déjà les icônes).

Vérification : Charger l'extension Chrome → ouvrir PRONOTE → vérifier que le texte est lisible, que les widgets sont blancs avec bordures arrondies, que le bandeau est vert dégradé.
