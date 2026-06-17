.PHONY: help bootstrap install init serve build image set-key

help:
	@echo "Article Generator Skill — make targets:"
	@echo "  make bootstrap New machine: install + set up content/ + build snapshot"
	@echo "                 (wraps ./bootstrap.sh; pass CONTENT=<git-url> for a specific repo)"
	@echo "  make install   Install deps (Quill, Turndown) and build the export snapshot"
	@echo "  make init      Create the content/ folder skeleton (BRAIN, drafts, images, …)"
	@echo "                 or clone yours:  make init CONTENT=<git-url>"
	@echo "  make set-key   Store your ContentMaschine API key user-level (once per machine)"
	@echo "  make serve     Run the local edit/save server at http://localhost:4321"
	@echo "  make build     Rebuild drafts-data.js (static file:// export page)"
	@echo "  make image PROMPT=\"<prompt>\" ARTICLE=<NN|slug> [IMAGE=<selfie>] [VARIABILITY=1-5] [OUT=name.png]"
	@echo "                 Generate a 16:9 cover (model 'pro'). With IMAGE: you in the scene."
	@echo "                 Tip: the export page (make serve) has the same generator + a gallery."

bootstrap:
	./bootstrap.sh $(CONTENT)

install:
	npm install

init:
	node tools/init-content.js $(CONTENT)

set-key:
	node tools/set-key.js $(if $(KEY),--key $(KEY),)

serve:
	npm run serve

build:
	npm run build-export

image:
	node tools/cm-image.js --prompt "$(PROMPT)" --article "$(ARTICLE)" \
		$(if $(IMAGE),--image "$(IMAGE)",) $(if $(VARIABILITY),--variability $(VARIABILITY),) $(if $(OUT),--out $(OUT),)
