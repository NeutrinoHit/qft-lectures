.PHONY: site

site:
	quarto render
	find _site -type f -name '*.qmd' -delete
