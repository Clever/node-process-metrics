# usage:
# `make` or `make test` runs all the tests
# `make successful_run` runs just that test
.PHONY: test clean

all: test

test:
	npm run test

clean:
	rm -rf lib-js

build: clean
	npm run prepare
