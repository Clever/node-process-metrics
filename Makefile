# usage:
# `make` or `make test` runs all the tests
# `make successful_run` runs just that test
.PHONY: test clean test-cov

TESTS=$(shell cd test && ls *.js | sed s/\.js$$// | grep -v migration)

all: test

test: $(TESTS)

$(TESTS):
	NODE_ENV=test node_modules/mocha/bin/mocha --reporter spec --ignore-leaks --bail --timeout 180000 test/$@.js

clean:
	rm -rf lib-js lib-js-cov

test-cov:
	jscoverage lib lib-cov
	mkdir lib-cov/ps_md5
	cp lib/ps_md5/md5.js lib-cov/ps_md5/md5.js
	DEBUG=* NODE_ENV=test TEST_COV_CLEVER_DB=1 node_modules/mocha/bin/mocha -R html-cov --timeout 60000 test/ | tee coverage.html
	open coverage.html
