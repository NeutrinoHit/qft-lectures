# qft-lectures

Материалы курса по квантовой теории поля.

## Сборка

```bash
make site
```

Готовый сайт записывается в `_site/`.

## Структура лекций

HTML-страницы курсов и отдельных лекций лежат в корне проекта:

```text
index.qmd
scalar-qed-attraction-repulsion.qmd
```

Самостоятельные мини-курсы получают собственную папку с `index.qmd`. Например:

```text
unruh/index.qmd
unruh/ru/slides/
```

Одиночные RevealJS-лекции лежат в языковых папках, а слайды мини-курса —
внутри его папки:

```text
en/slides/
unruh/ru/slides/
```

Общие настройки RevealJS задаются в metadata-файлах соответствующего языка:

```text
en/slides/_metadata.yml
unruh/ru/slides/_metadata.yml
```

Новые слайды нужно добавлять как `<course>/<lang>/slides/<NN_slug>.qmd`, не копируя
в каждый файл тему, footer, MathJax, размеры слайда и базовые параметры
RevealJS. Локальные настройки в самом `.qmd` допустимы только для специфики
конкретной лекции: заголовок, язык, короткий CSS для особых блоков, параметры
execute.

Медиафайлы конкретной лекции кладутся в:

```text
<course>/<lang>/slides/assets/<NN_lecture_slug>/
```

Крупные OJS-, JavaScript-, HTML- и CSS-фрагменты также хранятся в этой папке
и подключаются в лекцию через `{{< include ... >}}`, чтобы основной QMD
оставался конспектом слайдов.

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
сборки сайта. После изменения канонического footer или логотипа
синхронизируйте копии командой из `neutrinohit-map`:

```bash
python scripts/sync_reveal_assets.py
```
