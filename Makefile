.PHONY: app_test pipeline_test

js-install:
	npm install

py-install:
	pip install -r requirements.txt

pipeline_test: # Test pipeline infrastructure
	npx prettier --write ./infra/src/lib/*.ts
	./node_modules/eslint/bin/eslint.js -c .eslintrc.json infra/src/lib/pipeline_build.ts

py_test: #Test lambda functions
	isort api/src/*.py
	flake8 api/src/
	cfn-lint template.yaml
	yamllint -c .yamllint.yml *.yml
	
run_test:
	npm run test

build-mealNotificationsLayer:
	mkdir -p "$(ARTIFACTS_DIR)/python"
	cp api/src/meal-send-notification.py "$(ARTIFACTS_DIR)/python"
	python -m pip install -r ./api/src/requirements.txt -t "$(ARTIFACTS_DIR)/python"

sam_bucket := meal-planner-demo-bucket
sam_package: #package sam application
	sam package --template-file template.yaml --s3-bucket ${sam_bucket} --output-template-file packaged-template.yaml



