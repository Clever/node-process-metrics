# usage:
# `make` or `make test` runs all the tests
# `make successful_run` runs just that test
.PHONY: test clean

TESTS=$(shell cd test && ls *.ts | sed s/\.ts$$// | grep -v migration)

all: test

test: $(TESTS)

$(TESTS):
	NODE_ENV=test node_modules/mocha/bin/mocha --compilers ts:ts-node/register --reporter spec --ignore-leaks --bail --timeout 180000 test/$@.ts

clean:
	rm -rf lib-js

build:
	node_modules/.bin/tsc
