# qft-lectures

Материалы курса по квантовой теории поля.

## Структура лекций

HTML-страницы курсов и отдельных лекций лежат в корне проекта:

```text
index.qmd
unruh.qmd
scalar-qed-attraction-repulsion.qmd
```

RevealJS-слайды лежат в языковых папках:

```text
ru/slides/
en/slides/
```

Общие настройки RevealJS задаются в metadata-файлах соответствующего языка:

```text
ru/slides/_metadata.yml
en/slides/_metadata.yml
```

Новые слайды нужно добавлять как `<lang>/slides/<LectureName>.qmd`, не копируя
в каждый файл тему, footer, MathJax, размеры слайда и базовые параметры
RevealJS. Локальные настройки в самом `.qmd` допустимы только для специфики
конкретной лекции: заголовок, язык, короткий CSS для особых блоков, параметры
execute.

Медиафайлы конкретной лекции кладутся в:

```text
<lang>/slides/media/<lecture-slug>/
```

После добавления лекции обновите `index.qmd` и, если нужна отдельная страница
курса или лекции, добавьте корневой `<lecture-slug>.qmd`.

## Общий footer с логотипом и ссылками

RevealJS-слайды подключают общий footer через
`shared/reveal/neutrinohit-reveal-footer.js`. Канонический источник footer,
логотипа и ссылок на сайт, Telegram и YouTube живет в:

```text
../neutrinohit-map/assets/reveal/
```

Локальная копия в `qft-lectures/shared/reveal/` нужна для локального preview и
публикации GitHub Pages. После изменения канонического footer или логотипа
синхронизируйте копии командой из `neutrinohit-map`:

```bash
python scripts/sync_reveal_assets.py
```
