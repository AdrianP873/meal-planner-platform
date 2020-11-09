.PHONY: app_test pipeline_test

app_test: py_test cfn_lint

pipeline_test: # Test pipeline infrastructure
	#npm run test
	npx prettier --write ./infra/lib/*.ts

py_test: #Test lambda functions
	isort src/api/*.py
	flake8 src/api/
	cfn-lint template.yaml

run_test:
	npm run test

sam_bucket := meal-planner-demo-bucket
sam_package: #package sam application
	sam package --template-file template.yaml --s3-bucket sam_bucket --output-template-file packaged-template.yaml



