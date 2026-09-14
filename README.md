# Lastries

Registro personal de entrenamiento de fuerza y alimentación. PWA instalable que funciona sin conexión:
todos los datos se guardan en el dispositivo y se pueden exportar e importar en cualquier momento.

App: https://rafa-solvi.github.io/lastries/

## Desarrollo

Requiere Node 22.18 o posterior.

```bash
npm install
npm test          # tests de la lógica de cálculo
npm run dev       # servidor de desarrollo
npm run build     # build de producción en dist/ (incluye sw.js)
npm run preview   # sirve dist/ con el service worker activo
```

`npm run catalog` regenera el catálogo base de ejercicios desde
[free-exercise-db](https://github.com/yuhonas/free-exercise-db) (dominio público); el resultado ya está en
`public/catalog/`.

La especificación, el plan y las tareas están en `specs/001-gym-nutrition-tracker/` y los principios del
proyecto en `.specify/memory/constitution.md`.
