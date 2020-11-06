.PHONY: app_test pipeline_test

say_hello:
	@echo "Hello World"

app_test: py_test cfn_lint

pipeline_test: # Test pipeline infrastructure
	#npm run test
	npx prettier --write ./infra/lib/*.ts

py_test: #Test lambda functions
	isort src/api/*.py
	flake8 src/api/

cfn_lint:
	@echo "testing cfn"
#	cfn-lint validate *.yaml

run_test:
	npm run test

sam_bucket := meal-planner-demo-bucket
sam_package: #package sam application
	sam package --template-file template.yaml --s3-bucket sam_bucket --output-template-file packaged-template.yaml

	# pipeline builds (npm run build)
	# pipeline tests (eslint)
	# python tests (pylint, flake8)


