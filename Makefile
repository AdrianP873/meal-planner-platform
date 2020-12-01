.PHONY: app_test pipeline_test

js-install:
	npm install

py-install:
	pip install -r requirements.txt

pipeline_test: # Test pipeline infrastructure
	npx prettier --write ./infra/src/lib/*.ts
	./node_modules/eslint/bin/eslint.js -c .eslintrc.json infra/src/lib/pipeline_build.ts

py_test: #Test lambda functions
	isort src/api/*.py
	flake8 src/api/
	cfn-lint template.yaml
	yamllint -c .yamllint.yml *.yml
	
run_test:
	npm run test

sam_bucket := meal-planner-demo-bucket
sam_package: #package sam application
	sam package --template-file template.yaml --s3-bucket ${sam_bucket} --output-template-file packaged-template.yaml



