
# Color helpers
C_CYAN=\x1b[34;01m
C_RESET=\x1b[0m
VERSION=`node -e "process.stdout.write(require('./package.json').version)"`
HOMEPAGE=`node -e "process.stdout.write(require('./package.json').homepage)"`

# Group targets
all: deps lint test bundle
ci: lint test

# Install dependencies
deps:
	@echo "$(C_CYAN)> installing dependencies$(C_RESET)"
	@npm install

# Lint JavaScript
lint: jshint jscs

# Run JSHint
jshint:
	@echo "$(C_CYAN)> linting javascript$(C_RESET)"
	@./node_modules/.bin/jshint .

# Run JavaScript Code Style
jscs:
	@echo "$(C_CYAN)> checking javascript code style$(C_RESET)"
	@./node_modules/.bin/jscs .

# Run all tests
test: test-coverage

# Run unit tests
test-unit:
	@echo "$(C_CYAN)> running unit tests$(C_RESET)"
	@./node_modules/.bin/mocha ./test/unit --reporter spec --colors --recursive

# Run unit tests with coverage
test-coverage:
	@echo "$(C_CYAN)> running unit tests with coverage$(C_RESET)"
	@./node_modules/.bin/istanbul cover node_modules/mocha/bin/_mocha -- ./test/unit --reporter spec --recursive
	@./node_modules/.bin/istanbul check-coverage --statement 90 --branch 90 --function 90

# Bundle client-side JavaScript
bundle:
	@echo "$(C_CYAN)> bundling client-side JavaScript$(C_RESET)"
	@echo "/*! Varname $(VERSION) | $(HOMEPAGE) */" > build/varname.js
	@echo "/*! Varname $(VERSION) | $(HOMEPAGE) */" > build/varname.min.js
	@./node_modules/.bin/browserify ./lib/varname --standalone varname >> build/varname.js
	@./node_modules/.bin/browserify ./lib/varname --standalone varname | ./node_modules/.bin/uglifyjs >> build/varname.min.js
	@./node_modules/.bin/browserify ./test/unit/setup ./test/unit/lib/varname > build/test.js

.PHONY: test
